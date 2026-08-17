#!/usr/bin/env python3
"""
text_engine.py — 统一文字管理引擎
==================================
将 compose.py 和 brand_overlay.py 的文字叠加统一为单 pass 引擎，
解决文字重叠、z-index混乱等问题。

核心功能:
1. 读取 plan.json，合并所有文字源（texts + brand_config）
2. 统一 z-index 分层渲染
3. 文字自动避让产品区域 (product_bbox)
4. 字号自适应（根据画布尺寸和文字长度）
5. 可读性保障（对比度检测 + 自动添加背景块/描边）

z-index 分层:
  Layer 0: 场景背景底图
  Layer 1: 产品图（已合成到scene_image中）
  Layer 2: 品牌Logo（左上角）
  Layer 3: 保障条（底部）
  Layer 4: 徽章（右下角）
  Layer 5: 卖点标题+副标题（根据text_zones布局）
  Layer 6: 装饰元素（金色线条、分隔符等）

用法:
  # 主流程：处理整个plan.json
  python text_engine.py --plan /path/to/plan.json [--brand-config /path/to/brand.json]

  # 处理单张图片
  python text_engine.py --input /path/to/image.png --plan /path/to/plan.json --image-id main_01

  # 指定品牌（自动加载品牌配置）
  python text_engine.py --plan /path/to/plan.json --brand langke

  # 指定场景色调
  python text_engine.py --plan /path/to/plan.json --brand langke --scene-tone dark

依赖: Pillow, numpy (可选，用于对比度检测)
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============================================================================
# 常量
# ============================================================================

# z-index 定义
Z_BACKGROUND = 0
Z_PRODUCT = 1
Z_LOGO = 2
Z_GUARANTEE_BAR = 3
Z_BADGE = 4
Z_TEXT_CONTENT = 5
Z_DECORATION = 6

# 字体路径候选
FONT_PATHS_BOLD = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]
FONT_PATHS_REGULAR = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
]

# 对比度阈值（WCAG AA标准）
MIN_CONTRAST_RATIO = 4.5

# 技能目录
SKILL_DIR = Path(__file__).parent.parent
BRAND_PROFILES_DIR = SKILL_DIR / "references" / "brand_profiles"
BRAND_LOGOS_DIR = SKILL_DIR / "references" / "brand_logos"


# ============================================================================
# 字体管理
# ============================================================================

_FONT_CACHE: Dict[Tuple[int, bool], ImageFont.FreeTypeFont] = {}


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """加载并缓存字体"""
    key = (size, bold)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]

    paths = FONT_PATHS_BOLD if bold else FONT_PATHS_REGULAR
    for fp in paths:
        if Path(fp).exists():
            try:
                f = ImageFont.truetype(fp, size, index=2)
                _FONT_CACHE[key] = f
                return f
            except (OSError, IOError):
                try:
                    f = ImageFont.truetype(fp, size)
                    _FONT_CACHE[key] = f
                    return f
                except Exception:
                    continue

    f = ImageFont.load_default()
    _FONT_CACHE[key] = f
    return f


# ============================================================================
# 颜色工具
# ============================================================================

def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """将十六进制颜色转为RGB元组"""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0]*2 + h[1]*2 + h[2]*2
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def hex_to_rgba(hex_color: str, default_alpha: int = 255) -> Tuple[int, int, int, int]:
    """将十六进制颜色转为RGBA元组"""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        r, g, b = (int(x*2, 16) for x in h)
        return (r, g, b, default_alpha)
    if len(h) == 4:
        r, g, b, a = (int(x*2, 16) for x in h)
        return (r, g, b, a)
    if len(h) == 6:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), default_alpha)
    if len(h) == 8:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(h[6:8], 16))
    return (0, 0, 0, default_alpha)


def relative_luminance(r: int, g: int, b: int) -> float:
    """计算RGB的相对亮度（WCAG 2.0公式）"""
    def linearize(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)


def contrast_ratio(color1: Tuple[int, int, int], color2: Tuple[int, int, int]) -> float:
    """计算两个RGB颜色之间的对比度比率"""
    l1 = relative_luminance(*color1)
    l2 = relative_luminance(*color2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def sample_region_avg_color(img: Image.Image, bbox: Tuple[int, int, int, int]) -> Tuple[int, int, int]:
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

    avg_r = sum(p[0] for p in pixels) // len(pixels)
    avg_g = sum(p[1] for p in pixels) // len(pixels)
    avg_b = sum(p[2] for p in pixels) // len(pixels)
    return (avg_r, avg_g, avg_b)


# ============================================================================
# 几何工具
# ============================================================================

def bbox_overlap(bbox1: Dict, bbox2: Dict) -> bool:
    """检测两个bbox是否重叠（bbox格式: {x1, y1, x2, y2}）"""
    return not (bbox1["x2"] <= bbox2["x1"] or
                bbox1["x1"] >= bbox2["x2"] or
                bbox1["y2"] <= bbox2["y1"] or
                bbox1["y1"] >= bbox2["y2"])


def bbox_intersection_area(bbox1: Dict, bbox2: Dict) -> int:
    """计算两个bbox重叠面积"""
    x1 = max(bbox1["x1"], bbox2["x1"])
    y1 = max(bbox1["y1"], bbox2["y1"])
    x2 = min(bbox1["x2"], bbox2["x2"])
    y2 = min(bbox1["y2"], bbox2["y2"])
    if x2 <= x1 or y2 <= y1:
        return 0
    return (x2 - x1) * (y2 - y1)


def find_safe_zone(canvas_w: int, canvas_h: int,
                   product_bbox: Optional[Dict],
                   preferred_position: str = "auto") -> Dict:
    """
    根据产品位置找到安全的文字区域

    Args:
        canvas_w, canvas_h: 画布尺寸
        product_bbox: 产品区域 {x1, y1, x2, y2}，可以为None
        preferred_position: 偏好位置 ("auto", "left", "right", "top", "bottom")

    Returns:
        安全区域 {x1, y1, x2, y2}
    """
    margin = int(min(canvas_w, canvas_h) * 0.04)

    if product_bbox is None:
        # 没有产品，全画布可用
        return {
            "x1": margin,
            "y1": int(canvas_h * 0.14),
            "x2": canvas_w - margin,
            "y2": int(canvas_h * 0.88),
        }

    pb = product_bbox
    safe_zones = []

    # 左侧区域
    if pb["x1"] > canvas_w * 0.15:
        safe_zones.append({
            "x1": margin,
            "y1": int(canvas_h * 0.14),
            "x2": pb["x1"] - margin,
            "y2": int(canvas_h * 0.85),
            "position": "left",
            "area": (pb["x1"] - margin) * (canvas_h * 0.71),
        })

    # 右侧区域
    if canvas_w - pb["x2"] > canvas_w * 0.15:
        safe_zones.append({
            "x1": pb["x2"] + margin,
            "y1": int(canvas_h * 0.14),
            "x2": canvas_w - margin,
            "y2": int(canvas_h * 0.85),
            "position": "right",
            "area": (canvas_w - pb["x2"] - margin) * (canvas_h * 0.71),
        })

    # 顶部区域
    if pb["y1"] > canvas_h * 0.15:
        safe_zones.append({
            "x1": margin,
            "y1": margin,
            "x2": canvas_w - margin,
            "y2": pb["y1"] - margin,
            "position": "top",
            "area": (canvas_w - 2*margin) * (pb["y1"] - margin),
        })

    # 底部区域
    if canvas_h - pb["y2"] > canvas_h * 0.15:
        safe_zones.append({
            "x1": margin,
            "y1": pb["y2"] + margin,
            "x2": canvas_w - margin,
            "y2": int(canvas_h * 0.88),
            "position": "bottom",
            "area": (canvas_w - 2*margin) * (canvas_h * 0.88 - pb["y2"] - margin),
        })

    if not safe_zones:
        # 兜底：使用底部条带
        return {
            "x1": margin,
            "y1": int(canvas_h * 0.75),
            "x2": canvas_w - margin,
            "y2": int(canvas_h * 0.88),
            "position": "bottom",
        }

    # 按偏好位置选择
    if preferred_position != "auto":
        for zone in safe_zones:
            if zone["position"] == preferred_position:
                return zone

    # 自动选择最大面积的安全区
    safe_zones.sort(key=lambda z: z["area"], reverse=True)
    return safe_zones[0]


# ============================================================================
# 字号自适应
# ============================================================================

def calc_auto_font_size(canvas_w: int, canvas_h: int,
                        text: str, zone: Dict,
                        role: str = "title") -> int:
    """
    根据画布尺寸、文字长度和安全区域自动计算最佳字号

    Args:
        canvas_w, canvas_h: 画布尺寸
        text: 文字内容
        zone: 安全区域 {x1, y1, x2, y2}
        role: "title" (主标题) 或 "subtitle" (副标题)

    Returns:
        推荐字号(px)
    """
    zone_w = zone["x2"] - zone["x1"]
    zone_h = zone["y2"] - zone["y1"]

    # 基准字号比例
    if role == "title":
        base_ratio = 0.06  # 主标题 ≥ 画布宽度的5%
        min_ratio = 0.05
    else:
        base_ratio = 0.035  # 副标题 ≥ 画布宽度的3%
        min_ratio = 0.03

    base_size = int(canvas_w * base_ratio)
    min_size = int(canvas_w * min_ratio)

    # 根据文字长度调整
    lines = text.split("\n")
    max_line_len = max(len(line) for line in lines) if lines else 1

    # 中文字符约占字号宽度，英文约占0.6倍
    est_char_width = base_size * 0.8  # 估算每字符宽度
    est_line_width = max_line_len * est_char_width

    if est_line_width > zone_w * 0.9:
        # 文字太宽，缩小字号
        scale = (zone_w * 0.9) / est_line_width
        base_size = int(base_size * scale)

    # 检查高度是否足够
    line_height = int(base_size * 1.3)
    total_text_height = line_height * len(lines)
    if total_text_height > zone_h * 0.85:
        scale = (zone_h * 0.85) / total_text_height
        base_size = int(base_size * scale)

    return max(base_size, min_size)


# ============================================================================
# 可读性增强
# ============================================================================

def ensure_readability(img: Image.Image, text_color: Tuple[int, int, int],
                       text_bbox: Tuple[int, int, int, int],
                       is_dark: bool) -> Dict:
    """
    检测文字与背景对比度，不足时返回增强方案

    Args:
        img: 当前画布图像
        text_color: 文字RGB颜色
        text_bbox: 文字区域 (x1, y1, x2, y2)
        is_dark: 是否深色场景

    Returns:
        {"need_background": bool, "bg_color": ..., "need_stroke": bool, "stroke_color": ...}
    """
    bg_avg = sample_region_avg_color(img, text_bbox)
    ratio = contrast_ratio(text_color, bg_avg)

    result = {
        "contrast_ratio": ratio,
        "need_background": False,
        "bg_color": None,
        "need_stroke": False,
        "stroke_color": None,
    }

    if ratio >= MIN_CONTRAST_RATIO:
        return result

    # 对比度不足，添加增强
    if is_dark:
        # 深色场景：加半透明深色背景块 + 白色描边
        result["need_background"] = True
        result["bg_color"] = (0, 0, 0, 160)
        result["need_stroke"] = True
        result["stroke_color"] = (0, 0, 0, 200)
    else:
        # 浅色场景：加半透明白色背景块 + 深色描边
        result["need_background"] = True
        result["bg_color"] = (255, 255, 255, 180)
        result["need_stroke"] = True
        result["stroke_color"] = (255, 255, 255, 200)

    return result


# ============================================================================
# 品牌配置加载
# ============================================================================

def load_brand_config(brand_name: Optional[str], scene_tone: str = "dark") -> Optional[Dict]:
    """加载品牌配置（通过brand_loader）"""
    if not brand_name:
        return None

    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from brand_loader import load_brand
        config = load_brand(brand_name)
        return config.to_overlay_config(scene_tone)
    except (FileNotFoundError, ImportError):
        return None


def load_brand_config_from_file(config_path: str) -> Optional[Dict]:
    """从JSON文件加载品牌配置"""
    if not config_path or not Path(config_path).exists():
        return None
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================================
# 渲染引擎核心
# ============================================================================

class TextRenderItem:
    """一个待渲染的文字元素"""

    def __init__(self, z_index: int, content: str, position: Tuple[int, int],
                 font_size: int, color: Tuple[int, int, int, int],
                 bold: bool = False, role: str = "text",
                 max_width: Optional[int] = None,
                 align: str = "left"):
        self.z_index = z_index
        self.content = content
        self.position = position  # (x, y) 左上角
        self.font_size = font_size
        self.color = color
        self.bold = bold
        self.role = role  # "logo", "title", "subtitle", "guarantee", "badge", "decoration"
        self.max_width = max_width
        self.align = align
        self._bbox_cache: Optional[Tuple[int, int, int, int]] = None

    def get_bbox(self) -> Tuple[int, int, int, int]:
        """获取文字区域的bbox"""
        if self._bbox_cache:
            return self._bbox_cache

        # 对于非文字元素（logo/badge/装饰），使用估算尺寸
        if self.font_size <= 0:
            x1, y1 = self.position
            est_w = self.max_width if self.max_width else 100
            est_h = 100
            self._bbox_cache = (x1, y1, x1 + est_w, y1 + est_h)
            return self._bbox_cache

        font = load_font(self.font_size, self.bold)
        lines = self.content.split("\n")

        max_w = 0
        total_h = 0
        line_h = int(self.font_size * 1.3)

        for line in lines:
            bbox = font.getbbox(line)
            w = bbox[2] - bbox[0]
            max_w = max(max_w, w)
            total_h += line_h

        if self.max_width and max_w > self.max_width:
            max_w = self.max_width

        x1, y1 = self.position
        self._bbox_cache = (x1, y1, x1 + max_w, y1 + total_h)
        return self._bbox_cache


class TextEngine:
    """统一文字管理引擎"""

    def __init__(self, canvas: Image.Image, plan_data: dict,
                 brand_config: Optional[dict] = None,
                 scene_tone: str = "dark"):
        self.canvas = canvas.convert("RGBA")
        self.width = canvas.width
        self.height = canvas.height
        self.plan = plan_data
        self.brand_config = brand_config
        self.scene_tone = scene_tone
        self.is_dark = scene_tone == "dark"
        self.render_items: List[TextRenderItem] = []
        self.product_bbox: Optional[Dict] = None
        self._zone_tracker: Dict[str, int] = {}  # zone_key -> y_offset accumulator

    def collect_items(self, image_cfg: dict):
        """收集所有需要渲染的文字元素"""
        self.product_bbox = image_cfg.get("product_bbox")

        # Layer 2: Logo
        self._collect_logo(image_cfg)

        # Layer 3: 保障条
        self._collect_guarantee_bar(image_cfg)

        # Layer 4: 徽章
        self._collect_badge(image_cfg)

        # Layer 5: 卖点文字
        self._collect_selling_text(image_cfg)

        # Layer 6: 装饰元素
        self._collect_decorations(image_cfg)

        # 按 z-index 排序（保持同z-index的插入顺序）
        self.render_items.sort(key=lambda item: item.z_index)  # Python sort is stable, preserves insertion order for equal keys

        # 重新计算zone内堆叠偏移（排序后顺序可能改变）
        self._recalculate_zone_stacking()

    def _recalculate_zone_stacking(self):
        """重新计算zone内文字堆叠偏移（在排序后调用）
        
        按zone_direction分组（top/left/right/bottom），
        每组内文字从该方向的基准位置开始依次堆叠。
        """
        # 按zone_direction分组
        zone_groups: Dict[str, List[TextRenderItem]] = {}
        for item in self.render_items:
            if item.z_index != Z_TEXT_CONTENT:
                continue
            direction = getattr(item, '_zone_direction', 'auto')
            if direction not in zone_groups:
                zone_groups[direction] = []
            zone_groups[direction].append(item)
        
        # 每个方向组内依次堆叠
        for direction, items in zone_groups.items():
            if not items:
                continue
            
            # 计算该方向组的基准起始位置
            if direction == "top":
                # 从顶部开始，logo下方
                base_y = int(self.height * 0.14)  # 品牌区底部
                current_y = base_y
                for item in items:
                    item.position = (item.position[0], current_y)
                    item._bbox_cache = None
                    line_height = int(item.font_size * 1.5) + 8
                    current_y += line_height
                    
            elif direction == "bottom":
                # 从底部开始向上堆叠（保证条上方）
                bar_top = int(self.height * 0.88)
                # 反向：先计算总高度，再从底部往上排
                total_height = sum(int(it.font_size * 1.5) + 8 for it in items)
                current_y = bar_top - total_height
                for item in items:
                    item.position = (item.position[0], current_y)
                    item._bbox_cache = None
                    line_height = int(item.font_size * 1.5) + 8
                    current_y += line_height
                    
            elif direction == "left":
                # 左侧从上到下堆叠
                base_y = int(self.height * 0.14)
                current_y = base_y
                for item in items:
                    item.position = (item.position[0], current_y)
                    item._bbox_cache = None
                    line_height = int(item.font_size * 1.5) + 8
                    current_y += line_height
                    
            elif direction == "right":
                # 右侧从上到下堆叠
                base_y = int(self.height * 0.14)
                current_y = base_y
                for item in items:
                    item.position = (item.position[0], current_y)
                    item._bbox_cache = None
                    line_height = int(item.font_size * 1.5) + 8
                    current_y += line_height
                    
            else:  # auto / center
                base_y = int(self.height * 0.14)
                current_y = base_y
                for item in items:
                    item.position = (item.position[0], current_y)
                    item._bbox_cache = None
                    line_height = int(item.font_size * 1.5) + 8
                    current_y += line_height

    def _collect_logo(self, image_cfg: dict):
        """收集Logo元素"""
        if not self.brand_config:
            return

        logo_path = self.brand_config.get("logo", {}).get("path", "")
        if not logo_path or not Path(logo_path).exists():
            return

        max_w_ratio = self.brand_config.get("logo", {}).get("max_width_ratio", 0.25)
        margin = int(self.width * 0.03)

        # Logo放在左上角
        self.render_items.append(TextRenderItem(
            z_index=Z_LOGO,
            content=f"__LOGO__:{logo_path}",
            position=(margin, margin),
            font_size=0,
            color=(255, 255, 255, 255),
            role="logo",
            max_width=int(self.width * max_w_ratio),
        ))

    def _collect_guarantee_bar(self, image_cfg: dict):
        """收集保障条元素"""
        if not self.brand_config:
            return

        bar_config = self.brand_config.get("guarantee_bar", {})
        labels = bar_config.get("labels", [])
        if not labels:
            return

        bar_h_ratio = bar_config.get("height_ratio", 0.055)
        bar_h = int(self.height * bar_h_ratio)
        margin = int(self.width * 0.03)
        bar_y = self.height - bar_h - margin

        # 确定保障条右边界（为徽章让位）
        badge_config = self.brand_config.get("badge", {})
        badge_max_w = int(self.width * badge_config.get("max_width_ratio", 0.14))
        bar_right = self.width - badge_max_w - margin * 2 if badge_config.get("path") else self.width

        colors = self.brand_config.get("colors", {})

        self.render_items.append(TextRenderItem(
            z_index=Z_GUARANTEE_BAR,
            content=f"__GUARANTEE_BAR__:{json.dumps({'labels': labels, 'bar_y': bar_y, 'bar_h': bar_h, 'bar_right': bar_right, 'colors': colors, 'is_dark': self.is_dark})}",
            position=(0, bar_y),
            font_size=max(14, int(self.width * 0.018)),
            color=hex_to_rgb(colors.get("bar_text_dark" if self.is_dark else "bar_text_light", "#C8C8C8")),
            bold=True,
            role="guarantee",
        ))

    def _collect_badge(self, image_cfg: dict):
        """收集徽章元素"""
        if not self.brand_config:
            return

        badge_path = self.brand_config.get("badge", {}).get("path", "")
        if not badge_path or not Path(badge_path).exists():
            return

        max_w_ratio = self.brand_config.get("badge", {}).get("max_width_ratio", 0.14)
        margin = int(self.width * 0.03)
        badge_max_w = int(self.width * max_w_ratio)

        # 徽章放在右下角
        badge_x = self.width - badge_max_w - margin
        # y位置在保障条上方
        bar_h = int(self.height * 0.055)
        badge_y = self.height - bar_h - margin - int(self.height * 0.12)

        self.render_items.append(TextRenderItem(
            z_index=Z_BADGE,
            content=f"__BADGE__:{badge_path}",
            position=(badge_x, badge_y),
            font_size=0,
            color=(255, 255, 255, 255),
            role="badge",
            max_width=badge_max_w,
        ))

    def _collect_selling_text(self, image_cfg: dict):
        """收集卖点标题和副标题（支持zone内垂直堆叠）"""
        texts = image_cfg.get("texts", [])
        text_zones = image_cfg.get("text_zones", [])

        # 获取品牌名，用于检测logo冲突
        brand_name = ""
        if self.brand_config:
            brand_name = self.brand_config.get("brand_name", "") or self.brand_config.get("brand_cn", "")

        for i, text_cfg in enumerate(texts):
            content_text = text_cfg.get("content", "")
            if not content_text:
                continue

            # 检测与品牌logo的文字冲突：如果内容包含品牌名且position在logo区域
            # 则跳过该文字，避免与logo重复渲染
            if brand_name and brand_name in content_text:
                position_key = text_cfg.get("position", "")
                if position_key in ("top-left", "top-center"):
                    # 检查是否已有logo被渲染
                    has_logo = any(item.role == "logo" for item in self.render_items)
                    if has_logo:
                        print(f"  ⏭️ 跳过文字'{content_text}'（与品牌logo冲突）")
                        continue

            # 确定文字区域
            zone = self._resolve_text_zone(text_cfg, text_zones, i)

            # 确定角色
            role = "title" if i == 0 else "subtitle"

            # 自动计算字号
            specified_size = text_cfg.get("font_size")
            if specified_size:
                font_size = int(specified_size)
            else:
                font_size = calc_auto_font_size(
                    self.width, self.height, content_text, zone, role
                )

            # 确定颜色
            color_str = text_cfg.get("color", "#FFFFFF" if self.is_dark else "#1A1A1A")
            if isinstance(color_str, str):
                color = hex_to_rgba(color_str)
            else:
                color = tuple(color_str) if len(color_str) == 4 else (*color_str, 255)

            # 计算位置（支持zone内垂直堆叠）
            weight = text_cfg.get("weight", "regular")
            is_bold = weight == "bold" or role == "title"

            # 计算最终位置（堆叠偏移由排序后的_recalculate_zone_stacking处理）
            margin = int(min(self.width, self.height) * 0.04)
            x_pos = zone["x1"] + margin
            y_pos = zone["y1"] + margin

            # 保存zone方向供后续堆叠计算使用
            zone_direction = self._anchor_to_direction(text_cfg.get("position", "top-left"))

            item = TextRenderItem(
                z_index=Z_TEXT_CONTENT,
                content=content_text,
                position=(x_pos, y_pos),
                font_size=font_size,
                color=color,
                bold=is_bold,
                role=role,
                max_width=zone["x2"] - zone["x1"],
                align=text_cfg.get("align", "left"),
            )
            # 保存zone方向供后续堆叠分组
            item._zone_direction = zone_direction
            item._anchor = text_cfg.get("anchor", "top")
            item._offset_y = text_cfg.get("offset_y", 0)
            self.render_items.append(item)

    def _resolve_text_zone(self, text_cfg: dict, text_zones: list, index: int) -> Dict:
        """解析文字区域"""
        # 优先使用 text_zones
        if text_zones and index < len(text_zones):
            zone = text_zones[index]
            bbox = zone.get("bbox", {})
            if bbox and all(k in bbox for k in ["x1", "y1", "x2", "y2"]):
                return bbox

        # 使用 position 锚点推算
        position = text_cfg.get("position", "top-left")
        offset = text_cfg.get("offset", [0, 0])
        margin = int(min(self.width, self.height) * 0.04)

        # 根据锚点和product_bbox推算zone
        zone = find_safe_zone(self.width, self.height, self.product_bbox,
                            preferred_position=self._anchor_to_direction(position))

        # 应用offset
        if offset and len(offset) >= 2:
            zone["x1"] += int(offset[0])
            zone["y1"] += int(offset[1])

        return zone

    def _anchor_to_direction(self, anchor: str) -> str:
        """将锚点名称转为方向"""
        if isinstance(anchor, list):
            return "auto"
        mapping = {
            "top-left": "top", "top-center": "top", "top-right": "top",
            "middle-left": "left", "center-left": "left",
            "middle-right": "right", "center-right": "right",
            "bottom-left": "bottom", "bottom-center": "bottom", "bottom-right": "bottom",
            "middle-center": "auto", "center": "auto",
        }
        return mapping.get(anchor, "auto")

    def _resolve_text_position(self, text_cfg: dict, zone: Dict,
                               font_size: int, content: str, is_bold: bool) -> Tuple[int, int]:
        """解析文字位置"""
        # 如果直接指定了坐标
        position = text_cfg.get("position")
        if isinstance(position, (list, tuple)) and len(position) >= 2:
            return (int(position[0]), int(position[1]))

        # 使用zone的左上角
        margin = int(min(self.width, self.height) * 0.04)
        return (zone["x1"] + margin, zone["y1"] + margin)

    def _collect_decorations(self, image_cfg: dict):
        """收集装饰元素（金色线条等）"""
        if not self.brand_config:
            return

        # 根据标题位置自动添加装饰线
        for item in self.render_items:
            if item.role == "title" and item.z_index == Z_TEXT_CONTENT:
                bbox = item.get_bbox()
                line_y = bbox[3] + int(self.height * 0.008)
                line_w = int((bbox[2] - bbox[0]) * 0.4)
                line_h = max(4, int(self.height * 0.003))

                accent_hex = self.brand_config.get("colors", {}).get("accent", "#D4AF6A")
                accent_rgb = hex_to_rgb(accent_hex)

                self.render_items.append(TextRenderItem(
                    z_index=Z_DECORATION,
                    content=f"__LINE__:{json.dumps({'x': bbox[0], 'y': line_y, 'w': line_w, 'h': line_h})}",
                    position=(bbox[0], line_y),
                    font_size=0,
                    color=(*accent_rgb, 230),
                    role="decoration",
                ))
                break  # 只给第一个标题加装饰线

    def check_and_avoid_product(self):
        """检查并避让产品区域"""
        if not self.product_bbox:
            return

        pb = self.product_bbox
        for item in self.render_items:
            if item.z_index < Z_TEXT_CONTENT:
                continue  # 品牌元素不需要避让

            item_bbox_dict = {
                "x1": item.position[0],
                "y1": item.position[1],
                "x2": item.get_bbox()[2],
                "y2": item.get_bbox()[3],
            }

            if bbox_overlap(item_bbox_dict, pb):
                # 需要移动文字
                safe_zone = find_safe_zone(
                    self.width, self.height,
                    self.product_bbox,
                    preferred_position="auto"
                )
                item.position = (safe_zone["x1"] + 10, safe_zone["y1"] + 10)
                item._bbox_cache = None  # 清除缓存

    def render(self) -> Image.Image:
        """执行渲染，返回成品图"""
        result = self.canvas.copy()

        for item in self.render_items:
            if item.content.startswith("__LOGO__:"):
                self._render_logo(result, item)
            elif item.content.startswith("__BADGE__:"):
                self._render_badge(result, item)
            elif item.content.startswith("__GUARANTEE_BAR__:"):
                self._render_guarantee_bar(result, item)
            elif item.content.startswith("__LINE__:"):
                self._render_decoration_line(result, item)
            else:
                # 只渲染font_size > 0的文字元素
                if item.font_size > 0:
                    self._render_text(result, item)

        return result

    def _render_logo(self, canvas: Image.Image, item: TextRenderItem):
        """渲染Logo"""
        logo_path = item.content.split(":", 1)[1]
        try:
            logo = Image.open(logo_path).convert("RGBA")
            # 缩放
            max_w = item.max_width or int(self.width * 0.25)
            lw, lh = logo.size
            if lw > max_w:
                scale = max_w / lw
                logo = logo.resize((int(lw * scale), int(lh * scale)), Image.LANCZOS)

            # 深色场景自动转白色logo
            if self.is_dark:
                import numpy as np
                arr = np.array(logo).astype(float)
                is_colored = (arr[:,:,2] > 120) & (arr[:,:,0] < 80) & (arr[:,:,3] > 50)
                arr[is_colored, 0] = 240
                arr[is_colored, 1] = 240
                arr[is_colored, 2] = 245
                logo = Image.fromarray(arr.clip(0, 255).astype(np.uint8))

            canvas.paste(logo, item.position, logo)
        except Exception as e:
            print(f"  ⚠️ Logo渲染失败 ({logo_path}): {e}", file=sys.stderr)

    def _render_badge(self, canvas: Image.Image, item: TextRenderItem):
        """渲染徽章"""
        badge_path = item.content.split(":", 1)[1]
        try:
            badge = Image.open(badge_path).convert("RGBA")
            max_w = item.max_width or int(self.width * 0.14)
            bw, bh = badge.size
            if bw > max_w:
                scale = max_w / bw
                badge = badge.resize((int(bw * scale), int(bh * scale)), Image.LANCZOS)
            canvas.paste(badge, item.position, badge)
        except Exception as e:
            print(f"  ⚠️ 徽章渲染失败 ({badge_path}): {e}", file=sys.stderr)

    def _render_guarantee_bar(self, canvas: Image.Image, item: TextRenderItem):
        """渲染保障条"""
        data_str = item.content.split(":", 1)[1]
        data = json.loads(data_str)

        labels = data["labels"]
        bar_y = data["bar_y"]
        bar_h = data["bar_h"]
        bar_right = data["bar_right"]
        colors = data.get("colors", {})
        is_dark = data.get("is_dark", self.is_dark)

        draw = ImageDraw.Draw(canvas, "RGBA")
        margin = int(self.width * 0.03)

        # 保障条背景
        bar_bg_hex = colors.get("bar_bg_dark" if is_dark else "bar_bg_light",
                               "#0A0A0F" if is_dark else "#FFFFFF")
        bar_bg = (*hex_to_rgb(bar_bg_hex), 230)
        draw.rectangle([(0, bar_y), (bar_right, self.height)], fill=bar_bg)

        # 顶部装饰线
        accent_hex = colors.get("accent", "#D4AF6A")
        accent_rgb = hex_to_rgb(accent_hex)
        draw.line([(0, bar_y), (bar_right, bar_y)], fill=(*accent_rgb, 150), width=2)

        # 保障条文字
        font = load_font(item.font_size, bold=True)
        text_color = item.color
        text_y = bar_y + int((bar_h - item.font_size) / 2)
        n = len(labels)
        text_area = bar_right - margin * 2
        item_w = text_area // n if n > 0 else text_area

        for i, label in enumerate(labels):
            bbox = font.getbbox(label)
            tw = bbox[2] - bbox[0]
            tx = margin * 2 + i * item_w + (item_w - tw) // 2
            draw.text((tx, text_y), label, fill=text_color, font=font)
            # 分隔线
            if i < n - 1:
                sep_x = margin * 2 + (i + 1) * item_w
                draw.line([(sep_x, text_y + 2), (sep_x, text_y + item.font_size + 2)],
                         fill=(120, 120, 120, 100), width=1)

    def _render_text(self, canvas: Image.Image, item: TextRenderItem):
        """渲染普通文字（标题/副标题）"""
        font = load_font(item.font_size, item.bold)

        # 处理换行
        if item.max_width:
            lines = self._wrap_text(item.content, font, item.max_width)
        else:
            lines = item.content.split("\n")

        # 计算文字块尺寸
        line_h = int(item.font_size * 1.3)
        max_w = 0
        for line in lines:
            bbox = font.getbbox(line)
            w = bbox[2] - bbox[0]
            max_w = max(max_w, w)

        total_h = line_h * len(lines)
        text_bbox = (item.position[0], item.position[1],
                    item.position[0] + max_w, item.position[1] + total_h)

        # 可读性检测
        text_rgb = item.color[:3]
        readability = ensure_readability(canvas, text_rgb, text_bbox, self.is_dark)

        # 创建文字图层
        text_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        text_draw = ImageDraw.Draw(text_layer)

        # 绘制背景块（如需要）
        if readability["need_background"] and readability["bg_color"]:
            bg_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            bg_draw = ImageDraw.Draw(bg_layer)
            pad = int(item.font_size * 0.3)
            bg_rect = (text_bbox[0] - pad, text_bbox[1] - pad,
                      text_bbox[2] + pad, text_bbox[3] + pad)
            bg_draw.rounded_rectangle(bg_rect, radius=int(item.font_size * 0.15),
                                     fill=readability["bg_color"])
            canvas.alpha_composite(bg_layer)

        # 描边
        stroke_width = 2 if readability["need_stroke"] else 0
        stroke_fill = readability.get("stroke_color")

        # 绘制文字
        x, y = item.position
        for i, line in enumerate(lines):
            bbox = font.getbbox(line)
            w = bbox[2] - bbox[0]

            # 对齐
            if item.align == "center":
                lx = x + (max_w - w) // 2
            elif item.align == "right":
                lx = x + max_w - w
            else:
                lx = x

            ly = y + i * line_h

            if stroke_width > 0 and stroke_fill:
                text_draw.text((lx, ly), line, font=font, fill=item.color,
                             stroke_width=stroke_width, stroke_fill=stroke_fill)
            else:
                text_draw.text((lx, ly), line, font=font, fill=item.color)

            # 如果有自定义背景块或描边配置（来自plan.json）
            # 这里保持compose.py的兼容性

        canvas.alpha_composite(text_layer)

    def _render_decoration_line(self, canvas: Image.Image, item: TextRenderItem):
        """渲染装饰线条"""
        data_str = item.content.split(":", 1)[1]
        data = json.loads(data_str)

        draw = ImageDraw.Draw(canvas, "RGBA")
        x, y = data["x"], data["y"]
        w, h = data["w"], data["h"]
        draw.rounded_rectangle(
            [(x, y), (x + w, y + h)],
            radius=h // 2,
            fill=item.color
        )

    def _wrap_text(self, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> List[str]:
        """自动换行"""
        output_lines = []
        for hard_line in text.split("\n"):
            if not hard_line:
                output_lines.append("")
                continue
            current = ""
            for ch in hard_line:
                trial = current + ch
                bbox = font.getbbox(trial)
                w = bbox[2] - bbox[0]
                if w > max_width and current:
                    output_lines.append(current)
                    current = ch
                else:
                    current = trial
            if current:
                output_lines.append(current)
        return output_lines


# ============================================================================
# 处理单张图片
# ============================================================================

def process_single_image(image_cfg: dict, brand_config: Optional[dict],
                        scene_tone: str = "dark") -> Optional[Image.Image]:
    """
    处理单张图片的文字叠加

    Args:
        image_cfg: plan.json中单张图的配置
        brand_config: 品牌配置（可选）
        scene_tone: 场景色调

    Returns:
        处理后的Image，失败返回None
    """
    scene_path = image_cfg.get("scene_image", "")
    if not scene_path or not Path(scene_path).exists():
        print(f"  ❌ scene_image 不存在: {scene_path}", file=sys.stderr)
        return None

    # 加载底图
    img = Image.open(scene_path).convert("RGB")
    target_size = image_cfg.get("size")
    if target_size:
        tw, th = int(target_size[0]), int(target_size[1])
        if img.size != (tw, th):
            src_w, src_h = img.size
            scale = max(tw / src_w, th / src_h)
            new_w, new_h = int(src_w * scale), int(src_h * scale)
            img = img.resize((new_w, new_h), Image.LANCZOS)
            left = (new_w - tw) // 2
            top = (new_h - th) // 2
            img = img.crop((left, top, left + tw, top + th))

    # 创建引擎并渲染
    engine = TextEngine(img, {}, brand_config, scene_tone)
    engine.collect_items(image_cfg)
    engine.check_and_avoid_product()
    return engine.render()


# ============================================================================
# 主流程
# ============================================================================

def process_plan(plan_path: str, brand_name: Optional[str] = None,
                brand_config_path: Optional[str] = None,
                scene_tone: str = "dark",
                only_ids: Optional[set] = None) -> int:
    """
    处理整个plan.json

    Returns:
        0=成功, 1=plan不存在, 2=部分失败
    """
    plan_path_obj = Path(plan_path)
    if not plan_path_obj.exists():
        print(f"❌ plan.json 不存在: {plan_path}", file=sys.stderr)
        return 1

    with open(plan_path, "r", encoding="utf-8") as f:
        plan = json.load(f)

    output_dir = Path(plan.get("output_dir", ""))
    if not output_dir:
        print("❌ plan.output_dir 未设置", file=sys.stderr)
        return 1
    output_dir.mkdir(parents=True, exist_ok=True)

    # 加载品牌配置
    brand_config = None
    if brand_name:
        brand_config = load_brand_config(brand_name, scene_tone)
    elif brand_config_path:
        brand_config = load_brand_config_from_file(brand_config_path)

    if brand_config:
        print(f"🎨 品牌配置已加载: {brand_config.get('brand_name', 'unknown')}")
    else:
        print("📝 无品牌配置，仅渲染文字")

    # 收集所有图片
    all_images = []
    for kind, items in [("main", plan.get("main_images", [])),
                        ("detail", plan.get("detail_images", []))]:
        for img_cfg in items:
            all_images.append((kind, img_cfg))

    if not all_images:
        print("⚠️ plan 中未定义任何图片", file=sys.stderr)
        return 1

    # 逐张处理
    success, failed = [], []
    for kind, img_cfg in all_images:
        img_id = img_cfg.get("id", "unknown")
        if only_ids and img_id not in only_ids:
            continue

        print(f"\n🎨 渲染 {img_id} ...")
        try:
            result = process_single_image(img_cfg, brand_config, scene_tone)
            if result is None:
                failed.append((img_id, "scene_image 加载失败"))
                continue

            out_path = output_dir / f"{img_id}.png"
            result.convert("RGB").save(out_path, "PNG", optimize=True)
            success.append((img_id, str(out_path)))
            print(f"  ✅ {out_path} ({result.width}x{result.height})")
        except Exception as e:
            print(f"  ❌ 失败: {e}", file=sys.stderr)
            failed.append((img_id, str(e)))

    # 汇总
    print(f"\n{'='*60}")
    print(f"完成: 成功 {len(success)} / 失败 {len(failed)}")
    print(f"输出目录: {output_dir}")

    if success:
        print("\n成品清单:")
        for img_id, path in success:
            print(f"  - {img_id}: {path}")

    if failed:
        print("\n失败清单:")
        for img_id, err in failed:
            print(f"  - {img_id}: {err}")
        return 2

    return 0


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="统一文字管理引擎 — 电商素材一站式工坊",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 处理整个plan.json
  python text_engine.py --plan /path/to/plan.json --brand langke --scene-tone dark

  # 只处理特定图片
  python text_engine.py --plan /path/to/plan.json --only main_01,main_02

  # 使用外部品牌配置文件
  python text_engine.py --plan /path/to/plan.json --brand-config /path/to/brand.json

  # 处理单张图片（直接模式）
  python text_engine.py --input /path/to/scene.png --plan /path/to/plan.json --image-id main_01

z-index 分层:
  Layer 0: 场景背景底图
  Layer 1: 产品图（已合成到scene_image中）
  Layer 2: 品牌Logo（左上角）
  Layer 3: 保障条（底部）
  Layer 4: 徽章（右下角）
  Layer 5: 卖点标题+副标题（根据text_zones布局）
  Layer 6: 装饰元素（金色线条、分隔符等）
        """
    )
    parser.add_argument("--plan", help="plan.json 路径")
    parser.add_argument("--input", help="单张图片路径（直接模式）")
    parser.add_argument("--image-id", help="指定处理的图片ID（配合--input使用）")
    parser.add_argument("--output", help="输出路径（直接模式时使用）")
    parser.add_argument("--brand", help="品牌名称（自动加载品牌配置）")
    parser.add_argument("--brand-config", help="品牌配置JSON路径")
    parser.add_argument("--scene-tone", default="dark", choices=["dark", "light"],
                       help="场景色调 (default: dark)")
    parser.add_argument("--only", help="只渲染指定ID（逗号分隔）")

    args = parser.parse_args()

    if args.input:
        # 直接模式：处理单张图片
        if not args.plan:
            print("❌ 直接模式需要 --plan 参数提供文字配置", file=sys.stderr)
            sys.exit(1)

        with open(args.plan, "r", encoding="utf-8") as f:
            plan = json.load(f)

        # 找到对应图片配置
        image_cfg = None
        for items in [plan.get("main_images", []), plan.get("detail_images", [])]:
            for img in items:
                if img.get("id") == args.image_id:
                    image_cfg = img
                    break

        if not image_cfg:
            print(f"❌ 未找到图片ID: {args.image_id}", file=sys.stderr)
            sys.exit(1)

        # 覆盖scene_image
        image_cfg["scene_image"] = args.input

        brand_config = None
        if args.brand:
            brand_config = load_brand_config(args.brand, args.scene_tone)
        elif args.brand_config:
            brand_config = load_brand_config_from_file(args.brand_config)

        result = process_single_image(image_cfg, brand_config, args.scene_tone)
        if result:
            out_path = args.output or args.input.replace(".png", "_text.png")
            result.convert("RGB").save(out_path, "PNG", optimize=True)
            print(f"✅ 已输出: {out_path}")
        else:
            sys.exit(1)

    elif args.plan:
        # 批量模式：处理整个plan
        only_ids = set()
        if args.only:
            only_ids = {x.strip() for x in args.only.split(",") if x.strip()}

        exit_code = process_plan(
            plan_path=args.plan,
            brand_name=args.brand,
            brand_config_path=args.brand_config,
            scene_tone=args.scene_tone,
            only_ids=only_ids,
        )
        sys.exit(exit_code)

    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
