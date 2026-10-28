#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
feeling-search · 感觉检索 API 客户端（零第三方依赖，Python 3.8+）

把一句口语化的「感觉」描述落到感受词 + 视觉风格上。两条路径：

  本地词典档   用缓存的词表做命中，不联网、不花钱（大多数情况走这条）
  云端 analyze 本地一个词都没命中、且显式允许上云时才调用，消耗 1 次额度

本地结果绝不会标成云端结果：source 字段只有 "local" / "cloud" 两个值。

子命令
    status                      额度/缓存/连通性体检
    dict [--refresh]            拉取或读出词表缓存
    analyze <文本>              感受词 + 风格（本地优先，零命中才上云）
    lookup <词>                 单个词的落点风格、共现词、对立词（免费）
    style-words <风格id>        某风格挂了哪些词（免费）
    style <风格id>              风格详情，含图片与出处（计费 1 次）
    images <id1,id2,...>        批量取图，最多 5 个（计费 1 次）

通用参数
    --json          输出 JSON（默认人类可读）
    --allow-cloud   允许在本地零命中时调用付费的 /v2/analyze
    --words N       返回词数 1–12（默认 8）
    --styles N      返回风格数 1–30（默认 12）
    --base URL      服务端点，默认 https://xiximm.cloud
    --offline       完全不联网，只用缓存

环境变量
    FS_API_BASE     服务端点（默认 https://xiximm.cloud）
    FS_QUOTA        云端额度 token；留空则永不调用付费端点
    FS_CACHE_DIR    词表缓存目录（默认 ~/.cache/feeling-search）
    FS_CACHE_TTL    缓存有效期秒数（默认 604800 = 7 天）
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

try:  # Windows 控制台默认 GBK，中文会炸
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DEFAULT_BASE = "https://xiximm.cloud"
CACHE_FILE = "dictionary.json"
CACHE_TTL = 7 * 24 * 3600
TIMEOUT = 20

# 服务端口径：text 最长 500 字，>32KB 的请求体会被拒
MAX_CHARS = 500


class ApiError(Exception):
    """线上错误。code 是服务端 error 字段，http 是状态码，payload 是原始响应体。"""

    def __init__(self, message, code="", http=0, payload=None):
        super().__init__(message)
        self.code = code
        self.http = http
        self.payload = payload or {}


# ---------------------------------------------------------------- 基础 IO

def env_base():
    return (os.environ.get("FS_API_BASE") or DEFAULT_BASE).rstrip("/")


def env_quota():
    return (os.environ.get("FS_QUOTA") or "").strip()


def cache_dir():
    d = os.environ.get("FS_CACHE_DIR")
    if d:
        return os.path.abspath(os.path.expanduser(d))
    home = os.path.expanduser("~")
    return os.path.join(home, ".cache", "feeling-search")


def cache_path():
    return os.path.join(cache_dir(), CACHE_FILE)


QUOTA_FILE = "quota.json"


def quota_path():
    return os.path.join(cache_dir(), QUOTA_FILE)


def saved_quota():
    """上次保存下来的额度 token（`quota --set/--claim` 写的）"""
    try:
        with open(quota_path(), "r", encoding="utf-8") as fh:
            return (json.load(fh).get("token") or "").strip()
    except Exception:
        return ""


def quota_url(token):
    """额度端点 URL。统一用 urlencode，别手拼 `?token=`+- 拼接（转义漏一处就会带上原始 token）。"""
    return env_base() + "/v2/quota?" + urllib.parse.urlencode({"token": token})


def save_quota(token, meta=None):
    os.makedirs(cache_dir(), exist_ok=True)
    tmp = quota_path() + ".tmp"
    payload = {"token": token, "saved_at": int(time.time())}
    if meta:
        payload.update(meta)
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    os.replace(tmp, quota_path())
    return quota_path()


def resolve_quota(args=None):
    """token 优先级：--quota > FS_QUOTA 环境变量 > 本地缓存文件。

    返回 (token, 来源)。来源只用于排查，不参与鉴权。
    """
    if args is not None:
        v = (getattr(args, "quota", "") or "").strip()
        if v:
            return v, "flag"
    v = env_quota()
    if v:
        return v, "env"
    v = saved_quota()
    if v:
        return v, "file"
    return "", ""


