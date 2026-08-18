#!/usr/bin/env python3
"""
layout_engine.py — 素材工坊布局引擎 v1.0
==========================================
核心职责：将分散的比例计算、场景构图、文字排版、品牌叠加统一到一个布局引擎中，
输出标准化的 LayoutPlan JSON。

架构来源：
- calc_scale.py：物理尺寸→像素比例
- compose_v12.py：6种文字布局策略
- brand_assets_v3.py：品牌元素布局参数（margin=3%, logo=25%, badge=14%, bar_h=5.5%）
- 视觉布局原则_v1.md：四层空间模型 + 安全区域规则

作者：素材工坊
"""

import json
import os
import sys
from dataclasses import dataclass, field, asdict

# 尝试导入场景感知合成器的场景配置（用于参照物 prompt）
try:
    _engine_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, _engine_dir)
    from scene_aware_compositor import SCENE_CONFIGS as _SCENE_CONFIGS
    HAS_SCENE_CONFIGS = True
except ImportError:
    HAS_SCENE_CONFIGS = False
    _SCENE_CONFIGS = {}
from typing import Optional

# ============================================================================
# 数据结构
# ============================================================================

@dataclass
class LayoutPlan:
    """布局方案——布局引擎的最终输出"""
    canvas_w: int
    canvas_h: int
    product_bbox: dict          # {"x1","y1","x2","y2","scale_ratio"} 绝对像素
    text_zones: list            # [{"id","bbox":{"x1","y1","x2","y2"},"layout_type","max_lines"}]
    brand_zones: dict           # {"logo":{"x1","y1","x2","y2"},"guarantee_bar":{...},"badge_365":{...}}
    scene_tone: str             # "dark" or "light"
    scene_prompt_suffix: str    # 场景生成时的空间约束prompt
    safety_margin: float        # 元素间最小间距（占画布宽度比例）
    image_id: str = ""
    image_type: str = ""
    position_strategy: str = ""
    scale_ratio: float = 0.0    # 产品占画布比例
    layout_strategy: str = ""   # 文字布局策略名称

    def to_dict(self):
        return asdict(self)

    def to_json(self, indent=2):
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)


# ============================================================================
# 产品位置策略表
# ============================================================================

PRODUCT_POSITION_STRATEGIES = {
    # 主图：产品主导
    "main_01": {"position": "center",       "scale_range": (0.45, 0.60), "priority": "product",   "text_hint": "bottom"},
    "main_02": {"position": "center-right",  "scale_range": (0.50, 0.65), "priority": "product",   "text_hint": "left"},
    "main_03": {"position": "center",       "scale_range": (0.55, 0.70), "priority": "product",   "text_hint": "left"},
    "main_04": {"position": "center",       "scale_range": (0.40, 0.50), "priority": "balanced",  "text_hint": "top"},
    "main_05": {"position": "center",       "scale_range": (0.50, 0.65), "priority": "product",   "text_hint": "bottom"},

    # 详情图：图文并排
    "detail_01": {"position": "center",     "scale_range": (0.0,  0.0),  "priority": "text",      "text_hint": "center", "note": "痛点图不放产品"},
    "detail_02": {"position": "center-right","scale_range": (0.35, 0.45), "priority": "balanced",  "text_hint": "left"},
    "detail_03": {"position": "center-right","scale_range": (0.35, 0.45), "priority": "balanced",  "text_hint": "top"},
    "detail_04": {"position": "center",     "scale_range": (0.40, 0.50), "priority": "balanced",  "text_hint": "bottom"},
    "detail_05": {"position": "center",     "scale_range": (0.35, 0.45), "priority": "balanced",  "text_hint": "top"},
    "detail_06": {"position": "center",     "scale_range": (0.35, 0.45), "priority": "balanced",  "text_hint": "bottom"},
}

# 文字布局策略名称映射（与compose_v12的6种布局对应）
LAYOUT_STRATEGY_MAP = {
    "bottom_band":      {"name": "底部色带", "num": 1},
    "top_left_minimal":  {"name": "左上极简", "num": 2},
    "left_column":       {"name": "左侧栏",   "num": 3},
    "right_column":      {"name": "右侧栏",   "num": 4},
    "bottom_clean":      {"name": "底部干净区","num": 5},
    "top_band":          {"name": "顶部色带",  "num": 6},
}


# ============================================================================
# 比例计算（源自 calc_scale.py）
# ============================================================================

