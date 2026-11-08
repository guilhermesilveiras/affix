"""Inspect original curriculum sources without modifying them."""
from pathlib import Path
import json
from pypdf import PdfReader
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'tmp' / 'sources'
out.mkdir(parents=True, exist_ok=True)
for path in (ROOT / 'source').glob('*.pdf'):
    text = '\n\n'.join(f'--- PAGE {n} ---\n{page.extract_text(extraction_mode="layout")}' for n, page in enumerate(PdfReader(path).pages, 1))
    (out / (path.stem + '.txt')).write_text(text, encoding='utf-8')
for path in (ROOT / 'source').glob('*.xlsx'):
    wb = load_workbook(path, read_only=True, data_only=True)
    rows = {ws.title: list(ws.values) for ws in wb}
    (out / 'activities.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    wb.close()
print(out)
