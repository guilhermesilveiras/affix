"""Build a relocatable, dependency-free GitHub Pages frontend."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT/'dist'
catalog = json.loads((ROOT/'frontend/data/catalog.json').read_text(encoding='utf-8'))
assert catalog['total_hours'] == catalog['required_hours']+catalog['elective_hours']+catalog['activity_hours']
# Only the generated dist directory is replaced. Source files and user data stay outside it.
if DIST.is_symlink() or DIST.resolve() != ROOT.resolve()/'dist':
    raise RuntimeError(f'Diretório de build inesperado: {DIST.resolve()}')
if DIST.exists():
    shutil.rmtree(DIST)
shutil.copytree(ROOT/'frontend', DIST)
(DIST/'.nojekyll').touch()
print(f'Frontend pronto: {DIST} (sem dependências de Node ou caminhos absolutos)')
