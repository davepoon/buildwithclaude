#!/usr/bin/env python3
"""
delivery_packager.py — 标准化交付打包器
========================================
将整个项目的产物标准化打包，自动生成使用指南和素材清单。

核心功能:
1. 扫描项目目录，识别各类产物（成品图/文案/布局方案/场景图/品牌素材）
2. 可选调用 platform_adapter.py 生成多平台版本
3. 生成标准化目录结构的使用指南和素材清单
4. 打包为zip文件交付

Usage:
    python scripts/delivery_packager.py \\
        --project-dir <项目目录> \\
        --brand <品牌名> \\
        --product-name <产品名称> \\
        --platforms taobao,kuaishou \\
        --output <输出zip路径> \\
        --include-copywriting \\
        --include-brand-assets \\
        --include-source

依赖: Pillow (可选), zipfile (标准库)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from PIL import Image


# ============================================================================
# 常量
# ============================================================================

# 平台中文名映射
PLATFORM_NAMES = {
    "taobao": "淘宝天猫",
    "kuaishou": "快手",
    "xiaohongshu": "小红书",
    "douyin": "抖音",
    "pinduoduo": "拼多多",
    "jd": "京东",
    "wechat_shop": "微信小商店",
}

# 各平台上传指引
PLATFORM_GUIDES = {
    "taobao": {
        "main_upload": "商品管理 → 主图 → 上传800×800主图（第一张建议白底）",
        "detail_upload": "商品详情 → 源码编辑 → 按顺序插入详情图片",
        "notes": [
            "主图第一张建议白底，审核通过率更高",
            "主图文件大小 < 500KB",
            "详情图宽度建议750px，单张高度不超过1200px",
            "标题复制使用指南中的SEO标题，注意不超过60字",
        ]
    },
    "kuaishou": {
        "main_upload": "商品发布 → 商品图片 → 上传800×800",
        "detail_upload": "商品详情 → 上传750×1000详情图",
        "notes": [
            "主图建议白底或浅色背景",
            "主图文件大小 < 500KB",
            "标题建议包含品牌名+核心关键词",
        ]
    },
    "xiaohongshu": {
        "main_upload": "发布笔记 → 上传图片（建议3:4竖图1080×1440）",
        "detail_upload": "详情页图使用1080×1440尺寸",
        "notes": [
            "小红书优先使用3:4竖版图，视觉冲击力更强",
            "首图决定点击率，选择最有吸引力的场景图",
            "文案使用copywriting.md中的小红书种草文案",
            "记得添加话题标签",
            "图片文件大小 < 5MB",
        ]
    },
    "douyin": {
        "main_upload": "商品发布 → 商品主图 → 上传800×800",
        "detail_upload": "商品详情 → 上传750×1000",
        "notes": [
            "主图800×800，文件大小 < 500KB",
            "短视频素材可使用口播文案",
            "直播话术参考copywriting.md中的直播部分",
        ]
    },
    "pinduoduo": {
        "main_upload": "商品管理 → 商品图片 → 上传750×750",
        "detail_upload": "商品详情 → 自由比例详情图",
        "notes": [
            "主图750×750，文件大小 < 300KB",
            "标题建议包含核心搜索关键词",
            "详情图宽度750px，高度自由",
            "拼多多用户重视性价比，标题和描述突出性价比",
        ]
    },
    "jd": {
        "main_upload": "商品管理 → 商品主图 → 上传800×800",
        "detail_upload": "商品详情 → 上传750宽详情图",
        "notes": [
            "主图800×800，文件大小 < 500KB",
            "京东审核严格，主图不能有牛皮癣（过多文字装饰）",
            "详情图宽度不超过1000px",
        ]
    },
    "wechat_shop": {
        "main_upload": "商品管理 → 主图 → 上传750×750",
        "detail_upload": "商品详情 → 自由比例详情图",
        "notes": [
            "主图750×750，文件大小 < 500KB",
            "适合微信生态内分享传播",
        ]
    },
}


# ============================================================================
# 产物扫描
# ============================================================================

def scan_project(project_dir: Path) -> Dict[str, Any]:
    """
    扫描项目目录，识别各类产物。

    Returns:
        {
            "main_images": [Path, ...],      # 主图(1:1)
            "detail_images": [Path, ...],    # 详情图(3:4)
            "other_images": [Path, ...],     # 其他图片
            "copywriting": Optional[Path],   # 文案文件
            "plan": Optional[Path],          # 布局方案
            "scenes_dir": Optional[Path],    # 场景图目录
            "brand_assets": [Path, ...],     # 品牌素材
            "quality_report": Optional[Path],# 质检报告
        }
    """
    result: Dict[str, Any] = {
        "main_images": [],
        "detail_images": [],
        "other_images": [],
        "copywriting": None,
        "plan": None,
        "scenes_dir": None,
        "brand_assets": [],
        "quality_report": None,
    }

    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}

    # 扫描output目录（成品图）
    output_dir = project_dir / "output"
    if output_dir.is_dir():
        for f in sorted(output_dir.iterdir()):
            if f.suffix.lower() not in image_extensions:
                continue
            try:
                with Image.open(f) as img:
                    w, h = img.size
                    ratio = w / h if h > 0 else 1.0
                    if abs(ratio - 1.0) < 0.10:
                        result["main_images"].append(f)
                    elif abs(ratio - 0.75) < 0.10 or abs(ratio - 1.33) < 0.10:
                        result["detail_images"].append(f)
                    else:
                        result["other_images"].append(f)
            except Exception:
                result["other_images"].append(f)

    # 如果output目录不存在，直接扫描项目根目录
    if not output_dir.is_dir():
        for f in sorted(project_dir.iterdir()):
            if f.suffix.lower() in image_extensions:
                try:
                    with Image.open(f) as img:
                        w, h = img.size
                        ratio = w / h if h > 0 else 1.0
                        if abs(ratio - 1.0) < 0.10:
                            result["main_images"].append(f)
                        elif abs(ratio - 0.75) < 0.10:
                            result["detail_images"].append(f)
                        else:
                            result["other_images"].append(f)
                except Exception:
                    result["other_images"].append(f)

    # 扫描文案文件
    for name in ["copywriting.md", "copywriting.txt"]:
        f = project_dir / name
        if f.is_file():
            result["copywriting"] = f
            break

    # 扫描布局方案
    for name in ["plan.json", "layout_plan.json"]:
        f = project_dir / name
        if f.is_file():
            result["plan"] = f
            break

    # 扫描场景图目录
    scenes_dir = project_dir / "scenes"
    if scenes_dir.is_dir():
        result["scenes_dir"] = scenes_dir

    # 扫描品牌素材
    brand_dir = project_dir / "brand_assets"
    if brand_dir.is_dir():
        for f in sorted(brand_dir.iterdir()):
            if f.is_file():
                result["brand_assets"].append(f)

    # 扫描质检报告
    for name in ["quality_report.json", "quality_summary.txt"]:
        f = project_dir / name
        if f.is_file():
            result["quality_report"] = f
            break

    return result


# ============================================================================
# 多平台适配调用
# ============================================================================

def run_platform_adapter(
    project_dir: Path,
    platforms: List[str],
    output_base: Path
) -> bool:
    """
    调用 platform_adapter.py 生成多平台版本。

    Args:
        project_dir: 项目目录
        platforms: 目标平台列表
        output_base: 适配输出基础目录

    Returns:
        是否成功
    """
    # 确定成品图目录
    output_dir = project_dir / "output"
    if not output_dir.is_dir():
        output_dir = project_dir

    # 定位platform_adapter.py
    adapter_path = Path(__file__).parent / "platform_adapter.py"
    if not adapter_path.is_file():
        print(f"[WARN] platform_adapter.py 不存在: {adapter_path}", file=sys.stderr)
        return False

    platform_output = output_base / "多平台适配"
    cmd = [
        sys.executable, str(adapter_path),
        "--input-dir", str(output_dir),
        "--platforms", ",".join(platforms),
        "--output-dir", str(platform_output),
        "--resize-mode", "fit",
    ]

    print(f"🔄 调用多平台适配引擎...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"[WARN] 平台适配失败: {result.stderr}", file=sys.stderr)
            return False
        print(result.stdout)
        return True
    except subprocess.TimeoutExpired:
        print("[WARN] 平台适配超时", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[WARN] 平台适配异常: {e}", file=sys.stderr)
        return False


# ============================================================================
# 文档生成
# ============================================================================

def generate_usage_guide(
    brand: str,
    product_name: str,
    scan_result: Dict[str, Any],
    platforms: Optional[List[str]],
    plan_data: Optional[Dict[str, Any]]
) -> str:
    """
    生成使用指南Markdown内容。
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    main_count = len(scan_result["main_images"])
    detail_count = len(scan_result["detail_images"])

    lines = [
        f"# {product_name} 电商素材使用指南\n",
        f"## 素材概览\n",
        f"| 项目 | 内容 |",
        f"|------|------|",
        f"| 品牌 | {brand} |",
        f"| 产品 | {product_name} |",
        f"| 生成日期 | {now} |",
        f"| 主图数量 | {main_count} 张 |",
        f"| 详情图数量 | {detail_count} 张 |",
    ]

    if platforms:
        platform_str = "、".join(PLATFORM_NAMES.get(p, p) for p in platforms)
        lines.append(f"| 适配平台 | {platform_str} |")

    lines.append("")

    # 各平台使用说明
    if platforms:
        lines.append("## 各平台使用说明\n")
        for platform_key in platforms:
            guide = PLATFORM_GUIDES.get(platform_key, {})
            platform_name = PLATFORM_NAMES.get(platform_key, platform_key)
            lines.append(f"### {platform_name}\n")
            if "main_upload" in guide:
                lines.append(f"**主图上传：** {guide['main_upload']}\n")
            if "detail_upload" in guide:
                lines.append(f"**详情图上传：** {guide['detail_upload']}\n")
            if guide.get("notes"):
                lines.append("**注意事项：**")
                for note in guide["notes"]:
                    lines.append(f"- {note}")
                lines.append("")
    else:
        # 没有指定平台时，给通用建议
        lines.append("## 通用上传建议\n")
        lines.append("1. **主图**：建议第一张使用白底图，审核通过率更高")
        lines.append("2. **详情图**：按顺序上传，第一张为情境开篇图")
        lines.append("3. **文件大小**：一般电商平台要求单张 < 500KB")
        lines.append("4. **图片格式**：统一使用 JPG 格式，兼容性最好")
        lines.append("")

    # 文案使用建议
    if scan_result.get("copywriting"):
        lines.extend([
            "## 文案使用建议\n",
            "- **商品标题**：直接复制 `文案素材/copywriting.md` 中的SEO标题，根据平台字数限制适当删减",
            "- **五点描述**：逐条复制到商品描述区域",
            "- **小红书文案**：完整复制到小红书笔记正文，记得保留emoji和话题标签",
            "- **短视频脚本**：参考口播文案录制短视频，注意控制60-90秒",
            "- **直播话术**：按开场→留人→逼单→促转化的节奏使用",
            "",
        ])

    # 修改建议
    lines.extend([
        "## 修改建议\n",
        "### 如需修改文字内容",
        "- 文字由 `text_engine.py` 渲染在图片上",
        "- 如需修改，请重新运行文字渲染流程或使用图片编辑工具覆盖",
        "- 建议保留原始PNG文件（如有源文件包），方便重新渲染",
        "",
        "### 如需更换场景背景",
        "- 场景底图保存在 `源文件/scenes/` 目录（如有）",
        "- 可重新生成场景底图后，用 `text_engine.py` 重新合成",
        "- 修改 `plan.json` 中的 `scene_prompt` 后重新走 Step 4 生图流程",
        "",
        "### 如需适配更多平台",
        "- 运行 `platform_adapter.py` 可快速生成其他平台尺寸",
        "```bash",
        "python scripts/platform_adapter.py \\",
        "    --input-dir <成品图目录> \\",
        "    --platforms douyin,pinduoduo \\",
        "    --output-dir <输出目录> \\",
        "    --resize-mode fit",
        "```",
        "",
    ])

    # 文件结构说明
    lines.extend([
        "## 素材包目录结构\n",
        "```",
        f"{product_name}_电商素材包/",
        "├── 使用指南.md          ← 你正在阅读的文件",
        "├── 素材清单.md          ← 所有文件清单+尺寸+大小",
        "├── 成品图/",
        "│   ├── 主图（1:1）/     ← 正方形主图",
        "│   └── 详情图（3:4）/   ← 竖版详情图",
    ])
    if platforms:
        lines.append("├── 多平台适配/          ← 各平台尺寸适配版本")
    if scan_result.get("copywriting"):
        lines.append("├── 文案素材/            ← 全平台文案素材")
    if scan_result.get("brand_assets"):
        lines.append("├── 品牌素材/            ← logo等品牌资源")
    lines.extend([
        "└── 源文件/              ← plan.json + 场景底图",
        "```",
        "",
        "---",
        f"*本素材包由电商素材一站式工坊自动生成 · {now}*",
    ])

    return "\n".join(lines)


