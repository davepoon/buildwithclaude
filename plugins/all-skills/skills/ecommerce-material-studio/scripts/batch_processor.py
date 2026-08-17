#!/usr/bin/env python3
"""
batch_processor.py — 批量处理引擎
==================================
批量处理多个产品的素材生成，支持进度追踪、断点续传和失败重试。

核心职责:
1. 解析产品列表
2. 为每个产品调用 category_detector + style_matcher 生成配置
3. 输出标准化的任务队列
4. 追踪完成状态（实时更新状态文件）
5. 支持断点续传和失败重试

注意: 本脚本负责流程编排和输入准备，实际的生图和文字渲染
由主流程的 AI agent 执行。

Usage:
    # 生成任务队列（预处理阶段）
    python scripts/batch_processor.py \\
        --input products.json \\
        --output-dir ./batch_output \\
        --status-file status.json \\
        --prepare

    # 查看当前状态
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --status

    # 标记产品完成
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --mark-complete product_001 \\
        --output-subdir ./batch_output/product_001 \\
        --images-count 11

    # 标记产品失败
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --mark-failed product_002 \\
        --error "AI融合生图超时"

    # 获取下一个待处理产品
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --next

    # 重试失败的产品
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --retry-failed

    # 生成汇总报告
    python scripts/batch_processor.py \\
        --status-file status.json \\
        --report

依赖: 无外部依赖（纯Python + json）
"""

import argparse
import json
import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any


# ============================================================================
# 路径常量
# ============================================================================

SKILL_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"


# ============================================================================
# 状态管理
# ============================================================================

def create_status_file(batch_id: str, products: List[dict],
                       status_file: str) -> dict:
    """
    创建初始状态文件。
    
    Args:
        batch_id: 批次ID
        products: 产品列表
        status_file: 状态文件路径
    
    Returns:
        状态数据字典
    """
    status = {
        "batch_id": batch_id,
        "created_at": datetime.now().isoformat(),
        "last_updated": datetime.now().isoformat(),
        "total": len(products),
        "completed": 0,
        "failed": 0,
        "in_progress": 0,
        "pending": len(products),
        "products": []
    }
    
    for product in products:
        pid = product.get("id", f"product_{products.index(product)}")
        status["products"].append({
            "id": pid,
            "product_image": product.get("product_image", ""),
            "brand": product.get("brand", ""),
            "model": product.get("model", ""),
            "category": product.get("category", ""),
            "price": product.get("price", 0),
            "platform": product.get("platform", "general"),
            "style": product.get("style", ""),
            "selling_points": product.get("selling_points", []),
            "status": "pending",
            "output_dir": None,
            "images_count": 0,
            "error": None,
            "current_step": None,
            "config_file": None,
            "started_at": None,
            "completed_at": None,
        })
    
    _save_status(status, status_file)
    return status


