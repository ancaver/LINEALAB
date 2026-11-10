"""Verifica rutas locales, accesibilidad estructural, versión, licencia y ZIP.
No requiere servidor ni descarga dependencias. No sustituye una prueba HTTP real.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from zipfile import ZipFile
import hashlib,json,sys
root=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.paths=[];self.labels=[];self.refs=[]
    def handle_starttag(self,tag,attributes):
        a=dict(attributes)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='label' and 'for' in a:self.labels.append(a['for'])
        for key in ['aria-controls','aria-labelledby','aria-describedby']:
            if key in a:self.refs+=a[key].split()
        for key in ['src','href']:
            if key in a:self.paths.append(a[key])
p=Page();html=(root/'index.html').read_text(encoding='utf-8');p.feed(html)
assert 'v1.0' in html
assert len(p.ids)==len(set(p.ids)),'IDs repetidos'
assert all(item in p.ids for item in p.labels+p.refs),'Referencia HTML/ARIA inexistente'
local=[]
for url in p.paths:
    data=urlsplit(url)
    if data.scheme:raise AssertionError('La aplicación debe usar recursos locales: '+url)
    if not data.path:continue
    path=(root/unquote(data.path)).resolve()
    assert path.is_relative_to(root),'Ruta fuera del proyecto'
    if path.is_dir():path=path/'index.html'
    assert path.is_file(),'Ruta inexistente: '+url
    local.append(url)
vendor=root/'vendor/plotly-basic-2.35.2.min.js'
assert 'v2.35.2' in vendor.read_text(encoding='utf-8')[:100]
assert hashlib.sha256(vendor.read_bytes()).hexdigest()=='138c2e81014b979dc00867a93da55b7605a17495ee78dd7afb433b7f021dfcfa'
assert 'Permission is hereby granted' in (root/'vendor/plotly-LICENSE.txt').read_text()
# three.js r147 local (visor 3D): archivos sin modificar del paquete npm oficial.
for name,digest in {'three-0.147.0.min.js':'f34446bf875b5fb0dcd93819ffe1d9e182d46634ee855f5d904c6c4ac7cdbc95','three-0.147.0-OrbitControls.js':'b4c6e53f98538535b11fd6655627d47fb5877b3ad972568bff0a7026c4b6d5c4','three-0.147.0-RoomEnvironment.js':'251b4e779abb5b432f99a326878fe239747c1fe55f390933085fc3deb20d2cea'}.items():
    assert hashlib.sha256((root/'vendor'/name).read_bytes()).hexdigest()==digest,'three.js alterado: '+name
assert 'Permission is hereby granted' in (root/'vendor/three-LICENSE.txt').read_text(encoding='utf-8')
archive=root/'proyecto.zip'
with ZipFile(archive) as z:
    assert z.testzip() is None
    names=z.namelist()
    for name in names:
        assert not name.startswith('/') and '..' not in Path(name).parts
        assert z.read(name)==(root/name).read_bytes(),'ZIP desactualizado: '+name
    assert 'proyecto.zip' not in names
    for name in ['tests/final-validation.test.cjs','tests/fixtures/final-references.json','scripts/browser-check.cjs','scripts/reference-values.py','scripts/package.py','vendor/plotly-basic-2.35.2.min.js','vendor/plotly-LICENSE.txt','vendor/three-0.147.0.min.js','vendor/three-LICENSE.txt','viewer3d.js','validation/REPORT.md','.nojekyll']:
        assert name in names,'No está en el ZIP: '+name
print(json.dumps({'status':'passed','localLinksAndResources':local,'zipFiles':len(names),'zipBytes':archive.stat().st_size,'plotlySHA256':hashlib.sha256(vendor.read_bytes()).hexdigest()},ensure_ascii=False,indent=2))
