#!/usr/bin/env python3
"""
scene_aware_compositor.py — 场景感知合成引擎
=============================================
替代固定 scale 的 smart_composite，根据场景中的参照物几何关系自动计算产品大小，
并施加透视匹配、景深模拟、产品突出等后处理。

核心改进：
1. 参照物系统 → 每个场景模板定义已知尺寸的参照物
2. 像素尺度计算 → 根据参照物在画面中的预期比例反推 px/cm
3. 产品尺寸计算 → 真实物理尺寸 × px/cm → 像素尺寸
4. 透视匹配 → 根据场景视角对产品施加透视变换
5. 景深模拟 → 根据纵深位置施加高斯模糊
6. 产品突出 → 锐度/亮度/对比度增强

兼容：
- layout_engine.py 的 LayoutPlan
- ecommerce_suite_v2.py 的调用方式

Author: 素材工坊
"""

import math
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple
from PIL import Image, ImageFilter, ImageEnhance
from scipy.ndimage import gaussian_filter


# ============================================================================
# §1 数据结构
# ============================================================================

@dataclass
class ReferenceObject:
    """
    参照物定义。
    
    每个参照物有已知的真实世界尺寸，以及在场景生成 prompt 中的预期位置比例。
    预期位置比例用于在没有实际检测能力时，根据 prompt 设计反推像素/厘米比。
    
    Attributes:
        name: 参照物名称（如 "牙刷"、"盆栽"）
        real_height_cm: 真实高度 (cm)
        real_width_cm: 真实宽度 (cm)
        prompt_desc: 在 AI prompt 中的描述（英文，用于生成场景时让 AI 画出参照物）
        expected_x_range: 在画面中预期的水平范围 (归一化 0~1)，如 (0.05, 0.15)
        expected_y_range: 在画面中预期的垂直范围 (归一化 0~1)
    """
    name: str
    real_height_cm: float
    real_width_cm: float
    prompt_desc: str
    expected_x_range: Tuple[float, float]
    expected_y_range: Tuple[float, float]


@dataclass
class SceneConfig:
    """
    场景模板的完整配置，包含参照物系统和视角参数。
    
    Attributes:
        name: 场景显示名
        base_prompt: 场景基础 prompt（不含参照物）
        view_angle: 视角类型 ("topdown", "slight_topdown", "flat", "eye_level")
        view_angle_deg: 视角倾斜角度（0=正俯视, 90=正平视）
        reference_objects: 参照物列表
        depth_layers: 纵深层次定义 {"foreground": (z_near, z_far), ...}
        ref_object_prompt_suffix: 拼接到 base_prompt 后的参照物描述
    """
    name: str
    base_prompt: str
    view_angle: str
    view_angle_deg: float  # 0=正俯视, 45=微俯, 90=平视
    reference_objects: List[ReferenceObject]
    depth_layers: Dict[str, Tuple[float, float]] = field(default_factory=dict)
    canvas_w: int = 1024
    canvas_h: int = 1024


@dataclass
class ProductSpec:
    """
    产品物理规格。
    
    Attributes:
        name: 产品名称
        height_cm: 真实高度 (cm)
        width_cm: 真实宽度 (cm)
        depth_cm: 真实深度 (cm)，用于圆柱形产品的直径
        shape: 形状描述 ("cylinder", "box", "irregular")
        primary_color: 主体颜色描述
    """
    name: str
    height_cm: float
    width_cm: float
    depth_cm: float = 0.0
    shape: str = "cylinder"
    primary_color: str = "dark gray"


@dataclass
class CompositeResult:
    """合成结果"""
    image: Image.Image
    product_bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    pixel_per_cm: float                       # 像素/厘米比
    product_scale_ratio: float                # 产品占画布宽度比
    perspective_params: Optional[Dict] = None
    depth_blur_sigma: float = 0.0


# ============================================================================
# §2 场景模板配置 — 6个场景的参照物系统
# ============================================================================

# HDB1 剃须刀产品规格
HDB1_PRODUCT = ProductSpec(
    name="HDB1 剃须刀",
    height_cm=16.0,
    width_cm=6.0,
    depth_cm=6.0,
    shape="cylinder",
    primary_color="dark gray with gold top",
)


