import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "pydeps"))

import esprima


ROOT = Path(__file__).resolve().parents[1]


def parse_js(source: str, label: str, module: bool = False) -> None:
    if module:
      esprima.parseModule(source)
    else:
      esprima.parseScript(source)
    print("ok", label, len(source))


html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
if len(scripts) != 1:
    raise SystemExit(f"expected one inline script, found {len(scripts)}")
parse_js(scripts[0], "web/index.html script")
parse_js((ROOT / "server" / "index.js").read_text(encoding="utf-8"), "server/index.js", module=True)
