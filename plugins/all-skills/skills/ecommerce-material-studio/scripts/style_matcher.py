#!/usr/bin/env python3
"""
style_matcher.py — 风格自动匹配引擎
====================================
根据品类识别结果+价位+平台+品牌，自动推荐完整的风格方案。
输出可直接被 plan.json 消费的配置。

Usage:
    python scripts/style_matcher.py \\
        --category <品类> \\
        --sub-category <子品类> \\
        --price <价位> \\
        --platform <平台> \\
        --brand <品牌名，可选> \\
        --output <输出JSON路径>

Output:
    完整风格方案JSON，包含 recommended_templates, scene_style_config,
    layout_recommendations, platform_config, price_tier, brand_override

依赖: 无外部依赖（纯Python + json）
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any


# ============================================================================
# 路径常量
# ============================================================================

SKILL_DIR = Path(__file__).parent.parent
KB_DIR = SKILL_DIR / "references" / "knowledge_base"
BRAND_DIR = SKILL_DIR / "references" / "brand_profiles"
CATEGORY_TEMPLATES_FILE = KB_DIR / "category_templates.json"
PRODUCT_PROFILES_FILE = KB_DIR / "product_profiles.json"


# ============================================================================
# 平台配置
# ============================================================================

PLATFORM_CONFIGS: Dict[str, Dict[str, Any]] = {
    "taobao": {
        "main_image_size": [800, 800],
        "detail_image_size": [750, 1000],
        "text_max_length_per_line": 18,
        "max_title_length": 60,
        "notes": "淘宝主图800×800，详情宽度750"
    },
    "pinduoduo": {
        "main_image_size": [750, 750],
        "detail_image_size": [750, 1000],
        "text_max_length_per_line": 16,
        "max_title_length": 50,
        "notes": "拼多多主图750×750"
    },
    "xiaohongshu": {
        "main_image_size": [1080, 1440],
        "detail_image_size": [1080, 1440],
        "text_max_length_per_line": 22,
        "max_title_length": 30,
        "notes": "小红书3:4竖图，文字宜精不宜多"
    },
    "douyin": {
        "main_image_size": [800, 800],
        "detail_image_size": [750, 1000],
        "text_max_length_per_line": 16,
        "max_title_length": 30,
        "notes": "抖音电商主图800×800"
    },
    "kuaishou": {
        "main_image_size": [800, 800],
        "detail_image_size": [750, 1000],
        "text_max_length_per_line": 16,
        "max_title_length": 30,
        "notes": "快手电商主图800×800"
    },
    "general": {
        "main_image_size": [1024, 1024],
        "detail_image_size": [750, 1000],
        "text_max_length_per_line": 20,
        "max_title_length": 40,
        "notes": "通用尺寸，适合AI生图输出"
    }
}

# 价位分档
PRICE_TIERS = {
    "low": (0, 100),       # < 100
    "mid": (100, 500),     # 100 - 500
    "high": (500, 2000),   # 500 - 2000
    "luxury": (2000, 999999),  # > 2000
}

PRICE_TIER_CN = {
    "low": "低价位(< 100元)",
    "mid": "中价位(100-500元)",
    "high": "高价位(500-2000元)",
    "luxury": "奢华价位(> 2000元)",
}

# 价位 → 风格映射
PRICE_STYLE_MAP: Dict[str, Dict[str, List[str]]] = {
    "low": {
        "default_templates": ["minimalist", "clean_light"],
        "color_strategy": "明亮浅色系为主，突出性价比和清爽感",
        "text_style": "粗体无衬线，高对比度，字号偏大",
    },
    "mid": {
        "default_templates": ["tech_gradient", "modern_marble", "warm_wood"],
        "color_strategy": "深色/质感系，突出品质感",
        "text_style": "金色/白色搭配，精致无衬线",
    },
    "high": {
        "default_templates": ["modern_marble", "luxury_dark", "cozy_living"],
        "color_strategy": "高端质感色系，突出品牌溢价",
        "text_style": "衬线体/细体无衬线，优雅留白",
    },
    "luxury": {
        "default_templates": ["luxury_dark", "modern_marble"],
        "color_strategy": "深色+金属色点缀，极致奢华感",
        "text_style": "金色/玫瑰金，衬线体，大留白",
    }
}

# 11张图标准布局建议
LAYOUT_TEMPLATE_11: Dict[str, Dict[str, Any]] = {
    "main_images": {
        "main_01": {
            "type": "封面主图",
            "text_position": "bottom",
            "product_ratio": 0.45,
            "text_layout_template": "hero",
            "scene_priority": ["minimalist", "tech_gradient", "topdown_greenery"]
        },
        "main_02": {
            "type": "卖点主图A",
            "text_position": "left",
            "product_ratio": 0.55,
            "text_layout_template": "selling_point",
            "scene_priority": ["minimalist"]
        },
        "main_03": {
            "type": "卖点主图B",
            "text_position": "left",
            "product_ratio": 0.50,
            "text_layout_template": "selling_point",
            "scene_priority": ["warm_wood", "cozy_living", "modern_marble"]
        },
        "main_04": {
            "type": "使用场景图",
            "text_position": "top",
            "product_ratio": 0.40,
            "text_layout_template": "lifestyle",
            "scene_priority": ["lifestyle_bathroom", "cozy_living", "warm_wood", "topdown_greenery"]
        },
        "main_05": {
            "type": "参数/功能图",
            "text_position": "bottom",
            "product_ratio": 0.50,
            "text_layout_template": "specs",
            "scene_priority": ["minimalist"]
        },
    },
    "detail_images": {
        "detail_01": {
            "type": "情境开篇图",
            "text_position": "top",
            "product_ratio": 0.30,
            "text_layout_template": "premium",
            "scene_priority": ["cozy_living", "warm_wood", "lifestyle_bathroom"]
        },
        "detail_02": {
            "type": "卖点详情1",
            "text_position": "top_or_left",
            "product_ratio": 0.35,
            "text_layout_template": "premium",
            "scene_priority": ["modern_marble", "tech_gradient"]
        },
        "detail_03": {
            "type": "卖点详情2",
            "text_position": "top",
            "product_ratio": 0.35,
            "text_layout_template": "premium",
            "scene_priority": ["warm_wood", "modern_marble"]
        },
        "detail_04": {
            "type": "卖点详情3",
            "text_position": "bottom",
            "product_ratio": 0.40,
            "text_layout_template": "premium",
            "scene_priority": ["minimalist", "modern_marble"]
        },
        "detail_05": {
            "type": "场景应用图",
            "text_position": "top",
            "product_ratio": 0.35,
            "text_layout_template": "lifestyle",
            "scene_priority": ["cozy_living", "topdown_greenery", "warm_wood"]
        },
        "detail_06": {
            "type": "规格参数图",
            "text_position": "bottom",
            "product_ratio": 0.35,
            "text_layout_template": "specs",
            "scene_priority": ["minimalist"]
        },
    }
}


# ============================================================================
# 工具函数
# ============================================================================

def load_json(filepath: Path) -> dict:
    """加载JSON文件"""
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def get_price_tier(price: float) -> str:
    """根据价格返回价位档"""
    for tier, (low, high) in PRICE_TIERS.items():
        if low <= price < high:
            return tier
    return "mid"


def load_category_template(category: str, sub_category: str) -> dict:
    """
    加载品类模板，先查子品类，再查父品类。
    
    Args:
        category: 父品类（如"个护电器"）
        sub_category: 子品类（如"剃须刀"）
    
    Returns:
        品类模板配置
    """
    data = load_json(CATEGORY_TEMPLATES_FILE)
    categories = data.get("categories", {})
    
    # 优先查子品类
    if sub_category in categories:
        return categories[sub_category]
    
    # 再查父品类
    if category in categories:
        return categories[category]
    
    # 回退到小家电通用
    if "小家电通用" in categories:
        return categories["小家电通用"]
    
    return {}


def load_brand_profile(brand: str) -> Optional[dict]:
    """
    加载品牌配置文件。
    
    Args:
        brand: 品牌名称（如"langke"）
    
    Returns:
        品牌配置或None
    """
    if not brand:
        return None
    
    brand_file = BRAND_DIR / f"{brand.lower()}.json"
    if brand_file.exists():
        return load_json(brand_file)
    return None


def compute_template_suitability(template_id: str, category_template: dict,
                                  price_tier: str, brand_profile: Optional[dict]) -> tuple:
    """
    计算模板适合度。
    
    Returns:
        (suitability_score, reason)
    """
    score = 0.5  # 基础分
    reasons = []
    
    # 品类模板推荐场景匹配
    recommended_scene = category_template.get("scene_style", "")
    if template_id == recommended_scene:
        score += 0.35
        reasons.append(f"{category_template.get('scene_style', '')}是该品类推荐场景")
    
    # 价位匹配
    tier_config = PRICE_STYLE_MAP.get(price_tier, {})
    tier_templates = tier_config.get("default_templates", [])
    if template_id in tier_templates:
        score += 0.15
        rank = tier_templates.index(template_id) + 1
        reasons.append(f"符合{PRICE_TIER_CN.get(price_tier, '')}风格定位")
    
    # 品牌偏好覆盖
    if brand_profile:
        style_constraints = brand_profile.get("style_constraints", {})
        preferred_scenes = style_constraints.get("preferred_scenes", [])
        if template_id in preferred_scenes:
            score += 0.1
            reasons.append(f"品牌推荐场景")
        
        forbidden = style_constraints.get("forbidden_elements", [])
        # 检查模板是否触犯品牌禁忌（简化处理）
        if "花哨" in str(forbidden) and template_id in ["pastel_baby", "fashion_editorial"]:
            score -= 0.2
            reasons.append("与品牌风格约束冲突")
    
    score = round(max(0.05, min(score, 0.99)), 2)
    reason = "；".join(reasons) if reasons else "通用模板"
    
    return (score, reason)


# ============================================================================
# 主匹配流程
# ============================================================================

def match_style(category: str, sub_category: str, price: float,
                platform: str, brand: Optional[str] = None) -> dict:
    """
    完整风格匹配流程。
    
    Args:
        category: 父品类
        sub_category: 子品类
        price: 价位
        platform: 目标平台
        brand: 品牌名（可选）
    
    Returns:
        完整风格方案字典
    """
    # 1. 基础参数
    price_tier = get_price_tier(price)
    platform_key = platform.lower() if platform else "general"
    platform_config = PLATFORM_CONFIGS.get(platform_key, PLATFORM_CONFIGS["general"])
    
    # 2. 加载品类模板
    category_template = load_category_template(category, sub_category)
    
    # 3. 加载品牌配置
    brand_profile = load_brand_profile(brand) if brand else None
    brand_override = None
    
    if brand_profile:
        brand_colors = brand_profile.get("colors", {})
        brand_override = {
            "brand_name": brand_profile.get("brand_cn", brand),
            "primary_color": brand_colors.get("primary", ""),
            "accent_color": brand_colors.get("accent", ""),
            "text_on_dark": brand_colors.get("text_on_dark", "#FFFFFF"),
            "text_on_light": brand_colors.get("text_on_light", "#1A1A1A"),
            "preferred_scenes": brand_profile.get("style_constraints", {}).get("preferred_scenes", []),
        }
    
    # 4. 计算模板适合度
    all_templates = [
        "tech_gradient", "minimalist", "warm_wood", "modern_marble",
        "topdown_greenery", "lifestyle_bathroom", "cozy_living",
        "rustic_food", "pastel_baby", "fashion_editorial",
        "desk_tech", "luxury_dark"
    ]
    
    template_scores = []
    for tid in all_templates:
        score, reason = compute_template_suitability(
            tid, category_template, price_tier, brand_profile
        )
        template_scores.append({
            "template_id": tid,
            "suitability": score,
            "reason": reason
        })
    
    # 按适合度排序
    template_scores.sort(key=lambda x: x["suitability"], reverse=True)
    recommended_templates = template_scores[:5]  # Top 5
    
    # 5. 构建场景风格配置
    tier_config = PRICE_STYLE_MAP.get(price_tier, PRICE_STYLE_MAP["mid"])
    
    # 场景prompt关键词：品类模板优先，品牌覆盖
    scene_prompt_keywords = category_template.get("scene_prompt_keywords", [
        "clean product photography", "professional lighting"
    ])
    
    # 配色方案：品牌优先 > 品类默认 > 价位默认
    if brand_override and brand_override.get("primary_color"):
        color_palette = {
            "primary": brand_override["primary_color"],
            "accent": brand_override.get("accent_color", "#c9a84c"),
            "text": brand_override.get("text_on_dark", "#ffffff"),
        }
    else:
        color_palette = category_template.get("color_palette", {
            "primary": "#1a1a2e",
            "accent": "#c9a84c",
            "text": "#ffffff",
        })
    
    lighting = category_template.get("lighting", "柔和均匀光线")
    text_style = category_template.get("text_style", tier_config.get("text_style", "白色粗体无衬线"))
    
    scene_style_config = {
        "scene_prompt_keywords": scene_prompt_keywords,
        "color_palette": color_palette,
        "lighting": lighting,
        "text_style": text_style,
        "color_strategy": tier_config.get("color_strategy", ""),
    }
    
    # 6. 构建布局建议
    layout_recommendations = {}
    
    # 主图布局
    main_layout = {}
    for img_id, config in LAYOUT_TEMPLATE_11["main_images"].items():
        # 根据推荐模板调整场景优先级
        adjusted_priority = []
        for scene in config["scene_priority"]:
            if any(t["template_id"] == scene and t["suitability"] >= 0.5 
                   for t in recommended_templates):
                adjusted_priority.append(scene)
        if not adjusted_priority:
            adjusted_priority = [recommended_templates[0]["template_id"]] if recommended_templates else ["minimalist"]
        
        main_layout[img_id] = {
            "type": config["type"],
            "text_position": config["text_position"],
            "product_ratio": config["product_ratio"],
            "text_layout_template": config["text_layout_template"],
            "scene_priority": adjusted_priority
        }
    
    # 详情图布局
    detail_layout = {}
    for img_id, config in LAYOUT_TEMPLATE_11["detail_images"].items():
        adjusted_priority = []
        for scene in config["scene_priority"]:
            if any(t["template_id"] == scene and t["suitability"] >= 0.4
                   for t in recommended_templates):
                adjusted_priority.append(scene)
        if not adjusted_priority:
            adjusted_priority = [recommended_templates[0]["template_id"]] if recommended_templates else ["minimalist"]
        
        detail_layout[img_id] = {
            "type": config["type"],
            "text_position": config["text_position"],
            "product_ratio": config["product_ratio"],
            "text_layout_template": config["text_layout_template"],
            "scene_priority": adjusted_priority
        }
    
    layout_recommendations = {
        "main_images": {
            "text_position": "bottom",
            "product_ratio": 0.42,
            "text_layout_template": "tech_dark" if price_tier in ["mid", "high", "luxury"] else "clean_light",
            "per_image": main_layout
        },
        "detail_images": {
            "text_position": "top_or_left",
            "product_ratio": 0.35,
            "text_layout_template": "premium",
            "per_image": detail_layout
        }
    }
    
    # 7. 组装最终结果
    result = {
        "recommended_templates": recommended_templates,
        "scene_style_config": scene_style_config,
        "layout_recommendations": layout_recommendations,
        "platform_config": platform_config,
        "price_tier": price_tier,
        "price_tier_cn": PRICE_TIER_CN.get(price_tier, ""),
        "brand_override": brand_override,
        "category_info": {
            "category": category,
            "sub_category": sub_category,
            "template_source": "品类模板" if category_template else "默认",
        }
    }
    
    return result


# ============================================================================
# CLI 入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="风格自动匹配引擎 — 根据品类+价位+平台+品牌，推荐完整风格方案",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/style_matcher.py \\
      --category 个护电器 --sub-category 剃须刀 \\
      --price 169 --platform kuaishou \\
      --brand langke --output style_recommendation.json

  python scripts/style_matcher.py \\
      --category 厨房小家电 --sub-category 空气炸锅 \\
      --price 299 --platform taobao
        """
    )
    parser.add_argument(
        "--category", required=True,
        help="父品类（如：个护电器、3C数码、厨房小家电）"
    )
    parser.add_argument(
        "--sub-category", required=True,
        help="子品类（如：剃须刀、空气炸锅、耳机）"
    )
    parser.add_argument(
        "--price", required=True, type=float,
        help="产品价位（数字，如：169）"
    )
    parser.add_argument(
        "--platform", default="general",
        choices=["taobao", "pinduoduo", "xiaohongshu", "douyin", "kuaishou", "general"],
        help="目标平台（默认：general）"
    )
    parser.add_argument(
        "--brand", default=None,
        help="品牌名（可选，如：langke）"
    )
    parser.add_argument(
        "--output", default=None,
        help="输出JSON路径（不指定则输出到标准输出）"
    )
    parser.add_argument(
        "--pretty", action="store_true", default=True,
        help="美化JSON输出（默认开启）"
    )
    
    args = parser.parse_args()
    
    # 执行风格匹配
    result = match_style(
        category=args.category,
        sub_category=args.sub_category,
        price=args.price,
        platform=args.platform,
        brand=args.brand
    )
    
    # 输出结果
    indent = 2 if args.pretty else None
    output_json = json.dumps(result, ensure_ascii=False, indent=indent)
    
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"风格推荐结果已保存到: {args.output}")
        
        # 输出摘要
        print(f"  品类: {args.category} > {args.sub_category}")
        print(f"  价位档: {result['price_tier_cn']}")
        print(f"  平台: {args.platform} ({result['platform_config']['main_image_size']})")
        print(f"  Top 3 推荐模板:")
        for t in result['recommended_templates'][:3]:
            print(f"    - {t['template_id']} (适合度: {t['suitability']}) — {t['reason']}")
        if result['brand_override']:
            print(f"  品牌覆盖: {result['brand_override']['brand_name']}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