def _build_scene_configs() -> Dict[str, SceneConfig]:
    """
    构建6个场景模板的完整配置。
    
    每个场景的参照物选择原则：
    1. 参照物必须是该场景中「自然出现」的物品
    2. 参照物的真实尺寸必须是大众熟知的标准尺寸
    3. 参照物在画面中的位置要分散（最好在产品两侧），便于反推尺度
    """

    # ── 1. 极简白棚 ──
    minimalist = SceneConfig(
        name="极简白棚",
        base_prompt=(
            "flat lay top-down view, pure white seamless paper backdrop, "
            "soft even studio lighting, empty clean surface, "
            "product photography background, no text"
        ),
        view_angle="flat",
        view_angle_deg=10,  # 近乎正俯视，微倾斜
        reference_objects=[
            ReferenceObject(
                name="标准A4纸",
                real_height_cm=29.7,
                real_width_cm=21.0,
                prompt_desc="a white A4 sheet of paper placed at the left side",
                expected_x_range=(0.05, 0.30),
                expected_y_range=(0.20, 0.70),
            ),
            ReferenceObject(
                name="标准信用卡",
                real_height_cm=5.4,
                real_width_cm=8.6,
                prompt_desc="a standard credit card placed at the bottom right area",
                expected_x_range=(0.65, 0.82),
                expected_y_range=(0.72, 0.80),
            ),
        ],
        depth_layers={
            "foreground": (0.0, 0.3),
            "midground": (0.3, 0.7),
            "background": (0.7, 1.0),
        },
    )

    # ── 2. 俯视绿植桌面 ──
    topdown_greenery = SceneConfig(
        name="俯视绿植桌面",
        base_prompt=(
            "top-down view of a clean mint-green wooden desktop surface, "
            "flat lay style, soft daylight, minimalist, no text"
        ),
        view_angle="topdown",
        view_angle_deg=0,  # 正俯视
        reference_objects=[
            ReferenceObject(
                name="多肉盆栽(小)",
                real_height_cm=8.0,
                real_width_cm=8.0,
                prompt_desc="a small round potted succulent plant (8cm diameter pot) at the upper-left corner",
                expected_x_range=(0.02, 0.18),
                expected_y_range=(0.02, 0.18),
            ),
            ReferenceObject(
                name="多肉盆栽(小)",
                real_height_cm=8.0,
                real_width_cm=8.0,
                prompt_desc="another small round potted succulent plant (8cm diameter pot) at the lower-right corner",
                expected_x_range=(0.82, 0.98),
                expected_y_range=(0.82, 0.98),
            ),
            ReferenceObject(
                name="标准铅笔",
                real_height_cm=19.0,
                real_width_cm=0.7,
                prompt_desc="a standard pencil (19cm long) lying horizontally near the right edge",
                expected_x_range=(0.70, 0.95),
                expected_y_range=(0.40, 0.45),
            ),
        ],
        depth_layers={
            "foreground": (0.0, 0.3),
            "midground": (0.3, 0.7),
            "background": (0.7, 1.0),
        },
    )

    # ── 3. 暖色木纹桌面 ──
    warm_wood = SceneConfig(
        name="暖色木纹桌面",
        base_prompt=(
            "top-down view of a warm dark walnut wooden desk surface, "
            "natural wood grain texture, empty clean table, "
            "warm soft lighting, no text"
        ),
        view_angle="topdown",
        view_angle_deg=5,  # 近乎正俯视
        reference_objects=[
            ReferenceObject(
                name="标准咖啡杯",
                real_height_cm=10.0,
                real_width_cm=8.0,
                prompt_desc="a standard coffee cup (8cm diameter, 10cm tall) with saucer at the upper right area",
                expected_x_range=(0.72, 0.90),
                expected_y_range=(0.08, 0.25),
            ),
            ReferenceObject(
                name="标准钢笔",
                real_height_cm=14.0,
                real_width_cm=1.2,
                prompt_desc="a classic fountain pen (14cm long) lying diagonally at the lower left",
                expected_x_range=(0.08, 0.30),
                expected_y_range=(0.70, 0.85),
            ),
        ],
        depth_layers={
            "foreground": (0.0, 0.3),
            "midground": (0.3, 0.7),
            "background": (0.7, 1.0),
        },
    )

    # ── 4. 现代大理石 ──
    modern_marble = SceneConfig(
        name="现代大理石",
        base_prompt=(
            "top-down view of white marble countertop surface, "
            "subtle gray veining pattern, clean empty surface, "
            "bright even lighting, no text"
        ),
        view_angle="topdown",
        view_angle_deg=5,
        reference_objects=[
            ReferenceObject(
                name="大理石皂",
                real_height_cm=3.0,
                real_width_cm=9.0,
                prompt_desc="a rectangular soap bar (9cm x 6cm x 3cm) at the left side",
                expected_x_range=(0.04, 0.18),
                expected_y_range=(0.35, 0.50),
            ),
            ReferenceObject(
                name="标准化妆刷",
                real_height_cm=17.0,
                real_width_cm=1.5,
                prompt_desc="a makeup brush (17cm long) lying at the lower right area",
                expected_x_range=(0.68, 0.92),
                expected_y_range=(0.72, 0.85),
            ),
        ],
        depth_layers={
            "foreground": (0.0, 0.3),
            "midground": (0.3, 0.7),
            "background": (0.7, 1.0),
        },
    )

    # ── 5. 科技渐变 ──
    tech_gradient = SceneConfig(
        name="科技渐变",
        base_prompt=(
            "smooth dark gray to black gradient background, "
            "subtle radial blue light glow from center, "
            "sleek modern empty surface, no text"
        ),
        view_angle="flat",
        view_angle_deg=75,  # 接近平视，略带俯视
        reference_objects=[],  # 科技场景不放参照物，用产品本身和光影做尺度
        depth_layers={
            "foreground": (0.0, 0.4),
            "midground": (0.4, 0.7),
            "background": (0.7, 1.0),
        },
    )

    # ── 6. 生活浴室场景 ──
    lifestyle_bathroom = SceneConfig(
        name="生活浴室场景",
        base_prompt=(
            "top-down view of a clean white bathroom countertop, "
            "bright natural daylight, no text"
        ),
        view_angle="slight_topdown",
        view_angle_deg=25,  # 微俯视，能看到台面纵深
        reference_objects=[
            ReferenceObject(
                name="标准牙刷",
                real_height_cm=17.0,
                real_width_cm=2.0,
                prompt_desc="a standard toothbrush (17cm long) placed vertically on the left side",
                expected_x_range=(0.08, 0.14),
                expected_y_range=(0.20, 0.65),
            ),
            ReferenceObject(
                name="折叠毛巾",
                real_height_cm=3.0,
                real_width_cm=25.0,
                prompt_desc="a folded small towel (25cm x 15cm, 3cm thick) at the right side",
                expected_x_range=(0.72, 0.95),
                expected_y_range=(0.15, 0.40),
            ),
            ReferenceObject(
                name="小盆栽",
                real_height_cm=12.0,
                real_width_cm=10.0,
                prompt_desc="a small green potted plant (10cm pot, 12cm total height) at the upper right corner",
                expected_x_range=(0.78, 0.96),
                expected_y_range=(0.02, 0.20),
            ),
        ],
        depth_layers={
            "foreground": (0.0, 0.3),
            "midground": (0.3, 0.7),
            "background": (0.7, 1.0),
        },
    )

    return {
        "minimalist": minimalist,
        "topdown_greenery": topdown_greenery,
        "warm_wood": warm_wood,
        "modern_marble": modern_marble,
        "tech_gradient": tech_gradient,
        "lifestyle_bathroom": lifestyle_bathroom,
    }


# 全局场景配置注册表
SCENE_CONFIGS: Dict[str, SceneConfig] = _build_scene_configs()


# ============================================================================
# §3 像素尺度计算器
# ============================================================================

