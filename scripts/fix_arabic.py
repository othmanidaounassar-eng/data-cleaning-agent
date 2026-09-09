#!/usr/bin/env python3
"""fix_arabic.py — repair double-encoded (mojibake) Arabic text in frontend files.

The corruption: original UTF-8 Arabic/punctuation bytes were mis-decoded as
Windows-1252 and the garbage was re-saved as UTF-8.  Example:

    "تنظيف ملف جديد"  (UTF-8)  --misdecode via cp1252-->  "ØªÙ†Ø¸ÙŠÙ…Ù„Ù Ø¬Ø¯ÙŠØ¯"

This script reverses the damage span-by-span:

    text.encode("cp1252").decode("utf-8")

Only spans made entirely of cp1252 "mojibake" characters are considered, and a
change is accepted only when the reversal produces valid UTF-8 with no
replacement characters or control characters.  Legitimate Latin-1 accents,
curly quotes, em-dashes etc. never survive the round-trip (a lone byte such as
0xE9 / 0x97 is not valid UTF-8), so they are left untouched.

Usage:
    python scripts/fix_arabic.py [FILE ...]          # fix the given files
    python scripts/fix_arabic.py --scan-only         # report, do not write
    python scripts/fix_arabic.py --scan-only FILE... # report only those files
Dangerous punctuation cases that decode to an unexpected glyph are reported as
"reviews" for a human to confirm.
"""

import sys
import unicodedata

# ---- the full set of characters that a UTF-8 byte 0x80..0xFF renders as
#      after a Windows-1252 mis-decode.  A corrupted span is a maximal run of
#      these characters.  (Python 3.14's cp1252 codec refuses the undefined
#      bytes 0x81/0x8D/0x8F/0x90/0x9D, so the table is declared explicitly and
#      the five undefined bytes round-trip to their C1 control codepoints.)
_CP1252_SPECIAL = {
    0x80: "\u20ac", 0x81: "\u0081", 0x82: "\u201a", 0x83: "\u0192",
    0x84: "\u201e", 0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021",
    0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160", 0x8b: "\u2039",
    0x8c: "\u0152", 0x8d: "\u008d", 0x8e: "\u017d", 0x8f: "\u008f",
    0x90: "\u0090", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201c",
    0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
    0x98: "\u02dc", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a",
    0x9c: "\u0153", 0x9d: "\u009d", 0x9e: "\u017e", 0x9f: "\u0178",
}

# byte -> mojibake character (for the corrupted spans we scan)
_BYTE_TO_CHAR = {}
for _b in range(0x80, 0xA0):
    _BYTE_TO_CHAR[_b] = _CP1252_SPECIAL[_b]
# 0xA0..0xFF follow Latin-1
for _b in range(0xA0, 0x100):
    _BYTE_TO_CHAR[_b] = chr(_b)

MOJIBAKE = frozenset(_BYTE_TO_CHAR.values())
CHAR_TO_BYTE = {c: b for b, c in _BYTE_TO_CHAR.items()}

# A few reverse-decodings are ambiguous or low-confidence; their outputs are
# collected for human review instead of being applied silently.
REVIEW_ONLY = frozenset("\u0080\u0081\u009d\u0192\u02c6\u02dc")

DEFAULT_TARGETS = [
    "frontend/app/page.tsx",
    "frontend/app/dashboard/upload/page.tsx",
    "frontend/lib/workspace.ts",
    "frontend/app/dashboard/page.tsx",
    "frontend/app/dashboard/chat/page.tsx",
    "frontend/app/dashboard/analyze/page.tsx",
    "frontend/components/dashboard/file-tools.tsx",
    "frontend/components/dashboard/upload-progress-bar.tsx",
    "frontend/app/dashboard/reports/page.tsx",
    "frontend/app/plans/checkout/page.tsx",
    "frontend/app/dashboard/charts/page.tsx",
    "frontend/app/dashboard/history/page.tsx",
    "frontend/components/dashboard/upload-status-banner.tsx",
]


def try_fix(span: str):
    """Return the repaired text for a mojibake span, or None if unsure."""
    try:
        raw = bytes(CHAR_TO_BYTE[c] for c in span)
        fixed = raw.decode("utf-8")
    except (KeyError, UnicodeDecodeError):
        return None
    if "\ufffd" in fixed:
        return None
    if any(unicodedata.category(c) in ("Cc", "Cs") for c in fixed):
        return None
    if fixed == span:
        return None
    if any(c in REVIEW_ONLY for c in fixed):
        # possible but needs a human eye
        return ("__review__", fixed)
    return ("__ok__", fixed)


def repair(text: str):
    """Return (fixed_text, ok_count, review_list)."""
    out_parts = []
    ok = 0
    reviews: list[str] = []
    for line in text.split("\n"):
        parts = []
        i, n = 0, len(line)
        while i < n:
            ch = line[i]
            if ch not in MOJIBAKE:
                parts.append(ch)
                i += 1
                continue
            j = i + 1
            while j < n and line[j] in MOJIBAKE:
                j += 1
            span = line[i:j]
            result = try_fix(span)
            if result is None:
                parts.append(span)
            else:
                kind, fixed = result
                if kind == "__ok__":
                    parts.append(fixed)
                    ok += 1
                else:
                    parts.append(span)
                    reviews.append(f"{span!r} -> {fixed!r}")
            i = j
        out_parts.append("".join(parts))
    return "\n".join(out_parts), ok, reviews


def scan_file(path: str, write: bool):
    with open(path, "rb") as fh:
        raw = fh.read()
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    fixed, ok, reviews = repair(text)
    changed = fixed != text
    tag = "FIX " if (write and changed) else ("WILL FIX" if changed else "----")
    print(f"{tag} {path}  (spans fixed: {ok})")
    for r in reviews:
        print(f"       REVIEW: {r}")
    if write and changed:
        body = fixed.encode("utf-8")
        with open(path, "wb") as fh:
            if has_bom:
                fh.write(b"\xef\xbb\xbf")
            fh.write(body)
    return changed, ok


def main(argv):
    scan_only = "--scan-only" in argv
    args = [a for a in argv if a != "--scan-only"]
    write = not scan_only
    paths = args or DEFAULT_TARGETS
    total_ok = 0
    for p in paths:
        try:
            _, ok = scan_file(p, write)
            total_ok += ok
        except FileNotFoundError:
            print(f"SKIP {p}  (not found)")
    print(f"\nTotal repaired spans: {total_ok}")


if __name__ == "__main__":
    main(sys.argv[1:])
