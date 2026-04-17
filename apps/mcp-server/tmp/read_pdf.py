import fitz
import sys

pdf_path = r'C:\Users\k_jim\OneDrive\デスクトップ\suguvisa-mcp\suguvisa-mcp - MCP _ Smithery.pdf'

doc = fitz.open(pdf_path)
text = []
for page in doc:
    text.append(page.get_text())

with open('pdf_output.txt', 'w', encoding='utf-8') as f:
    f.write("\n=== PAGE BREAK ===\n".join(text))