class PixelScaleCalculator:
    """
    根据参照物的预期像素范围计算 像素/厘米 比率。
    
    数学原理：
    ─────────
    已知参照物 A 的真实宽度 W_real (cm)，以及它在画面中预期占据的
    水平范围 [x1_ratio, x2_ratio]（归一化 0~1），则：
    
        W_pixel = (x2_ratio - x1_ratio) × canvas_width   ... (1)
    
    像素/厘米比 = W_pixel / W_real                        ... (2)
    
    当有多个参照物时，取加权平均。权重基于参照物在画面中的
    「可信度」——尺寸越大的参照物，预期位置越精确，权重越高。
    
    对于有实际参照物检测结果（bbox）的场景，也可以直接传入
    检测到的像素尺寸来计算。
    """

    def __init__(self, canvas_w: int, canvas_h: int):
        self.canvas_w = canvas_w
        self.canvas_h = canvas_h

    def estimate_from_expected_positions(
        self, scene_config: SceneConfig
    ) -> float:
        """
        根据参照物的预期位置比例估算像素/厘米比。
        
        对每个参照物，分别计算水平方向和垂直方向的 px/cm，
        然后取加权平均。
        
        Returns:
            像素/厘米比 (float)
        """
        if not scene_config.reference_objects:
            # 无参照物场景（如科技渐变），使用默认值
            # 默认假设：产品占画布高度 ~50%，产品真实高度 16cm
            # → 画布高度 1024px 对应 ~32cm → 32 px/cm
            return self.canvas_h / 32.0

        px_per_cm_estimates = []
        weights = []

        for ref_obj in scene_config.reference_objects:
            # 水平方向
            x_span = ref_obj.expected_x_range[1] - ref_obj.expected_x_range[0]
            w_pixel = x_span * self.canvas_w
            if ref_obj.real_width_cm > 0:
                px_cm_h = w_pixel / ref_obj.real_width_cm
                px_per_cm_estimates.append(px_cm_h)
                # 权重：参照物越大越可信
                weights.append(ref_obj.real_width_cm)

            # 垂直方向
            y_span = ref_obj.expected_y_range[1] - ref_obj.expected_y_range[0]
            h_pixel = y_span * self.canvas_h
            if ref_obj.real_height_cm > 0:
                px_cm_v = h_pixel / ref_obj.real_height_cm
                px_per_cm_estimates.append(px_cm_v)
                weights.append(ref_obj.real_height_cm)

        if not px_per_cm_estimates:
            return self.canvas_h / 32.0

        # 加权平均
        total_weight = sum(weights)
        weighted_sum = sum(e * w for e, w in zip(px_per_cm_estimates, weights))
        return weighted_sum / total_weight

    def estimate_from_detected_bboxes(
        self,
        detected_bboxes: List[Tuple[str, Tuple[int, int, int, int], float, float]]
    ) -> float:
        """
        根据实际检测到的参照物 bbox 计算像素/厘米比。
        
        Args:
            detected_bboxes: 列表，每项为
                (name, (x1, y1, x2, y2), real_width_cm, real_height_cm)
        
        Returns:
            像素/厘米比 (float)
        """
        estimates = []
        weights = []
        for name, (x1, y1, x2, y2), real_w, real_h in detected_bboxes:
            w_px = x2 - x1
            h_px = y2 - y1
            if real_w > 0:
                estimates.append(w_px / real_w)
                weights.append(real_w)
            if real_h > 0:
                estimates.append(h_px / real_h)
                weights.append(real_h)

        if not estimates:
            return self.canvas_h / 32.0

        total_weight = sum(weights)
        return sum(e * w for e, w in zip(estimates, weights)) / total_weight


# ============================================================================
# §4 透视匹配器
# ============================================================================

class PerspectiveMatcher:
    """
    根据场景视角对产品图像施加透视变换，使其与场景的透视一致。
    
    数学原理：
    ─────────
    透视变换通过 3×3 单应性矩阵 H 实现：
        [x']       [h11 h12 h13] [x]
        [y'] = λ × [h21 h22 h23] [y]
        [w']       [h31 h32 h33] [1]
    
    对于俯视场景（view_angle_deg ≈ 0°~20°）：
    - 产品顶部（远离观察者）应比底部略窄
    - 收缩量 = tan(view_angle) × product_height / 2
    
    实现方式：通过 PIL 的 transform 方法 + 四点映射，
    定义输入/输出的四角对应关系来构造单应性矩阵。
    """

    @staticmethod
    def apply_perspective(
        product_img: Image.Image,
        view_angle_deg: float,
        product_layer: str = "midground"
    ) -> Image.Image:
        """
        对产品图像施加透视变换。
        
        Args:
            product_img: 产品图像（RGBA 或 RGB）
            view_angle_deg: 场景视角角度（0=正俯视, 90=正平视）
            product_layer: 产品所在纵深层 ("foreground", "midground", "background")
        
        Returns:
            透视变换后的图像
        """
        w, h = product_img.size

        # 将视角转换为透视收缩因子
        # 0° (正俯视) → 产品顶部收缩最大
        # 90° (正平视) → 无透视收缩
        # 使用 sin 函数映射：shrink = sin(90° - angle) = cos(angle)
        angle_rad = math.radians(view_angle_deg)
        
        # 透视收缩量：顶部宽度减少的比例
        # cos(0°) = 1.0 (全收缩), cos(90°) = 0 (无收缩)
        # 实际收缩比例要小一些，避免过度变形
        top_shrink_ratio = math.cos(angle_rad) * 0.15  # 最大 15% 收缩

        if top_shrink_ratio < 0.01:
            return product_img  # 几乎无透视效果，跳过

        # 计算四角偏移
        # 顶部两角向内收缩
        top_offset = int(w * top_shrink_ratio / 2)

        # 原始四角 (左上, 右上, 右下, 左下)
        src_corners = [
            (0, 0),
            (w - 1, 0),
            (w - 1, h - 1),
            (0, h - 1),
        ]

        # 目标四角：顶部向内收缩
        dst_corners = [
            (top_offset, 0),           # 左上 → 右移
            (w - 1 - top_offset, 0),   # 右上 → 左移
            (w - 1, h - 1),            # 右下 → 不变
            (0, h - 1),                # 左下 → 不变
        ]

        # 使用 PIL 的透视变换
        # PIL transform 需要的是 dst → src 的映射（逆向映射）
        try:
            coeffs = PerspectiveMatcher._find_perspective_coeffs(
                dst_corners, src_corners
            )
            result = product_img.transform(
                (w, h),
                Image.PERSPECTIVE,
                coeffs,
                Image.BICUBIC,
            )
            return result
        except Exception:
            return product_img

    @staticmethod
    def _find_perspective_coeffs(
        src: List[Tuple[int, int]],
        dst: List[Tuple[int, int]]
    ) -> Tuple[float, ...]:
        """
        计算透视变换系数（8个参数）。
        
        使用四点法求解单应性矩阵：
        给定4对对应点 (src_i → dst_i)，求解 8 个参数使得：
            dst_x = (c0*src_x + c1*src_y + c2) / (c6*src_x + c7*src_y + 1)
            dst_y = (c3*src_x + c4*src_y + c5) / (c6*src_x + c7*src_y + 1)
        
        这转化为一个 8×8 线性方程组。
        """
        matrix = []
        for (x, y), (X, Y) in zip(src, dst):
            matrix.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
            matrix.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])

        A = np.matrix(matrix, dtype=float)
        B = np.array([c for pair in dst for c in pair], dtype=float)

        try:
            coeffs = np.linalg.solve(A, B).flatten().tolist()
            return tuple(coeffs) + (1.0,)  # PIL 需要 8 个系数
        except np.linalg.LinAlgError:
            # 退化情况：返回恒等变换
            return (1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0)


