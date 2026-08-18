#!/usr/bin/env python3
"""
抖音视频内容提取助手 v3.0
用法: python3 douyin_extract.py <视频URL或video_id>

流水线:
  1. 解析video_id（支持短链 + 标准URL）
  2. 调用API获取元数据并打印摘要（首选用移动端SSR解析，无需Cookie）
  3. 下载视频 (可选)
  4. 提取音频和转写 (可选)

修复记录:
  v3.0 (2026-07-05): 新增移动端SSR解析方案。用iPhone UA请求分享链接，
    从页面window._ROUTER_DATA的SSR数据中解析元数据，完全无需Cookie。
    作为主要方案（不需要sessionid）。旧API方案保留为降级。
  v2.2 (2026-06-30): 加入从环境变量读取登录Cookie的支持(DOUYIN_COOKIE)。
    登录后有 sessionid，API可正常返回数据。Cookie由用户手动提供。
  v2.1 (2026-06-30): 移除硬编码的过期Cookie。API空响应时走浏览器降级方案。
  v2.0 (2026-06-27): 短链解析改用 curl -L 跟随重定向，而不是 -I (HEAD)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
import urllib.request
import urllib.error

TMP_DIR = "/tmp"

# 登录Cookie（从环境变量 DOUYIN_COOKIE 读取）
LOGIN_COOKIE = os.environ.get("DOUYIN_COOKIE", "")

# 移动端User-Agent（SSR解析用）
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


def fetch_metadata_ssr(video_url: str, video_id: str) -> dict:
    """用移动端UA请求页面，从SSR数据中解析元数据（无需Cookie）

    抖音移动端页面在 _ROUTER_DATA 中内嵌了完整的视频元数据。
    这是首选方案，不需要任何登录态。
    使用 curl 而不是 urllib，因为 urllib 跟随重定向到桌面版页面。
    """
    subprocess.run
    try:
        result = subprocess.run(
            ['curl', '-sL', '--max-time', '15',
             '-H', 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
             '-H', 'Accept: text/html,application/xhtml+xml',
             video_url],
            capture_output=True, text=True, timeout=20
        )
        html = result.stdout
        if not html or len(html) < 1000:
            return {"_error": "ssr_empty", "_error_msg": f"页面内容太少({len(html) if html else 0}字节)"}
    except Exception as e:
        return {"_error": "ssr_fetch_failed", "_error_msg": str(e)}

    # 提取 _ROUTER_DATA JSON
    marker = 'window._ROUTER_DATA = '
    start = html.find(marker)
    if start < 0:
        return {"_error": "ssr_no_router_data", "_error_msg": "页面中未找到 _ROUTER_DATA"}

    start += len(marker)
    depth = 0
    end = start
    for i, ch in enumerate(html[start:]):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = start + i + 1
                break

    try:
        data = json.loads(html[start:end])
    except json.JSONDecodeError as e:
        return {"_error": "ssr_json_parse", "_error_msg": str(e)}

    # 提取视频信息
    vpage = data.get('loaderData', {}).get('video_(id)/page', {})
    video_info = vpage.get('videoInfoRes', {})
    item_list = video_info.get('item_list', [])
    if not item_list:
        return {"_error": "ssr_no_item", "_error_msg": "SSR数据中未找到item_list"}

    item = item_list[0]

    # 包装成兼容print_metadata的格式
    # print_metadata 期望 data['aweme_detail']，这里把item直接映射
    return {
        "aweme_detail": item,
        "_source": "ssr",
    }


def get_video_id(url_or_id: str) -> str:
    """从抖音短链或直接ID中提取video_id"""
    # 已经是ID
    if re.match(r'^\d{17,}$', url_or_id):
        return url_or_id
    # 标准URL: /video/xxxx
    m = re.search(r'/video/(\d+)', url_or_id)
    if m:
        return m.group(1)
    # note格式: /note/xxxxx (图文笔记，非视频)
    m = re.search(r'/note/(\d+)', url_or_id)
    if m:
        print(f"[INFO] 这是图文笔记(note)类型，video_id={m.group(1)}", file=sys.stderr)
        print(f"[INFO] 图文笔记不包含视频，脚本只能返回基本元数据", file=sys.stderr)
        return m.group(1)
    # 短链: v.douyin.com/xxxx
    m = re.search(r'v\.douyin\.com/(\w+)', url_or_id)
    if m:
        try:
            # 改用 -L 跟随重定向（抖音屏蔽 HEAD 请求）
            result = subprocess.run(
                ['curl', '-sL', '--max-time', '8', url_or_id],
                capture_output=True, text=True, timeout=10
            )
            # 重定向后的URL或页面源码中的 video_id
            loc = re.search(r'/video/(\d+)', result.stderr)
            if loc:
                return loc.group(1)
            # 页面源码中可能有 video_id
            loc = re.search(r'/video/(\d+)', result.stdout)
            if loc:
                return loc.group(1)
            # 搜索 aweme_id 或 video_id 模式
            loc = re.search(r'(\d{19})', result.stdout)
            if loc:
                return loc.group(1)
        except Exception as e:
            print(f"[WARN] 短链解析失败: {e}", file=sys.stderr)

    raise ValueError(f"无法提取video_id: {url_or_id}")


def fetch_metadata(video_id: str, is_note: bool = False) -> dict:
    """调用抖音公开API获取元数据"""
    if is_note:
        # note/图文笔记 使用不同的API端点
        url = f"https://www.douyin.com/aweme/v1/web/note/detail/?note_id={video_id}"
    else:
        url = f"https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id={video_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.douyin.com/",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    if LOGIN_COOKIE:
        headers["Cookie"] = LOGIN_COOKIE
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        raw = resp.read()
        if not raw or len(raw) < 10:
            return {"_error": "empty_response", "_error_msg": "API返回空响应，可能需要cookies"}
        return json.loads(raw.decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"[WARN] API返回 {e.code}: {e.reason}", file=sys.stderr)
        return {"_error": f"HTTP {e.code}", "_error_msg": str(e)}
    except urllib.error.URLError as e:
        print(f"[WARN] API请求失败: {e.reason}", file=sys.stderr)
        return {"_error": "network_error", "_error_msg": str(e)}


def print_metadata(data: dict):
    """打印元数据摘要"""
    # 检测API是否返回错误
    if "_error" in data:
        print(f"[API错误] {data.get('_error')}: {data.get('_error_msg', '未知')}")
        return

    ad = data.get('aweme_detail', {})
    if not ad:
        # 可能是其他格式的响应
        print(f"[WARN] 未找到aweme_detail字段，原始响应: {json.dumps(data, ensure_ascii=False)[:200]}")
        return

    au = ad.get('author', {})
    stats = ad.get('statistics', {})

    desc = ad.get('desc', 'N/A')[:200]
    print(f"标题: {desc}")
    print(f"作者: {au.get('nickname', 'N/A')}")
    print(f"作者签名: {au.get('signature', 'N/A')[:100]}")
    print(f"作者ID: {au.get('unique_id', 'N/A')}")
    print(f"点赞/评论/收藏/分享: "
          f"{stats.get('digg_count', 0):,} / "
          f"{stats.get('comment_count', 0):,} / "
          f"{stats.get('collect_count', 0):,} / "
          f"{stats.get('share_count', 0):,}")
    print(f"粉丝: {au.get('follower_count', 0):,}")

    duration_ms = ad.get('duration', 0)
    print(f"时长: {duration_ms//1000}秒 ({duration_ms//60000}分{duration_ms%60000//1000}秒)")

    for t in ad.get('text_extra', []):
        if 'hashtag_name' in t:
            print(f"标签: #{t['hashtag_name']}")

    # 获取音乐信息
    music = ad.get('music', {})
    if music:
        print(f"背景音乐: {music.get('title', 'N/A')} - {music.get('author', 'N/A')}")

    # 获取发布时间
    create_time = ad.get('create_time', 0)
    if create_time:
        from datetime import datetime
        dt = datetime.fromtimestamp(create_time)
        print(f"发布时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")

    # 判断是否有完整转写价值
    if duration_ms > 0:
        mins = duration_ms / 60000
        if mins < 3:
            print(f"\n[建议] 短视频(<3分钟)，适合完整语音转写")
        elif mins < 10:
            print(f"\n[建议] 中视频(3-10分钟)，可用tiny模型异步转写")
        else:
            print(f"\n[建议] 长视频(>{mins:.0f}分钟)，元数据已足够，语音转写需后台异步")

    # 关键字段原始输出供MAGMA使用
    print("\n--- RAW KEY FIELDS ---")
    print(json.dumps({
        "desc": desc,
        "author_nickname": au.get('nickname'),
        "author_id": au.get('unique_id'),
        "digg_count": stats.get('digg_count'),
        "comment_count": stats.get('comment_count'),
        "collect_count": stats.get('collect_count'),
        "share_count": stats.get('share_count'),
        "duration_ms": duration_ms,
        "hashtags": [t.get('hashtag_name') for t in ad.get('text_extra', []) if 'hashtag_name' in t],
    }, ensure_ascii=False))


def get_video_url(data: dict) -> str:
    """从元数据中提取视频播放地址"""
    play = data.get('aweme_detail', {}).get('video', {}).get('play_addr', {})
    urls = play.get('url_list', [])
    return urls[0] if urls else None


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python3 douyin_extract.py <视频URL或video_id>")
        sys.exit(1)

    url = sys.argv[1]

    try:
        video_id = get_video_id(url)
    except ValueError as e:
        print(f"[ERROR] {e}")
        print("降级方案: 用浏览器打开链接，通过 browser_console 获取 meta description")
        sys.exit(1)

    # 判断是否为 note 类型（图文笔记）
    is_note = '/note/' in url
    if is_note:
        print(f"[INFO] 图文笔记类型，使用 note API 端点")

    print(f"视频ID: {video_id}")

    # 首选：移动端SSR解析（无需Cookie）
    print("[尝试] 移动端SSR解析...", file=sys.stderr)
    data = fetch_metadata_ssr(url, video_id)

    # SSR失败时降级到旧API方案（需要Cookie）
    if data.get("_error", "").startswith("ssr_"):
        print(f"[降级] SSR解析失败 ({data['_error']}), 降级到API方案...", file=sys.stderr)
        data = fetch_metadata(video_id, is_note=is_note)

    json_path = os.path.join(TMP_DIR, f"douyin_{video_id}.json")
    with open(json_path, 'w') as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"元数据已保存: {json_path}")

    print_metadata(data)

    vu = get_video_url(data)
    if vu:
        print(f"\n视频播放URL: {vu[:120]}...")