def cache_ttl():
    try:
        return int(os.environ.get("FS_CACHE_TTL") or CACHE_TTL)
    except ValueError:
        return CACHE_TTL


def http_get(url, headers=None, offline=False):
    if offline:
        raise ApiError("离线模式：不允许联网（去掉 --offline 或先跑一次 dict）", "offline")
    req = urllib.request.Request(url, method="GET")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    req.add_header("User-Agent", "feeling-search-skill/1.0")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode("utf-8", "replace"))
        except Exception:
            body = {}
        raise ApiError(body.get("message") or ("HTTP %s" % e.code),
                       body.get("error") or "http_error", e.code, body)
    except urllib.error.URLError as e:
        raise ApiError("连不上服务端：%s" % (e.reason,), "network_unreachable", 0)


def http_post(url, payload, headers=None, offline=False):
    if offline:
        raise ApiError("离线模式：不允许联网", "offline")
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("User-Agent", "feeling-search-skill/1.0")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        body = {}
        try:
            body = json.loads(e.read().decode("utf-8", "replace"))
        except Exception:
            body = {}
        raise ApiError(body.get("message") or ("HTTP %s" % e.code),
                       body.get("error") or "http_error", e.code, body)
    except urllib.error.URLError as e:
        raise ApiError("连不上服务端：%s" % (e.reason,), "network_unreachable", 0)


# ---------------------------------------------------------------- 词表缓存