# ============================================================================
# §5 景深模拟器
# ============================================================================

class DepthOfFieldSimulator:
    """
    根据产品在场景中的纵深位置施加高斯模糊。
    
    数学原理：
    ─────────
    景深（DOF）模拟的核心是：离焦程度与物距的偏差成正比。
    
        blur_sigma = k × |z_product - z_focus|
    
    其中：
    - z_product: 产品所在纵深位置（归一化 0~1）
    - z_focus: 焦点位置（通常=产品位置，所以产品自身清晰）
    - k: 模糊系数，控制模糊强度
    
    实际实现中：
    - 前景 (z < 0.3): sigma = 0~0.5 (几乎清晰)
    - 中景 (0.3 ≤ z < 0.7): sigma = 0.5~1.5 (轻微模糊)
    - 远景 (z ≥ 0.7): sigma = 1.5~3.0 (明显模糊)
    
    但产品本身应该是焦点，所以产品的 sigma 很低，
    而场景背景根据纵深有不同的模糊程度（已在场景生成时体现）。
    这里主要处理产品本身的轻微景深效果。
    """

    # 纵深层次 → 模糊 sigma 映射
    LAYER_BLUR_MAP = {
        "foreground": 0.0,   # 前景清晰
        "midground": 0.3,    # 中景轻微模糊
        "background": 0.8,   # 远景模糊
    }

    @staticmethod
    def apply_dof(
        product_img: Image.Image,
        depth_layer: str = "midground",
        custom_sigma: Optional[float] = None
    ) -> Image.Image:
        """
        对产品施加景深模糊。
        
        Args:
            product_img: 产品图像
            depth_layer: 纵深层次 ("foreground", "midground", "background")
            custom_sigma: 自定义模糊 sigma（覆盖默认值）
        
        Returns:
            模糊处理后的图像
        """
        sigma = custom_sigma if custom_sigma is not None else DepthOfFieldSimulator.LAYER_BLUR_MAP.get(depth_layer, 0.0)

        if sigma <= 0:
            return product_img

        # 使用 PIL 的 GaussianBlur（比 scipy 更适合处理 RGBA）
        # 分离 alpha 通道，只对 RGB 模糊
        if product_img.mode == "RGBA":
            r, g, b, a = product_img.split()
            rgb = Image.merge("RGB", (r, g, b))
            rgb_blurred = rgb.filter(ImageFilter.GaussianBlur(radius=sigma))
            return Image.merge("RGBA", (*rgb_blurred.split(), a))
        else:
            return product_img.filter(ImageFilter.GaussianBlur(radius=sigma))


# ============================================================================
# §6 产品突出处理器
# ============================================================================

class ProductEmphasis:
    """
    增强产品的视觉突出感，使其从场景中「跳出来」。
    
    策略：
    1. 轻微亮度提升 (+3~5%)
    2. 轻微对比度增强 (+5~10%)
    3. 轻微锐度增强 (+10~20%)
    
    数学原理：
    ─────────
    - 亮度: pixel_out = pixel_in × (1 + brightness_factor)
    - 对比度: pixel_out = 128 + (pixel_in - 128) × (1 + contrast_factor)
    - 锐度: USM 锐化 = original + amount × (original - blurred)
    
    注意：所有增强都是轻微的，避免过度导致失真。
    """

    @staticmethod
    def emphasize(
        product_img: Image.Image,
        brightness: float = 1.04,
        contrast: float = 1.08,
        sharpness: float = 1.15,
    ) -> Image.Image:
        """
        产品突出处理。
        
        Args:
            product_img: 产品图像
            brightness: 亮度因子（1.0=不变, >1.0=变亮）
            contrast: 对比度因子
            sharpness: 锐度因子
        
        Returns:
            增强后的图像
        """
        if product_img.mode != "RGBA":
            product_img = product_img.convert("RGBA")

        r, g, b, a = product_img.split()
        rgb = Image.merge("RGB", (r, g, b))

        # 亮度增强
        enhancer = ImageEnhance.Brightness(rgb)
        rgb = enhancer.enhance(brightness)

        # 对比度增强
        enhancer = ImageEnhance.Contrast(rgb)
        rgb = enhancer.enhance(contrast)

        # 锐度增强
        enhancer = ImageEnhance.Sharpness(rgb)
        rgb = enhancer.enhance(sharpness)

        return Image.merge("RGBA", (*rgb.split(), a))


# ============================================================================
# §7 场景感知合成器（主类）
# ============================================================================

