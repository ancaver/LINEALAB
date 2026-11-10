"""Genera el único proyecto.zip: código, pruebas, scripts, Plotly y evidencias."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
files=["index.html","styles.css","calculations.js","secondary.js","sweep.js","charts.js","app.js","analysis.js","viewer3d.js","README.md","THIRD_PARTY.md",".nojekyll"]
for directory in ["tests","scripts","vendor","validation"]:
    files += [str(file.relative_to(root)) for file in sorted((root/directory).rglob("*"))
              if file.is_file() and "__pycache__" not in file.parts and file.suffix!=".pyc"]
contents={name:(root/name).read_bytes() for name in files}
with ZipFile(root/"proyecto.zip","w",compression=ZIP_DEFLATED) as archive:
    for name,data in contents.items():
        info=ZipInfo(name,date_time=(1980,1,1,0,0,0));info.compress_type=ZIP_DEFLATED;info.external_attr=0o644<<16
        archive.writestr(info,data)
print(f"proyecto.zip: {len(files)} archivos, {(root / 'proyecto.zip').stat().st_size} bytes")