def generate_inventory(
    scan_result: Dict[str, Any],
    package_root_name: str
) -> str:
    """
    生成素材清单Markdown内容。
    """
    lines = [
        "# 素材清单\n",
        "| 序号 | 文件名 | 类型 | 尺寸 | 大小 |",
        "|------|--------|------|------|------|",
    ]

    idx = 0

    # 主图
    for img_path in scan_result["main_images"]:
        idx += 1
        try:
            with Image.open(img_path) as img:
                w, h = img.size
            size_str = f"{w}×{h}"
        except Exception:
            size_str = "N/A"
        file_size = _format_file_size(img_path)
        lines.append(f"| {idx} | {img_path.name} | 主图 | {size_str} | {file_size} |")

    # 详情图
    for img_path in scan_result["detail_images"]:
        idx += 1
        try:
            with Image.open(img_path) as img:
                w, h = img.size
            size_str = f"{w}×{h}"
        except Exception:
            size_str = "N/A"
        file_size = _format_file_size(img_path)
        lines.append(f"| {idx} | {img_path.name} | 详情图 | {size_str} | {file_size} |")

    # 其他图片
    for img_path in scan_result["other_images"]:
        idx += 1
        try:
            with Image.open(img_path) as img:
                w, h = img.size
            size_str = f"{w}×{h}"
        except Exception:
            size_str = "N/A"
        file_size = _format_file_size(img_path)
        lines.append(f"| {idx} | {img_path.name} | 其他 | {size_str} | {file_size} |")

    # 文案
    if scan_result.get("copywriting"):
        idx += 1
        file_size = _format_file_size(scan_result["copywriting"])
        lines.append(f"| {idx} | copywriting.md | 文案 | - | {file_size} |")

    # 布局方案
    if scan_result.get("plan"):
        idx += 1
        file_size = _format_file_size(scan_result["plan"])
        lines.append(f"| {idx} | plan.json | 布局方案 | - | {file_size} |")

    # 品牌素材
    for f in scan_result["brand_assets"]:
        idx += 1
        file_size = _format_file_size(f)
        lines.append(f"| {idx} | {f.name} | 品牌素材 | - | {file_size} |")

    lines.extend([
        "",
        f"**共计 {idx} 个文件**",
        "",
        "---",
        f"*生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}*",
    ])

    return "\n".join(lines)


