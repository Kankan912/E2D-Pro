"""Generate the security report PDF from the markdown source."""
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)

SRC = "docs/SECURITY_REPORT_2026_05.md"
OUT = "/mnt/documents/SECURITY_REPORT_2026_05.pdf"

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=18, spaceAfter=12, textColor=colors.HexColor("#0f172a"))
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, spaceAfter=8, textColor=colors.HexColor("#1e40af"))
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontSize=12, spaceAfter=6, textColor=colors.HexColor("#334155"))
P = ParagraphStyle("P", parent=styles["BodyText"], fontSize=10, leading=14, spaceAfter=6)
LI = ParagraphStyle("LI", parent=P, leftIndent=14, bulletIndent=4)

def inline(s: str) -> str:
    # Replace emoji not in standard fonts with text equivalents
    s = s.replace("✅", "[OK]").replace("❌", "[NON]").replace("—", "-")
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"`([^`]+)`", r'<font name="Courier" color="#b91c1c">\1</font>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*", r"<i>\1</i>", s)
    return s

def parse_table(lines, idx):
    header = [c.strip() for c in lines[idx].strip().strip("|").split("|")]
    idx += 2  # skip separator
    rows = [header]
    while idx < len(lines) and lines[idx].lstrip().startswith("|"):
        rows.append([c.strip() for c in lines[idx].strip().strip("|").split("|")])
        idx += 1
    return rows, idx

def build():
    with open(SRC, encoding="utf-8") as f:
        lines = f.readlines()

    story = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip("\n")
        stripped = line.strip()

        if not stripped:
            story.append(Spacer(1, 4)); i += 1; continue
        if stripped.startswith("---"):
            story.append(Spacer(1, 8)); i += 1; continue
        if stripped.startswith("# "):
            story.append(Paragraph(inline(stripped[2:]), H1)); i += 1; continue
        if stripped.startswith("## "):
            story.append(Spacer(1, 6))
            story.append(Paragraph(inline(stripped[3:]), H2)); i += 1; continue
        if stripped.startswith("### "):
            story.append(Paragraph(inline(stripped[4:]), H3)); i += 1; continue
        if stripped.startswith("|"):
            rows, i = parse_table(lines, i)
            # Wrap cells in Paragraph for wrapping
            data = [[Paragraph(inline(c), P) for c in row] for row in rows]
            t = Table(data, repeatRows=1, colWidths=None)
            t.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e2e8f0")),
                ("TEXTCOLOR",  (0,0), (-1,0), colors.HexColor("#0f172a")),
                ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
                ("GRID", (0,0), (-1,-1), 0.4, colors.HexColor("#94a3b8")),
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("LEFTPADDING", (0,0), (-1,-1), 4),
                ("RIGHTPADDING", (0,0), (-1,-1), 4),
                ("TOPPADDING", (0,0), (-1,-1), 3),
                ("BOTTOMPADDING", (0,0), (-1,-1), 3),
            ]))
            story.append(t); story.append(Spacer(1, 8)); continue
        m_num = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if m_num:
            story.append(Paragraph(inline(m_num.group(2)), LI, bulletText=f"{m_num.group(1)}.")); i += 1; continue
        if stripped.startswith("- "):
            story.append(Paragraph(inline(stripped[2:]), LI, bulletText="•")); i += 1; continue
        story.append(Paragraph(inline(stripped), P)); i += 1

    doc = SimpleDocTemplate(OUT, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm,
                            title="Rapport de sécurité — Mai 2026")
    doc.build(story)
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    build()
