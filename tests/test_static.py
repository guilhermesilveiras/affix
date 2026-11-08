"""Check relative assets under the same URL prefix used by project Pages."""
import json
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
from threading import Thread
from urllib.parse import urljoin
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths=[]

    def handle_starttag(self,tag,attrs):
        data=dict(attrs)
        path=data.get('src') if tag=='script' else data.get('href') if tag=='link' else None
        if path and path.startswith('./'):
            self.paths.append(path)


class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass


def test_static_site_under_repository_prefix(tmp_path):
    shutil.copytree(ROOT/'frontend',tmp_path/'affix')
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietStaticHandler,directory=str(tmp_path)))
    thread=Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        base=f'http://127.0.0.1:{server.server_port}/affix/'
        with urlopen(base) as response:
            parser=Assets()
            parser.feed(response.read().decode('utf-8'))
        assert len(parser.paths)>=5
        for path in parser.paths:
            with urlopen(urljoin(base,path)) as asset:
                assert asset.status==200
        for path in ['sigaa.js','pdf-import.js','vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs','vendor/pdfjs/LICENSE']:
            with urlopen(urljoin(base,path)) as asset:
                assert asset.status==200
        with urlopen(urljoin(base,'./data/catalog.json')) as response:
            catalog=json.load(response)
        assert catalog['total_hours']==3090
        assert len(catalog['courses'])==113
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
