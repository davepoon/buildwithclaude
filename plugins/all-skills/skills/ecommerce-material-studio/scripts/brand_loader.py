#!/usr/bin/env python3
"""
brand_loader.py — 品牌视觉规范加载器
=====================================
从 references/brand_profiles/ 加载品牌配置，支持多品牌管理和自动Logo选择。

用法:
  # 加载品牌配置
  python brand_loader.py load --brand langke

  # 自动选择Logo（根据场景色调）
  python brand_loader.py select-logo --brand langke --scene-tone dark

  # 列出已录入品牌
  python brand_loader.py list

  # 导出为 brand_overlay.py 兼容的 config 格式
  python brand_loader.py export --brand langke --scene-tone dark --output brand_config.json

依赖: 无外部依赖（纯Python + json）
"""

import argparse
import json
import os
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Dict, List


# 品牌配置目录
BRAND_PROFILES_DIR = Path(__file__).parent.parent / "references" / "brand_profiles"
BRAND_LOGOS_DIR = Path(__file__).parent.parent / "references" / "brand_logos"


@dataclass
class LogoVariant:
    """Logo变体配置"""
    path: str
    scene_tone: str  # "dark" or "light"
    description: str = ""

    @property
    def absolute_path(self) -> str:
        """获取Logo的绝对路径"""
        full_path = BRAND_LOGOS_DIR.parent / self.path
        return str(full_path)


@dataclass
class GuaranteeBarConfig:
    """保障条配置"""
    labels: List[str] = field(default_factory=lambda: ["官方正品", "全国联保", "售后无忧", "现货速发"])
    style: str = "rounded_pill"


@dataclass
class StyleConstraints:
    """风格约束"""
    forbidden_elements: List[str] = field(default_factory=list)
    preferred_scenes: List[str] = field(default_factory=list)
    tone_range: List[str] = field(default_factory=lambda: ["dark", "light"])


@dataclass
class BrandConfig:
    """品牌完整配置"""
    brand_name: str
    brand_cn: str = ""
    logo_variants: Dict[str, LogoVariant] = field(default_factory=dict)
    colors: Dict[str, str] = field(default_factory=dict)
    guarantee_bar: GuaranteeBarConfig = field(default_factory=GuaranteeBarConfig)
    style_constraints: StyleConstraints = field(default_factory=StyleConstraints)

    def get_logo_path(self, scene_tone: str = "dark") -> Optional[str]:
        """
        根据场景色调自动选择合适的Logo

        Args:
            scene_tone: "dark" 或 "light"

        Returns:
            Logo文件绝对路径，若无匹配则返回None
        """
        # 优先精确匹配
        for variant_name, variant in self.logo_variants.items():
            if variant.scene_tone == scene_tone:
                path = variant.absolute_path
                if Path(path).exists():
                    return path

        # 降级：返回第一个存在的
        for variant_name, variant in self.logo_variants.items():
            path = variant.absolute_path
            if Path(path).exists():
                return path

        return None

    def to_overlay_config(self, scene_tone: str = "dark") -> dict:
        """
        导出为 brand_overlay.py 兼容的配置格式

        Args:
            scene_tone: 场景色调

        Returns:
            兼容 brand_overlay.py 的 dict
        """
        logo_path = self.get_logo_path(scene_tone)

        # 确定文字颜色
        if scene_tone == "dark":
            text_primary = self.colors.get("text_on_dark", "#FFFFFF")
            text_secondary = "#CCCCCC"
        else:
            text_primary = self.colors.get("text_on_light", "#1A1A1A")
            text_secondary = "#505050"

        return {
            "brand_name": self.brand_name,
            "logo": {
                "path": logo_path or "",
                "max_width_ratio": 0.25,
            },
            "badge": {
                "path": "",  # 由外部指定
                "max_width_ratio": 0.14,
            },
            "guarantee_bar": {
                "labels": self.guarantee_bar.labels,
                "height_ratio": 0.055,
            },
            "colors": {
                "accent": self.colors.get("accent", "#D4AF6A"),
                "text_primary": text_primary,
                "text_secondary": text_secondary,
                "bar_bg_dark": "#0A0A0F",
                "bar_bg_light": "#FFFFFF",
                "bar_text_dark": "#C8C8C8",
                "bar_text_light": "#505050",
            },
            "logo_margin_ratio": 0.03,
            "brand_zone_top_ratio": 0.14,
            "content_zone_bottom_ratio": 0.88,
            "guarantee_zone_bottom_ratio": 0.98,
            "safe_margin_ratio": 0.02,
        }


