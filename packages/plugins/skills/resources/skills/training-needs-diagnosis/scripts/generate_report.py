#!/usr/bin/env python3
"""Generate a training-needs diagnosis report (.docx) from a JSON data file.

Usage:
    python generate_report.py <path-to-data.json> <output-folder>

The JSON structure is documented in references/report-data-schema.md.
Depends on python-docx:  pip install python-docx
"""

import json
import os
import sys
from datetime import datetime


def _require_docx():
    try:
        import docx  # noqa: F401
    except ImportError:
        sys.stderr.write(
            "ERROR: python-docx not installed. Run: pip install python-docx\n"
        )
        sys.exit(1)


def load_data(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build(data, out_folder):
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT

    NAVY = RGBColor(0x0F, 0x17, 0x2A)
    GOLD = RGBColor(0xA1, 0x62, 0x07)
    GREY = RGBColor(0x55, 0x55, 0x55)

    doc = Document()

    # Base font
    style = doc.styles["Normal"]
    style.font.name = "Microsoft YaHei"
    style.font.size = Pt(10.5)
    try:
        style.element.rPr.rFonts.set(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}eastAsia",
            "Microsoft YaHei",
        )
    except Exception:
        pass

    def heading(text, level=1):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        if level == 1:
            run.font.size = Pt(16)
            run.font.color.rgb = NAVY
            p.space_before = Pt(12)
        else:
            run.font.size = Pt(13)
            run.font.color.rgb = GOLD
        return p

    def body(text, color=None):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.font.size = Pt(10.5)
        if color:
            run.font.color.rgb = color
        return p

    # ---- Cover / title ----
    company = data.get("company", "企业")
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    trun = title.add_run(f"{company}\n培训需求 AI 诊断报告")
    trun.bold = True
    trun.font.size = Pt(24)
    trun.font.color.rgb = NAVY

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_raw = str(data.get("date", datetime.now().strftime("%Y%m%d")))
    try:
        date_disp = datetime.strptime(date_raw, "%Y%m%d").strftime("%Y 年 %m 月 %d 日")
    except ValueError:
        date_disp = date_raw
    parts = [date_disp]
    if data.get("industry"):
        parts.append(f"行业：{data['industry']}")
    if data.get("scale"):
        parts.append(f"规模：{data['scale']}")
    if data.get("consultant"):
        parts.append(f"诊断：{data['consultant']}")
    mrun = meta.add_run("    ｜    ".join(parts))
    mrun.font.size = Pt(10.5)
    mrun.font.color.rgb = GREY

    if data.get("maturity_level"):
        ml = doc.add_paragraph()
        ml.alignment = WD_ALIGN_PARAGRAPH.CENTER
        mlr = ml.add_run(f"当前 L&D 成熟度评级：L{data['maturity_level']} / 5")
        mlr.bold = True
        mlr.font.size = Pt(11)
        mlr.font.color.rgb = GOLD
    if data.get("top_pain"):
        tp = doc.add_paragraph()
        tp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        tpr = tp.add_run(f"核心痛点：{data['top_pain']}")
        tpr.font.size = Pt(10.5)
        tpr.font.color.rgb = GREY

    # Executive summary
    if data.get("executive_summary"):
        heading("诊断结论摘要", 2)
        body(data["executive_summary"])

    doc.add_page_break()

    # ---- 1. 现状分析 ----
    heading("一、现状分析（五维诊断）", 1)
    dims = data.get("dimensions", [])
    if dims:
        table = doc.add_table(rows=1, cols=4)
        table.style = "Light Grid Accent 1"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        hdr = table.rows[0].cells
        for i, h in enumerate(["维度", "现状摘要", "成熟度", "最大缺口"]):
            r = hdr[i].paragraphs[0].add_run(h)
            r.bold = True
            r.font.size = Pt(10)
        for d in dims:
            cells = table.add_row().cells
            cells[0].text = str(d.get("name", ""))
            cells[1].text = str(d.get("current_state", ""))
            cells[2].text = f"{d.get('score', '-')} / 5"
            cells[3].text = str(d.get("gap", ""))
        # quick radar-ish score line
        avg = [d.get("score") for d in dims if isinstance(d.get("score"), (int, float))]
        if avg:
            body("")
            body(f"五维平均成熟度：{sum(avg)/len(avg):.1f} / 5", GOLD)

    # ---- 2. AI 机会点 ----
    heading("二、AI 机会点（优先级排序）", 1)
    opps = data.get("opportunities", [])
    if opps:
        table = doc.add_table(rows=1, cols=6)
        table.style = "Light Grid Accent 1"
        hdr = table.rows[0].cells
        for i, h in enumerate(["优先级", "AI 机会点", "目标环节", "预期收益", "投入", "见效周期"]):
            r = hdr[i].paragraphs[0].add_run(h)
            r.bold = True
            r.font.size = Pt(10)
        for o in opps:
            cells = table.add_row().cells
            cells[0].text = str(o.get("priority", ""))
            cells[1].text = str(o.get("name", ""))
            cells[2].text = str(o.get("target", ""))
            cells[3].text = str(o.get("benefit", ""))
            cells[4].text = str(o.get("effort", ""))
            cells[5].text = str(o.get("payback", ""))

    # ---- 3. 实施路线图 ----
    heading("三、实施路线图", 1)
    for phase in data.get("roadmap", []):
        heading(phase.get("phase", "阶段"), 2)
        if phase.get("focus"):
            body(f"重点：{phase['focus']}")
        for dv in phase.get("deliverables", []):
            p = doc.add_paragraph(style="List Bullet")
            p.add_run(str(dv)).font.size = Pt(10.5)
        if phase.get("milestone"):
            body(f"里程碑：{phase['milestone']}", GOLD)

    # ---- 4. 预估 ROI ----
    heading("四、预估 ROI", 1)
    roi = data.get("roi", {})
    if roi:
        if roi.get("assumptions"):
            heading("关键假设", 2)
            for a in roi["assumptions"]:
                p = doc.add_paragraph(style="List Bullet")
                p.add_run(str(a)).font.size = Pt(10.5)
        cost = roi.get("cost", [])
        benefit = roi.get("benefit", [])
        if cost or benefit:
            heading("成本 / 收益", 2)
            table = doc.add_table(rows=1, cols=3)
            table.style = "Light Grid Accent 1"
            hdr = table.rows[0].cells
            for i, h in enumerate(["类别", "项目", "金额"]):
                r = hdr[i].paragraphs[0].add_run(h)
                r.bold = True
                r.font.size = Pt(10)
            for c in cost:
                cells = table.add_row().cells
                cells[0].text = "成本"
                cells[1].text = str(c.get("item", ""))
                cells[2].text = str(c.get("amount", ""))
            for b in benefit:
                cells = table.add_row().cells
                cells[0].text = "收益"
                cells[1].text = str(b.get("item", ""))
                cells[2].text = str(b.get("amount", ""))
        summ = roi.get("summary", {})
        if summ:
            heading("ROI 测算区间", 2)
            if summ.get("conservative"):
                body(f"保守估计：{summ['conservative']}")
            if summ.get("optimistic"):
                body(f"乐观估计：{summ['optimistic']}", GOLD)

    # footer note
    doc.add_paragraph("")
    note = doc.add_paragraph()
    nr = note.add_run("本报告基于五维培训需求诊断框架生成，ROI 数字含明确假设，仅供决策参考。")
    nr.font.size = Pt(8)
    nr.font.color.rgb = GREY

    os.makedirs(out_folder, exist_ok=True)
    safe_company = "".join(c for c in company if c not in '\\/:*?"<>|').strip() or "企业"
    fname = f"培训需求诊断报告_{safe_company}_{date_raw}.docx"
    out_path = os.path.join(out_folder, fname)
    doc.save(out_path)
    return out_path


def main():
    if len(sys.argv) < 3:
        sys.stderr.write(
            "Usage: python generate_report.py <data.json> <output-folder>\n"
        )
        sys.exit(1)
    _require_docx()
    data = load_data(sys.argv[1])
    out = build(data, sys.argv[2])
    print(f"OK: report written to {out}")


if __name__ == "__main__":
    main()