class SceneAwareCompositor:
    """
    场景感知合成器 — 替代固定 scale 的 smart_composite。
    
    核心流程：
    1. 根据场景配置中的参照物计算像素/厘米比
    2. 根据产品真实尺寸和像素/厘米比计算产品像素尺寸
    3. 根据纵深层次调整产品大小（前景略大，远景略小）
    4. 对产品施加透视变换
    5. 使用高斯模糊混合将产品融入场景
    6. 施加景深模糊
    7. 产品突出处理
    
    使用示例：
        compositor = SceneAwareCompositor()
        result = compositor.composite(
            scene_image=scene_img,
            product_image=product_img,
            scene_type="lifestyle_bathroom",
            product_spec=HDB1_PRODUCT,
            position=(0.5, 0.45),
        )
    """

    def __init__(self, canvas_w: int = 1024, canvas_h: int = 1024):
        self.canvas_w = canvas_w
        self.canvas_h = canvas_h
        self.scale_calculator = PixelScaleCalculator(canvas_w, canvas_h)
        self.perspective_matcher = PerspectiveMatcher()
        self.dof_simulator = DepthOfFieldSimulator()
        self.product_emphasis = ProductEmphasis()

    def composite(
        self,
        scene_image: Image.Image,
        product_image: Image.Image,
        scene_type: str = "lifestyle_bathroom",
        product_spec: Optional[ProductSpec] = None,
        position: Tuple[float, float] = (0.5, 0.45),
        depth_layer: str = "midground",
        do_perspective: bool = True,
        do_dof: bool = True,
        do_emphasis: bool = True,
        edge_blur_sigma: float = 8.0,
        perspective_override: Optional[float] = None,
    ) -> CompositeResult:
        """
        场景感知合成主入口。
        
        Args:
            scene_image: 场景背景图
            product_image: 产品图（白底，将被抠出）
            scene_type: 场景类型（对应 SCENE_CONFIGS 的 key）
            product_spec: 产品规格（默认 HDB1）
            position: 产品在画面中的归一化位置 (x_ratio, y_ratio)
            depth_layer: 产品纵深层次
            do_perspective: 是否做透视变换
            do_dof: 是否做景深模糊
            do_emphasis: 是否做产品突出
            edge_blur_sigma: 边缘混合模糊 sigma
            perspective_override: 覆盖视角角度（用于测试）
        
        Returns:
            CompositeResult
        """
        if product_spec is None:
            product_spec = HDB1_PRODUCT

        # 获取场景配置
        scene_config = SCENE_CONFIGS.get(scene_type)
        if scene_config is None:
            raise ValueError(f"Unknown scene type: {scene_type}. "
                             f"Available: {list(SCENE_CONFIGS.keys())}")

        # ── Step 1: 计算像素/厘米比 ──
        pixel_per_cm = self.scale_calculator.estimate_from_expected_positions(scene_config)

        # ── Step 2: 计算产品像素尺寸 ──
        product_w_cm = product_spec.width_cm
        product_h_cm = product_spec.height_cm

        target_w_px = int(product_w_cm * pixel_per_cm)
        target_h_px = int(product_h_cm * pixel_per_cm)

        # 约束：产品不应超过画布的 70% 宽度或 80% 高度
        max_w = int(self.canvas_w * 0.70)
        max_h = int(self.canvas_h * 0.80)
        if target_w_px > max_w:
            scale_down = max_w / target_w_px
            target_w_px = max_w
            target_h_px = int(target_h_px * scale_down)
        if target_h_px > max_h:
            scale_down = max_h / target_h_px
            target_h_px = max_h
            target_w_px = int(target_w_px * scale_down)

        # 最小尺寸约束：至少占画布 15% 宽
        min_w = int(self.canvas_w * 0.15)
        if target_w_px < min_w:
            scale_up = min_w / target_w_px
            target_w_px = min_w
            target_h_px = int(target_h_px * scale_up)

        # ── Step 3: 纵深层次调整 ──
        # 前景产品放大 5%，远景缩小 5%
        depth_scale_factors = {
            "foreground": 1.05,
            "midground": 1.0,
            "background": 0.90,
        }
        depth_factor = depth_scale_factors.get(depth_layer, 1.0)
        target_w_px = int(target_w_px * depth_factor)
        target_h_px = int(target_h_px * depth_factor)

        # ── Step 4: 缩放产品 ──
        prod_resized = product_image.resize(
            (target_w_px, target_h_px), Image.LANCZOS
        )

        # ── Step 5: 透视变换 ──
        if do_perspective:
            view_angle = perspective_override if perspective_override is not None else scene_config.view_angle_deg
            prod_resized = self.perspective_matcher.apply_perspective(
                prod_resized, view_angle, depth_layer
            )

        # ── Step 6: 景深模糊 ──
        if do_dof:
            prod_resized = self.dof_simulator.apply_dof(
                prod_resized, depth_layer
            )

        # ── Step 7: 产品突出 ──
        if do_emphasis:
            prod_resized = self.product_emphasis.emphasize(
                prod_resized,
                brightness=1.04,
                contrast=1.08,
                sharpness=1.15,
            )

        # ── Step 8: 抠图 & 合成到场景 ──
        # 生成 alpha mask（去白底）
        mask = self._remove_white_bg(prod_resized)

        # 计算放置位置（绝对像素）
        px = int(position[0] * self.canvas_w) - target_w_px // 2
        py = int(position[1] * self.canvas_h) - target_h_px // 2

        # 边界修正
        px = max(0, min(px, self.canvas_w - target_w_px))
        py = max(0, min(py, self.canvas_h - target_h_px))

        # 边缘融合合成
        result_image = self._alpha_blend_composite(
            scene_image, prod_resized, mask, px, py, edge_blur_sigma
        )

        # 计算产品占画布比例
        product_scale_ratio = target_w_px / self.canvas_w

        return CompositeResult(
            image=result_image,
            product_bbox=(px, py, target_w_px, target_h_px),
            pixel_per_cm=pixel_per_cm,
            product_scale_ratio=product_scale_ratio,
            perspective_params={
                "view_angle_deg": scene_config.view_angle_deg,
                "depth_layer": depth_layer,
            },
            depth_blur_sigma=DepthOfFieldSimulator.LAYER_BLUR_MAP.get(depth_layer, 0.0),
        )

    def _remove_white_bg(self, image: Image.Image, threshold: int = 30) -> np.ndarray:
        """
        去除白色背景，生成前景 alpha mask。
        
        如果图像有 alpha 通道，优先使用 alpha 作为基础 mask，
        同时去除白底像素（处理半透明白边）。
        无 alpha 时回退到距离法：mask = 1 if ||RGB - (255,255,255)|| >= threshold else 0
        """
        if image.mode == "RGBA":
            # 有 alpha 通道：以 alpha 为基础，同时排除接近白色的像素
            rgba = np.array(image).astype(float)
            alpha_mask = rgba[:, :, 3] / 255.0  # 0~1
            rgb_dist = np.linalg.norm(rgba[:, :, :3] - 255, axis=2)
            white_exclude = (rgb_dist >= threshold).astype(float)
            # 两者取交集：alpha 不透明 且 不是白色
            return np.minimum(alpha_mask, white_exclude).astype(np.float32)
        else:
            # 无 alpha 通道：回退到距离法
            arr = np.array(image.convert("RGB")).astype(float)
            dist = np.linalg.norm(arr - 255, axis=2)
            return (dist >= threshold).astype(np.float32)

    def _alpha_blend_composite(
        self,
        scene: Image.Image,
        product: Image.Image,
        mask: np.ndarray,
        px: int,
        py: int,
        blur_sigma: float = 8.0,
    ) -> Image.Image:
        """
        将产品通过软遮罩混合到场景中。
        
        核心是模糊 mask 的边缘，使产品与场景的过渡自然。
        与 smart_composite 的混合方式一致：
            final = product × blurred_mask + scene × (1 - blurred_mask)
        
        Args:
            scene: 场景背景图
            product: 产品图（已缩放/透视/增强）
            mask: 前景 mask（0/1 二值）
            px, py: 产品放置位置
            blur_sigma: 边缘模糊 sigma
        
        Returns:
            合成后的图像
        """
        w, h = scene.size
        arr_scene = np.array(scene.convert("RGB")).astype(float)
        # 如果产品有 alpha 通道，用 alpha 预乘 RGB，避免透明区黑色渗入边缘
        if product.mode == "RGBA":
            rgba = np.array(product).astype(float)
            alpha_norm = rgba[:, :, 3:4] / 255.0
            prod_arr = rgba[:, :, :3]  # 保留原始 RGB（透明区可能为任意值）
            # 预乘 alpha：透明区域的 RGB 被 alpha 加权为 0，不会污染混合结果
            prod_arr = prod_arr * alpha_norm
        else:
            prod_arr = np.array(product.convert("RGB")).astype(float)

        # 确保产品图尺寸与 mask 一致
        if prod_arr.shape[:2] != mask.shape[:2]:
            mask = np.array(
                Image.fromarray((mask * 255).astype(np.uint8)).resize(
                    (prod_arr.shape[1], prod_arr.shape[0]), Image.LANCZOS
                )
            ).astype(float) / 255.0

        # 裁剪 mask 和 product 到不超出场景边界
        pw, ph = prod_arr.shape[1], prod_arr.shape[0]
        crop_x2 = min(px + pw, w)
        crop_y2 = min(py + ph, h)
        crop_pw = crop_x2 - px
        crop_ph = crop_y2 - py

        if crop_pw <= 0 or crop_ph <= 0:
            return scene  # 产品完全在画面外

        mask_crop = mask[:crop_ph, :crop_pw]
        prod_crop = prod_arr[:crop_ph, :crop_pw]

        # 边缘模糊
        mask_blur = gaussian_filter(mask_crop, sigma=blur_sigma)
        mask_blur = np.clip(mask_blur, 0, 1)

        # Alpha 混合
        scene_crop = arr_scene[py:py + crop_ph, px:px + crop_pw].copy()
        final_arr = arr_scene.copy()

        for c in range(3):
            final_arr[py:py + crop_ph, px:px + crop_pw, c] = (
                prod_crop[:, :, c] * mask_blur
                + scene_crop[:, :, c] * (1 - mask_blur)
            )

        return Image.fromarray(final_arr.astype(np.uint8))

    # ================================================================
    # 辅助方法
    # ================================================================

    def generate_scene_prompt_with_refs(self, scene_type: str) -> str:
        """
        生成包含参照物描述的完整场景 prompt。
        
        用于场景图生成阶段，让 AI 在画面中画出参照物。
        
        Args:
            scene_type: 场景类型
        
        Returns:
            完整的场景 prompt（含参照物描述）
        """
        config = SCENE_CONFIGS.get(scene_type)
        if not config:
            return ""

        prompt = config.base_prompt

        if config.reference_objects:
            ref_descriptions = ", ".join(
                ref.prompt_desc for ref in config.reference_objects
            )
            prompt += f", {ref_descriptions}"

        return prompt

    def calculate_product_scale(
        self,
        scene_type: str,
        product_spec: Optional[ProductSpec] = None,
    ) -> Dict:
        """
        预计算产品在指定场景中的缩放参数（不执行实际合成）。
        
        用于调试和预览。
        
        Returns:
            dict with keys: pixel_per_cm, target_w_px, target_h_px,
                           scale_ratio, depth_layer
        """
        if product_spec is None:
            product_spec = HDB1_PRODUCT

        config = SCENE_CONFIGS.get(scene_type)
        if not config:
            raise ValueError(f"Unknown scene: {scene_type}")

        pixel_per_cm = self.scale_calculator.estimate_from_expected_positions(config)
        target_w = int(product_spec.width_cm * pixel_per_cm)
        target_h = int(product_spec.height_cm * pixel_per_cm)

        # 约束
        max_w = int(self.canvas_w * 0.70)
        max_h = int(self.canvas_h * 0.80)
        if target_w > max_w:
            ratio = max_w / target_w
            target_w = max_w
            target_h = int(target_h * ratio)
        if target_h > max_h:
            ratio = max_h / target_h
            target_h = max_h
            target_w = int(target_w * ratio)

        return {
            "scene_type": scene_type,
            "scene_name": config.name,
            "view_angle_deg": config.view_angle_deg,
            "pixel_per_cm": round(pixel_per_cm, 2),
            "target_w_px": target_w,
            "target_h_px": target_h,
            "scale_ratio": round(target_w / self.canvas_w, 4),
            "ref_objects_count": len(config.reference_objects),
            "ref_objects": [
                {
                    "name": r.name,
                    "real_size": f"{r.real_width_cm}x{r.real_height_cm}cm",
                    "expected_position": f"({r.expected_x_range[0]:.0%}~{r.expected_x_range[1]:.0%}, "
                                         f"{r.expected_y_range[0]:.0%}~{r.expected_y_range[1]:.0%})",
                }
                for r in config.reference_objects
            ],
        }