def load_brand(brand_name: str) -> BrandConfig:
    """
    加载品牌配置

    Args:
        brand_name: 品牌名称（不区分大小写，如 "langke", "朗科"）

    Returns:
        BrandConfig 对象

    Raises:
        FileNotFoundError: 品牌配置文件不存在
    """
    brand_name_lower = brand_name.lower()

    # 查找配置文件
    profile_path = BRAND_PROFILES_DIR / f"{brand_name_lower}.json"
    if not profile_path.exists():
        # 尝试中文名称匹配
        for p in BRAND_PROFILES_DIR.glob("*.json"):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("brand_cn", "").lower() == brand_name_lower or \
               data.get("brand_name", "").lower() == brand_name_lower:
                profile_path = p
                break
        else:
            raise FileNotFoundError(
                f"品牌 '{brand_name}' 配置文件不存在。\n"
                f"已录入品牌目录: {BRAND_PROFILES_DIR}\n"
                f"可用品牌: {list_brands()}"
            )

    with open(profile_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 解析 Logo variants
    logo_variants = {}
    for name, variant_data in data.get("logo_variants", {}).items():
        logo_variants[name] = LogoVariant(
            path=variant_data.get("path", ""),
            scene_tone=variant_data.get("scene_tone", "dark"),
            description=variant_data.get("description", ""),
        )

    # 解析保障条
    bar_data = data.get("guarantee_bar", {})
    guarantee_bar = GuaranteeBarConfig(
        labels=bar_data.get("labels", ["官方正品", "全国联保", "售后无忧", "现货速发"]),
        style=bar_data.get("style", "rounded_pill"),
    )

    # 解析风格约束
    sc_data = data.get("style_constraints", {})
    style_constraints = StyleConstraints(
        forbidden_elements=sc_data.get("forbidden_elements", []),
        preferred_scenes=sc_data.get("preferred_scenes", []),
        tone_range=sc_data.get("tone_range", ["dark", "light"]),
    )

    return BrandConfig(
        brand_name=data.get("brand_name", brand_name),
        brand_cn=data.get("brand_cn", ""),
        logo_variants=logo_variants,
        colors=data.get("colors", {}),
        guarantee_bar=guarantee_bar,
        style_constraints=style_constraints,
    )


def auto_select_logo(brand_name: str, scene_tone: str) -> Optional[str]:
    """
    自动选择合适的Logo

    Args:
        brand_name: 品牌名称
        scene_tone: 场景色调 ("dark" 或 "light")

    Returns:
        Logo文件绝对路径，若无匹配则返回None
    """
    try:
        config = load_brand(brand_name)
        return config.get_logo_path(scene_tone)
    except FileNotFoundError:
        return None


def list_brands() -> List[dict]:
    """
    列出所有已录入的品牌

    Returns:
        品牌信息列表 [{"name": ..., "brand_cn": ..., "has_logos": ...}, ...]
    """
    brands = []
    if not BRAND_PROFILES_DIR.exists():
        return brands

    for profile_path in BRAND_PROFILES_DIR.glob("*.json"):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            brand_name = data.get("brand_name", profile_path.stem)
            brand_cn = data.get("brand_cn", "")

            # 检查Logo文件是否存在
            has_logos = False
            for variant_data in data.get("logo_variants", {}).values():
                logo_path = BRAND_LOGOS_DIR.parent / variant_data.get("path", "")
                if logo_path.exists():
                    has_logos = True
                    break

            brands.append({
                "name": brand_name,
                "brand_cn": brand_cn,
                "profile_file": str(profile_path),
                "has_logos": has_logos,
            })
        except Exception as e:
            brands.append({
                "name": profile_path.stem,
                "brand_cn": "",
                "profile_file": str(profile_path),
                "has_logos": False,
                "error": str(e),
            })

    return brands


# ============================================================================
# CLI
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="品牌视觉规范加载器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 加载朗科品牌配置
  python brand_loader.py load --brand langke

  # 为深色场景选择Logo
  python brand_loader.py select-logo --brand langke --scene-tone dark

  # 列出所有已录入品牌
  python brand_loader.py list

  # 导出为brand_overlay.py兼容格式
  python brand_loader.py export --brand langke --scene-tone dark --output brand_config.json
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # load 命令
    load_parser = subparsers.add_parser("load", help="加载品牌配置")
    load_parser.add_argument("--brand", required=True, help="品牌名称（如 langke, 朗科）")

    # select-logo 命令
    logo_parser = subparsers.add_parser("select-logo", help="自动选择Logo")
    logo_parser.add_argument("--brand", required=True, help="品牌名称")
    logo_parser.add_argument("--scene-tone", default="dark", choices=["dark", "light"],
                            help="场景色调 (default: dark)")

    # list 命令
    subparsers.add_parser("list", help="列出已录入品牌")

    # export 命令
    export_parser = subparsers.add_parser("export", help="导出为brand_overlay.py兼容格式")
    export_parser.add_argument("--brand", required=True, help="品牌名称")
    export_parser.add_argument("--scene-tone", default="dark", choices=["dark", "light"],
                              help="场景色调")
    export_parser.add_argument("--output", required=True, help="输出JSON文件路径")

    args = parser.parse_args()

    if args.command == "load":
        try:
            config = load_brand(args.brand)
            print(json.dumps({
                "brand_name": config.brand_name,
                "brand_cn": config.brand_cn,
                "colors": config.colors,
                "guarantee_bar": {
                    "labels": config.guarantee_bar.labels,
                    "style": config.guarantee_bar.style,
                },
                "logo_variants": {
                    name: {"path": v.absolute_path, "scene_tone": v.scene_tone}
                    for name, v in config.logo_variants.items()
                },
                "style_constraints": {
                    "forbidden_elements": config.style_constraints.forbidden_elements,
                    "preferred_scenes": config.style_constraints.preferred_scenes,
                    "tone_range": config.style_constraints.tone_range,
                },
            }, ensure_ascii=False, indent=2))
        except FileNotFoundError as e:
            print(f"❌ {e}", file=sys.stderr)
            sys.exit(1)

    elif args.command == "select-logo":
        logo_path = auto_select_logo(args.brand, args.scene_tone)
        if logo_path:
            print(logo_path)
        else:
            print(f"❌ 未找到品牌 '{args.brand}' 在 {args.scene_tone} 场景下的Logo", file=sys.stderr)
            sys.exit(1)

    elif args.command == "list":
        brands = list_brands()
        if not brands:
            print("📭 暂无已录入品牌")
        else:
            print(f"📦 已录入 {len(brands)} 个品牌:\n")
            for b in brands:
                status = "✅" if b.get("has_logos") else "⚠️  缺少Logo文件"
                print(f"  {status} {b['name']} ({b['brand_cn']})")
                print(f"     配置文件: {b['profile_file']}")

    elif args.command == "export":
        try:
            config = load_brand(args.brand)
            overlay_config = config.to_overlay_config(args.scene_tone)
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(overlay_config, f, ensure_ascii=False, indent=2)
            print(f"✅ 已导出到 {output_path}")
        except FileNotFoundError as e:
            print(f"❌ {e}", file=sys.stderr)
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
