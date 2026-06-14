#!/usr/bin/env python3

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from markdown_header import (
    EXPECTED_BADGE_LINE,
    EXPECTED_PROFILE_LINE,
    EXPECTED_SEPARATOR_LINE,
    validate_standard_header,
)


def list_markdown_files(repo_root: Path) -> list[Path]:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), "ls-files", "*.md"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError:
        return sorted(
            path for path in repo_root.rglob("*.md") if ".git" not in path.parts
        )

    return sorted(repo_root / Path(line) for line in result.stdout.splitlines() if line)
def validate_markdown_file(file_path: Path) -> list[str]:
    lines = file_path.read_text(encoding="utf-8-sig").splitlines()
    return validate_standard_header(lines)


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    markdown_files = list_markdown_files(repo_root)

    if not markdown_files:
        print("No Markdown files found.")
        return 0

    failures: dict[Path, list[str]] = {}

    for file_path in markdown_files:
        errors = validate_markdown_file(file_path)
        if errors:
            failures[file_path.relative_to(repo_root)] = errors

    if not failures:
        print(f"Validated the standard header block in {len(markdown_files)} Markdown files.")
        return 0

    print("Markdown header validation failed.\n")

    for relative_path, errors in failures.items():
        print(f"- {relative_path}")
        for error in errors:
            print(f"  * {error}")

    print(
        "\nExpected block immediately below the main '# Title' line:\n\n"
        "City, Country\n\n"
        f"{EXPECTED_BADGE_LINE}\n"
        f"{EXPECTED_PROFILE_LINE}\n\n"
        "Last updated: YYYY-MM-DD\n\n"
        f"{EXPECTED_SEPARATOR_LINE}"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())