def _format_file_size(path: Path) -> str:
    """格式化文件大小显示"""
    try:
        size = path.stat().st_size
        if size < 1024:
            return f"{size}B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f}KB"
        else:
            return f"{size / (1024 * 1024):.1f}MB"
    except Exception:
        return "N/A"


# ============================================================================
# 打包流程
# ============================================================================

def create_package(
    project_dir: Path,
    brand: str,
    product_name: str,
    platforms: Optional[List[str]],
    output_zip: Path,
    include_copywriting: bool,
    include_brand_assets: bool,
    include_source: bool
) -> Path:
    """
    创建标准化交付包并打包为zip。

    Returns:
        zip文件路径
    """
    # 扫描项目产物
    print(f"📂 扫描项目目录: {project_dir}")
    scan_result = scan_project(project_dir)
    print(f"   主图: {len(scan_result['main_images'])} 张")
    print(f"   详情图: {len(scan_result['detail_images'])} 张")
    print(f"   文案: {'有' if scan_result['copywriting'] else '无'}")
    print(f"   布局方案: {'有' if scan_result['plan'] else '无'}")

    # 加载plan.json（用于生成使用指南）
    plan_data = None
    if scan_result["plan"]:
        try:
            with open(scan_result["plan"], "r", encoding="utf-8") as f:
                plan_data = json.load(f)
        except Exception as e:
            print(f"[WARN] 无法读取plan.json: {e}", file=sys.stderr)

    # 创建临时打包目录
    package_name = f"{product_name}_电商素材包"
    temp_dir = output_zip.parent / f"_packaging_temp_{product_name}"

    # 清理已存在的临时目录
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True)

    try:
        package_dir = temp_dir / package_name
        package_dir.mkdir()

        # 1. 成品图
        finished_dir = package_dir / "成品图"
        main_dir = finished_dir / "主图（1:1）"
        detail_dir = finished_dir / "详情图（3:4）"
        main_dir.mkdir(parents=True)
        detail_dir.mkdir(parents=True)

        for img_path in scan_result["main_images"]:
            shutil.copy2(img_path, main_dir / img_path.name)

        for img_path in scan_result["detail_images"]:
            shutil.copy2(img_path, detail_dir / img_path.name)

        # 其他图片也放入成品图
        if scan_result["other_images"]:
            other_dir = finished_dir / "其他"
            other_dir.mkdir(parents=True, exist_ok=True)
            for img_path in scan_result["other_images"]:
                shutil.copy2(img_path, other_dir / img_path.name)

        # 2. 多平台适配
        if platforms:
            print(f"\n🔄 生成多平台适配版本...")
            success = run_platform_adapter(project_dir, platforms, package_dir)
            if not success:
                print("[WARN] 多平台适配未成功，素材包不含平台适配版本", file=sys.stderr)

        # 3. 文案素材
        if include_copywriting and scan_result.get("copywriting"):
            copywriting_dir = package_dir / "文案素材"
            copywriting_dir.mkdir()
            shutil.copy2(scan_result["copywriting"], copywriting_dir / scan_result["copywriting"].name)

        # 4. 品牌素材
        if include_brand_assets and scan_result.get("brand_assets"):
            brand_dir_pkg = package_dir / "品牌素材"
            brand_dir_pkg.mkdir()
            for f in scan_result["brand_assets"]:
                shutil.copy2(f, brand_dir_pkg / f.name)

        # 5. 源文件
        if include_source:
            source_dir = package_dir / "源文件"
            source_dir.mkdir()
            if scan_result.get("plan"):
                shutil.copy2(scan_result["plan"], source_dir / scan_result["plan"].name)
            if scan_result.get("scenes_dir") and scan_result["scenes_dir"].is_dir():
                scenes_dest = source_dir / "scenes"
                shutil.copytree(scan_result["scenes_dir"], scenes_dest, dirs_exist_ok=True)

        # 6. 生成使用指南
        print(f"\n📝 生成使用指南...")
        guide_content = generate_usage_guide(
            brand, product_name, scan_result, platforms, plan_data
        )
        guide_path = package_dir / "使用指南.md"
        with open(guide_path, "w", encoding="utf-8") as f:
            f.write(guide_content)

        # 7. 生成素材清单
        print(f"📝 生成素材清单...")
        inventory_content = generate_inventory(scan_result, package_name)
        inventory_path = package_dir / "素材清单.md"
        with open(inventory_path, "w", encoding="utf-8") as f:
            f.write(inventory_content)

        # 8. 打包为zip
        print(f"\n📦 打包为zip...")
        if output_zip.exists():
            output_zip.unlink()

        with zipfile.ZipFile(str(output_zip), "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(package_dir):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(temp_dir)
                    zf.write(str(file_path), str(arcname))

        zip_size = _format_file_size(output_zip)
        print(f"   ✅ 打包完成: {output_zip} ({zip_size})")

        return output_zip

    finally:
        # 清理临时目录
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)