def calculate_scale(product_width_mm, product_height_mm=None,
                    ref_width_mm=80, canvas_width=1024, canvas_height=1024,
                    product_ratio=0.42):
    """
    根据产品物理尺寸计算在画布上的像素比例。
    
    与 calc_scale.py 完全一致的计算逻辑：
    - width_ratio = product_width_mm / ref_width_mm
    - product_canvas_ratio = width_ratio * product_ratio, clamped to [0.1, 0.8]
    
    Args:
        product_width_mm: 产品宽度(mm)
        product_height_mm: 产品高度(mm)，可选
        ref_width_mm: 参照物宽度(mm)，默认80mm(手掌宽)
        canvas_width: 画布宽度(px)
        canvas_height: 画布高度(px)
        product_ratio: 产品占参照物比例
    
    Returns:
        dict with product_canvas_ratio, pixel_width, pixel_height
    """
    width_ratio = product_width_mm / ref_width_mm
    product_canvas_ratio = round(width_ratio * product_ratio, 4)
    product_canvas_ratio = max(0.1, min(0.8, product_canvas_ratio))

    result = {
        "product_canvas_ratio": product_canvas_ratio,
        "pixel_width": int(canvas_width * product_canvas_ratio),
        "canvas_width": canvas_width,
        "canvas_height": canvas_height,
        "product_width_mm": product_width_mm,
        "ref_width_mm": ref_width_mm,
    }

    if product_height_mm:
        aspect = product_height_mm / product_width_mm
        result["pixel_height"] = int(result["pixel_width"] * aspect)
        result["product_height_mm"] = product_height_mm

    return result


# ============================================================================
# 布局引擎核心类
# ============================================================================

