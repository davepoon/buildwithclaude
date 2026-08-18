#!/usr/bin/env python3
"""
preference_memory.py — 用户偏好记忆模块
========================================
存储和检索用户的风格偏好，跨项目复用。

功能:
1. 保存项目偏好（风格、品牌、色调、布局等）
2. 按关键词/标签检索历史偏好
3. 列出所有偏好记录
4. 导出偏好统计和推荐

Usage:
    # 保存偏好
    python scripts/preference_memory.py \\
        --action save \\
        --project-name "示例项目" \\
        --preferences '{"style":"tech_gradient","brand":"langke"}' \\
        --tags '["剃须刀","朗科","科技风"]'

    # 检索偏好
    python scripts/preference_memory.py \\
        --action search \\
        --query "剃须刀科技风格"

    # 列出所有偏好
    python scripts/preference_memory.py --action list

    # 导出偏好统计
    python scripts/preference_memory.py --action stats

依赖: 无外部依赖（纯Python + json）
"""

import argparse
import json
import os
import sys
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import Counter


# ============================================================================
# 路径常量
# ============================================================================

SKILL_DIR = Path(__file__).parent.parent
REFERENCES_DIR = SKILL_DIR / "references"
PREFERENCES_FILE = REFERENCES_DIR / "user_preferences.json"

# 初始模板
INITIAL_PREFERENCES_DATA = {
    "version": "1.0",
    "description": "用户偏好记忆库 — 记录每次项目的风格偏好，跨项目复用",
    "preferences": [],
    "metadata": {
        "created_at": None,
        "last_updated": None,
        "total_entries": 0
    }
}


# ============================================================================
# 工具函数
# ============================================================================