# ============================================================================
# CLI入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="标准化交付打包器 - 将项目产物打包为标准化电商素材包",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基础打包（只含成品图）
  python scripts/delivery_packager.py \\
      --project-dir ./my_project \\
      --brand 朗科 \\
      --product-name 剃须刀ES-100 \\
      --output ./delivery.zip

  # 完整打包（含多平台+文案+品牌+源文件）
  python scripts/delivery_packager.py \\
      --project-dir ./my_project \\
      --brand 朗科 \\
      --product-name 剃须刀ES-100 \\
      --platforms taobao,kuaishou,xiaohongshu \\
      --output ./delivery.zip \\
      --include-copywriting \\
      --include-brand-assets \\
      --include-source

  # 只打包多平台适配（不含源文件）
  python scripts/delivery_packager.py \\
      --project-dir ./my_project \\
      --brand 米家 \\
      --product-name 空气炸锅 \\
      --platforms taobao,pinduoduo,douyin \\
      --output ./delivery.zip \\
      --include-copywriting
        """
    )

    parser.add_argument(
        "--project-dir", required=True,
        help="项目目录路径（包含output/、copywriting.md等产物）"
    )
    parser.add_argument(
        "--brand", required=True,
        help="品牌名称"
    )
    parser.add_argument(
        "--product-name", required=True,
        help="产品名称"
    )
    parser.add_argument(
        "--platforms", default=None,
        help="目标平台，逗号分隔。可选: taobao,kuaishou,xiaohongshu,douyin,pinduoduo,jd,wechat_shop"
    )
    parser.add_argument(
        "--output", required=True,
        help="输出zip文件路径"
    )
    parser.add_argument(
        "--include-copywriting", action="store_true",
        help="包含文案素材"
    )
    parser.add_argument(
        "--include-brand-assets", action="store_true",
        help="包含品牌素材（logo等）"
    )
    parser.add_argument(
        "--include-source", action="store_true",
        help="包含源文件（plan.json、场景底图等）"
    )

    args = parser.parse_args()

    # 验证项目目录
    project_dir = Path(args.project_dir)
    if not project_dir.is_dir():
        print(f"[ERROR] 项目目录不存在: {project_dir}", file=sys.stderr)
        sys.exit(1)

    # 解析平台
    platforms = None
    if args.platforms:
        platforms = [p.strip() for p in args.platforms.split(",") if p.strip()]
        # 使用本地定义的PLATFORM_NAMES作为合法平台列表
        valid_platforms = set(PLATFORM_NAMES.keys())
        invalid = [p for p in platforms if p not in valid_platforms]
        if invalid:
            print(f"[ERROR] 不支持的平台: {', '.join(invalid)}", file=sys.stderr)
            print(f"[INFO]  支持的平台: {', '.join(valid_platforms)}", file=sys.stderr)
            sys.exit(1)

    # 验证输出路径
    output_zip = Path(args.output)
    if not output_zip.suffix.lower() == ".zip":
        output_zip = output_zip.with_suffix(".zip")
    output_zip.parent.mkdir(parents=True, exist_ok=True)

    # 创建打包
    print(f"\n{'='*50}")
    print(f"📦 电商素材标准化交付打包")
    print(f"{'='*50}")
    print(f"   品牌: {args.brand}")
    print(f"   产品: {args.product_name}")
    if platforms:
        platform_names = "、".join(PLATFORM_NAMES.get(p, p) for p in platforms)
        print(f"   平台: {platform_names}")
    print(f"   文案: {'✓' if args.include_copywriting else '✗'}")
    print(f"   品牌素材: {'✓' if args.include_brand_assets else '✗'}")
    print(f"   源文件: {'✓' if args.include_source else '✗'}")
    print(f"{'='*50}\n")

    result = create_package(
        project_dir=project_dir,
        brand=args.brand,
        product_name=args.product_name,
        platforms=platforms,
        output_zip=output_zip,
        include_copywriting=args.include_copywriting,
        include_brand_assets=args.include_brand_assets,
        include_source=args.include_source,
    )

    print(f"\n{'='*50}")
    print(f"✅ 交付打包完成!")
    print(f"   文件: {result}")
    print(f"   大小: {_format_file_size(result)}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