class LayoutEngine:
    """
    素材工坊布局引擎 v1.0
    
    核心方法 plan() 的输出是一个完整的 LayoutPlan，涵盖：
    1. 产品位置与比例（基于物理尺寸 + 位置策略）
    2. 文字安全区域（根据产品位置自动避让）
    3. 品牌元素位置（logo / 保障条 / 365标识）
    4. 场景生成空间约束 prompt
    5. 冲突检测与自动修正
    """

    # ---------- 品牌区参数（源自 brand_assets_v3.py v17验证值）----------
    LOGO_MAX_WIDTH_RATIO = 0.25       # Logo最大宽度 = 25%画布宽
    LOGO_MARGIN_RATIO = 0.03          # Logo边距 = 3%画布宽
    BADGE_MAX_WIDTH_RATIO = 0.14      # 365标识最大宽度 = 14%画布宽
    GUARANTEE_BAR_HEIGHT_RATIO = 0.055  # 保障条高度 = 5.5%画布高
    SAFE_MARGIN_RATIO = 0.05          # 元素间最小间距 = 5%画布宽
    BRAND_ZONE_TOP_RATIO = 0.14       # 品牌区上边界 = 14%画布高
    GUARANTEE_ZONE_BOTTOM_RATIO = 0.98  # 保障区下边界 = 98%画布高

    def __init__(self, canvas_w=1000, canvas_h=1000, brand_kit_path=None):
        """
        初始化布局引擎。
        
        Args:
            canvas_w: 画布宽度(px)
            canvas_h: 画布高度(px)
            brand_kit_path: 品牌资源包路径（可选，用于精确计算logo/badge实际尺寸）
        """
        self.canvas_w = canvas_w
        self.canvas_h = canvas_h
        self.brand_kit_path = brand_kit_path
    
    # ================================================================
    # 公开接口
    # ================================================================

    def plan(self, product_width_mm, product_height_mm=None,
             canvas_w=None, canvas_h=None,
             image_type="main", image_id="main_01",
             scene_type="tech_gradient",
             texts=None, brand_name=None,
             product_view="front",
             ref_width_mm=80, product_ratio=0.42) -> LayoutPlan:
        """
        核心方法：计算完整布局方案。
        
        流程：
        1. 用calc_scale逻辑算产品比例（物理尺寸→像素比例）
        2. 根据image_type+image_id确定产品位置策略
        3. 计算product_bbox
        4. 根据product_bbox计算text_zones（文字安全区域）
        5. 计算brand_zones（logo/保障条/365标识区域）
        6. 生成scene_prompt_suffix（空间约束prompt）
        7. 冲突检测（确保zones互不重叠）
        
        Args:
            product_width_mm: 产品宽度(mm)
            product_height_mm: 产品高度(mm)，可选
            canvas_w: 覆盖默认画布宽度
            canvas_h: 覆盖默认画布高度
            image_type: "main" 或 "detail"
            image_id: 图片ID（如 "main_01", "detail_03"）
            scene_type: 场景类型
            texts: 文字内容列表 [{"content":..., "style":...}]
            brand_name: 品牌名（默认不直接使用，品牌区用Logo PNG）
            product_view: 产品视角 ("front","left","right","bottom","tilted_45")
            ref_width_mm: 参照物宽度(mm)
            product_ratio: 产品占参照物比例
        
        Returns:
            LayoutPlan
        """
        # 允许覆盖画布尺寸
        if canvas_w is not None:
            self.canvas_w = canvas_w
        if canvas_h is not None:
            self.canvas_h = canvas_h

        cw, ch = self.canvas_w, self.canvas_h

        # Step 1: 比例计算
        scale_info = calculate_scale(
            product_width_mm, product_height_mm,
            ref_width_mm=ref_width_mm,
            canvas_width=cw, canvas_height=ch,
            product_ratio=product_ratio
        )
        calc_ratio = scale_info["product_canvas_ratio"]

        # Step 2: 获取位置策略
        strategy = self._get_position_strategy(image_type, image_id)
        
        # 确定最终scale_ratio：在策略范围内结合calc_ratio
        scale_lo, scale_hi = strategy["scale_range"]
        if scale_hi == 0.0 and scale_lo == 0.0:
            # 不放产品的特殊图（如痛点图）
            final_scale = 0.0
        else:
            # calc_ratio作为基础参考，但受策略范围约束
            final_scale = max(scale_lo, min(scale_hi, calc_ratio))
            # 如果calc_ratio超出策略范围，使用策略范围的中值
            if calc_ratio < scale_lo or calc_ratio > scale_hi:
                final_scale = (scale_lo + scale_hi) / 2

        # Step 3: 计算product_bbox
        product_bbox = self._compute_product_bbox(
            final_scale, strategy, cw, ch, product_height_mm, product_width_mm
        )

        # Step 4: 计算text_zones
        text_zones = self._compute_text_zones(
            product_bbox, image_type, image_id, texts, strategy
        )

        # Step 5: 计算brand_zones
        brand_zones = self._compute_brand_zones(cw, ch, product_bbox)

        # Step 6: 场景色调
        scene_tone = self._infer_scene_tone(scene_type, image_id)

        # Step 7: 生成空间约束prompt（含参照物描述）
        scene_prompt_suffix = self._generate_scene_prompt_suffix(product_bbox, cw, ch, scene_type=scene_type)

        # Step 8: 冲突检测与修正
        plan = LayoutPlan(
            canvas_w=cw,
            canvas_h=ch,
            product_bbox=product_bbox,
            text_zones=text_zones,
            brand_zones=brand_zones,
            scene_tone=scene_tone,
            scene_prompt_suffix=scene_prompt_suffix,
            safety_margin=self.SAFE_MARGIN_RATIO,
            image_id=image_id,
            image_type=image_type,
            position_strategy=strategy["position"],
            scale_ratio=final_scale,
            layout_strategy=self._get_layout_strategy_name(
                product_bbox, cw, ch, strategy
            ),
        )

        # 冲突检测
        conflicts = self._detect_conflicts(plan)
        if conflicts:
            plan = self._resolve_conflicts(plan, conflicts)

        return plan

    # ================================================================
    # 内部方法：位置策略
    # ================================================================

    def _get_position_strategy(self, image_type, image_id):
        """获取产品位置策略"""
        key = image_id
        if key in PRODUCT_POSITION_STRATEGIES:
            return PRODUCT_POSITION_STRATEGIES[key]
        # fallback
        if image_type == "detail":
            return PRODUCT_POSITION_STRATEGIES["detail_06"]
        return PRODUCT_POSITION_STRATEGIES["main_01"]

    def _get_layout_strategy_name(self, product_bbox, cw, ch, strategy):
        """根据产品位置确定文字布局策略名称"""
        if product_bbox["x1"] == 0 and product_bbox["x2"] == 0:
            # 无产品图
            return "bottom_band"

        center_x_ratio = (product_bbox["x1"] + product_bbox["x2"]) / 2 / cw
        center_y_ratio = (product_bbox["y1"] + product_bbox["y2"]) / 2 / ch
        top_ratio = product_bbox["y1"] / ch
        bottom_ratio = product_bbox["y2"] / ch

        hint = strategy.get("text_hint", "")
        
        # 根据hint和product位置综合判断
        if hint == "left" or center_x_ratio > 0.55:
            return "left_column"
        elif hint == "top" or (top_ratio > 0.35 and center_y_ratio < 0.4):
            return "top_band"
        elif hint == "bottom" or bottom_ratio < 0.65:
            return "bottom_band"
        elif center_x_ratio < 0.45:
            return "right_column"
        elif hint == "center":
            return "bottom_band"
        else:
            return "left_column"

    # ================================================================
    # 内部方法：产品bbox计算
    # ================================================================

    def _compute_product_bbox(self, scale_ratio, strategy, cw, ch,
                              product_height_mm=None, product_width_mm=None):
        """
        计算产品的绝对像素bbox。
        
        Args:
            scale_ratio: 产品占画布比例
            strategy: 位置策略dict
            cw, ch: 画布尺寸
            product_height_mm: 产品高度（用于计算宽高比）
            product_width_mm: 产品宽度（用于计算宽高比）
        
        Returns:
            dict: {"x1","y1","x2","y2","scale_ratio"}
        """
        if scale_ratio == 0.0:
            return {"x1": 0, "y1": 0, "x2": 0, "y2": 0, "scale_ratio": 0.0}

        # 产品宽度（像素）
        pw = int(cw * scale_ratio)
        
        # 产品高度：如果有物理尺寸，按比例算；否则默认1:1
        if product_height_mm and product_width_mm and product_width_mm > 0:
            aspect = product_height_mm / product_width_mm
            ph = int(pw * aspect)
        else:
            ph = pw  # 默认正方形
        
        # 产品不应超过画布高度的80%
        max_ph = int(ch * 0.80)
        if ph > max_ph:
            ph = max_ph
            # 反算宽度保持比例
            if product_height_mm and product_width_mm and product_height_mm > 0:
                pw = int(ph * product_width_mm / product_height_mm)

        # 根据position策略确定中心点
        position = strategy["position"]
        cx, cy = self._resolve_position(position, cw, ch, pw, ph)

        x1 = cx - pw // 2
        y1 = cy - ph // 2
        x2 = x1 + pw
        y2 = y1 + ph

        # 边界修正：不超出画布
        if x1 < 0:
            x2 -= x1
            x1 = 0
        if y1 < 0:
            y2 -= y1
            y1 = 0
        if x2 > cw:
            x1 -= (x2 - cw)
            x2 = cw
        if y2 > ch:
            y1 -= (y2 - ch)
            y2 = ch

        return {
            "x1": x1, "y1": y1,
            "x2": x2, "y2": y2,
            "scale_ratio": round(scale_ratio, 4),
        }

    def _resolve_position(self, position, cw, ch, pw, ph):
        """
        根据位置策略计算产品中心点。
        
        位置策略:
        - "center": 画面正中
        - "center-right": 水平偏右（55%），垂直居中
        - "right": 靠右（70%），垂直居中
        - "left": 靠左（35%），垂直居中
        - "center-left": 水平偏左（45%），垂直居中
        """
        position_map = {
            "center":        (0.50, 0.45),
            "center-right":  (0.55, 0.48),
            "right":         (0.68, 0.48),
            "left":          (0.35, 0.48),
            "center-left":   (0.42, 0.48),
        }
        rx, ry = position_map.get(position, (0.50, 0.45))
        return int(cw * rx), int(ch * ry)

    # ================================================================
    # 内部方法：文字区域计算
    # ================================================================

    def _compute_text_zones(self, product_bbox, image_type, image_id, texts, strategy):
        """
        根据产品位置，自动选择文字布局并计算安全区域。
        
        决策树（与视觉布局原则v1一致）：
        1. 无产品 → 全画面文字区
        2. 产品居中偏右(center_x > 0.55) → 文字放左侧
        3. 产品居中偏左(center_x < 0.45) → 文字放右侧
        4. 产品占满中心 → 文字放顶部或底部色带
        5. 产品在上方(bottom < 0.6) → 文字放底部
        6. 产品在下方(top > 0.35) → 文字放顶部
        
        每种情况计算text_zone bbox，确保：
        - 不覆盖product_bbox（+5%安全间距）
        - 不覆盖brand_zones
        - 宽度足够容纳文字（至少20%画布宽度）
        """
        cw, ch = self.canvas_w, self.canvas_h
        margin_px = int(cw * self.SAFE_MARGIN_RATIO)

        # 无产品的特殊图（痛点图）
        pw = product_bbox["x2"] - product_bbox["x1"]
        if pw == 0:
            return [self._make_text_zone(
                "main_text", 
                int(cw * 0.06), int(ch * 0.06),
                int(cw * 0.94), int(ch * 0.40),
                "center_full", max_lines=4
            )]

        # 计算产品归一化位置
        pcx = (product_bbox["x1"] + product_bbox["x2"]) / 2 / cw
        pcy = (product_bbox["y1"] + product_bbox["y2"]) / 2 / ch
        p_top = product_bbox["y1"] / ch
        p_bottom = product_bbox["y2"] / ch
        p_left = product_bbox["x1"] / cw
        p_right = product_bbox["x2"] / cw

        hint = strategy.get("text_hint", "")
        zones = []

        # ---------- 策略A: 文字在左侧 ----------
        if hint == "left" or (pcx > 0.55 and hint != "top" and hint != "bottom"):
            # 左侧文字区域：从左边距到产品左边界-间距
            text_right = product_bbox["x1"] - margin_px
            text_left = int(cw * 0.04)
            text_top = max(int(ch * 0.16), product_bbox["y1"])  # 不低于产品顶部
            text_bottom = min(int(ch * 0.85), product_bbox["y2"])  # 不高于产品底部

            # 确保最小宽度
            min_w = int(cw * 0.20)
            if text_right - text_left < min_w:
                text_left = max(0, text_right - min_w)
            
            zones.append(self._make_text_zone(
                "main_text", text_left, text_top, text_right, text_bottom,
                "left_column", max_lines=4
            ))

        # ---------- 策略B: 文字在右侧 ----------
        elif hint == "right" or pcx < 0.45:
            text_left = product_bbox["x2"] + margin_px
            text_right = int(cw * 0.96)
            text_top = max(int(ch * 0.16), product_bbox["y1"])
            text_bottom = min(int(ch * 0.85), product_bbox["y2"])

            min_w = int(cw * 0.20)
            if text_right - text_left < min_w:
                text_right = min(cw, text_left + min_w)

            zones.append(self._make_text_zone(
                "main_text", text_left, text_top, text_right, text_bottom,
                "right_column", max_lines=4
            ))

        # ---------- 策略C: 文字在顶部色带 ----------
        elif hint == "top" or p_top > 0.35:
            # 顶部色带区域：品牌区下方，产品上方
            text_top = int(ch * 0.03)
            text_bottom = min(product_bbox["y1"] - margin_px, int(ch * 0.18))
            if text_bottom - text_top < int(ch * 0.08):
                text_bottom = int(ch * 0.18)
            
            # 顶部色带文字从logo右侧开始（避开logo区）
            text_left = int(cw * 0.38)
            text_right = int(cw * 0.95)

            zones.append(self._make_text_zone(
                "main_text", text_left, text_top, text_right, text_bottom,
                "top_band", max_lines=2
            ))

        # ---------- 策略D: 文字在底部色带 ----------
        elif hint == "bottom" or p_bottom < 0.65:
            # 底部色带：产品下方到保障条上方
            text_top = max(product_bbox["y2"] + margin_px, int(ch * 0.70))
            text_bottom = int(ch * 0.88)  # 保障条上边界
            text_left = int(cw * 0.06)
            text_right = int(cw * 0.94)

            if text_bottom - text_top < int(ch * 0.08):
                # 空间不够，使用overlay式底部色带
                text_top = int(ch * 0.82)
                text_bottom = int(ch * 0.88)

            zones.append(self._make_text_zone(
                "main_text", text_left, text_top, text_right, text_bottom,
                "bottom_band", max_lines=2
            ))

        # ---------- 策略E: 默认（底部色带兜底）----------
        else:
            text_top = max(product_bbox["y2"] + margin_px, int(ch * 0.75))
            text_bottom = int(ch * 0.88)
            text_left = int(cw * 0.06)
            text_right = int(cw * 0.94)

            zones.append(self._make_text_zone(
                "main_text", text_left, text_top, text_right, text_bottom,
                "bottom_band", max_lines=2
            ))

        # 如果有副文本（多行副标题），添加辅助文字区
        if texts and len(texts) > 1:
            # 副文本放在主文本下方
            main_zone = zones[0]
            sub_top = main_zone["bbox"]["y2"] + int(ch * 0.01)
            sub_bottom = min(sub_top + int(ch * 0.10), int(ch * 0.88))
            if sub_bottom > sub_top:
                zones.append(self._make_text_zone(
                    "sub_text",
                    main_zone["bbox"]["x1"], sub_top,
                    main_zone["bbox"]["x2"], sub_bottom,
                    "sub_text", max_lines=2
                ))

        return zones

    def _make_text_zone(self, zone_id, x1, y1, x2, y2, layout_type, max_lines=2):
        """构造文字区域dict"""
        return {
            "id": zone_id,
            "bbox": {
                "x1": max(0, x1),
                "y1": max(0, y1),
                "x2": min(self.canvas_w, x2),
                "y2": min(self.canvas_h, y2),
            },
            "layout_type": layout_type,
            "max_lines": max_lines,
        }

    # ================================================================
    # 内部方法：品牌区域计算
    # ================================================================

    def _compute_brand_zones(self, cw, ch, product_bbox):
        """
        计算品牌元素的绝对像素位置。
        
        固定规则（源自brand_assets_v3.py v17验证参数）：
        - Logo: 左上角，max_width = 25%画布宽，margin = 3%
        - 保障条: 底部，高度5.5%画布高，右边界 = badge_x - margin
        - 365标识: 右下角，max_width = 14%画布宽
        - 关键：保障条右边界要给365标识留空，不能重叠
        
        四层空间模型（源自视觉布局原则v1）：
        - 品牌区: 0~14% 高度
        - 内容区: 14%~88% 高度
        - 保障区: 88%~98% 高度
        - 安全边距: 98%~100% 高度
        """
        margin = int(cw * self.LOGO_MARGIN_RATIO)  # 3%
        
        # === Logo区域 ===
        logo_max_w = int(cw * self.LOGO_MAX_WIDTH_RATIO)  # 25%
        # Logo高宽比约0.4（含slogan），估算实际高度
        logo_h = int(logo_max_w * 0.4)
        logo_zone = {
            "x1": margin,
            "y1": margin,
            "x2": margin + logo_max_w,
            "y2": margin + logo_h,
        }

        # === 365标识区域 ===
        badge_max_w = int(cw * self.BADGE_MAX_WIDTH_RATIO)  # 14%
        # badge高宽比约1.0（圆形/方形）
        badge_h = int(badge_max_w * 0.85)
        badge_x = cw - badge_max_w - margin
        # 保障条高度
        bar_h = int(ch * self.GUARANTEE_BAR_HEIGHT_RATIO)  # 5.5%
        bar_y = ch - bar_h - margin
        # badge底部在保障条上方，留2%间距
        badge_y = bar_y - badge_h - int(ch * 0.02)
        
        badge_zone = {
            "x1": badge_x,
            "y1": badge_y,
            "x2": badge_x + badge_max_w,
            "y2": badge_y + badge_h,
        }

        # === 保障条区域 ===
        # 保障条右边界 = badge左边界 - margin（给365标识留空）
        bar_right = badge_x - margin
        guarantee_bar_zone = {
            "x1": 0,
            "y1": bar_y,
            "x2": bar_right,
            "y2": ch - margin,
        }

        return {
            "logo": logo_zone,
            "guarantee_bar": guarantee_bar_zone,
            "badge_365": badge_zone,
        }

    # ================================================================
    # 内部方法：场景色调推断
    # ================================================================

    def _infer_scene_tone(self, scene_type, image_id):
        """根据场景类型推断色调"""
        dark_scenes = [
            "tech_gradient", "tech_dark", "dark_business", "hotel_night",
            "luxury_dark", "brushed_metal", "carbon_fiber"
        ]
        light_scenes = [
            "white_clean", "white_studio", "bright_natural", "bathroom_bright"
        ]
        if scene_type in dark_scenes:
            return "dark"
        elif scene_type in light_scenes:
            return "light"
        # 根据image_id推断
        if image_id in ("main_05", "detail_06"):
            return "light"  # 参数图通常白底
        return "dark"  # 默认暗色

    # ================================================================
    # 内部方法：空间约束prompt生成
    # ================================================================

    def _generate_scene_prompt_suffix(self, product_bbox, cw, ch, scene_type=None):
        """
        生成场景生成时的空间约束prompt。
        
        v1.1 改进：
        - 不再使用 "keep area empty"（会导致 AI 生成黑色方块）
        - 改为 "continuous scene texture, no prominent objects"
        - 如果 scene_type 有对应的参照物配置，自动追加参照物描述
        
        Args:
            product_bbox: 产品区域的像素坐标
            cw, ch: 画布宽高
            scene_type: 场景类型（可选，用于追加参照物描述）
        """
        pw = product_bbox["x2"] - product_bbox["x1"]
        if pw == 0:
            return "full frame scene, no reserved area needed"

        # 核心约束：连续纹理 + 无突出物体（替代旧的 "keep empty" 方案）
        prompt = (
            "should have continuous scene texture and soft lighting "
            "matching the overall scene style, no prominent objects"
        )

        # 如果有场景类型的参照物配置，追加参照物描述
        if scene_type and HAS_SCENE_CONFIGS and scene_type in _SCENE_CONFIGS:
            config = _SCENE_CONFIGS[scene_type]
            if config.reference_objects:
                ref_descriptions = ", ".join(
                    ref.prompt_desc for ref in config.reference_objects
                )
                prompt += f", {ref_descriptions}"

        return prompt

    # ================================================================
    # 冲突检测与修正
    # ================================================================

    def _detect_conflicts(self, plan):
        """
        检测所有zones之间是否有重叠。
        
        检查：
        - product_bbox vs text_zones
        - product_bbox vs brand_zones
        - text_zones vs brand_zones
        - brand_zones之间（logo vs guarantee vs badge）
        
        Returns:
            list of conflict tuples: (zone_a_name, zone_a_bbox, zone_b_name, zone_b_bbox)
        """
        conflicts = []
        bboxes = {}
        bboxes["product"] = plan.product_bbox
        
        for i, tz in enumerate(plan.text_zones):
            bboxes[f"text_{i}"] = tz["bbox"]
        
        for key, bz in plan.brand_zones.items():
            bboxes[f"brand_{key}"] = bz

        # 两两检测重叠
        names = list(bboxes.keys())
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                a_name = names[i]
                b_name = names[j]
                a = bboxes[a_name]
                b = bboxes[b_name]
                
                # 跳过空bbox
                if (a["x2"] - a["x1"]) <= 0 or (b["x2"] - b["x1"]) <= 0:
                    continue
                
                # AABB重叠检测
                if self._bbox_overlap(a, b):
                    overlap_area = self._overlap_area(a, b)
                    # 只在重叠面积大于小区域5%时报告冲突
                    min_area = min(
                        (a["x2"]-a["x1"]) * (a["y2"]-a["y1"]),
                        (b["x2"]-b["x1"]) * (b["y2"]-b["y1"])
                    )
                    if min_area > 0 and overlap_area / min_area > 0.05:
                        conflicts.append((a_name, a, b_name, b))

        return conflicts

    def _bbox_overlap(self, a, b):
        """AABB重叠检测"""
        return not (
            a["x2"] <= b["x1"] or b["x2"] <= a["x1"] or
            a["y2"] <= b["y1"] or b["y2"] <= a["y1"]
        )

    def _overlap_area(self, a, b):
        """计算重叠面积"""
        ox1 = max(a["x1"], b["x1"])
        oy1 = max(a["y1"], b["y1"])
        ox2 = min(a["x2"], b["x2"])
        oy2 = min(a["y2"], b["y2"])
        if ox2 <= ox1 or oy2 <= oy1:
            return 0
        return (ox2 - ox1) * (oy2 - oy1)

    def _resolve_conflicts(self, plan, conflicts):
        """
        尝试自动修正冲突。
        
        修正策略：
        1. text vs product: 缩小文字区域，使其不覆盖产品
        2. text vs brand: 缩小文字区域，避开品牌区
        3. product vs brand: 产品优先，品牌区不动（品牌区是固定的）
        4. brand内部: 保障条右边界收缩
        """
        for a_name, a_bbox, b_name, b_bbox in conflicts:
            # 文字区 vs 产品区：缩小文字区
            if a_name.startswith("text_") and b_name == "product":
                self._shrink_text_zone(plan, a_name, b_bbox)
            elif a_name == "product" and b_name.startswith("text_"):
                self._shrink_text_zone(plan, b_name, a_bbox)
            # 文字区 vs 品牌区：缩小文字区
            elif a_name.startswith("text_") and b_name.startswith("brand_"):
                self._shrink_text_zone(plan, a_name, b_bbox)
            elif a_name.startswith("brand_") and b_name.startswith("text_"):
                self._shrink_text_zone(plan, b_name, a_bbox)
            # 保障条 vs 365标识：收缩保障条右边界
            elif a_name == "brand_guarantee_bar" and b_name == "brand_badge_365":
                for tz in plan.text_zones:
                    pass  # brand_zones已在_compute_brand_zones中处理
                # 直接修正保障条右边界
                plan.brand_zones["guarantee_bar"]["x2"] = (
                    plan.brand_zones["badge_365"]["x1"] - int(self.canvas_w * self.LOGO_MARGIN_RATIO)
                )
        
        return plan

    def _shrink_text_zone(self, plan, zone_name, obstacle_bbox):
        """缩小文字区域以避开障碍区域"""
        for tz in plan.text_zones:
            if f"text_{plan.text_zones.index(tz)}" == zone_name:
                bbox = tz["bbox"]
                # 尝试从右侧收缩
                if bbox["x1"] < obstacle_bbox["x2"] < bbox["x2"]:
                    tz["bbox"]["x1"] = obstacle_bbox["x2"] + int(self.canvas_w * self.SAFE_MARGIN_RATIO)
                # 尝试从左侧收缩
                elif bbox["x1"] < obstacle_bbox["x1"] < bbox["x2"]:
                    tz["bbox"]["x2"] = obstacle_bbox["x1"] - int(self.canvas_w * self.SAFE_MARGIN_RATIO)
                # 尝试从底部收缩
                if bbox["y1"] < obstacle_bbox["y2"] < bbox["y2"]:
                    tz["bbox"]["y1"] = obstacle_bbox["y2"] + int(self.canvas_h * self.SAFE_MARGIN_RATIO)
                # 尝试从顶部收缩
                elif bbox["y1"] < obstacle_bbox["y1"] < bbox["y2"]:
                    tz["bbox"]["y2"] = obstacle_bbox["y1"] - int(self.canvas_h * self.SAFE_MARGIN_RATIO)
                break


