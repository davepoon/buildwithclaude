#!/usr/bin/env python3
"""
quality_check.py — 自动质检清单
================================
出图前自动检查常见问题，输出JSON质检报告 + 人类可读checklist。

检查项:
1. 分辨率检查：主图≥1000×1000，详情图≥1200×1600
2. 文字可读性：采样文字区域背景色和文字色，计算对比度
3. 品牌Logo检查：检测logo区域是否有非透明像素
4. 文件完整性：检查output_dir中是否有完整的11张图
5. 文字重叠检测：检查text_zones和product_bbox是否有重叠

用法:
  # 完整质检（读取plan.json + 检查成品图）
  python quality_check.py --plan /path/to/plan.json

  # 只检查文件完整性
  python quality_check.py --plan /path/to/plan.json --check-only files

  # 检查单张图片
  python quality_check.py --image /path/to/image.png --type main

  # 输出详细JSON报告
  python quality_check.py --plan /path/to/plan.json --format json --output report.json

依赖: Pillow (可选: numpy用于更精确的对比度检测)
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

from PIL import Image


# ============================================================================
# 常量
# ============================================================================

# 标准尺寸
MAIN_IMAGE_SIZE = (1000, 1000)
DETAIL_IMAGE_SIZE = (1200, 1600)
EXPECTED_MAIN_COUNT = 5
EXPECTED_DETAIL_COUNT = 6
EXPECTED_TOTAL = EXPECTED_MAIN_COUNT + EXPECTED_DETAIL_COUNT

# 对比度阈值（WCAG AA）
MIN_CONTRAST_RATIO = 4.5

# 允许的分辨率误差（像素）
RESOLUTION_TOLERANCE = 50


# ============================================================================
# 颜色工具
# ============================================================================

def relative_luminance(r: int, g: int, b: int) -> float:
    """计算RGB的相对亮度"""
    def linearize(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(c1: Tuple[int, int, int], c2: Tuple[int, int, int]) -> float:
    """计算两个RGB颜色的对比度"""
    l1 = relative_luminance(*c1)
    l2 = relative_luminance(*c2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def sample_region_avg(img: Image.Image, bbox: Tuple[int, int, int, int]) -> Tuple[int, int, int]:
    """采样区域平均颜色"""
    x1, y1, x2, y2 = bbox
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(img.width, x2), min(img.height, y2)
    if x2 <= x1 or y2 <= y1:
        return (128, 128, 128)
    region = img.crop((x1, y1, x2, y2)).convert("RGB")
    pixels = list(region.getdata())
    if not pixels:
        return (128, 128, 128)
    return (
        sum(p[0] for p in pixels) // len(pixels),
        sum(p[1] for p in pixels) // len(pixels),
        sum(p[2] for p in pixels) // len(pixels),
    )


# ============================================================================
# 检查器
# ============================================================================

class CheckResult:
    """单项检查结果"""
    def __init__(self, name: str, passed: bool, message: str,
                 severity: str = "info", details: Optional[Dict] = None):
        self.name = name
        self.passed = passed
        self.message = message
        self.severity = severity  # "error", "warning", "info"
        self.details = details or {}

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "severity": self.severity,
            "details": self.details,
        }


def check_resolution(image_path: str, image_type: str) -> CheckResult:
    """
    检查图片分辨率

    Args:
        image_path: 图片路径
        image_type: "main" 或 "detail"
    """
    try:
        img = Image.open(image_path)
        w, h = img.size
    except Exception as e:
        return CheckResult("分辨率检查", False, f"无法打开图片: {e}", "error")

    if image_type == "main":
        expected_w, expected_h = MAIN_IMAGE_SIZE
        name = "主图"
    else:
        expected_w, expected_h = DETAIL_IMAGE_SIZE
        name = "详情图"

    w_ok = w >= expected_w - RESOLUTION_TOLERANCE
    h_ok = h >= expected_h - RESOLUTION_TOLERANCE

    if w_ok and h_ok:
        return CheckResult(
            f"{name}分辨率检查", True,
            f"{w}×{h} ✅ (要求≥{expected_w}×{expected_h})"
        )
    else:
        return CheckResult(
            f"{name}分辨率检查", False,
            f"{w}×{h} ❌ (要求≥{expected_w}×{expected_h})",
            "error",
            {"actual": [w, h], "expected": [expected_w, expected_h]}
        )


def check_text_readability(image_path: str, text_zones: List[Dict],
                          text_colors: List[Tuple[int, int, int]]) -> CheckResult:
    """
    检查文字可读性（对比度）

    Args:
        image_path: 成品图路径
        text_zones: 文字区域列表 [{x1, y1, x2, y2}, ...]
        text_colors: 对应的文字颜色列表
    """
    if not text_zones:
        return CheckResult("文字可读性", True, "无文字区域，跳过检查")

    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        return CheckResult("文字可读性", False, f"无法打开图片: {e}", "error")

    issues = []
    min_ratio = float('inf')

    for i, zone in enumerate(text_zones):
        if isinstance(zone, dict) and "bbox" in zone:
            bbox = zone["bbox"]
        else:
            bbox = zone

        x1, y1 = bbox.get("x1", 0), bbox.get("y1", 0)
        x2, y2 = bbox.get("x2", img.width), bbox.get("y2", img.height)

        # 采样文字区域周围的背景色
        # 取文字区域上方和左方的背景
        sample_bboxes = [
            (max(0, x1 - 20), max(0, y1 - 20), x1, y1),  # 左上角外侧
            (x2, max(0, y1 - 20), min(img.width, x2 + 20), y1),  # 右上角外侧
        ]

        bg_colors = [sample_region_avg(img, sb) for sb in sample_bboxes]
        if not bg_colors:
            continue

        avg_bg = (
            sum(c[0] for c in bg_colors) // len(bg_colors),
            sum(c[1] for c in bg_colors) // len(bg_colors),
            sum(c[2] for c in bg_colors) // len(bg_colors),
        )

        text_color = text_colors[i] if i < len(text_colors) else (255, 255, 255)
        ratio = contrast_ratio(avg_bg, text_color)
        min_ratio = min(min_ratio, ratio)

        if ratio < MIN_CONTRAST_RATIO:
            issues.append({
                "zone_id": zone.get("id", f"zone_{i}"),
                "contrast_ratio": round(ratio, 2),
                "bg_color": avg_bg,
                "text_color": text_color,
                "minimum_required": MIN_CONTRAST_RATIO,
            })

    if issues:
        return CheckResult(
            "文字可读性", False,
            f"{len(issues)}个文字区域对比度不足 (最低: {min_ratio:.1f}:1, 要求≥{MIN_CONTRAST_RATIO}:1)",
            "warning",
            {"issues": issues}
        )

    return CheckResult(
        "文字可读性", True,
        f"所有文字区域对比度合格 (最低: {min_ratio:.1f}:1)"
    )


def check_logo_presence(image_path: str, logo_zone: Optional[Dict]) -> CheckResult:
    """
    检查Logo是否正确叠加

    Args:
        image_path: 成品图路径
        logo_zone: Logo区域 {x1, y1, x2, y2}
    """
    if not logo_zone:
        return CheckResult("Logo检查", True, "无Logo区域配置，跳过检查")

    try:
        img = Image.open(image_path).convert("RGBA")
    except Exception as e:
        return CheckResult("Logo检查", False, f"无法打开图片: {e}", "error")

    x1 = logo_zone.get("x1", 0)
    y1 = logo_zone.get("y1", 0)
    x2 = logo_zone.get("x2", img.width)
    y2 = logo_zone.get("y2", img.height)

    # 检查Logo区域是否有非白色/非透明像素
    region = img.crop((x1, y1, x2, y2))
    pixels = list(region.getdata())

    non_white_count = 0
    for p in pixels:
        if len(p) >= 4 and p[3] > 50:  # 有alpha
            if p[0] < 240 or p[1] < 240 or p[2] < 240:  # 非纯白
                non_white_count += 1
        elif len(p) < 4:
            if p[0] < 240 or p[1] < 240 or p[2] < 240:
                non_white_count += 1

    total_pixels = len(pixels)
    ratio = non_white_count / total_pixels if total_pixels > 0 else 0

    if ratio > 0.05:  # 至少5%的像素是Logo内容
        return CheckResult(
            "Logo检查", True,
            f"Logo区域检测到内容 ({ratio*100:.1f}%非背景像素)"
        )
    else:
        return CheckResult(
            "Logo检查", False,
            f"Logo区域几乎无内容 ({ratio*100:.1f}%非背景像素)，可能未叠加",
            "warning",
            {"zone": logo_zone, "non_bg_ratio": round(ratio, 4)}
        )


def check_file_completeness(output_dir: str, plan: Dict) -> CheckResult:
    """
    检查输出文件完整性

    Args:
        output_dir: 输出目录
        plan: plan.json数据
    """
    if not output_dir or not Path(output_dir).exists():
        return CheckResult("文件完整性", False, f"输出目录不存在: {output_dir}", "error")

    expected_files = []
    for img_cfg in plan.get("main_images", []):
        expected_files.append(f"{img_cfg['id']}.png")
    for img_cfg in plan.get("detail_images", []):
        expected_files.append(f"{img_cfg['id']}.png")

    missing = []
    present = []
    for f in expected_files:
        if Path(output_dir, f).exists():
            present.append(f)
        else:
            missing.append(f)

    if missing:
        return CheckResult(
            "文件完整性", False,
            f"缺少 {len(missing)}/{len(expected_files)} 张图",
            "error",
            {"missing": missing, "present": present}
        )

    return CheckResult(
        "文件完整性", True,
        f"全部 {len(expected_files)} 张图已生成"
    )


def check_text_product_overlap(plan_image: Dict) -> CheckResult:
    """
    检查文字区域与产品bbox是否重叠

    Args:
        plan_image: 单张图的plan配置
    """
    product_bbox = plan_image.get("product_bbox")
    text_zones = plan_image.get("text_zones", [])

    if not product_bbox:
        return CheckResult("文字避让", True, "无产品bbox，跳过检查")

    if not text_zones:
        return CheckResult("文字避让", True, "无text_zones配置，跳过检查")

    overlaps = []
    for zone in text_zones:
        zone_bbox = zone.get("bbox", {})
        if not zone_bbox:
            continue

        # 检查重叠
        x1 = max(product_bbox.get("x1", 0), zone_bbox.get("x1", 0))
        y1 = max(product_bbox.get("y1", 0), zone_bbox.get("y1", 0))
        x2 = min(product_bbox.get("x2", 0), zone_bbox.get("x2", 0))
        y2 = min(product_bbox.get("y2", 0), zone_bbox.get("y2", 0))

        if x2 > x1 and y2 > y1:
            overlap_area = (x2 - x1) * (y2 - y1)
            zone_area = (zone_bbox.get("x2", 0) - zone_bbox.get("x1", 0)) * \
                       (zone_bbox.get("y2", 0) - zone_bbox.get("y1", 0))
            if zone_area > 0:
                overlap_ratio = overlap_area / zone_area
                if overlap_ratio > 0.2:  # 超过20%面积重叠
                    overlaps.append({
                        "zone_id": zone.get("id", "unknown"),
                        "overlap_ratio": round(overlap_ratio, 3),
                        "overlap_area": overlap_area,
                    })

    if overlaps:
        return CheckResult(
            "文字避让", False,
            f"{len(overlaps)}个文字区域与产品区域重叠",
            "warning",
            {"overlaps": overlaps}
        )

    return CheckResult("文字避让", True, "文字区域与产品无重叠")


# ============================================================================
# 质检报告生成
# ============================================================================

def run_full_check(plan_path: str, check_type: Optional[str] = None) -> Dict:
    """
    运行完整质检

    Args:
        plan_path: plan.json路径
        check_type: 限定检查类型 ("files", "resolution", "readability", "logo", "overlap")

    Returns:
        质检报告dict
    """
    with open(plan_path, "r", encoding="utf-8") as f:
        plan = json.load(f)

    output_dir = plan.get("output_dir", "")
    results: List[CheckResult] = []

    all_images = []
    for kind, items in [("main", plan.get("main_images", [])),
                        ("detail", plan.get("detail_images", []))]:
        for img_cfg in items:
            all_images.append((kind, img_cfg))

    # 1. 文件完整性
    if not check_type or check_type == "files":
        results.append(check_file_completeness(output_dir, plan))

    # 逐图检查
    for kind, img_cfg in all_images:
        img_id = img_cfg.get("id", "unknown")
        img_path = str(Path(output_dir) / f"{img_id}.png")

        if not Path(img_path).exists():
            if not check_type or check_type == "resolution":
                results.append(CheckResult(
                    f"{img_id}分辨率", False,
                    "文件不存在，跳过检查", "error"
                ))
            continue

        # 2. 分辨率检查
        if not check_type or check_type == "resolution":
            results.append(check_resolution(img_path, kind))

        # 3. 文字可读性
        if not check_type or check_type == "readability":
            text_zones = img_cfg.get("text_zones", [])
            # 提取文字颜色
            text_colors = []
            for text_cfg in img_cfg.get("texts", []):
                color_str = text_cfg.get("color", "#FFFFFF")
                if isinstance(color_str, str):
                    c = color_str.lstrip("#")
                    if len(c) == 6:
                        text_colors.append((int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)))
                    else:
                        text_colors.append((255, 255, 255))
                else:
                    text_colors.append(tuple(color_str[:3]))

            results.append(check_text_readability(img_path, text_zones, text_colors))

        # 4. Logo检查
        if not check_type or check_type == "logo":
            brand_zones = img_cfg.get("brand_zones", {})
            logo_zone = brand_zones.get("logo")
            results.append(check_logo_presence(img_path, logo_zone))

        # 5. 文字重叠检测
        if not check_type or check_type == "overlap":
            results.append(check_text_product_overlap(img_cfg))

    # 生成报告
    report = {
        "timestamp": datetime.now().isoformat(),
        "plan_path": plan_path,
        "product": plan.get("product", {}).get("name", "unknown"),
        "total_checks": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "errors": sum(1 for r in results if not r.passed and r.severity == "error"),
        "warnings": sum(1 for r in results if not r.passed and r.severity == "warning"),
        "results": [r.to_dict() for r in results],
    }

    report["overall_pass"] = all(
        r.passed or r.severity != "error" for r in results
    )

    return report


def format_human_readable(report: Dict) -> str:
    """生成人类可读的质检清单"""
    lines = []
    lines.append("=" * 60)
    lines.append(f"📋 质检报告 — {report.get('product', 'unknown')}")
    lines.append(f"📅 {report.get('timestamp', '')}")
    lines.append("=" * 60)
    lines.append("")

    total = report.get("total_checks", 0)
    passed = report.get("passed", 0)
    failed = report.get("failed", 0)
    errors = report.get("errors", 0)
    warnings = report.get("warnings", 0)

    status_emoji = "✅" if report.get("overall_pass") else "⚠️"
    lines.append(f"总评: {status_emoji} {'通过' if report.get('overall_pass') else '有问题需关注'}")
    lines.append(f"检查项: {total} | 通过: {passed} | 失败: {failed} (错误: {errors}, 警告: {warnings})")
    lines.append("")
    lines.append("-" * 40)

    for r in report.get("results", []):
        icon = "✅" if r["passed"] else ("❌" if r["severity"] == "error" else "⚠️")
        lines.append(f"  {icon} {r['name']}: {r['message']}")

    lines.append("")
    lines.append("=" * 60)

    if not report.get("overall_pass"):
        lines.append("")
        lines.append("⚠️ 需要处理的问题:")
        for r in report.get("results", []):
            if not r["passed"] and r["severity"] == "error":
                lines.append(f"  ❌ {r['name']}: {r['message']}")
        lines.append("")
        lines.append("💡 建议:")
        if any("分辨率" in r["name"] for r in report["results"] if not r["passed"]):
            lines.append("  - 重新生成低分辨率的图片，确保主图≥1000×1000，详情图≥1200×1600")
        if any("文件完整性" in r["name"] for r in report["results"] if not r["passed"]):
            lines.append("  - 检查缺失的文件并重新渲染")
        if any("可读性" in r["name"] for r in report["results"] if not r["passed"]):
            lines.append("  - 为对比度不足的文字添加背景块或描边，或使用text_engine.py的自动可读性增强")
        if any("Logo" in r["name"] for r in report["results"] if not r["passed"]):
            lines.append("  - 检查Logo文件路径是否正确，或重新运行品牌叠加")

    return "\n".join(lines)


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="自动质检清单 — 电商素材一站式工坊",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 完整质检
  python quality_check.py --plan /path/to/plan.json

  # 只检查文件完整性
  python quality_check.py --plan /path/to/plan.json --check-only files

  # 检查单张图片
  python quality_check.py --image /path/to/image.png --type main

  # 输出JSON报告
  python quality_check.py --plan /path/to/plan.json --format json --output report.json

检查项:
  1. 分辨率检查：主图≥1000×1000，详情图≥1200×1600
  2. 文字可读性：对比度≥4.5:1 (WCAG AA)
  3. Logo检查：Logo区域是否有内容
  4. 文件完整性：11张图是否齐全
  5. 文字重叠：text_zones与product_bbox无重叠
        """
    )
    parser.add_argument("--plan", help="plan.json 路径")
    parser.add_argument("--image", help="检查单张图片")
    parser.add_argument("--type", choices=["main", "detail"], help="图片类型（配合--image使用）")
    parser.add_argument("--check-only", choices=["files", "resolution", "readability", "logo", "overlap"],
                       help="只运行特定检查")
    parser.add_argument("--format", default="text", choices=["text", "json"],
                       help="输出格式 (default: text)")
    parser.add_argument("--output", help="输出文件路径")

    args = parser.parse_args()

    if args.image:
        # 单图模式
        if not args.type:
            print("❌ 请指定 --type main 或 --type detail", file=sys.stderr)
            sys.exit(1)

        results = [check_resolution(args.image, args.type)]
        report = {
            "timestamp": datetime.now().isoformat(),
            "image": args.image,
            "total_checks": len(results),
            "passed": sum(1 for r in results if r.passed),
            "failed": sum(1 for r in results if not r.passed),
            "results": [r.to_dict() for r in results],
            "overall_pass": all(r.passed for r in results),
        }
    elif args.plan:
        report = run_full_check(args.plan, args.check_only)
    else:
        parser.print_help()
        sys.exit(0)

    # 输出
    if args.format == "json":
        output_str = json.dumps(report, ensure_ascii=False, indent=2)
    else:
        output_str = format_human_readable(report)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_str)
        print(f"📄 报告已保存到: {args.output}")
    else:
        print(output_str)

    # 退出码
    sys.exit(0 if report.get("overall_pass", True) else 1)


if __name__ == "__main__":
    main()
