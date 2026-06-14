from __future__ import annotations

import re
from datetime import datetime

EXPECTED_BADGE_LINE = "[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/)"
EXPECTED_PROFILE_LINE = "[Cloud2BR OSS - Learning Hub](https://github.com/Cloud2BR-MSFTLearningHub)"
EXPECTED_SEPARATOR_LINE = "----------"
LAST_UPDATED_PATTERN = re.compile(r"^Last updated: (\d{4}-\d{2}-\d{2})$")
MAIN_TITLE_PATTERN = re.compile(r"^\s{0,3}#\s+\S")
DATE_LINE_OFFSET = 7
HEADER_LENGTH_AFTER_TITLE = 9


def find_main_title_index(lines: list[str]) -> int | None:
    start_index = 0

    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                start_index = index + 1
                break

    for index in range(start_index, len(lines)):
        if MAIN_TITLE_PATTERN.match(lines[index]):
            return index

    return None


def validate_last_updated_value(value: str) -> bool:
    match = LAST_UPDATED_PATTERN.match(value)
    if not match:
        return False

    try:
        datetime.strptime(match.group(1), "%Y-%m-%d")
    except ValueError:
        return False

    return True


def validate_standard_header(
    lines: list[str],
    *,
    allow_any_date: bool = False,
) -> list[str]:
    title_index = find_main_title_index(lines)

    if title_index is None:
        return ["missing a main title that starts with '# '."]

    expected_line_count = title_index + HEADER_LENGTH_AFTER_TITLE + 1
    if len(lines) < expected_line_count:
        return [
            "does not contain the full standard header block immediately below the main title."
        ]

    errors: list[str] = []
    checks = [
        (1, "a blank line after the main title", "blank"),
        (2, "a location line", "location"),
        (3, "a blank line after the location", "blank"),
        (4, "the standard GitHub badge line", EXPECTED_BADGE_LINE),
        (5, "the standard GitHub profile line", EXPECTED_PROFILE_LINE),
        (6, "a blank line before the date", "blank"),
        (7, "a valid 'Last updated: YYYY-MM-DD' line", "date"),
        (8, "a blank line before the separator", "blank"),
        (9, "the standard separator line", EXPECTED_SEPARATOR_LINE),
    ]

    for offset, description, expected in checks:
        line_number = title_index + offset + 1
        actual = lines[title_index + offset]

        if expected == "blank":
            if actual.strip():
                errors.append(
                    f"line {line_number}: expected {description}, found {actual!r}."
                )
            continue

        if expected == "location":
            if not actual.strip():
                errors.append(
                    f"line {line_number}: expected {description}, found an empty line."
                )
            continue

        if expected == "date":
            if not allow_any_date and not validate_last_updated_value(actual):
                errors.append(
                    f"line {line_number}: expected {description}, found {actual!r}."
                )
            continue

        if actual != expected:
            errors.append(
                f"line {line_number}: expected {description}, found {actual!r}."
            )

    return errors


def update_last_updated_in_header(
    lines: list[str],
    current_date: str,
) -> tuple[list[str], list[str]]:
    errors = validate_standard_header(lines, allow_any_date=True)
    if errors:
        return lines, errors

    title_index = find_main_title_index(lines)
    if title_index is None:
        return lines, ["missing a main title that starts with '# '."]

    updated_lines = list(lines)
    updated_lines[title_index + DATE_LINE_OFFSET] = f"Last updated: {current_date}"
    return updated_lines, []