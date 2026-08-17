import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "pydeps"))

from dulwich import porcelain
from dulwich.client import HttpGitClient
from dulwich.repo import Repo


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".site-source"


TRACKED = [
    ".github/workflows/ci.yml",
    ".openai/hosting.json",
    ".env.example",
    "AGENTS.md",
    "dist/.openai/hosting.json",
    "dist/server/html.js",
    "dist/server/index.js",
    "web/index.html",
    "server/index.js",
    "scripts/build.py",
    "scripts/build.mjs",
    "scripts/check.mjs",
    "scripts/dev_server.mjs",
    "scripts/dev_server.py",
    "scripts/test_client.mjs",
    "scripts/validate.py",
    "scripts/push_sites_source.py",
    ".gitignore",
    "package.json",
    "README.md",
]


def copy_into_source() -> None:
    if SOURCE.exists():
        shutil.rmtree(SOURCE)
    SOURCE.mkdir()
    for relative in TRACKED:
        src = ROOT / relative
        dst = SOURCE / relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def push_source(remote_url: str, token: str) -> str:
    copy_into_source()
    porcelain.init(str(SOURCE), bare=False)
    repo = Repo(str(SOURCE))
    porcelain.add(repo, paths=[path.encode("utf-8") for path in TRACKED])
    commit_id = porcelain.commit(
        repo,
        message=b"Build ticket grocery dashboard",
        author=b"Codex <codex@example.com>",
        committer=b"Codex <codex@example.com>",
    )
    repo.refs[b"refs/heads/main"] = commit_id
    parsed = urlparse(remote_url)
    client = HttpGitClient(f"{parsed.scheme}://{parsed.netloc}", username="x-access-token", password=token)

    def update_refs(_refs):
        return {b"refs/heads/main": commit_id}

    def generate_pack_data(have, want, ofs_delta=False, progress=None):
        return repo.generate_pack_data(set(have), set(want), ofs_delta=ofs_delta, progress=progress)

    client.send_pack(parsed.path, update_refs, generate_pack_data=generate_pack_data, progress=lambda _data: None)
    return commit_id.decode("ascii")


if __name__ == "__main__":
    missing = [name for name in ("SITES_REMOTE_URL", "SITES_TOKEN") if not os.environ.get(name)]
    if missing:
        raise SystemExit(
            "Missing temporary Sites credentials: "
            + ", ".join(missing)
            + ". Generate a source repository write credential from the Sites owner/editor account."
        )
    print(push_source(os.environ["SITES_REMOTE_URL"], os.environ["SITES_TOKEN"]))
