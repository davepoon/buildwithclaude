#!/usr/bin/env python3
"""
Video-to-Text — 视频内容提取器（通用版）
=========================================
抖音链接 / 本地视频 → 元数据 + 语音转写文字。

用法:
  python3 vtt.py "https://v.douyin.com/xxx/"           # 抖音分享链接
  python3 vtt.py 本地视频.mp4                          # 本地视频
  python3 vtt.py 链接 --transcribe                     # 强制转写
  python3 vtt.py 链接 --meta-only                      # 只要元数据

输出:
  元数据摘要打印到终端；转写文本保存到 <输入名>_transcript.txt

依赖（可选，缺失时自动跳过转写只出元数据）:
  avconvert (macOS自带) / ffmpeg
  faster-whisper:  pip install faster-whisper
"""
import sys, os, re, subprocess, json, argparse, tempfile

def is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")

def extract_douyin(url: str, want_transcript: bool):
    """抖音链接：元数据 + 可选转写。复用 douyin_extract.py 的 SSR 解析。"""
    import douyin_extract
    # 先拿元数据（douyin_extract 的 main 会打印摘要）
    try:
        meta = douyin_extract.extract_metadata(url) if hasattr(douyin_extract, 'extract_metadata') else None
    except Exception:
        meta = None
    if meta is None:
        # 直接跑脚本拿输出
        r = subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'douyin_extract.py'), url],
                           capture_output=True, text=True, timeout=90)
        print(r.stdout)
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
        return
    print("=" * 50)
    print("🎬 视频元数据")
    print("=" * 50)
    for k, v in meta.items():
        print(f"{k}: {v}")

def transcribe_local(video_path: str) -> str:
    """本地视频 → 音频 → faster-whisper 转写。"""
    base = os.path.splitext(os.path.basename(video_path))[0]
    audio = os.path.join(tempfile.gettempdir(), base + ".m4a")
    # 提取音频
    if shutil_which("avconvert"):
        subprocess.run(["avconvert", "--source", video_path, "--preset", "PresetAppleM4A",
                        "--output", audio, "--replace"], check=True, timeout=300)
    elif shutil_which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-i", video_path, "-vn", "-acodec", "aac", audio],
                       check=True, timeout=300)
    else:
        raise SystemExit("❌ 需要 avconvert (macOS) 或 ffmpeg 提取音频")
    # 转写
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise SystemExit("❌ 需要 faster-whisper: pip install faster-whisper")
    print("⏳ 正在转写（首次会下载模型）...", file=sys.stderr)
    model = WhisperModel(os.environ.get("WHISPER_MODEL", "tiny"), device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio, language="zh", beam_size=3)
    lines = [f"[{int(s.start)//60:02d}:{int(s.start)%60:02d}] {s.text.strip()}" for s in segments]
    return "\n".join(lines)

def shutil_which(name):
    import shutil
    return shutil.which(name)

def main():
    ap = argparse.ArgumentParser(description="Video-to-Text — 视频内容提取器")
    ap.add_argument("input", help="抖音链接 或 本地视频文件路径")
    ap.add_argument("--transcribe", action="store_true", help="抖音链接也强制转写")
    ap.add_argument("--meta-only", action="store_true", help="只要元数据，不转写")
    args = ap.parse_args()

    if is_url(args.input):
        print("📥 抖音视频链接，解析元数据...", file=sys.stderr)
        extract_douyin(args.input, args.transcribe)
    else:
        if not os.path.exists(args.input):
            raise SystemExit(f"❌ 文件不存在: {args.input}")
        print("🎬 本地视频，提取语音转文字...", file=sys.stderr)
        text = transcribe_local(args.input)
        out = os.path.splitext(args.input)[0] + "_transcript.txt"
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"✅ 转写完成: {out}（{len(text)} 字）")

if __name__ == "__main__":
    main()
