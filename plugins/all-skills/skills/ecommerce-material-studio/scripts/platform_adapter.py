#!/usr/bin/env python3
"""
platform_adapter.py — 多平台尺寸适配引擎
==========================================
将已生成的成品图自动适配不同电商平台要求的尺寸规格。

核心功能:
1. 自动识别成品图中的主图(1:1)和详情图(3:4)
2. 按目标平台规格进行 resize/crop/pad
3. 支持三种适配模式：fit(等比+padding)、fill(等比+裁切)、stretch(拉伸)
4. 自动文件大小控制（超标时降低JPEG质量）
5. 输出适配报告JSON

Usage:
    python scripts/platform_adapter.py \\
        --input-dir <成品图目录> \\
        --platforms taobao,kuaishou,xiaohongshu,douyin,pinduoduo \\
        --output-dir <输出根目录> \\
        --resize-mode fit \\
        --bg-color "#ffffff"

依赖: Pillow
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from PIL import Image


# ============================================================================
# 平台尺寸规格
# ============================================================================

PLATFORM_SPECS: Dict[str, Dict[str, Any]] = {
    "taobao": {
        "name": "淘宝/天猫",
        "main_image": {"width": 800, "height": 800, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": "auto", "ratio": "3:4", "max_height": 1200},
        "long_detail": {"width": 790, "height": "auto", "ratio": "自由高度"},
        "max_file_size_kb": 500,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "kuaishou": {
        "name": "快手",
        "main_image": {"width": 800, "height": 800, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": 1000, "ratio": "3:4"},
        "max_file_size_kb": 500,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "xiaohongshu": {
        "name": "小红书",
        "main_image": {"width": 1080, "height": 1440, "ratio": "3:4"},
        "square_image": {"width": 1080, "height": 1080, "ratio": "1:1"},
        "detail_image": {"width": 1080, "height": 1440, "ratio": "3:4"},
        "max_file_size_kb": 5000,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "douyin": {
        "name": "抖音",
        "main_image": {"width": 800, "height": 800, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": 1000, "ratio": "3:4"},
        "max_file_size_kb": 500,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "pinduoduo": {
        "name": "拼多多",
        "main_image": {"width": 750, "height": 750, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": "auto", "ratio": "自由比例"},
        "max_file_size_kb": 300,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "jd": {
        "name": "京东",
        "main_image": {"width": 800, "height": 800, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": "auto", "ratio": "自由高度", "max_width": 1000},
        "max_file_size_kb": 500,
        "format": "jpg",
        "color_profile": "sRGB"
    },
    "wechat_shop": {
        "name": "微信小商店",
        "main_image": {"width": 750, "height": 750, "ratio": "1:1"},
        "detail_image": {"width": 750, "height": "auto", "ratio": "自由比例"},
        "max_file_size_kb": 500,
        "format": "jpg",
        "color_profile": "sRGB"
    }
}


# ============================================================================
# 图片分类
# ============================================================================

def classify_images(input_dir: Path) -> Dict[str, List[Path]]:
    """
    扫描输入目录，按图片比例分类为主图(1:1)和详情图(3:4)。

    Args:
        input_dir: 成品图所在目录

    Returns:
        {"main": [path, ...], "detail": [path, ...], "unknown": [path, ...]}
    """
    result: Dict[str, List[Path]] = {"main": [], "detail": [], "unknown": []}
    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}

    for f in sorted(input_dir.iterdir()):
        if f.suffix.lower() not in image_extensions:
            continue
        try:
            with Image.open(f) as img:
                w, h = img.size
                if w <= 0 or h <= 0:
                    result["unknown"].append(f)
                    continue

                ratio = w / h
                # 1:1 ± 10% 判定为主图
                if abs(ratio - 1.0) < 0.10:
                    result["main"].append(f)
                # 3:4(0.75) ± 10% 判定为详情图
                elif abs(ratio - 0.75) < 0.10:
                    result["detail"].append(f)
                # 4:3(1.33) ± 10% 也归为详情图（横版）
                elif abs(ratio - 1.33) < 0.10:
                    result["detail"].append(f)
                else:
                    result["unknown"].append(f)
        except Exception as e:
            print(f"  [WARN] 无法读取 {f.name}: {e}", file=sys.stderr)
            result["unknown"].append(f)

    return result


def get_image_type_from_filename(filename: str) -> Optional[str]:
    """
    从文件名推断类型（main_xx / detail_xx）。
    作为比例分类的补充。
    """
    name_lower = filename.lower()
    if "main" in name_lower:
        return "main"
    elif "detail" in name_lower:
        return "detail"
    return None


# ============================================================================
# 尺寸计算
# ============================================================================

def resolve_target_size(
    spec: Dict[str, Any],
    image_type: str,
    source_ratio: float
) -> Tuple[int, int]:
    """
    根据平台规格和图片类型，计算目标尺寸。

    Args:
        spec: 单个平台的规格定义（PLATFORM_SPECS中的值）
        image_type: "main" 或 "detail"
        source_ratio: 源图的宽高比

    Returns:
        (target_width, target_height)
    """
    if image_type == "main":
        key = "main_image"
        # 小红书的主图是3:4，需要匹配square_image
        if "square_image" in spec and spec["main_image"]["ratio"] == "3:4":
            key = "square_image"
    else:
        key = "detail_image"

    target_spec = spec.get(key)
    if target_spec is None:
        # 回退到main_image
        target_spec = spec.get("main_image", {})

    target_w = target_spec["width"]
    target_h = target_spec["height"]

    if target_h == "auto":
        # 自由高度模式：按源图比例计算，受max_height限制
        target_h = int(target_w / source_ratio) if source_ratio > 0 else target_w
        max_h = target_spec.get("max_height")
        if max_h and target_h > max_h:
            target_h = max_h
        # 自由比例模式也做宽度限制
        max_w = target_spec.get("max_width")
        if max_w and target_w > max_w:
            target_w = max_w
            target_h = int(target_w / source_ratio) if source_ratio > 0 else target_w

    return target_w, target_h


# ============================================================================
# 缩放模式实现
# ============================================================================

def resize_fit(
    img: Image.Image,
    target_w: int,
    target_h: int,
    bg_color: Tuple[int, int, int]
) -> Image.Image:
    """
    fit模式：等比缩放 + 白底/指定色padding到目标尺寸。
    保证图片完整显示，不裁切任何内容。
    """
    src_w, src_h = img.size
    # 计算等比缩放的scale
    scale = min(target_w / src_w, target_h / src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))

    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # 创建目标尺寸的背景画布
    canvas = Image.new("RGB", (target_w, target_h), bg_color)
    # 居中粘贴
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2

    if resized.mode == "RGBA":
        canvas.paste(resized, (paste_x, paste_y), resized)
    else:
        canvas.paste(resized, (paste_x, paste_y))

    return canvas


def resize_fill(
    img: Image.Image,
    target_w: int,
    target_h: int
) -> Image.Image:
    """
    fill模式：等比缩放 + 居中裁切到目标尺寸。
    填满目标区域，可能裁切边缘。
    """
    src_w, src_h = img.size
    # 计算填满的scale
    scale = max(target_w / src_w, target_h / src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))

    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # 居中裁切
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    cropped = resized.crop((left, top, left + target_w, top + target_h))

    return cropped


def resize_stretch(
    img: Image.Image,
    target_w: int,
    target_h: int
) -> Image.Image:
    """
    stretch模式：直接拉伸到目标尺寸（不推荐，但某些平台需要精确像素）。
    """
    return img.resize((target_w, target_h), Image.LANCZOS)


# ============================================================================
# 文件大小控制
# ============================================================================

def save_with_size_control(
    img: Image.Image,
    output_path: Path,
    max_size_kb: int,
    fmt: str = "jpg"
) -> int:
    """
    保存图片，如果文件超过max_size_kb则逐步降低JPEG质量。

    Args:
        img: PIL Image对象
        output_path: 输出路径
        max_size_kb: 最大文件大小(KB)
        fmt: 输出格式

    Returns:
        最终文件大小(字节)
    """
    # 确保是RGB模式（JPEG不支持RGBA）
    if img.mode == "RGBA":
        # 合成到白色背景
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    max_size_bytes = max_size_kb * 1024

    # 尝试不同质量等级
    quality_levels = [92, 85, 78, 70, 60, 50, 40]

    for quality in quality_levels:
        img.save(str(output_path), "JPEG", quality=quality, optimize=True)
        file_size = output_path.stat().st_size
        if file_size <= max_size_bytes:
            return file_size

    # 所有质量级别都超标，使用最低质量
    img.save(str(output_path), "JPEG", quality=quality_levels[-1], optimize=True)
    file_size = output_path.stat().st_size
    return file_size


# ============================================================================
# 核心适配流程
# ============================================================================

def adapt_image(
    img_path: Path,
    platform_key: str,
    image_type: str,
    output_dir: Path,
    resize_mode: str,
    bg_color: Tuple[int, int, int],
    max_size_kb: int
) -> Dict[str, Any]:
    """
    将单张图片适配到指定平台。

    Args:
        img_path: 源图片路径
        platform_key: 平台标识
        image_type: "main" 或 "detail"
        output_dir: 平台输出目录
        resize_mode: "fit" / "fill" / "stretch"
        bg_color: 背景色RGB元组
        max_size_kb: 最大文件大小(KB)

    Returns:
        适配报告字典
    """
    spec = PLATFORM_SPECS[platform_key]
    report: Dict[str, Any] = {
        "source_file": str(img_path),
        "platform": platform_key,
        "image_type": image_type,
        "resize_mode": resize_mode
    }

    try:
        with Image.open(img_path) as img:
            src_w, src_h = img.size
            report["source_size"] = f"{src_w}x{src_h}"
            source_ratio = src_w / src_h if src_h > 0 else 1.0

            # 计算目标尺寸
            target_w, target_h = resolve_target_size(spec, image_type, source_ratio)
            report["target_size"] = f"{target_w}x{target_h}"

            # 执行缩放
            if resize_mode == "fill":
                result = resize_fill(img, target_w, target_h)
            elif resize_mode == "stretch":
                result = resize_stretch(img, target_w, target_h)
            else:  # fit
                result = resize_fit(img, target_w, target_h, bg_color)

            # 输出文件名
            output_name = img_path.stem + "." + spec["format"]
            output_path = output_dir / output_name

            # 保存并控制文件大小
            final_size = save_with_size_control(
                result, output_path, max_size_kb, spec["format"]
            )
            report["output_file"] = str(output_path)
            report["final_size_bytes"] = final_size
            report["final_size_kb"] = round(final_size / 1024, 1)
            report["compliant"] = final_size <= max_size_kb * 1024

            final_w, final_h = result.size
            report["final_dimensions"] = f"{final_w}x{final_h}"

    except Exception as e:
        report["error"] = str(e)
        report["compliant"] = False

    return report


def adapt_for_platform(
    images: Dict[str, List[Path]],
    platform_key: str,
    output_dir: Path,
    resize_mode: str,
    bg_color: Tuple[int, int, int]
) -> List[Dict[str, Any]]:
    """
    将所有图片适配到单个平台。

    Args:
        images: classify_images的输出
        platform_key: 平台标识
        output_dir: 平台输出目录
        resize_mode: 缩放模式
        bg_color: 背景色

    Returns:
        该平台所有图片的适配报告列表
    """
    spec = PLATFORM_SPECS[platform_key]
    max_size_kb = spec["max_file_size_kb"]
    platform_output_dir = output_dir / platform_key
    platform_output_dir.mkdir(parents=True, exist_ok=True)

    reports: List[Dict[str, Any]] = []

    # 处理主图
    for img_path in images["main"]:
        report = adapt_image(
            img_path, platform_key, "main",
            platform_output_dir, resize_mode, bg_color, max_size_kb
        )
        reports.append(report)

    # 处理详情图
    for img_path in images["detail"]:
        report = adapt_image(
            img_path, platform_key, "detail",
            platform_output_dir, resize_mode, bg_color, max_size_kb
        )
        reports.append(report)

    # 处理未分类图片（按文件名推断）
    for img_path in images["unknown"]:
        inferred_type = get_image_type_from_filename(img_path.name)
        if inferred_type:
            report = adapt_image(
                img_path, platform_key, inferred_type,
                platform_output_dir, resize_mode, bg_color, max_size_kb
            )
            reports.append(report)
        else:
            # 默认当主图处理
            report = adapt_image(
                img_path, platform_key, "main",
                platform_output_dir, resize_mode, bg_color, max_size_kb
            )
            report["warning"] = "未识别图片类型，按主图处理"
            reports.append(report)

    return reports


# ============================================================================
# 颜色解析
# ============================================================================

def parse_color(color_str: str) -> Tuple[int, int, int]:
    """
    解析颜色字符串为RGB元组。
    支持: "#ffffff", "#fff", "255,255,255", "white"
    """
    color_str = color_str.strip()

    # hex格式
    if color_str.startswith("#"):
        hex_str = color_str[1:]
        if len(hex_str) == 3:
            hex_str = "".join(c * 2 for c in hex_str)
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16)
            g = int(hex_str[2:4], 16)
            b = int(hex_str[4:6], 16)
            return (r, g, b)

    # RGB格式
    if "," in color_str:
        parts = color_str.split(",")
        if len(parts) == 3:
            return tuple(int(p.strip()) for p in parts)

    # 预定义颜色
    color_map = {
        "white": (255, 255, 255),
        "black": (0, 0, 0),
        "gray": (128, 128, 128),
        "lightgray": (230, 230, 230),
    }
    return color_map.get(color_str.lower(), (255, 255, 255))


# ============================================================================
# 适配报告汇总
# ============================================================================

def generate_summary_report(
    all_reports: Dict[str, List[Dict[str, Any]]],
    platforms: List[str]
) -> Dict[str, Any]:
    """
    生成汇总适配报告。
    """
    summary = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "platforms": {},
        "overall": {
            "total_images": 0,
            "compliant_count": 0,
            "non_compliant_count": 0,
            "errors": []
        }
    }

    for platform_key in platforms:
        reports = all_reports.get(platform_key, [])
        spec = PLATFORM_SPECS.get(platform_key, {})

        platform_summary = {
            "platform_name": spec.get("name", platform_key),
            "total_images": len(reports),
            "compliant": sum(1 for r in reports if r.get("compliant")),
            "non_compliant": sum(1 for r in reports if not r.get("compliant")),
            "max_size_kb": spec.get("max_file_size_kb", 0),
            "images": []
        }

        for r in reports:
            img_info = {
                "source": Path(r["source_file"]).name,
                "type": r["image_type"],
                "target_size": r.get("target_size", "N/A"),
                "final_size_kb": r.get("final_size_kb", 0),
                "compliant": r.get("compliant", False)
            }
            if "error" in r:
                img_info["error"] = r["error"]
                summary["overall"]["errors"].append(
                    f"{platform_key}/{r['source_file']}: {r['error']}"
                )
            if "warning" in r:
                img_info["warning"] = r["warning"]
            platform_summary["images"].append(img_info)

        summary["platforms"][platform_key] = platform_summary
        summary["overall"]["total_images"] += platform_summary["total_images"]
        summary["overall"]["compliant_count"] += platform_summary["compliant"]
        summary["overall"]["non_compliant_count"] += platform_summary["non_compliant"]

    return summary


# ============================================================================
# CLI入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="多平台尺寸适配引擎 - 将成品图自动适配到各电商平台尺寸规格",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 适配到淘宝和快手
  python scripts/platform_adapter.py \\
      --input-dir ./output \\
      --platforms taobao,kuaishou \\
      --output-dir ./platform_output \\
      --resize-mode fit

  # 适配到全平台，用浅灰背景
  python scripts/platform_adapter.py \\
      --input-dir ./output \\
      --platforms taobao,kuaishou,xiaohongshu,douyin,pinduoduo \\
      --output-dir ./platform_output \\
      --resize-mode fill \\
      --bg-color "#f0f0f0"

支持平台: taobao, kuaishou, xiaohongshu, douyin, pinduoduo, jd, wechat_shop
        """
    )

    parser.add_argument(
        "--input-dir", required=True,
        help="成品图所在目录"
    )
    parser.add_argument(
        "--platforms", required=True,
        help="目标平台，逗号分隔。可选: taobao,kuaishou,xiaohongshu,douyin,pinduoduo,jd,wechat_shop"
    )
    parser.add_argument(
        "--output-dir", required=True,
        help="输出根目录（每个平台一个子目录）"
    )
    parser.add_argument(
        "--resize-mode", default="fit",
        choices=["fit", "fill", "stretch"],
        help="缩放模式: fit(等比+padding,默认), fill(等比+裁切), stretch(拉伸)"
    )
    parser.add_argument(
        "--bg-color", default="#ffffff",
        help='背景色，fit模式使用。支持 "#ffffff"、"white"、"255,255,255"，默认白色'
    )
    parser.add_argument(
        "--report", default=None,
        help="适配报告JSON输出路径（默认输出到 output-dir/adaptation_report.json）"
    )

    args = parser.parse_args()

    # 验证输入目录
    input_dir = Path(args.input_dir)
    if not input_dir.is_dir():
        print(f"[ERROR] 输入目录不存在: {input_dir}", file=sys.stderr)
        sys.exit(1)

    # 解析平台列表
    platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
    invalid = [p for p in platforms if p not in PLATFORM_SPECS]
    if invalid:
        print(f"[ERROR] 不支持的平台: {', '.join(invalid)}", file=sys.stderr)
        print(f"[INFO]  支持的平台: {', '.join(PLATFORM_SPECS.keys())}", file=sys.stderr)
        sys.exit(1)

    # 解析背景色
    bg_color = parse_color(args.bg_color)

    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 扫描和分类图片
    print(f"📂 扫描成品图目录: {input_dir}")
    images = classify_images(input_dir)
    print(f"   主图(1:1): {len(images['main'])} 张")
    print(f"   详情图(3:4): {len(images['detail'])} 张")
    if images["unknown"]:
        print(f"   未识别: {len(images['unknown'])} 张")

    if not images["main"] and not images["detail"] and not images["unknown"]:
        print("[ERROR] 未找到任何图片文件", file=sys.stderr)
        sys.exit(1)

    # 逐平台适配
    all_reports: Dict[str, List[Dict[str, Any]]] = {}

    for platform_key in platforms:
        platform_name = PLATFORM_SPECS[platform_key]["name"]
        print(f"\n🔄 适配到 [{platform_name}] ({platform_key})...")
        reports = adapt_for_platform(
            images, platform_key, output_dir, args.resize_mode, bg_color
        )
        all_reports[platform_key] = reports

        # 打印该平台结果
        compliant = sum(1 for r in reports if r.get("compliant"))
        print(f"   ✅ 完成: {len(reports)} 张图片, {compliant}/{len(reports)} 合规")
        for r in reports:
            status = "✅" if r.get("compliant") else "⚠️"
            size_info = f"{r.get('final_size_kb', '?')}KB"
            dim_info = r.get("final_dimensions", "?")
            err_info = f" ERROR: {r['error']}" if "error" in r else ""
            print(f"   {status} {Path(r['source_file']).name} → {dim_info} ({size_info}){err_info}")

    # 生成汇总报告
    summary = generate_summary_report(all_reports, platforms)
    report_path = args.report or str(output_dir / "adaptation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\n📊 适配报告已保存: {report_path}")

    # 汇总输出
    total = summary["overall"]["total_images"]
    compliant_total = summary["overall"]["compliant_count"]
    print(f"\n{'='*50}")
    print(f"📦 多平台适配完成")
    print(f"   总图片数: {total}")
    print(f"   合规数: {compliant_total}/{total}")
    if summary["overall"]["errors"]:
        print(f"   错误数: {len(summary['overall']['errors'])}")
        for err in summary["overall"]["errors"]:
            print(f"   ❌ {err}")
    print(f"   输出目录: {output_dir}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