# ============================================================================
# §8 兼容层 — 与原 smart_composite 接口一致
# ============================================================================

def scene_aware_composite(
    scene: Image.Image,
    product: Image.Image,
    scene_type: str = "lifestyle_bathroom",
    product_spec: Optional[ProductSpec] = None,
    scale: Optional[float] = None,
    y_ratio: float = 0.50,
    blur_sigma: float = 8.0,
    do_perspective: bool = True,
    do_dof: bool = True,
    do_emphasis: bool = True,
) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """
    与原 smart_composite 兼容的函数接口。
    
    如果传入 scale，则使用 scale 模式（与旧接口一致，退化为固定 scale）。
    如果传入 scene_type，则使用场景感知模式（推荐）。
    
    Args:
        scene: 场景背景图
        product: 产品图
        scene_type: 场景类型
        product_spec: 产品规格
        scale: 覆盖自动计算的 scale（兼容旧接口）
        y_ratio: 产品垂直位置比例
        blur_sigma: 边缘模糊 sigma
        do_perspective: 透视变换
        do_dof: 景深
        do_emphasis: 产品突出
    
    Returns:
        (合成图, (px, py, w, h))
    """
    w, h = scene.size
    compositor = SceneAwareCompositor(w, h)

    if scale is not None:
        # 兼容模式：使用固定 scale（退化为原始 smart_composite 的行为）
        # 但仍然可以叠加透视、景深、突出效果
        product_spec = product_spec or HDB1_PRODUCT
        target_w = int(w * scale)
        prod_scale_factor = target_w / product.size[0]
        target_h = int(product.size[1] * prod_scale_factor)

        prod_resized = product.resize((target_w, target_h), Image.LANCZOS)

        if do_perspective:
            config = SCENE_CONFIGS.get(scene_type)
            angle = config.view_angle_deg if config else 15
            prod_resized = PerspectiveMatcher.apply_perspective(prod_resized, angle)

        if do_dof:
            prod_resized = DepthOfFieldSimulator.apply_dof(prod_resized, "midground")

        if do_emphasis:
            prod_resized = ProductEmphasis.emphasize(prod_resized)

        mask = compositor._remove_white_bg(prod_resized)
        px = (w - target_w) // 2
        py = max(0, min(h - target_h, int(h * y_ratio)))

        result = compositor._alpha_blend_composite(
            scene, prod_resized, mask, px, py, blur_sigma
        )
        return result, (px, py, target_w, target_h)

    else:
        # 场景感知模式（推荐）
        position_x = 0.5  # 居中
        position_y = y_ratio

        result = compositor.composite(
            scene_image=scene,
            product_image=product,
            scene_type=scene_type,
            product_spec=product_spec,
            position=(position_x, position_y),
            do_perspective=do_perspective,
            do_dof=do_dof,
            do_emphasis=do_emphasis,
            edge_blur_sigma=blur_sigma,
        )
        return result.image, result.product_bbox


