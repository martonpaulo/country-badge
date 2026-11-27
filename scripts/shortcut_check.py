#!/usr/bin/env python3
"""Refuse a workaround comment that names no issue and no upgrade condition (#1767).

A known-limit shortcut is written `shortcut: <limit>, <when to upgrade>`, as the global rules
define. This check reads every file Git tracks under ROOT, except prose and data (Markdown, JSON,
TSV), and takes each `shortcut:` up to the end of its sentence, across comment continuation lines.
The sentence passes when it names an issue (`#123`, `owner/name#123` or an `/issues/123` link) or
has a second clause, after a comma or a semicolon, that says when to upgrade. Each failure prints
`PATH:LINE: shortcut names no issue and no upgrade condition`; the exit code is 1 then, else 0.

    python3 shortcut_check.py ROOT
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

SKIPPED_SUFFIXES = {".md", ".json", ".tsv", ".txt", ".lock", ".svg", ".png", ".jpg", ".pdf"}
MARKER = re.compile(r"\bshortcut:")
COMMENT_PREFIX = re.compile(r"^\s*(?:#+|//+|/\*+|\*+|--|;+)?\s?")
ISSUE = re.compile(r"(?:^|[\s(\[])[\w.-]*(?:/[\w.-]+)?#\d+|/issues/\d+")
CONTINUATION_LINES = 4  # a shortcut sentence longer than five lines is cut there


def sentence(lines: list[str], index: int) -> str:
    """The text from `shortcut:` to the end of its sentence, comment markers removed."""
    text = lines[index][MARKER.search(lines[index]).end():]
    for following in lines[index + 1:index + 1 + CONTINUATION_LINES]:
        if re.search(r"\.(?:\s|$)", text):
            break
        stripped = COMMENT_PREFIX.sub("", following, count=1).strip()
        if not stripped or MARKER.search(stripped):
            break
        text += " " + stripped
    end = re.search(r"\.(?:\s|$)", text)
    return text[:end.start()] if end else text


def passes(text: str) -> bool:
    return bool(ISSUE.search(text)) or bool(re.search(r"[,;]\s*\S", text))


def tracked_files(root: Path) -> list[Path]:
    listed = subprocess.run(["git", "-C", str(root), "ls-files", "-z"], capture_output=True, check=False)
    if listed.returncode != 0:
        return sorted(path for path in root.rglob("*") if path.is_file() and ".git" not in path.parts)
    return [root / name for name in listed.stdout.decode("utf-8", "replace").split("\0") if name]


def problems(root: Path) -> list[str]:
    found: list[str] = []
    for path in tracked_files(root):
        if path.suffix.lower() in SKIPPED_SUFFIXES or not path.is_file():
            continue
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (UnicodeDecodeError, OSError):
            continue
        for index, line in enumerate(lines):
            if MARKER.search(line) and not passes(sentence(lines, index)):
                found.append(f"{path.relative_to(root)}:{index + 1}: shortcut names no issue and no upgrade condition")
    return found


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip().splitlines()[-1].strip(), file=sys.stderr)
        return 2
    found = problems(Path(argv[1]).resolve())
    for line in found:
        print(line)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
