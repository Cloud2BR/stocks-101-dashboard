#!/usr/bin/env python3

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from markdown_header import update_last_updated_in_header


def list_changed_markdown_files(repo_root: Path, base_ref: str | None) -> list[Path]:
    diff_target = f"origin/{base_ref}...HEAD" if base_ref else "HEAD~1...HEAD"

    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "diff", "--name-only", "--diff-filter=ACMRT", diff_target],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as error:
        print(f"Failed to determine changed files from {diff_target}: {error}", file=sys.stderr)
        return []

    markdown_paths: list[Path] = []
    for line in result.stdout.splitlines():
        if not line.endswith(".md"):
            continue
        file_path = repo_root / Path(line)
        if file_path.is_file():
            markdown_paths.append(file_path)

    return sorted(markdown_paths)


def update_file_date(file_path: Path, current_date: str) -> tuple[bool, list[str]]:
    original_text = file_path.read_text(encoding="utf-8-sig")
    lines = original_text.splitlines()
    updated_lines, errors = update_last_updated_in_header(lines, current_date)
    if errors:
        return False, errors

    updated_text = "\n".join(updated_lines)
    if original_text.endswith("\n"):
        updated_text += "\n"

    if updated_text == original_text:
        return False, []

    file_path.write_text(updated_text, encoding="utf-8")
    return True, []


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    base_ref = os.environ.get("PR_BASE_REF")
    current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    markdown_files = list_changed_markdown_files(repo_root, base_ref)

    if not markdown_files:
        print("No changed Markdown files found.")
        return 0

    failures: dict[Path, list[str]] = {}
    updated_files: list[Path] = []

    for file_path in markdown_files:
        changed, errors = update_file_date(file_path, current_date)
        if errors:
            failures[file_path.relative_to(repo_root)] = errors
            continue
        if changed:
            updated_files.append(file_path.relative_to(repo_root))

    if failures:
        print("Markdown date update failed because the standard header block is invalid.\n")
        for relative_path, errors in failures.items():
            print(f"- {relative_path}")
            for error in errors:
                print(f"  * {error}")
        return 1

    if not updated_files:
        print("All changed Markdown files already had the current date in their standard header block.")
        return 0

    print("Updated Last updated lines in:")
    for relative_path in updated_files:
        print(f"- {relative_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())