# ============================================================================
# §9 独立测试 & 演示
# ============================================================================

def _create_test_product(width: int = 300, height: int = 800) -> Image.Image:
    """
    创建一个模拟的剃须刀产品图（用于测试）。
    深灰色圆柱体 + 金色顶部。
    """
    img = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    arr = np.zeros((height, width, 4), dtype=np.uint8)

    # 主体：深灰色圆柱（椭圆渐变模拟立体感）
    cx = width // 2
    for y in range(int(height * 0.12), int(height * 0.92)):
        for x in range(width):
            dx = (x - cx) / (width * 0.38)
            if abs(dx) <= 1.0:
                # 圆柱体光照：cos 渐变
                brightness = int(80 + 60 * math.cos(dx * math.pi / 2))
                arr[y, x] = [brightness, brightness, brightness + 5, 255]

    # 顶部：金色刀网
    for y in range(0, int(height * 0.12)):
        for x in range(width):
            dx = (x - cx) / (width * 0.35)
            if abs(dx) <= 1.0:
                gold_r = int(180 + 40 * math.cos(dx * math.pi / 2))
                gold_g = int(150 + 30 * math.cos(dx * math.pi / 2))
                gold_b = int(60 + 20 * math.cos(dx * math.pi / 2))
                arr[y, x] = [gold_r, gold_g, gold_b, 255]

    # 底部 LangKe logo 区域
    for y in range(int(height * 0.92), height):
        for x in range(width):
            dx = (x - cx) / (width * 0.38)
            if abs(dx) <= 1.0:
                arr[y, x] = [50, 50, 55, 255]

    img = Image.fromarray(arr)
    return img


def _create_test_scene(
    width: int = 1024, height: int = 1024, style: str = "bathroom"
) -> Image.Image:
    """创建一个简单的测试场景图。"""
    arr = np.zeros((height, width, 3), dtype=np.uint8)

    if style == "bathroom":
        # 白色台面 + 微渐变
        for y in range(height):
            for x in range(width):
                # 基础白色台面
                base = 220 + int(15 * math.sin(x / 100) * math.cos(y / 80))
                arr[y, x] = [base, base + 2, base + 5]
    elif style == "dark":
        # 深色渐变背景
        for y in range(height):
            for x in range(width):
                r = int(20 + 30 * (y / height))
                g = int(20 + 25 * (y / height))
                b = int(30 + 40 * (y / height))
                arr[y, x] = [r, g, b]
    else:
        # 木纹色
        for y in range(height):
            for x in range(width):
                base_r = 120 + int(20 * math.sin(x / 30 + y / 50))
                base_g = 80 + int(15 * math.sin(x / 25 + y / 45))
                base_b = 50 + int(10 * math.sin(x / 20 + y / 40))
                arr[y, x] = [base_r, base_g, base_b]

    return Image.fromarray(arr)


