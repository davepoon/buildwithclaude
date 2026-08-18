#!/usr/bin/env python3
"""
De-AI Writer — AI 文案去味器（通用版 CLI）
============================================
把 AI 生成的文本改写成自然、有真人味的中文。

用法:
  python3 deai.py 输入文件.txt -o 输出文件.txt     # 处理文件
  cat 文本.txt | python3 deai.py -o 输出.txt       # 管道输入
  python3 deai.py -t "要改写的文本"                 # 直接传文本
  python3 deai.py 输入.txt --prompt-only           # 只输出 prompt（无API key时用）

配置（环境变量）:
  LLM_API_KEY    API Key（OpenAI 兼容）
  LLM_BASE_URL   接口地址，默认 https://api.openai.com/v1
  LLM_MODEL      模型名，默认 gpt-4o-mini
  不配置也能用：--prompt-only 模式输出可直接粘贴到任意 AI 助手的提示词

示例:
  python3 deai.py draft.txt -o polished.txt
  python3 deai.py -t "此外，该产品不仅性能卓越，更是彰显了创新精神。" 
"""
import sys, os, json, argparse, urllib.request

# ---------- 核心提示词（产品核心资产） ----------
CORE_PROMPT = """你是一位资深中文编辑，专长是去除 AI 味、恢复真人写作风格。请把用户提供的文本改写成自然、有人味的中文。

【必须清除的 AI 味模式】
1. 空洞拔高：删除"不仅...更是""彰显""标志着""至关重要""深远影响"等虚张声势的表述
2. 排比三连：打破"创新、卓越、领先"式三连排比
3. 万能衔接词：清除"此外""然而""值得注意的是""综上所述"等机械过渡
4. 官方腔：去掉"赋能""抓手""闭环""颗粒度"等黑话
5. 形容词堆砌：删掉"极致""巅峰""完美"等夸张词
6. 模板化结尾：删除"未来可期""让我们拭目以待"式空话
7. 重复替代词：避免用"该产品""此方案"反复替换主语
8. 过度客套：删除"希望对您有帮助""欢迎随时联系"式废话
9. 被动句式：能主动就主动（"文件被保存"→"系统保存了文件"）
10. 完美工整：允许句子长短交错、口语化、轻微不完美

【写作要求】
- 保留原意、事实、数据，只改表达
- 用短句和长句交错，自然呼吸感
- 可以有一点点个人态度（"说实话""我个人觉得"），但不要过度
- 中文优先，专有名词保留原文
- 输出 ONLY 改写后的文本，不要任何解释、前言、后记
"""

def build_prompt(text: str) -> str:
    return CORE_PROMPT + "\n\n【用户文本】\n" + text

def load_config():
    """读取配置：环境变量优先，其次参数，最后 ~/.deai_writer.conf 配置文件。
    环境变量: LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
    配置示例 (~/.deai_writer.conf):
        [llm]
        key = sk-xxx
        base_url = https://api.deepseek.com/v1
        model = deepseek-chat
    """
    import configparser
    cfg = configparser.ConfigParser()
    cfg.read(os.path.expanduser("~/.deai_writer.conf"))
    key = os.environ.get("LLM_API_KEY", "") or cfg.get("llm", "key", fallback="")
    base = os.environ.get("LLM_BASE_URL", "") or cfg.get("llm", "base_url", fallback="https://api.openai.com/v1")
    model = os.environ.get("LLM_MODEL", "") or cfg.get("llm", "model", fallback="gpt-4o-mini")
    return key, base, model

def call_llm(prompt: str, api_key: str = "", base_url: str = "", model: str = "") -> str:
    if not api_key:
        api_key, base_url, model = load_config()
    base = base_url.rstrip("/")
    if not api_key:
        raise SystemExit("❌ 未配置 API Key。用 --api-key 参数，或写 ~/.deai_writer.conf（见 load_config 注释），或用 --prompt-only 模式。")
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
        }).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"].strip()

def main():
    ap = argparse.ArgumentParser(description="De-AI Writer — AI 文案去味器")
    ap.add_argument("input", nargs="?", help="输入文件（缺省读 stdin）")
    ap.add_argument("-t", "--text", help="直接传入要改写的文本")
    ap.add_argument("-o", "--output", help="输出文件（缺省打印 stdout）")
    ap.add_argument("--prompt-only", action="store_true", help="只输出提示词（不调用 API）")
    ap.add_argument("--api-key", default="", help="API Key（优先于配置文件）")
    args = ap.parse_args()

    # 读输入
    if args.text:
        text = args.text
    elif args.input:
        with open(args.input, encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()
    if not text.strip():
        raise SystemExit("❌ 没有输入内容")

    if args.prompt_only:
        result = build_prompt(text)
    else:
        print("⏳ 正在改写...", file=sys.stderr)
        result = call_llm(build_prompt(text), api_key=args.api_key)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"✅ 已保存到 {args.output}", file=sys.stderr)
    else:
        print(result)

if __name__ == "__main__":
    main()
