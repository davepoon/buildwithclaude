#!/usr/bin/env python3
"""
Doc-OCR — 文档文字识别（通用版）
================================
PDF / 图片 → 可编辑文字。支持扫描件 OCR（macOS Vision 自带，中英文）。

用法:
  python3 dococr.py 文件.pdf              # PDF → 文字（有文字层直接提取，扫描件自动OCR）
  python3 dococr.py 文件.png              # 图片 → OCR
  python3 dococr.py 目录/ -o 输出.txt     # 批量处理目录
  python3 dococr.py 文件.pdf --md         # 输出 Markdown

输出:
  <输入名>_ocr.txt（或 --md 输出 .md）

依赖:
  macOS 自带 Vision（无需安装）；PDF 用 pymupdf: pip install pymupdf
"""
import sys, os, argparse, glob

def ocr_image(path: str) -> str:
    """用 macOS Vision 识别图片中的文字（中英文）。"""
    import Quartz
    from Foundation import NSURL
    import Vision
    url = NSURL.fileURLWithPath_(path)
    handler = Vision.VNImageRequestHandler.alloc().initWithURL_options_(url, None)
    request = Vision.VNRecognizeTextRequest.alloc().init()
    request.setRecognitionLanguages_(["zh-Hans", "en"])
    request.setRecognitionLevel_(Vision.VNRequestTextRecognitionLevelAccurate)
    ok, err = handler.performRequests_error_([request], None)
    if not ok:
        return f"[OCR失败: {err}]"
    results = request.results() or []
    lines = [r.topCandidates_(1)[0].string() for r in results]
    return "\n".join(lines)

def ocr_pdf_pages(path: str) -> str:
    """PDF 逐页转图片后 OCR。"""
    import fitz  # pymupdf
    doc = fitz.open(path)
    parts = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=200)
        tmp = f"/tmp/dococr_p{i}.png"
        pix.save(tmp)
        text = ocr_image(tmp)
        parts.append(f"--- 第{i+1}页 ---\n{text}")
        os.remove(tmp)
    return "\n\n".join(parts)

def extract_pdf_text(path: str) -> str:
    """优先提取 PDF 文字层，若几乎无文字则走 OCR。"""
    import fitz
    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    if len(text.strip()) > 20:
        return text
    print("⚠️ 文字层为空（扫描件），启动 OCR...", file=sys.stderr)
    return ocr_pdf_pages(path)

def main():
    ap = argparse.ArgumentParser(description="Doc-OCR — 文档文字识别")
    ap.add_argument("input", help="PDF/图片文件 或 目录")
    ap.add_argument("-o", "--output", help="输出文件（缺省 <输入名>_ocr.txt）")
    ap.add_argument("--md", action="store_true", help="输出 Markdown")
    args = ap.parse_args()

    files = []
    if os.path.isdir(args.input):
        files = sorted(glob.glob(os.path.join(args.input, "*")))
        files = [f for f in files if f.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"))]
    else:
        files = [args.input]

    if not files:
        raise SystemExit("❌ 没有可处理的文件")

    all_text = []
    for f in files:
        ext = f.lower().rsplit(".", 1)[-1]
        print(f"📄 处理: {os.path.basename(f)}", file=sys.stderr)
        if ext == "pdf":
            text = extract_pdf_text(f)
        else:
            text = ocr_image(f)
        all_text.append(f"# {os.path.basename(f)}\n{text}")

    result = "\n\n".join(all_text)
    if args.md:
        result = result.replace("\n", "  \n")
    out = args.output or (os.path.splitext(files[0])[0] + "_ocr" + (".md" if args.md else ".txt"))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(result)
    print(f"✅ 已保存: {out}（{len(result)} 字）")

if __name__ == "__main__":
    main()
