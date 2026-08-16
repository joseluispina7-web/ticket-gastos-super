from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            self.path = "/web/index.html"
        return super().do_GET()


if __name__ == "__main__":
    import os

    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", 8788), Handler)
    print("http://127.0.0.1:8788")
    server.serve_forever()