def main():
    """独立测试入口。"""
    import os
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scene_aware_test_output")
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("  Scene-Aware Compositor — 独立测试")
    print("=" * 60)

    # 创建测试素材
    product_img = _create_test_product(300, 800)
    product_img.save(os.path.join(output_dir, "test_product.png"))
    print("\n✓ 测试产品图已生成")

    # ── 测试 1: 预计算各场景的产品缩放参数 ──
    print("\n" + "─" * 50)
    print("测试 1: 各场景的产品缩放参数")
    print("─" * 50)

    compositor = SceneAwareCompositor(1024, 1024)

    for scene_type in SCENE_CONFIGS:
        info = compositor.calculate_product_scale(scene_type, HDB1_PRODUCT)
        print(f"\n  [{info['scene_name']}] ({scene_type})")
        print(f"    视角: {info['view_angle_deg']}°")
        print(f"    像素/厘米比: {info['pixel_per_cm']}")
        print(f"    产品像素尺寸: {info['target_w_px']} × {info['target_h_px']}")
        print(f"    占画布比例: {info['scale_ratio']:.1%}")
        if info['ref_objects']:
            print(f"    参照物 ({info['ref_objects_count']}个):")
            for ref in info['ref_objects']:
                print(f"      - {ref['name']} ({ref['real_size']}) @ {ref['expected_position']}")

    # ── 测试 2: 各场景合成测试 ──
    print("\n" + "─" * 50)
    print("测试 2: 场景感知合成")
    print("─" * 50)

    test_cases = [
        ("lifestyle_bathroom", "bathroom", (0.5, 0.45), "midground"),
        ("topdown_greenery", "bathroom", (0.5, 0.45), "midground"),
        ("warm_wood", "wood", (0.5, 0.45), "midground"),
        ("tech_gradient", "dark", (0.5, 0.50), "foreground"),
        ("modern_marble", "bathroom", (0.5, 0.45), "midground"),
        ("minimalist", "bathroom", (0.5, 0.45), "midground"),
    ]

    for scene_type, bg_style, pos, depth in test_cases:
        scene_img = _create_test_scene(1024, 1024, bg_style)

        result = compositor.composite(
            scene_image=scene_img,
            product_image=product_img,
            scene_type=scene_type,
            product_spec=HDB1_PRODUCT,
            position=pos,
            depth_layer=depth,
            do_perspective=True,
            do_dof=True,
            do_emphasis=True,
        )

        filename = f"test_{scene_type}.png"
        result.image.save(os.path.join(output_dir, filename))
        px, py, pw, ph = result.product_bbox
        print(f"\n  ✓ {scene_type}")
        print(f"    产品位置: ({px}, {py}), 尺寸: {pw}×{ph}")
        print(f"    px/cm: {result.pixel_per_cm:.2f}")
        print(f"    scale_ratio: {result.product_scale_ratio:.3f}")

    # ── 测试 3: 兼容接口测试 ──
    print("\n" + "─" * 50)
    print("测试 3: 兼容 smart_composite 接口")
    print("─" * 50)

    scene_img = _create_test_scene(1024, 1024, "bathroom")

    # 3a: 使用 scene_type（场景感知模式）
    result_img, bbox = scene_aware_composite(
        scene=scene_img,
        product=product_img,
        scene_type="lifestyle_bathroom",
    )
    result_img.save(os.path.join(output_dir, "test_compat_scene_aware.png"))
    print(f"\n  ✓ 场景感知模式: bbox={bbox}")

    # 3b: 使用 scale（兼容模式）
    result_img, bbox = scene_aware_composite(
        scene=scene_img,
        product=product_img,
        scene_type="lifestyle_bathroom",
        scale=0.42,
        y_ratio=0.50,
    )
    result_img.save(os.path.join(output_dir, "test_compat_fixed_scale.png"))
    print(f"  ✓ 固定 scale 兼容模式: bbox={bbox}")

    # ── 测试 4: 生成含参照物的场景 prompt ──
    print("\n" + "─" * 50)
    print("测试 4: 含参照物的场景 Prompt")
    print("─" * 50)

    for scene_type in SCENE_CONFIGS:
        prompt = compositor.generate_scene_prompt_with_refs(scene_type)
        print(f"\n  [{scene_type}]")
        print(f"    {prompt[:120]}...")

    # ── 测试 5: 透视变换可视化对比 ──
    print("\n" + "─" * 50)
    print("测试 5: 透视变换效果对比")
    print("─" * 50)

    for angle in [0, 15, 30, 60, 85]:
        transformed = PerspectiveMatcher.apply_perspective(product_img, angle)
        transformed.save(os.path.join(output_dir, f"perspective_{angle}deg.png"))
        print(f"  ✓ {angle}° 透视变换已保存")

    # ── 测试 6: 景深模糊对比 ──
    print("\n" + "─" * 50)
    print("测试 6: 景深模糊效果对比")
    print("─" * 50)

    for layer in ["foreground", "midground", "background"]:
        blurred = DepthOfFieldSimulator.apply_dof(product_img, layer)
        blurred.save(os.path.join(output_dir, f"dof_{layer}.png"))
        sigma = DepthOfFieldSimulator.LAYER_BLUR_MAP[layer]
        print(f"  ✓ {layer} (sigma={sigma}) 已保存")

    # ── 总结 ──
    print("\n" + "=" * 60)
    print(f"  所有测试完成！输出目录: {output_dir}")
    print("=" * 60)
    print("\n生成的文件:")
    for f in sorted(os.listdir(output_dir)):
        fpath = os.path.join(output_dir, f)
        size_kb = os.path.getsize(fpath) / 1024
        print(f"  {f} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