# ============================================================================
# 可视化报告（文本形式）
# ============================================================================

def print_layout_report(plan):
    """打印文本形式的布局示意图"""
    cw, ch = plan.canvas_w, plan.canvas_h
    print(f"\n{'='*60}")
    print(f"  LayoutPlan 可视化报告 — {plan.image_id}")
    print(f"{'='*60}")
    print(f"  画布: {cw}×{ch}px | 色调: {plan.scene_tone} | 安全间距: {plan.safety_margin:.0%}")
    print(f"  产品比例: {plan.scale_ratio:.1%} | 位置策略: {plan.position_strategy}")
    print(f"  文字布局: {plan.layout_strategy}")
    print()

    # 用ASCII画布可视化
    W = 40  # 终端宽度（字符）
    H = 30  # 终端高度（字符）
    
    # 创建画布
    canvas = [["·" for _ in range(W)] for _ in range(H)]

    def draw_rect(r1, c1, r2, c2, char, fill=None):
        """在ASCII画布上画矩形"""
        for r in range(max(0, r1), min(H, r2)):
            for c in range(max(0, c1), min(W, c2)):
                canvas[r][c] = char if fill is None else fill

    def to_grid(bbox):
        """像素坐标→网格坐标"""
        return (
            int(bbox["y1"] / ch * H),
            int(bbox["x1"] / cw * W),
            int(bbox["y2"] / ch * H),
            int(bbox["x2"] / cw * W),
        )

    # 1. 绘制品牌区边界
    brand_line = int(ch * 0.14 / ch * H)
    for c in range(W):
        canvas[brand_line][c] = "─"
    
    # 2. 绘制保障区边界
    guarantee_line = int(ch * 0.88 / ch * H)
    for c in range(W):
        canvas[guarantee_line][c] = "─"

    # 3. 绘制产品区域
    pb = plan.product_bbox
    if pb["x2"] - pb["x1"] > 0:
        r1, c1, r2, c2 = to_grid(pb)
        draw_rect(r1, c1, r2, c2, "█")

    # 4. 绘制文字区域
    for tz in plan.text_zones:
        r1, c1, r2, c2 = to_grid(tz["bbox"])
        draw_rect(r1, c1, r2, c2, "░")

    # 5. 绘制品牌元素
    logo = plan.brand_zones["logo"]
    r1, c1, r2, c2 = to_grid(logo)
    draw_rect(r1, c1, r2, c2, "L")

    badge = plan.brand_zones["badge_365"]
    r1, c1, r2, c2 = to_grid(badge)
    draw_rect(r1, c1, r2, c2, "B")

    gbar = plan.brand_zones["guarantee_bar"]
    r1, c1, r2, c2 = to_grid(gbar)
    draw_rect(r1, c1, r2, c2, "▬")

    # 打印画布
    print(f"  {'┌' + '─'*W + '┐'}")
    for row in canvas:
        print(f"  │{''.join(row)}│")
    print(f"  {'└' + '─'*W + '┘'}")
    print()

    # 图例
    print(f"  图例: █=产品  ░=文字  L=Logo  B=365标识  ▬=保障条")
    print(f"        ─=品牌区边界(14%)  ─=保障区边界(88%)")
    print()

    # 详细数据
    print(f"  ── 产品区域 ──")
    print(f"  像素: ({pb['x1']}, {pb['y1']}) → ({pb['x2']}, {pb['y2']})")
    print(f"  比例: ({pb['x1']/cw:.1%}, {pb['y1']/ch:.1%}) → ({pb['x2']/cw:.1%}, {pb['y2']/ch:.1%})")
    print(f"  尺寸: {pb['x2']-pb['x1']}×{pb['y2']-pb['y1']}px (scale={pb['scale_ratio']:.1%})")
    print()

    print(f"  ── 文字区域 ──")
    for tz in plan.text_zones:
        b = tz["bbox"]
        print(f"  [{tz['id']}] ({b['x1']},{b['y1']})→({b['x2']},{b['y2']}) "
              f"| {tz['layout_type']} | max_lines={tz['max_lines']}")
    print()

    print(f"  ── 品牌区域 ──")
    for key, bz in plan.brand_zones.items():
        print(f"  [{key}] ({bz['x1']},{bz['y1']})→({bz['x2']},{bz['y2']})")
    print()

    print(f"  ── 空间约束Prompt ──")
    print(f"  {plan.scene_prompt_suffix}")
    print()

    # 冲突检测结果
    conflicts = plan.scene_prompt_suffix  # 临时占位
    print(f"  ── 冲突检测 ──")
    detected = LayoutEngine(cw, ch)._detect_conflicts(plan)
    if detected:
        for a_name, a, b_name, b in detected:
            print(f"  ⚠ 冲突: {a_name} vs {b_name}")
    else:
        print(f"  ✓ 无冲突，所有区域互不重叠")
    print(f"{'='*60}\n")