def load_preferences() -> dict:
    """加载偏好数据，不存在则创建初始文件"""
    if PREFERENCES_FILE.exists():
        with open(PREFERENCES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    
    # 创建初始文件
    data = INITIAL_PREFERENCES_DATA.copy()
    data["metadata"]["created_at"] = datetime.now().isoformat()
    save_preferences(data)
    return data


def save_preferences(data: dict):
    """保存偏好数据"""
    REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
    with open(PREFERENCES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_id() -> str:
    """生成唯一ID"""
    return f"pref_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"


# ============================================================================
# 核心功能
# ============================================================================

def save_preference(project_name: str, preferences: dict,
                    tags: Optional[List[str]] = None) -> dict:
    """
    保存一条偏好记录。
    
    Args:
        project_name: 项目名称
        preferences: 偏好配置字典
        tags: 标签列表
    
    Returns:
        保存的记录
    """
    data = load_preferences()
    
    entry = {
        "id": generate_id(),
        "project_name": project_name,
        "timestamp": datetime.now().isoformat(),
        "preferences": preferences,
        "tags": tags or [],
        "usage_count": 0,
        "last_used": None
    }
    
    data["preferences"].append(entry)
    data["metadata"]["last_updated"] = datetime.now().isoformat()
    data["metadata"]["total_entries"] = len(data["preferences"])
    save_preferences(data)
    
    return entry


def search_preferences(query: str, top_k: int = 5) -> List[dict]:
    """
    搜索偏好记录（基于标签匹配 + 偏好字段模糊匹配）。
    
    Args:
        query: 搜索关键词
        top_k: 返回前K个结果
    
    Returns:
        匹配的偏好记录列表（按相关度排序）
    """
    data = load_preferences()
    entries = data.get("preferences", [])
    
    if not entries:
        return []
    
    query_lower = query.lower().strip()
    query_terms = set(query_lower.split())
    
    scored = []
    for entry in entries:
        score = 0.0
        
        # 1. 标签匹配（权重最高）
        tags = [t.lower() for t in entry.get("tags", [])]
        tag_match = sum(1 for term in query_terms if any(term in tag or tag in term for tag in tags))
        score += tag_match * 3.0
        
        # 2. 项目名称匹配
        name = entry.get("project_name", "").lower()
        if query_lower in name or name in query_lower:
            score += 2.0
        for term in query_terms:
            if term in name:
                score += 1.0
        
        # 3. 偏好字段匹配
        prefs = entry.get("preferences", {})
        for key, value in prefs.items():
            value_str = str(value).lower()
            for term in query_terms:
                if term in value_str or value_str in term:
                    score += 1.5
        
        # 4. 使用频率加成（常用偏好优先）
        usage = entry.get("usage_count", 0)
        score += min(usage * 0.1, 1.0)
        
        if score > 0:
            scored.append((entry, score))
    
    # 排序并取Top-K
    scored.sort(key=lambda x: x[1], reverse=True)
    results = []
    for entry, score in scored[:top_k]:
        result = entry.copy()
        result["_relevance_score"] = round(score, 2)
        results.append(result)
    
    # 自动更新使用次数
    if results:
        _update_usage(results[0]["id"])
    
    return results


def _update_usage(pref_id: str):
    """更新偏好记录的使用次数和最后使用时间"""
    data = load_preferences()
    for entry in data["preferences"]:
        if entry["id"] == pref_id:
            entry["usage_count"] = entry.get("usage_count", 0) + 1
            entry["last_used"] = datetime.now().isoformat()
            break
    data["metadata"]["last_updated"] = datetime.now().isoformat()
    save_preferences(data)


def list_preferences() -> List[dict]:
    """列出所有偏好记录"""
    data = load_preferences()
    entries = data.get("preferences", [])
    # 按时间降序排列
    entries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return entries


def compute_stats() -> dict:
    """
    计算偏好统计信息，输出推荐偏好。
    
    Returns:
        统计结果字典
    """
    data = load_preferences()
    entries = data.get("preferences", [])
    
    if not entries:
        return {
            "total_entries": 0,
            "message": "暂无偏好记录",
            "recommended": {}
        }
    
    # 统计各字段频率
    style_counter = Counter()
    brand_counter = Counter()
    color_tone_counter = Counter()
    text_layout_counter = Counter()
    tag_counter = Counter()
    platform_counter = Counter()
    
    for entry in entries:
        prefs = entry.get("preferences", {})
        
        style = prefs.get("style", "")
        if style:
            style_counter[style] += 1
        
        brand = prefs.get("brand", "")
        if brand:
            brand_counter[brand] += 1
        
        color_tone = prefs.get("color_tone", "")
        if color_tone:
            color_tone_counter[color_tone] += 1
        
        text_layout = prefs.get("text_layout", "")
        if text_layout:
            text_layout_counter[text_layout] += 1
        
        platform = prefs.get("platform", "")
        if platform:
            platform_counter[platform] += 1
        
        for tag in entry.get("tags", []):
            tag_counter[tag] += 1
    
    # 推荐偏好（各维度最常用值）
    recommended = {
        "style": style_counter.most_common(1)[0][0] if style_counter else None,
        "brand": brand_counter.most_common(1)[0][0] if brand_counter else None,
        "color_tone": color_tone_counter.most_common(1)[0][0] if color_tone_counter else None,
        "text_layout": text_layout_counter.most_common(1)[0][0] if text_layout_counter else None,
        "platform": platform_counter.most_common(1)[0][0] if platform_counter else None,
    }
    
    # 清理None值
    recommended = {k: v for k, v in recommended.items() if v is not None}
    
    stats = {
        "total_entries": len(entries),
        "date_range": {
            "earliest": min(e.get("timestamp", "") for e in entries) if entries else None,
            "latest": max(e.get("timestamp", "") for e in entries) if entries else None,
        },
        "top_styles": style_counter.most_common(5),
        "top_brands": brand_counter.most_common(5),
        "top_color_tones": color_tone_counter.most_common(5),
        "top_text_layouts": text_layout_counter.most_common(5),
        "top_platforms": platform_counter.most_common(5),
        "top_tags": tag_counter.most_common(10),
        "recommended": recommended,
        "most_used": {
            "entry": max(entries, key=lambda x: x.get("usage_count", 0)).get("project_name", "") if entries else None,
            "usage_count": max(e.get("usage_count", 0) for e in entries) if entries else 0,
        }
    }
    
    return stats


def delete_preference(pref_id: str) -> bool:
    """
    删除一条偏好记录。
    
    Args:
        pref_id: 偏好记录ID
    
    Returns:
        是否删除成功
    """
    data = load_preferences()
    original_len = len(data["preferences"])
    data["preferences"] = [e for e in data["preferences"] if e["id"] != pref_id]
    
    if len(data["preferences"]) < original_len:
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        data["metadata"]["total_entries"] = len(data["preferences"])
        save_preferences(data)
        return True
    return False


# ============================================================================
# CLI 入口
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="用户偏好记忆模块 — 存储和检索风格偏好，跨项目复用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 保存偏好
  python scripts/preference_memory.py \\
      --action save \\
      --project-name "示例项目" \\
      --preferences '{"style":"tech_gradient","brand":"langke","color_tone":"dark"}' \\
      --tags '["剃须刀","朗科","科技风"]'

  # 检索偏好
  python scripts/preference_memory.py --action search --query "剃须刀科技风格"

  # 列出所有偏好
  python scripts/preference_memory.py --action list

  # 统计信息
  python scripts/preference_memory.py --action stats

  # 删除偏好
  python scripts/preference_memory.py --action delete --id pref_20260809_abc123
        """
    )
    parser.add_argument(
        "--action", required=True,
        choices=["save", "search", "list", "stats", "delete"],
        help="操作类型：save(保存)/search(搜索)/list(列表)/stats(统计)/delete(删除)"
    )
    parser.add_argument(
        "--project-name", default=None,
        help="项目名称（save时使用）"
    )
    parser.add_argument(
        "--preferences", default=None,
        help='偏好配置JSON字符串（save时使用，如 \'{"style":"tech_gradient"}\'）'
    )
    parser.add_argument(
        "--tags", default=None,
        help='标签JSON数组字符串（save时使用，如 \'["剃须刀","朗科"]\'）'
    )
    parser.add_argument(
        "--query", default=None,
        help="搜索关键词（search时使用）"
    )
    parser.add_argument(
        "--top-k", type=int, default=5,
        help="搜索结果数量（search时使用，默认5）"
    )
    parser.add_argument(
        "--id", default=None,
        help="偏好记录ID（delete时使用）"
    )
    parser.add_argument(
        "--pretty", action="store_true", default=True,
        help="美化JSON输出（默认开启）"
    )
    
    args = parser.parse_args()
    
    # ─── save ───
    if args.action == "save":
        if not args.project_name:
            print("Error: save操作需要 --project-name", file=sys.stderr)
            sys.exit(1)
        
        # 解析偏好
        try:
            prefs = json.loads(args.preferences) if args.preferences else {}
        except json.JSONDecodeError as e:
            print(f"Error: --preferences JSON解析失败: {e}", file=sys.stderr)
            sys.exit(1)
        
        # 解析标签
        try:
            tags = json.loads(args.tags) if args.tags else []
        except json.JSONDecodeError as e:
            print(f"Error: --tags JSON解析失败: {e}", file=sys.stderr)
            sys.exit(1)
        
        entry = save_preference(args.project_name, prefs, tags)
        
        indent = 2 if args.pretty else None
        print("偏好已保存:")
        print(json.dumps(entry, ensure_ascii=False, indent=indent))
    
    # ─── search ───
    elif args.action == "search":
        if not args.query:
            print("Error: search操作需要 --query", file=sys.stderr)
            sys.exit(1)
        
        results = search_preferences(args.query, top_k=args.top_k)
        
        indent = 2 if args.pretty else None
        if results:
            print(f"找到 {len(results)} 条相关偏好记录:")
            print(json.dumps(results, ensure_ascii=False, indent=indent))
        else:
            print(f"未找到与 \"{args.query}\" 相关的偏好记录")
    
    # ─── list ───
    elif args.action == "list":
        entries = list_preferences()
        indent = 2 if args.pretty else None
        
        if entries:
            print(f"共 {len(entries)} 条偏好记录:")
            for i, entry in enumerate(entries, 1):
                print(f"\n[{i}] {entry['project_name']}")
                print(f"    ID: {entry['id']}")
                print(f"    时间: {entry['timestamp'][:19]}")
                print(f"    标签: {', '.join(entry.get('tags', []))}")
                print(f"    偏好: {json.dumps(entry.get('preferences', {}), ensure_ascii=False)}")
                print(f"    使用次数: {entry.get('usage_count', 0)}")
        else:
            print("暂无偏好记录")
    
    # ─── stats ───
    elif args.action == "stats":
        stats = compute_stats()
        indent = 2 if args.pretty else None
        
        print("=== 偏好统计 ===")
        print(json.dumps(stats, ensure_ascii=False, indent=indent))
    
    # ─── delete ───
    elif args.action == "delete":
        if not args.id:
            print("Error: delete操作需要 --id", file=sys.stderr)
            sys.exit(1)
        
        success = delete_preference(args.id)
        if success:
            print(f"已删除偏好记录: {args.id}")
        else:
            print(f"未找到偏好记录: {args.id}")


if __name__ == "__main__":
    main()
