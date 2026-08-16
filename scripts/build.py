import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_SERVER = ROOT / "dist" / "server"


def main() -> None:
    DIST_SERVER.mkdir(parents=True, exist_ok=True)
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    (DIST_SERVER / "html.js").write_text(
        "export const HTML = " + json.dumps(html, ensure_ascii=True) + ";\n",
        encoding="utf-8",
    )
    shutil.copy2(ROOT / "server" / "index.js", DIST_SERVER / "index.js")
    dist_openai = ROOT / "dist" / ".openai"
    dist_openai.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / ".openai" / "hosting.json", dist_openai / "hosting.json")
    print("built", DIST_SERVER / "index.js")


if __name__ == "__main__":
    main()