def load_status(status_file: str) -> dict:
    """加载状态文件"""
    if not os.path.isfile(status_file):
        print(f"Error: 状态文件不存在: {status_file}", file=sys.stderr)
        sys.exit(1)
    
    with open(status_file, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_status(status: dict, status_file: str):
    """保存状态文件"""
    status["last_updated"] = datetime.now().isoformat()
    
    # 重新计算统计
    statuses = [p["status"] for p in status["products"]]
    status["completed"] = statuses.count("completed")
    status["failed"] = statuses.count("failed")
    status["in_progress"] = statuses.count("in_progress")
    status["pending"] = statuses.count("pending")
    
    output_path = Path(status_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(status, f, ensure_ascii=False, indent=2)


def load_product_list(input_file: str) -> List[dict]:
    """
    加载产品列表JSON。
    
    Args:
        input_file: 产品列表JSON路径
    
    Returns:
        产品列表
    """
    if not os.path.isfile(input_file):
        print(f"Error: 产品列表文件不存在: {input_file}", file=sys.stderr)
        sys.exit(1)
    
    with open(input_file, "r", encoding="utf-8") as f:
        products = json.load(f)
    
    if not isinstance(products, list):
        print("Error: 产品列表必须是JSON数组", file=sys.stderr)
        sys.exit(1)
    
    # 验证必填字段
    for i, product in enumerate(products):
        if "product_image" not in product:
            print(f"Error: 产品[{i}]缺少必填字段 product_image", file=sys.stderr)
            sys.exit(1)
        if "id" not in product:
            product["id"] = f"product_{i+1:03d}"
    
    return products


# ============================================================================
# 预处理：为每个产品生成配置
# ============================================================================

def prepare_product_config(product: dict, output_dir: str) -> dict:
    """
    为单个产品生成配置文件（调用category_detector + style_matcher）。
    
    Args:
        product: 产品配置字典
        output_dir: 输出目录
    
    Returns:
        配置结果字典
    """
    pid = product["id"]
    product_dir = Path(output_dir) / pid
    product_dir.mkdir(parents=True, exist_ok=True)
    
    config = {
        "product_id": pid,
        "product_image": product.get("product_image", ""),
        "brand": product.get("brand", ""),
        "model": product.get("model", ""),
        "price": product.get("price", 0),
        "platform": product.get("platform", "general"),
        "selling_points": product.get("selling_points", []),
    }
    
    # Step 1: 品类识别（如果用户未指定品类）
    category_result = None
    if not product.get("category"):
        category_file = product_dir / "category.json"
        cmd = [
            sys.executable, str(SCRIPTS_DIR / "category_detector.py"),
            "--image", product["product_image"],
            "--output", str(category_file)
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0 and category_file.exists():
                with open(category_file, "r", encoding="utf-8") as f:
                    category_result = json.load(f)
                config["category"] = category_result.get("category", "家居日用")
                config["sub_category"] = category_result.get("sub_category", "")
                config["category_attributes"] = category_result.get("attributes", {})
            else:
                config["category"] = "家居日用"
                config["sub_category"] = ""
                config["category_note"] = "品类识别失败，使用默认品类"
        except Exception as e:
            config["category"] = "家居日用"
            config["sub_category"] = ""
            config["category_note"] = f"品类识别异常: {e}"
    else:
        config["category"] = product["category"]
        config["sub_category"] = product.get("sub_category", product["category"])
    
    # Step 2: 风格匹配
    style_result = None
    if config.get("category"):
        style_file = product_dir / "style_recommendation.json"
        cmd = [
            sys.executable, str(SCRIPTS_DIR / "style_matcher.py"),
            "--category", config["category"],
            "--sub-category", config.get("sub_category", config["category"]),
            "--price", str(config.get("price", 100)),
            "--platform", config.get("platform", "general"),
            "--output", str(style_file)
        ]
        if product.get("brand"):
            cmd.extend(["--brand", product["brand"]])
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0 and style_file.exists():
                with open(style_file, "r", encoding="utf-8") as f:
                    style_result = json.load(f)
                config["style_recommendation"] = style_result
                # 如果用户未指定风格，使用推荐的第一模板
                if not product.get("style"):
                    templates = style_result.get("recommended_templates", [])
                    if templates:
                        config["style"] = templates[0].get("template_id", "minimalist")
        except Exception as e:
            config["style_note"] = f"风格匹配异常: {e}"
    
    if not config.get("style"):
        config["style"] = product.get("style", "minimalist")
    
    # 保存配置
    config_file = product_dir / "product_config.json"
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    
    config["config_file"] = str(config_file)
    config["output_dir"] = str(product_dir)
    
    return config


def prepare_batch(product_list: List[dict], output_dir: str,
                  status_file: str) -> dict:
    """
    批量预处理：为所有产品生成配置并创建状态文件。
    
    Args:
        product_list: 产品列表
        output_dir: 输出根目录
        status_file: 状态文件路径
    
    Returns:
        状态数据字典
    """
    batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # 创建状态文件
    status = create_status_file(batch_id, product_list, status_file)
    
    print(f"批次ID: {batch_id}")
    print(f"产品总数: {len(product_list)}")
    print(f"输出目录: {output_dir}")
    print(f"状态文件: {status_file}")
    print()
    
    # 为每个产品生成配置
    for i, product in enumerate(product_list):
        pid = product["id"]
        print(f"[{i+1}/{len(product_list)}] 预处理: {pid} ...", end=" ")
        
        try:
            config = prepare_product_config(product, output_dir)
            
            # 更新状态文件
            for p in status["products"]:
                if p["id"] == pid:
                    p["config_file"] = config.get("config_file")
                    p["output_dir"] = config.get("output_dir")
                    p["category"] = config.get("category", "")
                    p["style"] = config.get("style", "")
                    break
            
            print(f"✓ (品类: {config.get('category', '?')}, 风格: {config.get('style', '?')})")
            
        except Exception as e:
            print(f"✗ ({e})")
            for p in status["products"]:
                if p["id"] == pid:
                    p["status"] = "failed"
                    p["error"] = f"预处理失败: {e}"
                    break
    
    _save_status(status, status_file)
    
    # 打印汇总
    print(f"\n预处理完成:")
    print(f"  成功: {sum(1 for p in status['products'] if p['status'] == 'pending')}")
    print(f"  失败: {sum(1 for p in status['products'] if p['status'] == 'failed')}")
    
    return status


# ============================================================================
# 状态操作
# ============================================================================

def show_status(status_file: str):
    """显示当前状态"""
    status = load_status(status_file)
    
    print(f"=== 批次 {status['batch_id']} ===")
    print(f"总计: {status['total']} | 完成: {status['completed']} | "
          f"进行中: {status['in_progress']} | 失败: {status['failed']} | "
          f"待处理: {status['pending']}")
    print()
    
    for p in status["products"]:
        status_icon = {
            "completed": "✅", "in_progress": "🔄",
            "failed": "❌", "pending": "⏳"
        }.get(p["status"], "?")
        
        line = f"  {status_icon} {p['id']}"
        if p.get("category"):
            line += f" ({p['category']})"
        if p.get("current_step"):
            line += f" [步骤: {p['current_step']}]"
        if p["status"] == "completed":
            line += f" → {p.get('images_count', 0)}张图"
        elif p["status"] == "failed" and p.get("error"):
            line += f" — {p['error'][:50]}"
        
        print(line)


def get_next_product(status_file: str) -> Optional[dict]:
    """
    获取下一个待处理的产品。
    
    Returns:
        下一个产品的配置信息，或None
    """
    status = load_status(status_file)
    
    for p in status["products"]:
        if p["status"] == "pending":
            # 标记为进行中
            p["status"] = "in_progress"
            p["current_step"] = "category_detect"
            p["started_at"] = datetime.now().isoformat()
            _save_status(status, status_file)
            
            # 输出产品配置（供AI agent读取）
            if p.get("config_file") and os.path.isfile(p["config_file"]):
                with open(p["config_file"], "r", encoding="utf-8") as f:
                    config = json.load(f)
                print(json.dumps(config, ensure_ascii=False, indent=2))
            else:
                print(json.dumps(p, ensure_ascii=False, indent=2))
            
            return p
    
    print("所有产品已处理完毕！")
    return None


def mark_complete(status_file: str, product_id: str,
                  output_subdir: str = None, images_count: int = 0):
    """标记产品处理完成"""
    status = load_status(status_file)
    
    found = False
    for p in status["products"]:
        if p["id"] == product_id:
            p["status"] = "completed"
            p["completed_at"] = datetime.now().isoformat()
            p["current_step"] = None
            if output_subdir:
                p["output_dir"] = output_subdir
            p["images_count"] = images_count
            found = True
            break
    
    if not found:
        print(f"Error: 未找到产品 {product_id}", file=sys.stderr)
        sys.exit(1)
    
    _save_status(status, status_file)
    print(f"✅ {product_id} 已标记完成 ({images_count}张图)")


def mark_failed(status_file: str, product_id: str, error: str = ""):
    """标记产品处理失败"""
    status = load_status(status_file)
    
    found = False
    for p in status["products"]:
        if p["id"] == product_id:
            p["status"] = "failed"
            p["error"] = error
            p["current_step"] = None
            found = True
            break
    
    if not found:
        print(f"Error: 未找到产品 {product_id}", file=sys.stderr)
        sys.exit(1)
    
    _save_status(status, status_file)
    print(f"❌ {product_id} 已标记失败: {error}")


def update_step(status_file: str, product_id: str, step: str):
    """更新产品当前处理步骤"""
    status = load_status(status_file)
    
    for p in status["products"]:
        if p["id"] == product_id:
            p["current_step"] = step
            break
    
    _save_status(status, status_file)
    print(f"🔄 {product_id} 当前步骤: {step}")


def retry_failed(status_file: str) -> List[str]:
    """
    重置失败的产品为待处理状态。
    
    Returns:
        被重置的产品ID列表
    """
    status = load_status(status_file)
    
    retried = []
    for p in status["products"]:
        if p["status"] == "failed":
            p["status"] = "pending"
            p["error"] = None
            p["current_step"] = None
            p["started_at"] = None
            p["completed_at"] = None
            retried.append(p["id"])
    
    _save_status(status, status_file)
    
    if retried:
        print(f"已重置 {len(retried)} 个失败产品为待处理:")
        for pid in retried:
            print(f"  ⏳ {pid}")
    else:
        print("没有失败的产品需要重试")
    
    return retried


def generate_report(status_file: str) -> dict:
    """
    生成批次处理汇总报告。
    
    Returns:
        报告字典
    """
    status = load_status(status_file)
    
    completed = [p for p in status["products"] if p["status"] == "completed"]
    failed = [p for p in status["products"] if p["status"] == "failed"]
    pending = [p for p in status["products"] if p["status"] == "pending"]
    
    total_images = sum(p.get("images_count", 0) for p in completed)
    
    report = {
        "batch_id": status["batch_id"],
        "created_at": status.get("created_at", ""),
        "last_updated": status.get("last_updated", ""),
        "summary": {
            "total": status["total"],
            "completed": len(completed),
            "failed": len(failed),
            "pending": len(pending),
            "success_rate": f"{len(completed)/max(status['total'],1)*100:.1f}%",
            "total_images": total_images,
        },
        "completed_products": [
            {
                "id": p["id"],
                "category": p.get("category", ""),
                "style": p.get("style", ""),
                "images_count": p.get("images_count", 0),
                "output_dir": p.get("output_dir", ""),
            }
            for p in completed
        ],
        "failed_products": [
            {
                "id": p["id"],
                "error": p.get("error", "未知错误"),
            }
            for p in failed
        ],
        "pending_products": [
            {"id": p["id"]}
            for p in pending
        ]
    }
    
    # 打印可读报告
    print("=" * 60)
    print(f"  批次处理报告 — {status['batch_id']}")
    print("=" * 60)
    print(f"  总产品数: {status['total']}")
    print(f"  完成: {len(completed)} | 失败: {len(failed)} | 待处理: {len(pending)}")
    print(f"  成功率: {report['summary']['success_rate']}")
    print(f"  总产出图数: {total_images}")
    print()
    
    if completed:
        print("✅ 已完成:")
        for p in completed:
            print(f"   {p['id']} — {p.get('images_count', 0)}张图 → {p.get('output_dir', '?')}")
    
    if failed:
        print("\n❌ 失败:")
        for p in failed:
            print(f"   {p['id']} — {p.get('error', '?')}")
    
    if pending:
        print(f"\n⏳ 待处理: {', '.join(p['id'] for p in pending)}")
    
    print("=" * 60)
    
    return report


# ============================================================================
# CLI 入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="批量处理引擎 — 多产品素材生成流程编排",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 预处理：生成任务队列
  python scripts/batch_processor.py \\
      --input products.json --output-dir ./batch_output \\
      --status-file status.json --prepare

  # 查看状态
  python scripts/batch_processor.py --status-file status.json --status

  # 获取下一个待处理
  python scripts/batch_processor.py --status-file status.json --next

  # 标记完成
  python scripts/batch_processor.py --status-file status.json \\
      --mark-complete product_001 --output-subdir ./batch_output/product_001 \\
      --images-count 11

  # 标记失败
  python scripts/batch_processor.py --status-file status.json \\
      --mark-failed product_002 --error "生图超时"

  # 重试失败
  python scripts/batch_processor.py --status-file status.json --retry-failed

  # 生成报告
  python scripts/batch_processor.py --status-file status.json --report
        """
    )
    
    # 输入参数
    parser.add_argument(
        "--input", default=None,
        help="产品列表JSON路径"
    )
    parser.add_argument(
        "--output-dir", default=None,
        help="输出根目录"
    )
    parser.add_argument(
        "--status-file", default=None,
        help="状态文件路径"
    )
    
    # 操作模式（互斥）
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--prepare", action="store_true",
                       help="预处理模式：生成任务队列")
    group.add_argument("--status", action="store_true",
                       help="查看当前状态")
    group.add_argument("--next", action="store_true",
                       help="获取下一个待处理产品")
    group.add_argument("--mark-complete", metavar="PRODUCT_ID",
                       help="标记产品处理完成")
    group.add_argument("--mark-failed", metavar="PRODUCT_ID",
                       help="标记产品处理失败")
    group.add_argument("--update-step", metavar="STEP",
                       help="更新当前处理步骤（需配合 --product-id）")
    group.add_argument("--retry-failed", action="store_true",
                       help="重试所有失败产品")
    group.add_argument("--report", action="store_true",
                       help="生成汇总报告")
    
    # 辅助参数
    parser.add_argument("--product-id", default=None,
                        help="产品ID（配合 --update-step 使用）")
    parser.add_argument("--output-subdir", default=None,
                        help="产品输出子目录（配合 --mark-complete 使用）")
    parser.add_argument("--images-count", type=int, default=0,
                        help="产出图片数（配合 --mark-complete 使用）")
    parser.add_argument("--error", default=None,
                        help="错误信息（配合 --mark-failed 使用）")
    
    args = parser.parse_args()
    
    # 验证必要参数
    if args.prepare:
        if not args.input or not args.output_dir or not args.status_file:
            parser.error("--prepare 模式需要 --input, --output-dir, --status-file")
        
        product_list = load_product_list(args.input)
        prepare_batch(product_list, args.output_dir, args.status_file)
    
    elif args.status:
        if not args.status_file:
            parser.error("--status 需要 --status-file")
        show_status(args.status_file)
    
    elif args.next:
        if not args.status_file:
            parser.error("--next 需要 --status-file")
        get_next_product(args.status_file)
    
    elif args.mark_complete:
        if not args.status_file:
            parser.error("--mark-complete 需要 --status-file")
        mark_complete(args.status_file, args.mark_complete,
                      args.output_subdir, args.images_count)
    
    elif args.mark_failed:
        if not args.status_file:
            parser.error("--mark-failed 需要 --status-file")
        mark_failed(args.status_file, args.mark_failed, args.error or "未知错误")
    
    elif args.update_step:
        if not args.status_file or not args.product_id:
            parser.error("--update-step 需要 --status-file 和 --product-id")
        update_step(args.status_file, args.product_id, args.update_step)
    
    elif args.retry_failed:
        if not args.status_file:
            parser.error("--retry-failed 需要 --status-file")
        retry_failed(args.status_file)
    
    elif args.report:
        if not args.status_file:
            parser.error("--report 需要 --status-file")
        generate_report(args.status_file)


if __name__ == "__main__":
    main()
