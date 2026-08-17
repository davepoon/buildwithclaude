#!/usr/bin/env python3
"""
category_detector.py — 品类识别引擎
====================================
输入产品图片，通过视觉特征分析自动识别品类，输出标准化品类识别结果。

核心逻辑:
1. 读取产品图片，提取基础视觉特征（主色调、材质判断、尺寸比例）
2. 基于预定义规则和视觉特征匹配品类
3. 输出标准化JSON

Usage:
    python scripts/category_detector.py \\
        --image <产品图路径> \\
        --output <输出JSON路径>

Output:
    品类识别结果JSON，包含 category, sub_category, attributes,
    suggested_scene_styles, suggested_price_range, confidence, analysis_notes

依赖: Pillow (PIL)
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from collections import Counter

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow is required. Install via: pip install Pillow", file=sys.stderr)
    sys.exit(1)


# ============================================================================
# 品类特征库 — 基于形状/颜色/材质的规则匹配
# ============================================================================

# 主色调 → 品类权重映射
# 每种颜色类别对各个品类的贡献权重 (0-1)
COLOR_CATEGORY_WEIGHTS: Dict[str, Dict[str, float]] = {
    "dark_metallic": {
        "3C数码": 0.3, "个护电器": 0.35, "清洁电器": 0.1,
        "厨房小家电": 0.1, "食品饮料": 0.0, "美妆护肤": 0.05
    },
    "bright_white": {
        "美妆护肤": 0.25, "母婴用品": 0.2, "卫浴用品": 0.2,
        "个护电器": 0.15, "家居日用": 0.1, "小家电通用": 0.1
    },
    "warm_wood_tone": {
        "家居日用": 0.3, "厨房小家电": 0.25, "食品饮料": 0.2,
        "家居家装": 0.15, "个护电器": 0.0, "3C数码": 0.0
    },
    "pastel_soft": {
        "母婴用品": 0.35, "美妆护肤": 0.3, "个护电器": 0.1,
        "家居日用": 0.1, "食品饮料": 0.05, "服饰鞋包": 0.05
    },
    "vibrant_colorful": {
        "食品饮料": 0.2, "美妆护肤": 0.2, "服饰鞋包": 0.2,
        "母婴用品": 0.15, "家居日用": 0.1, "3C数码": 0.05
    },
    "tech_blue_glow": {
        "3C数码": 0.35, "个护电器": 0.2, "清洁电器": 0.15,
        "厨房小家电": 0.1, "数码配件": 0.15, "家居日用": 0.0
    },
    "natural_green": {
        "母婴用品": 0.2, "美妆护肤": 0.25, "食品饮料": 0.15,
        "家居日用": 0.15, "个护电器": 0.1, "清洁电器": 0.05
    },
    "luxury_gold": {
        "美妆护肤": 0.2, "食品饮料": 0.15, "服饰鞋包": 0.15,
        "个护电器": 0.15, "家居日用": 0.1, "3C数码": 0.05
    }
}

# 子品类视觉特征规则
# 每个子品类有颜色、比例、材质等特征
SUB_CATEGORY_RULES: Dict[str, Dict[str, dict]] = {
    "剃须刀": {
        "parent_category": "个护电器",
        "color_hints": ["dark_metallic", "tech_blue_glow"],
        "aspect_ratio_range": (0.2, 0.6),  # 窄高型
        "material_hints": ["metallic", "glossy"],
        "typical_colors": ["#333333", "#555555", "#1a1a2e", "#4a4a4a"],
    },
    "电吹风": {
        "parent_category": "个护电器",
        "color_hints": ["dark_metallic", "tech_blue_glow", "pastel_soft"],
        "aspect_ratio_range": (0.3, 0.8),
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#2d2d2d", "#f5f5f5", "#c9a84c"],
    },
    "电动牙刷": {
        "parent_category": "个护电器",
        "color_hints": ["bright_white", "pastel_soft", "tech_blue_glow"],
        "aspect_ratio_range": (0.1, 0.35),
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#ffffff", "#4a90d9", "#81c784"],
    },
    "空气炸锅": {
        "parent_category": "厨房小家电",
        "color_hints": ["dark_metallic", "warm_wood_tone"],
        "aspect_ratio_range": (0.6, 1.2),
        "material_hints": ["matte", "glossy"],
        "typical_colors": ["#2d2d2d", "#3d3d3d", "#1a1a1a"],
    },
    "电饭煲": {
        "parent_category": "厨房小家电",
        "color_hints": ["bright_white", "warm_wood_tone"],
        "aspect_ratio_range": (0.7, 1.3),
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#f5f5f5", "#ffffff", "#c4956a"],
    },
    "破壁机": {
        "parent_category": "厨房小家电",
        "color_hints": ["bright_white", "warm_wood_tone"],
        "aspect_ratio_range": (0.3, 0.6),
        "material_hints": ["glossy", "transparent"],
        "typical_colors": ["#f5f5f5", "#e0e0e0", "#333333"],
    },
    "咖啡机": {
        "parent_category": "厨房小家电",
        "color_hints": ["dark_metallic", "warm_wood_tone", "luxury_gold"],
        "aspect_ratio_range": (0.4, 0.8),
        "material_hints": ["metallic", "glossy"],
        "typical_colors": ["#2d2d2d", "#5c3d2e", "#c9a84c"],
    },
    "扫地机器人": {
        "parent_category": "清洁电器",
        "color_hints": ["dark_metallic", "bright_white"],
        "aspect_ratio_range": (0.8, 1.5),  # 扁平圆形
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#f5f5f5", "#2d2d2d", "#333333"],
    },
    "洗地机": {
        "parent_category": "清洁电器",
        "color_hints": ["dark_metallic", "bright_white"],
        "aspect_ratio_range": (0.15, 0.4),  # 细长杆状
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#f5f5f5", "#2d2d2d", "#4a90d9"],
    },
    "手机": {
        "parent_category": "3C数码",
        "color_hints": ["dark_metallic", "tech_blue_glow"],
        "aspect_ratio_range": (0.4, 0.55),
        "material_hints": ["glossy", "metallic"],
        "typical_colors": ["#1a1a1a", "#333333", "#c9a84c"],
    },
    "耳机": {
        "parent_category": "3C数码",
        "color_hints": ["dark_metallic", "tech_blue_glow", "bright_white"],
        "aspect_ratio_range": (0.5, 1.5),
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#f5f5f5", "#2d2d2d", "#1a1a1a"],
    },
    "充电宝": {
        "parent_category": "数码配件",
        "color_hints": ["dark_metallic", "tech_blue_glow", "bright_white"],
        "aspect_ratio_range": (0.3, 0.7),
        "material_hints": ["glossy", "matte", "metallic"],
        "typical_colors": ["#f5f5f5", "#2d2d2d", "#1a1a2e"],
    },
    "键盘": {
        "parent_category": "数码配件",
        "color_hints": ["dark_metallic", "tech_blue_glow", "bright_white"],
        "aspect_ratio_range": (1.5, 3.0),  # 宽扁型
        "material_hints": ["matte", "metallic"],
        "typical_colors": ["#2d2d2d", "#f5f5f5", "#1a1a2e"],
    },
    "面霜": {
        "parent_category": "美妆护肤",
        "color_hints": ["pastel_soft", "bright_white", "luxury_gold"],
        "aspect_ratio_range": (0.6, 1.4),
        "material_hints": ["glossy", "transparent", "matte"],
        "typical_colors": ["#fdf2f8", "#ffffff", "#d4a5a5"],
    },
    "精华液": {
        "parent_category": "美妆护肤",
        "color_hints": ["pastel_soft", "luxury_gold", "natural_green"],
        "aspect_ratio_range": (0.15, 0.4),
        "material_hints": ["glossy", "transparent"],
        "typical_colors": ["#fdf2f8", "#d4a5a5", "#a8d8a8"],
    },
    "面膜": {
        "parent_category": "美妆护肤",
        "color_hints": ["pastel_soft", "natural_green", "bright_white"],
        "aspect_ratio_range": (0.5, 1.2),
        "material_hints": ["matte"],
        "typical_colors": ["#e8f5e9", "#ffffff", "#f5f5f5"],
    },
    "奶粉": {
        "parent_category": "母婴用品",
        "color_hints": ["pastel_soft", "bright_white", "natural_green"],
        "aspect_ratio_range": (0.4, 0.8),
        "material_hints": ["matte"],
        "typical_colors": ["#f5f5f5", "#e8f5e9", "#fff3e0"],
    },
    "婴儿洗护": {
        "parent_category": "母婴用品",
        "color_hints": ["pastel_soft", "natural_green"],
        "aspect_ratio_range": (0.2, 0.5),
        "material_hints": ["glossy", "matte"],
        "typical_colors": ["#e8f5e9", "#fff9c4", "#f8bbd0"],
    },
    "茶叶": {
        "parent_category": "食品饮料",
        "color_hints": ["natural_green", "warm_wood_tone", "luxury_gold"],
        "aspect_ratio_range": (0.4, 1.0),
        "material_hints": ["matte"],
        "typical_colors": ["#2d5a27", "#5c3d2e", "#c9a84c"],
    },
    "坚果零食": {
        "parent_category": "食品饮料",
        "color_hints": ["warm_wood_tone", "vibrant_colorful"],
        "aspect_ratio_range": (0.5, 1.5),
        "material_hints": ["matte"],
        "typical_colors": ["#8d6e63", "#e8a87c", "#f5f5f5"],
    }
}

# 品类→父品类映射
PARENT_CATEGORY_MAP: Dict[str, str] = {
    "剃须刀": "个护电器", "电吹风": "个护电器", "电动牙刷": "个护电器",
    "空气炸锅": "厨房小家电", "电饭煲": "厨房小家电", "破壁机": "厨房小家电",
    "咖啡机": "厨房小家电", "扫地机器人": "清洁电器", "洗地机": "清洁电器",
    "手机": "3C数码", "耳机": "3C数码",
    "充电宝": "数码配件", "键盘": "数码配件",
    "面霜": "美妆护肤", "精华液": "美妆护肤", "面膜": "美妆护肤",
    "奶粉": "母婴用品", "婴儿洗护": "母婴用品",
    "茶叶": "食品饮料", "坚果零食": "食品饮料",
}

# 所有支持的品类
ALL_CATEGORIES = [
    "3C数码", "个护电器", "美妆护肤", "厨房小家电",
    "清洁电器", "食品饮料", "家居日用", "服饰鞋包", "母婴用品"
]

ALL_SUB_CATEGORIES = list(SUB_CATEGORY_RULES.keys())

# 价位范围建议（按品类）
PRICE_RANGES: Dict[str, str] = {
    "个护电器": "50-500",
    "厨房小家电": "100-800",
    "清洁电器": "200-3000",
    "3C数码": "50-5000",
    "数码配件": "20-500",
    "美妆护肤": "30-2000",
    "母婴用品": "30-1000",
    "食品饮料": "10-500",
    "家居日用": "20-1000",
    "服饰鞋包": "50-5000",
}

# 场景风格推荐（按品类+价位段）
SCENE_STYLE_MAP: Dict[str, Dict[str, List[str]]] = {
    "个护电器": {
        "low": ["clean_light", "minimalist"],
        "mid": ["tech_gradient", "minimalist", "lifestyle_bathroom"],
        "high": ["tech_gradient", "premium", "lifestyle_bathroom"],
        "luxury": ["luxury_dark", "tech_gradient"],
    },
    "厨房小家电": {
        "low": ["warm_wood", "minimalist"],
        "mid": ["warm_wood", "modern_marble", "cozy_living"],
        "high": ["modern_marble", "cozy_living", "warm_wood"],
        "luxury": ["modern_marble", "luxury_dark"],
    },
    "清洁电器": {
        "low": ["minimalist", "clean_light"],
        "mid": ["tech_gradient", "modern_marble", "minimalist"],
        "high": ["tech_gradient", "modern_marble"],
        "luxury": ["tech_gradient", "luxury_dark"],
    },
    "3C数码": {
        "low": ["minimalist", "desk_tech"],
        "mid": ["tech_gradient", "desk_tech", "minimalist"],
        "high": ["tech_gradient", "luxury_dark", "desk_tech"],
        "luxury": ["luxury_dark", "tech_gradient"],
    },
    "数码配件": {
        "low": ["minimalist", "desk_tech"],
        "mid": ["desk_tech", "tech_gradient", "minimalist"],
        "high": ["tech_gradient", "desk_tech"],
        "luxury": ["luxury_dark", "tech_gradient"],
    },
    "美妆护肤": {
        "low": ["topdown_greenery", "minimalist"],
        "mid": ["modern_marble", "topdown_greenery", "minimalist"],
        "high": ["modern_marble", "luxury_dark", "topdown_greenery"],
        "luxury": ["luxury_dark", "modern_marble"],
    },
    "母婴用品": {
        "low": ["pastel_baby", "topdown_greenery"],
        "mid": ["pastel_baby", "topdown_greenery", "minimalist"],
        "high": ["pastel_baby", "topdown_greenery"],
        "luxury": ["pastel_baby", "modern_marble"],
    },
    "食品饮料": {
        "low": ["warm_wood", "rustic_food"],
        "mid": ["rustic_food", "warm_wood", "cozy_living"],
        "high": ["rustic_food", "luxury_dark", "warm_wood"],
        "luxury": ["luxury_dark", "rustic_food"],
    },
    "家居日用": {
        "low": ["warm_wood", "minimalist"],
        "mid": ["cozy_living", "warm_wood", "minimalist"],
        "high": ["cozy_living", "modern_marble", "warm_wood"],
        "luxury": ["luxury_dark", "cozy_living"],
    },
    "服饰鞋包": {
        "low": ["minimalist", "fashion_editorial"],
        "mid": ["fashion_editorial", "minimalist", "cozy_living"],
        "high": ["fashion_editorial", "luxury_dark", "minimalist"],
        "luxury": ["luxury_dark", "fashion_editorial"],
    },
}


# ============================================================================
# 图像分析函数
# ============================================================================

def extract_dominant_colors(image: Image.Image, n_colors: int = 5) -> List[Tuple[Tuple[int,int,int], float]]:
    """
    提取图片主色调（通过缩小+量化实现简易KMeans效果）。
    
    Args:
        image: PIL Image对象
        n_colors: 提取的颜色数量
    
    Returns:
        颜色列表 [(R,G,B), 占比]，按占比降序排列
    """
    # 缩小到 50x50 加速计算
    small = image.copy().resize((50, 50), Image.LANCZOS)
    
    # 转为 RGB
    if small.mode == "RGBA":
        # 过滤透明背景
        pixels = []
        for pixel in small.getdata():
            if pixel[3] > 128:  # 不透明像素
                pixels.append(pixel[:3])
    elif small.mode == "RGB":
        pixels = list(small.getdata())
    else:
        small = small.convert("RGB")
        pixels = list(small.getdata())
    
    if not pixels:
        return [((255, 255, 255), 1.0)]
    
    # 简易量化：将每个通道量化到 8 级
    quantized = []
    for r, g, b in pixels:
        qr = (r // 32) * 32
        qg = (g // 32) * 32
        qb = (b // 32) * 32
        quantized.append((qr, qg, qb))
    
    # 统计颜色频次
    color_counts = Counter(quantized)
    total = len(quantized)
    
    # 返回前n个主色
    result = []
    for color, count in color_counts.most_common(n_colors):
        result.append((color, count / total))
    
    return result


def classify_color_tone(color: Tuple[int,int,int]) -> str:
    """
    将RGB颜色归类为色调类别。
    
    Args:
        color: (R, G, B) 元组
    
    Returns:
        色调类别字符串
    """
    r, g, b = color
    brightness = (r * 0.299 + g * 0.587 + b * 0.114)
    saturation = max(r, g, b) - min(r, g, b)
    
    # 金色/铜色系
    if r > 150 and g > 100 and b < 100 and (r - b) > 60:
        return "luxury_gold"
    
    # 绿色系
    if g > r and g > b and saturation > 40:
        return "natural_green"
    
    # 蓝色系
    if b > r and b > g and saturation > 40:
        return "tech_blue_glow"
    
    # 粉/紫柔和色
    if saturation < 80 and brightness > 150 and (r > b or g > 100):
        if r > 180 and b > 150:
            return "pastel_soft"
    
    # 暖木色
    if r > 100 and g > 60 and b < 80 and saturation > 30 and brightness > 80:
        return "warm_wood_tone"
    
    # 深金属色
    if brightness < 100 and saturation < 60:
        return "dark_metallic"
    
    # 明亮白色系
    if brightness > 220 and saturation < 40:
        return "bright_white"
    
    # 鲜艳彩色
    if saturation > 80:
        return "vibrant_colorful"
    
    # 默认根据亮度判断
    if brightness > 180:
        return "bright_white"
    elif brightness > 100:
        return "warm_wood_tone"
    else:
        return "dark_metallic"


def analyze_aspect_ratio(image: Image.Image) -> float:
    """
    分析产品的宽高比（通过检测非透明区域）。
    
    Args:
        image: PIL Image对象
    
    Returns:
        宽高比 (width/height)，对于全图则返回图片本身的宽高比
    """
    if image.mode == "RGBA":
        # 检测非透明区域的bbox
        bbox = image.getbbox()
        if bbox:
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            if h > 0:
                return w / h
    
    # 回退：使用图片原始宽高比
    w, h = image.size
    return w / h if h > 0 else 1.0


def analyze_material(image: Image.Image, dominant_colors: list) -> str:
    """
    根据视觉特征推断材质。
    
    Args:
        image: PIL Image对象
        dominant_colors: 主色调列表
    
    Returns:
        材质描述字符串
    """
    materials = []
    
    # 检查高光和反光（通过亮度分布）
    small = image.copy().resize((50, 50), Image.LANCZOS).convert("RGB")
    pixels = list(small.getdata())
    bright_pixels = sum(1 for p in pixels if max(p) > 220)
    ratio = bright_pixels / len(pixels)
    
    if ratio > 0.15:
        materials.append("glossy")
    
    # 检查是否有金属质感（深灰+高光组合）
    has_dark = any(c[1] > 0.1 and classify_color_tone(c[0]) == "dark_metallic" 
                   for c in dominant_colors)
    has_bright = ratio > 0.08
    
    if has_dark and has_bright:
        materials.append("metallic")
    
    if not materials:
        materials.append("matte")
    
    return "+".join(materials)


def infer_form_factor(aspect_ratio: float) -> str:
    """
    根据宽高比推断产品形态。
    
    Args:
        aspect_ratio: 宽高比 (w/h)
    
    Returns:
        形态描述
    """
    if aspect_ratio < 0.3:
        return "细长杆状"
    elif aspect_ratio < 0.5:
        return "手持式"
    elif aspect_ratio < 0.8:
        return "紧凑型"
    elif aspect_ratio < 1.2:
        return "方正型"
    elif aspect_ratio < 1.8:
        return "宽扁型"
    else:
        return "超宽型"


def infer_dominant_shape(aspect_ratio: float) -> str:
    """
    根据宽高比推断主导形状。
    
    Args:
        aspect_ratio: 宽高比 (w/h)
    
    Returns:
        形状描述
    """
    if aspect_ratio < 0.25:
        return "细长圆柱形"
    elif aspect_ratio < 0.5:
        return "圆柱形"
    elif aspect_ratio < 0.8:
        return "椭圆/圆角矩形"
    elif aspect_ratio < 1.2:
        return "方形/圆形"
    elif aspect_ratio < 2.0:
        return "横向矩形"
    else:
        return "超宽扁形"


def match_sub_category(dominant_tones: List[str], aspect_ratio: float,
                       material: str) -> List[Tuple[str, float]]:
    """
    根据视觉特征匹配子品类，返回候选列表和置信度。
    
    Args:
        dominant_tones: 主色调类别列表
        aspect_ratio: 产品宽高比
        material: 材质描述
    
    Returns:
        [(子品类名, 置信度)] 按置信度降序
    """
    scores: Dict[str, float] = {}
    
    for sub_cat, rules in SUB_CATEGORY_RULES.items():
        score = 0.0
        
        # 颜色匹配 (权重 0.4)
        color_match = sum(1 for t in dominant_tones if t in rules.get("color_hints", []))
        color_score = min(color_match / max(len(rules.get("color_hints", [])), 1), 1.0)
        score += color_score * 0.4
        
        # 比例匹配 (权重 0.35)
        ratio_range = rules.get("aspect_ratio_range", (0, 10))
        if ratio_range[0] <= aspect_ratio <= ratio_range[1]:
            # 在范围内，根据与中心的距离给分
            center = (ratio_range[0] + ratio_range[1]) / 2
            span = (ratio_range[1] - ratio_range[0]) / 2
            if span > 0:
                distance = abs(aspect_ratio - center) / span
                ratio_score = max(0, 1.0 - distance * 0.5)
            else:
                ratio_score = 1.0
        else:
            # 在范围外，距离越远分数越低
            distance = min(abs(aspect_ratio - ratio_range[0]),
                          abs(aspect_ratio - ratio_range[1]))
            ratio_score = max(0, 1.0 - distance * 0.3)
        score += ratio_score * 0.35
        
        # 材质匹配 (权重 0.25)
        material_hints = rules.get("material_hints", [])
        if material_hints:
            material_match = sum(1 for m in material_hints if m in material)
            mat_score = material_match / len(material_hints)
        else:
            mat_score = 0.3  # 无材质规则时给基础分
        score += mat_score * 0.25
        
        scores[sub_cat] = score
    
    # 排序返回
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_scores


def match_parent_category(dominant_tones: List[str]) -> List[Tuple[str, float]]:
    """
    根据主色调匹配父品类。
    
    Args:
        dominant_tones: 主色调类别列表
    
    Returns:
        [(父品类名, 置信度)] 按置信度降序
    """
    scores: Dict[str, float] = {}
    
    for tone in dominant_tones:
        weights = COLOR_CATEGORY_WEIGHTS.get(tone, {})
        for cat, weight in weights.items():
            scores[cat] = scores.get(cat, 0) + weight
    
    # 归一化
    total = sum(scores.values()) or 1.0
    normalized = {cat: s / total for cat, s in scores.items()}
    
    # 补齐缺失品类
    for cat in ALL_CATEGORIES:
        if cat not in normalized:
            normalized[cat] = 0.0
    
    sorted_scores = sorted(normalized.items(), key=lambda x: x[1], reverse=True)
    return sorted_scores


# ============================================================================
# 主检测流程
# ============================================================================

def detect_category(image_path: str) -> dict:
    """
    完整品类检测流程。
    
    Args:
        image_path: 产品图片路径
    
    Returns:
        标准化品类识别结果字典
    """
    # 1. 加载图片
    try:
        image = Image.open(image_path)
    except Exception as e:
        return {
            "error": f"无法加载图片: {e}",
            "category": "未知",
            "confidence": 0.0
        }
    
    # 2. 提取视觉特征
    dominant_colors = extract_dominant_colors(image, n_colors=6)
    dominant_tones = list(dict.fromkeys(
        classify_color_tone(c) for c, _ in dominant_colors if _ > 0.03
    ))
    
    aspect_ratio = analyze_aspect_ratio(image)
    material = analyze_material(image, dominant_colors)
    form_factor = infer_form_factor(aspect_ratio)
    dominant_shape = infer_dominant_shape(aspect_ratio)
    
    # 3. 匹配子品类
    sub_cat_scores = match_sub_category(dominant_tones, aspect_ratio, material)
    
    # 4. 匹配父品类
    parent_cat_scores = match_parent_category(dominant_tones)
    
    # 5. 确定最终结果
    best_sub_cat, sub_confidence = sub_cat_scores[0] if sub_cat_scores else ("未知", 0.0)
    best_parent_cat = PARENT_CATEGORY_MAP.get(best_sub_cat, parent_cat_scores[0][0] if parent_cat_scores else "家居日用")
    
    # 综合置信度：子品类置信度和父品类置信度的加权平均
    parent_confidence = next((s for c, s in parent_cat_scores if c == best_parent_cat), 0.0)
    overall_confidence = sub_confidence * 0.6 + parent_confidence * 0.4
    
    # 如果置信度太低，标注需要人工确认
    confidence = round(min(overall_confidence, 0.99), 2)
    
    # 6. 颜色描述
    top_colors = dominant_colors[:3]
    color_names = []
    for color, ratio in top_colors:
        if ratio < 0.05:
            continue
        r, g, b = color
        tone = classify_color_tone(color)
        tone_cn = {
            "dark_metallic": "深灰/金属色",
            "bright_white": "白色/浅色",
            "warm_wood_tone": "暖棕/木色",
            "pastel_soft": "柔和粉色",
            "vibrant_colorful": "鲜艳彩色",
            "tech_blue_glow": "科技蓝",
            "natural_green": "自然绿",
            "luxury_gold": "金色",
        }.get(tone, f"RGB({r},{g},{b})")
        color_names.append(tone_cn)
    color_desc = "+".join(color_names) if color_names else "混合色"
    
    # 7. 推荐场景风格
    # 先根据价位段获取，默认mid
    price_tier = "mid"  # 品类检测阶段不知道价位，给通用推荐
    scene_styles = SCENE_STYLE_MAP.get(best_parent_cat, {}).get(
        price_tier,
        ["minimalist", "warm_wood"]
    )
    
    # 8. 价位范围建议
    suggested_price = PRICE_RANGES.get(best_parent_cat, "50-500")
    
    # 9. 分析备注
    analysis_notes = f"{best_sub_cat}，{material}材质，{form_factor}，"
    if confidence >= 0.7:
        analysis_notes += f"适合{scene_styles[0]}风格"
    else:
        analysis_notes += "视觉特征不够明确，建议人工确认品类"
    
    result = {
        "category": best_parent_cat,
        "sub_category": best_sub_cat,
        "attributes": {
            "color": color_desc,
            "material": material,
            "style": "科技感" if "dark_metallic" in dominant_tones or "tech_blue_glow" in dominant_tones else "自然清新" if "natural_green" in dominant_tones or "pastel_soft" in dominant_tones else "简约现代",
            "form_factor": form_factor,
            "dominant_shape": dominant_shape,
            "aspect_ratio": round(aspect_ratio, 3),
        },
        "suggested_scene_styles": scene_styles[:3],
        "suggested_price_range": suggested_price,
        "confidence": confidence,
        "analysis_notes": analysis_notes,
        # 附加调试信息
        "_debug": {
            "dominant_tones": dominant_tones,
            "sub_category_scores": {k: round(v, 3) for k, v in sub_cat_scores[:5]},
            "parent_category_scores": {k: round(v, 3) for k, v in parent_cat_scores[:5]},
        }
    }
    
    return result


# ============================================================================
# CLI 入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="品类识别引擎 — 输入产品图片，输出标准化品类识别结果",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/category_detector.py --image product.png --output category.json
  python scripts/category_detector.py --image /path/to/shaver.png
        """
    )
    parser.add_argument(
        "--image", required=True,
        help="产品图片路径（支持 PNG/JPG/JPEG/WebP）"
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
    
    # 验证输入文件
    if not os.path.isfile(args.image):
        print(f"Error: 图片文件不存在: {args.image}", file=sys.stderr)
        sys.exit(1)
    
    # 执行品类检测
    result = detect_category(args.image)
    
    # 输出结果
    indent = 2 if args.pretty else None
    output_json = json.dumps(result, ensure_ascii=False, indent=indent)
    
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"品类识别结果已保存到: {args.output}")
        
        # 输出摘要到终端
        conf_label = "高" if result["confidence"] >= 0.7 else ("中" if result["confidence"] >= 0.4 else "低")
        print(f"  品类: {result['category']} > {result['sub_category']}")
        print(f"  置信度: {result['confidence']} ({conf_label})")
        print(f"  推荐风格: {', '.join(result['suggested_scene_styles'])}")
    else:
        print(output_json)


if __name__ == "__main__":
    main()
