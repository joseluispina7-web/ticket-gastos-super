import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".site-source"


TRACKED = [
    ".github/workflows/ci.yml",
    ".github/workflows/deploy-cloudflare.yml",
    ".openai/hosting.json",
    ".env.example",
    "AGENTS.md",
    "THIRD_PARTY_NOTICES.md",
    "cloudflare/wrangler.template.jsonc",
    "dist/.openai/hosting.json",
    "dist/server/comparison.js",
    "dist/server/html.js",
    "dist/server/index.js",
    "web/index.html",
    "server/index.js",
    "server/comparison.js",
    "scripts/build.py",
    "scripts/build.mjs",
    "scripts/check.mjs",
    "scripts/dev_server.mjs",
    "scripts/dev_server.py",
    "scripts/test_client.mjs",
    "scripts/test_comparison.mjs",
    "scripts/validate.py",
    "scripts/push_sites_source.py",
    ".gitignore",
    "package.json",
    "README.md",
]


def copy_into_source() -> None:
    if SOURCE.exists():
        def make_writable(function, path, _exc_info):
            os.chmod(path, stat.S_IWRITE)
            function(path)

        shutil.rmtree(SOURCE, onerror=make_writable)
    SOURCE.mkdir()
    for relative in TRACKED:
        src = ROOT / relative
        dst = SOURCE / relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def run_git(args: list[str], token: str | None = None) -> str:
    command = ["git", "-C", str(SOURCE)]
    if token:
        command.extend(["-c", f"http.extraHeader=Authorization: Bearer {token}"])
    command.extend(args)
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0"}
    result = subprocess.run(command, text=True, capture_output=True, env=env, check=False)
    if result.returncode != 0:
        message = result.stderr or result.stdout or "git command failed"
        if token:
            message = message.replace(token, "<redacted>")
        raise SystemExit(message.strip())
    return result.stdout.strip()


def push_source(remote_url: str, token: str) -> str:
    copy_into_source()
    run_git(["init", "-b", "main"])
    run_git(["config", "user.email", "codex@example.com"])
    run_git(["config", "user.name", "Codex"])
    run_git(["add", "-f", "--", *TRACKED])
    run_git(["commit", "-m", "Build ticket grocery dashboard"])
    commit_id = run_git(["rev-parse", "HEAD"])
    run_git(["push", "--force", remote_url, "HEAD:refs/heads/main"], token=token)
    return commit_id


if __name__ == "__main__":
    missing = [name for name in ("SITES_REMOTE_URL", "SITES_TOKEN") if not os.environ.get(name)]
    if missing:
        raise SystemExit(
            "Missing temporary Sites credentials: "
            + ", ".join(missing)
            + ". Generate a source repository write credential from the Sites owner/editor account."
        )
    print(push_source(os.environ["SITES_REMOTE_URL"], os.environ["SITES_TOKEN"]))