# ============================================================================
# 便捷函数
# ============================================================================

def plan_from_config(img_config, engine=None):
    """
    从plan_v7.json的单个图片配置生成LayoutPlan。
    
    Args:
        img_config: plan_v7.json中的单个image dict
        engine: 已有的LayoutEngine实例（可选）
    
    Returns:
        LayoutPlan
    """
    image_id = img_config["id"]
    image_type = "detail" if image_id.startswith("detail") else "main"
    size = img_config.get("size", [1000, 1000])
    
    comp = img_config.get("product_composition", {})
    
    # 从plan_v7.json获取场景类型
    scene_prompt = img_config.get("scene_prompt", "")
    scene_type = "tech_dark"
    if "white" in scene_prompt.lower() or "bright" in scene_prompt.lower():
        scene_type = "white_clean"
    elif "dark" in scene_prompt.lower():
        scene_type = "tech_dark"
    elif "hotel" in scene_prompt.lower():
        scene_type = "hotel_night"
    elif "bathroom" in scene_prompt.lower():
        scene_type = "bright_natural"
    elif "metal" in scene_prompt.lower():
        scene_type = "brushed_metal"

    if engine is None:
        engine = LayoutEngine(canvas_w=size[0], canvas_h=size[1])
    else:
        engine.canvas_w = size[0]
        engine.canvas_h = size[1]

    plan = engine.plan(
        product_width_mm=74,
        product_height_mm=39,
        image_type=image_type,
        image_id=image_id,
        scene_type=scene_type,
        texts=img_config.get("texts"),
        product_view=comp.get("angle", "front"),
    )

    return plan


# ============================================================================
# CLI
# ============================================================================

if __name__ == "__main__":
    import sys
    
    # 默认跑一个示例
    engine = LayoutEngine(1000, 1000)
    plan = engine.plan(
        product_width_mm=74,
        product_height_mm=39,
        image_type="main",
        image_id="main_01",
        scene_type="tech_gradient",
    )
    print(plan.to_json())
    print_layout_report(plan)
