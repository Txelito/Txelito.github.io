"""Check that index.html (EN) and pt.html (PT) still have the same structure.

The two pages are separate copies. This compares their tags, classes, ids and data
attributes, ignoring the text and the attributes that are translated, and prints
every place where one page has something the other does not.

Usage:
  python tools/check_sync.py
"""

import difflib
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ("index.html", "pt.html")
# attributes whose value is text for people, so it differs between languages
TRANSLATED = {"alt", "aria-label", "content", "title", "placeholder", "data-title", "data-place", "lang", "hreflang"}
# links that are meant to differ (language switch, canonical, translated mail subject)
LANGUAGE_LINKS = ("index.html", "pt.html", "https://txelito.github.io", "mailto:")


class Outline(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []

    def handle_starttag(self, tag, attrs):
        parts = []
        for name, value in sorted(attrs):
            if name in TRANSLATED:
                parts.append(name)
            elif name == "href" and (value or "").startswith(LANGUAGE_LINKS):
                parts.append("href=<language link>")
            elif name == "class":
                # "active-lang" marks the current language, so it sits on a different link in each page
                classes = [c for c in (value or "").split() if c != "active-lang"]
                parts.append(f'class="{" ".join(classes)}"')
            else:
                parts.append(f'{name}="{value}"' if value is not None else name)
        line, _ = self.getpos()
        self.rows.append((f"<{tag} {' '.join(parts)}".strip() + ">", line))

    def handle_endtag(self, tag):
        line, _ = self.getpos()
        self.rows.append((f"</{tag}>", line))


def outline(name):
    parser = Outline()
    parser.feed((ROOT / name).read_text(encoding="utf-8"))
    return parser.rows


def main():
    en, pt = (outline(name) for name in PAGES)
    matcher = difflib.SequenceMatcher(a=[row[0] for row in en], b=[row[0] for row in pt], autojunk=False)
    problems = 0
    for op, a0, a1, b0, b1 in matcher.get_opcodes():
        if op == "equal":
            continue
        problems += 1
        print(f"\n--- difference {problems} ---")
        for text, line in en[a0:a1]:
            print(f"  only in {PAGES[0]}:{line}  {text}")
        for text, line in pt[b0:b1]:
            print(f"  only in {PAGES[1]}:{line}  {text}")
    if problems:
        sys.exit(f"\n{problems} difference(s) between {PAGES[0]} and {PAGES[1]}.")
    print(f"{PAGES[0]} and {PAGES[1]} have the same structure ({len(en)} tags).")


if __name__ == "__main__":
    main()