def load_dictionary(refresh=False, offline=False):
    """读本地缓存；过期或缺失时联网拉取。返回 (数据, 来源)。"""
    path = cache_path()
    data = None
    if not refresh and os.path.isfile(path):
        age = time.time() - os.path.getmtime(path)
        if age < cache_ttl():
            try:
                with open(path, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except Exception:
                data = None
    if data and data.get("words"):
        return data, "cache"

    if offline:
        if data:
            return data, "cache-stale"
        raise ApiError("本地没有词表缓存且处于离线模式，先跑一次 `dict`", "no_cache_offline")

    data = http_get(env_base() + "/v2/dictionary", offline=offline)
    try:
        os.makedirs(cache_dir(), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False)
        os.replace(tmp, path)
    except OSError:
        pass  # 写不进缓存不影响本次结果
    return data, "network"


# ---------------------------------------------------------------- 本地命中

def split_gloss(gloss):
    """拆 gloss 词袋，返回 (近义词, 反义/易混词)。

    gloss 的构造是「本词 + 近义词 + 末尾两个反义/易混词」——
    末尾两个是刻意放进去的对照项（例如「温暖」的串里带「冷寂」），
    用来划边界而不是用来命中。把它们当近义用，检索会直接给出反义风格。
    """
    if not gloss:
        return [], []
    parts = [p.strip() for p in str(gloss).replace(",", "、").split("、")]
    parts = [p for p in parts if len(p) >= 2]
    if not parts:
        return [], []
    anti = parts[-2:] if len(parts) >= 3 else []
    near = parts[:-2] if anti else parts
    return near, anti


def score_words(text, dictionary, fuzzy=False):
    """在文本里找词：本词命中权重 1.0。

    默认**只认本词**。gloss 是「近义词 + 易混词」的词袋，里面刻意混着对立词
    （例如「温暖」的 gloss 带「冷寂」），拿它做模糊匹配会把反义拉进来，
    宁可少命中也不误命中——误命中会直接给出错误的风格。
    要更多召回时用 --fuzzy，近义词按 0.5 计分（仍低于本词）。
    """
    low = str(text).lower()
    hits = {}
    for rec in dictionary.get("words", []):
        w = rec.get("w") or ""
        if not w:
            continue
        best = 0.0
        if w.lower() in low:
            best = 1.0
        elif fuzzy:
            near, anti = split_gloss(rec.get("gloss"))
            # 文本里出现了这个词的反义/易混词 → 它不该被算成命中
            if any(a.lower() in low for a in anti):
                continue
            for n in near:
                if n.lower() in low:
                    best = max(best, 0.5)
        if best > 0:
            hits[w] = max(hits.get(w, 0.0), best)
    return hits


def direct_styles(text, dictionary):
    """用户直接说出风格名时不绕词表（中文名与英文名都认）。"""
    low = str(text).lower()
    out = []
    for s in dictionary.get("styles", []):
        for key in ((s.get("name") or "").strip(), (s.get("en") or "").strip()):
            if len(key) >= 2 and key.lower() in low:
                out.append(s.get("id"))
                break
    return out


def rank_styles(hits, direct, dictionary, limit):
    """与线上 /v2/analyze 同形状的打分：Σ q² / √词条数 / 向量模长，直命 +1.5。"""
    qnorm = sum(v * v for v in hits.values()) ** 0.5 or 1.0
    rows = []
    for s in dictionary.get("styles", []):
        terms = s.get("terms") or []
        hit = 0.0
        matched = []
        for t in terms:
            q = hits.get(t)
            if q is None:
                continue
            hit += q * q
            matched.append(t)
        is_direct = s.get("id") in direct
        if not hit and not is_direct:
            continue
        score = hit / (max(1, len(terms)) ** 0.5) / qnorm
        if is_direct:
            score += 1.5
        rows.append({
            "id": s.get("id"),
            "name": s.get("name"),
            "en": s.get("en"),
            "score": round(score, 4),
            "hits": len(matched),
            "matched": matched,
            "def": s.get("def"),
            "parent": s.get("parent"),
        })
    rows.sort(key=lambda r: (-r["score"], str(r["id"])))
    return rows[:limit]


def local_style_names(dictionary):
    return {s.get("id"): s.get("name") for s in dictionary.get("styles", [])}


def local_analyze(text, dictionary, words_n=8, styles_n=12, fuzzy=False):
    hits = score_words(text, dictionary, fuzzy=fuzzy)
    direct = direct_styles(text, dictionary)

    ranked = sorted(hits.items(), key=lambda kv: (-kv[1], kv[0]))
    top = ranked[:words_n]
    maxs = top[0][1] if top else 1.0
    share = {}
    index = {}
    for rec in dictionary.get("words", []):
        if rec.get("w"):
            share[rec["w"]] = rec.get("share", 0)
            index[rec["w"]] = rec.get("styles") or []
    words = [{
        "w": w,
        "score": round(s / maxs, 3),
        "share": share.get(w, 0),
        "styles": (index.get(w) or [])[:6],
    } for w, s in top]

    styles = rank_styles(hits, direct, dictionary, styles_n)
    return {
        "ok": True,
        "source": "local",
        "input": {"text": text, "chars": len(text)},
        "words": words,
        "styles": styles,
        "direct": direct,
        "meta": {
            "engine": "local-lexicon",
            "matched_words": len(hits),
            "counts": dictionary.get("counts") or {},
        },
    }


# ---------------------------------------------------------------- 子命令

def cmd_quota(args):
    """额度：查余额 / 存 token / 用支付凭证领取。三个动作都落同一个 token。"""
    if args.claim:
        # 两种领取方式：① 有支付凭证（宿主 SDK 回传）② 只有订单号（服务端自己向支付宝查单）
        body = {}
        if args.proof and args.trade:
            body["payment_proof"] = args.proof.strip()
            body["trade_no"] = args.trade.strip()
        elif not args.order:
            raise ApiError(
                "领取额度需要 --order <订单号>（服务端查单），"
                "或者 --proof + --trade（宿主回传的支付凭证）", "missing_proof")
        if args.order:
            body["out_trade_no"] = args.order.strip()
        try:
            resp = http_post(env_base() + "/v2/quota/claim", body, offline=args.offline)
        except ApiError as exc:
            if exc.code == "not_paid":
                raise ApiError(
                    "这笔订单还没到账。请先在支付宝里完成付款，然后重跑同一条命令"
                    "（服务端会自己向支付宝查单，不需要你回填任何凭证）", "not_paid", exc.http, exc.payload)
            raise
        token = ((resp.get("quota") or {}).get("token") or "").strip()
        if not token:
            raise ApiError("服务端没有返回额度 token", "no_token_returned", 200, resp)
        path = save_quota(token, {"order": (resp.get("order") or {}).get("out_trade_no")})
        return {
            "ok": True,
            "action": "claim",
            "quota": resp.get("quota"),
            "order": resp.get("order"),
            "already_fulfilled": bool((resp.get("order") or {}).get("already_fulfilled")),
            "saved_to": path,
        }

    if args.set_token:
        token = args.set_token.strip()
        resp = http_get(quota_url(token), offline=args.offline)
        path = save_quota(token)
        return {"ok": True, "action": "set", "quota": resp.get("quota"), "saved_to": path}

    token, src = resolve_quota(args)
    if not token:
        raise ApiError(
            "还没有额度 token：用 `quota --set <token>` 存一个，"
            "或 `quota --claim --proof <payment_proof> --trade <trade_no>` 领取；"
            "领取页 " + env_base() + "/docs/quota.html", "no_token")
    resp = http_get(quota_url(token), offline=args.offline)
    return {
        "ok": True,
        "action": "balance",
        "token_source": src,
        "quota": resp.get("quota"),
        "topup": resp.get("topup"),
        "saved_to": quota_path(),
    }


def cmd_status(args):
    info = {
        "base": env_base(),
        "quota_configured": bool(resolve_quota(args)[0]),
        "quota_source": resolve_quota(args)[1],
        "quota_file": quota_path(),
        "cache_dir": cache_dir(),
        "cache_file": cache_path(),
        "cache_exists": os.path.isfile(cache_path()),
        "cache_ttl_seconds": cache_ttl(),
        "offline": args.offline,
    }
    if info["cache_exists"]:
        try:
            with open(cache_path(), "r", encoding="utf-8") as fh:
                d = json.load(fh)
            info["cache_counts"] = d.get("counts") or {}
            info["cache_age_seconds"] = int(time.time() - os.path.getmtime(cache_path()))
        except Exception as exc:
            info["cache_error"] = str(exc)
    if not args.offline:
        try:
            http_get(env_base() + "/v2/dictionary", offline=False)
            info["reachable"] = True
        except ApiError as exc:
            info["reachable"] = False
            info["reach_error"] = "%s %s" % (exc.code, exc)
    return info


def cmd_dict(args):
    data, origin = load_dictionary(refresh=args.refresh, offline=args.offline)
    out = {
        "ok": True,
        "source": origin,
        "counts": data.get("counts") or {
            "words": len(data.get("words") or []),
            "styles": len(data.get("styles") or []),
        },
        "cache_file": cache_path(),
    }
    if args.with_items:
        out["words"] = [w.get("w") for w in data.get("words", [])]
        out["styles"] = [{"id": s.get("id"), "name": s.get("name")}
                         for s in data.get("styles", [])]
    return out


def cmd_analyze(args):
    text = (args.text or "").strip()
    if not text:
        raise ApiError("text 不能为空", "empty_text")
    if len(text) > MAX_CHARS:
        raise ApiError("text 最长 %d 字，当前 %d 字" % (MAX_CHARS, len(text)), "text_too_long")

    dictionary, _ = load_dictionary(refresh=args.refresh, offline=args.offline)
    result = local_analyze(text, dictionary, args.words, args.styles, fuzzy=args.fuzzy)

    if result["meta"]["matched_words"] > 0:
        return result

    # 本地一个词都没命中：先提示还有免费的模糊档没试，再谈付费
    if not args.fuzzy:
        result["hint"] = "零命中。可先免费加 --fuzzy（近义词匹配）再试，仍不行才考虑付费云端"
    if not args.allow_cloud:
        result["cloud_skipped"] = "未开启 --allow-cloud；本地零命中，未调用付费接口"
        return result
    token, token_src = resolve_quota(args)
    if not token:
        result["cloud_skipped"] = (
            "还没有额度 token，云端兜底没有跑。三条获取方式："
            "① 先确认这台机器上有支付宝付款回执，用 `quota --claim --proof <payment_proof> --trade <trade_no>` 领取；"
            "② 已有 token 就 `quota --set <token>` 存下来；"
            "③ 或者让调用方用 x402（USDC）直接付 POST %s/v2/analyze。"
            "领取页：%s/docs/quota.html" % (env_base(), env_base())
        )
        return result

    try:
        payload = {"text": text, "words": args.words, "styles": args.styles}
        cloud = http_post(env_base() + "/v2/analyze", payload,
                          headers={"X-FS-Quota": token}, offline=args.offline)
    except ApiError as exc:
        result["cloud_error"] = {"code": exc.code, "http": exc.http, "message": str(exc)}
        return result

    inner = cloud.get("result") if isinstance(cloud.get("result"), dict) else cloud
    inner["source"] = "cloud"
    return inner


def cmd_lookup(args):
    url = env_base() + "/v2/links?" + urllib.parse.urlencode({"word": args.word})
    return http_get(url, offline=args.offline)


def cmd_style_words(args):
    url = env_base() + "/v2/styles/" + urllib.parse.quote(args.style_id) + "/words"
    return http_get(url, offline=args.offline)


def cmd_style(args):
    url = env_base() + "/v2/styles/" + urllib.parse.quote(args.style_id)
    token, _ = resolve_quota(args)
    headers = {"X-FS-Quota": token} if token else {}
    return http_get(url, headers=headers, offline=args.offline)


def cmd_images(args):
    ids = [x.strip() for x in (args.ids or "").split(",") if x.strip()]
    if not ids:
        raise ApiError("缺少风格 id", "missing_ids")
    if len(ids) > 5:
        raise ApiError("一次最多 5 个风格 id", "too_many_ids")
    url = env_base() + "/v2/images?" + urllib.parse.urlencode({"ids": ",".join(ids)})
    token, _ = resolve_quota(args)
    headers = {"X-FS-Quota": token} if token else {}
    return http_get(url, headers=headers, offline=args.offline)


# ---------------------------------------------------------------- 渲染

def _ts(v):
    try:
        return time.strftime("%Y-%m-%d %H:%M", time.localtime(int(v)))
    except Exception:
        return str(v)


_QUOTA_SRC = {"flag": "--quota 参数", "env": "FS_QUOTA 环境变量", "file": "本地缓存文件"}


def render(kind, data):
    if kind == "quota":
        q = data.get("quota") or {}
        if data.get("action") == "claim":
            head = "已领取额度"
            if data.get("already_fulfilled"):
                head += "（这张之前领过，返回的是同一个 token）"
        elif data.get("action") == "set":
            head = "token 已保存"
        else:
            head = "额度余额"
        lines = [head]
        if q:
            lines.append("  剩余        : %s / %s 次%s" % (
                q.get("left"), q.get("total"), "（已过期）" if q.get("expired") else ""))
            if q.get("plan"):
                lines.append("  档位        : %s" % q["plan"])
            if q.get("order"):
                lines.append("  订单        : %s" % q["order"])
            if q.get("reset"):
                lines.append("  到期        : %s" % _ts(q["reset"]))
        if data.get("token_source"):
            lines.append("  token 来源  : %s" % _QUOTA_SRC.get(data["token_source"], data["token_source"]))
        if data.get("saved_to"):
            lines.append("  已保存到    : %s" % data["saved_to"])
        if q and not q.get("usable", True):
            lines.append("  提示        : 这张已不可用，去 %s 续购" % env_base() + "/docs/quota.html")
        return "\n".join(lines)

    if kind == "status":
        lines = ["感觉检索 · 状态"]
        lines.append("  服务端点     : %s" % data["base"])
        lines.append("  线上可达     : %s" % ("是" if data.get("reachable") else "否 %s" % data.get("reach_error", "")))
        lines.append("  额度已配置   : %s" % ("是" if data["quota_configured"] else "否（只会走免费路径）"))
        lines.append("  词表缓存     : %s" % ("有" if data["cache_exists"] else "无"))
        if data.get("cache_counts"):
            lines.append("  词表规模     : %s 词 / %s 风格" % (
                data["cache_counts"].get("words"), data["cache_counts"].get("styles")))
        return "\n".join(lines)

    if kind == "dict":
        c = data.get("counts", {})
        return "词表：%s 词 / %s 风格　来源：%s\n缓存：%s" % (
            c.get("words"), c.get("styles"), data.get("source"), data.get("cache_file"))

    if kind == "analyze":
        lines = ["来源：%s　匹配词数：%s" % (
            data.get("source"), (data.get("meta") or {}).get("matched_words"))]
        if data.get("hint"):
            lines.append("※ " + data["hint"])
        if data.get("cloud_skipped"):
            lines.append("※ " + data["cloud_skipped"])
        if data.get("cloud_error"):
            lines.append("※ 云端调用失败：" + json.dumps(data["cloud_error"], ensure_ascii=False))
        words = data.get("words") or []
        if words:
            lines.append("")
            lines.append("感受词：")
            for w in words:
                lines.append("  %-8s %5s  share=%-3s 风格=%s" % (
                    w.get("w"), w.get("score"), w.get("share"),
                    ",".join((w.get("styles") or [])[:4])))
        styles = data.get("styles") or []
        if styles:
            lines.append("")
            lines.append("视觉风格：")
            for s in styles:
                lines.append("  %-22s %-7s %s  %s" % (
                    s.get("name") or s.get("id"), s.get("score"), s.get("id"),
                    s.get("def") or ""))
        if not words and not styles:
            lines.append("（没有命中任何词或风格）")
        return "\n".join(lines)

    return json.dumps(data, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------- CLI

def build_parser():
    # 公共开关在两个位置都能用：写在子命令前或子命令后都行。
    # 子命令一侧用 SUPPRESS 作默认值，没显式给出时不覆盖顶层解析到的值。
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true", default=argparse.SUPPRESS,
                        help="输出 JSON")
    common.add_argument("--offline", action="store_true", default=argparse.SUPPRESS,
                        help="完全不联网，只用本地缓存")
    common.add_argument("--quota", default=argparse.SUPPRESS,
                        help="额度 token（优先于 FS_QUOTA 与本地缓存）")
    common.add_argument("--refresh", action="store_true", default=argparse.SUPPRESS,
                        help="强制刷新词表缓存")

    p = argparse.ArgumentParser(
        prog="fs_api.py",
        description="感觉检索 API 客户端（本地词典优先，云端付费兜底）")
    p.add_argument("--json", action="store_true", default=False, help="输出 JSON")
    p.add_argument("--offline", action="store_true", default=False, help="完全不联网")
    p.add_argument("--refresh", action="store_true", default=False, help="强制刷新词表缓存")
    sub = p.add_subparsers(dest="cmd")

    sp = sub.add_parser("quota", parents=[common],
                        help="额度：查余额 / --set 存 token / --claim 用支付凭证领取")
    sp.add_argument("--set", dest="set_token", metavar="TOKEN", help="保存一枚额度 token 并校验")
    sp.add_argument("--claim", action="store_true", help="用支付宝回传的凭证领取额度")
    sp.add_argument("--proof", help="支付宝回传的 payment_proof（配 --claim）")
    sp.add_argument("--trade", help="支付宝交易号 trade_no（配 --claim）")
    sp.add_argument("--order", help="订单号 out_trade_no（可选）")

    sub.add_parser("status", parents=[common], help="额度/缓存/连通性体检")

    sp = sub.add_parser("dict", parents=[common], help="词表缓存")
    sp.add_argument("--with-items", action="store_true", help="连词条一起输出")

    sp = sub.add_parser("analyze", parents=[common], help="一句描述 → 感受词 + 视觉风格")
    sp.add_argument("text")
    sp.add_argument("--words", type=int, default=8)
    sp.add_argument("--styles", type=int, default=12)
    sp.add_argument("--fuzzy", action="store_true",
                    help="连近义词一起匹配（免费，但可能带进易混词）")
    sp.add_argument("--allow-cloud", action="store_true",
                    help="本地零命中时调用付费的 /v2/analyze（消耗 1 次额度）")

    sp = sub.add_parser("lookup", parents=[common], help="查单个词（免费）")
    sp.add_argument("word")

    sp = sub.add_parser("style-words", parents=[common], help="某风格的词集（免费）")
    sp.add_argument("style_id")

    sp = sub.add_parser("style", parents=[common], help="风格详情含图（计费 1 次）")
    sp.add_argument("style_id")

    sp = sub.add_parser("images", parents=[common], help="批量取图，最多 5 个（计费 1 次）")
    sp.add_argument("ids")

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.cmd:
        parser.print_help()
        return 2

    handlers = {
        "quota": cmd_quota,
        "status": cmd_status,
        "dict": cmd_dict,
        "analyze": cmd_analyze,
        "lookup": cmd_lookup,
        "style-words": cmd_style_words,
        "style": cmd_style,
        "images": cmd_images,
    }

    try:
        data = handlers[args.cmd](args)
    except ApiError as exc:
        payload = {"ok": False, "error": exc.code, "message": str(exc),
                   "http": exc.http, "payload": exc.payload}
        if args.json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print("失败：[%s] %s" % (exc.code, exc))
            if exc.code == "payment_required":
                print("      ↳ 付费端点需要额度。设置 FS_QUOTA 或改走免费端点"
                      "（dict / lookup / style-words）")
        return 1

    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(render(args.cmd, data))
    return 0


if __name__ == "__main__":
    sys.exit(main())
