#!/usr/bin/env python3
"""Page mapping and PDF assembly for the BlockTrack report.

The body PDF is rendered by Chrome first. This helper locates each section
heading, writes a JSON map of printed body page numbers, and later merges the
cover and body into one PDF with metadata and a bookmark outline.
"""
import argparse
import json
import os
import sys

import fitz


def load_sections(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def find_page(doc, title):
    """Return the 1-based printed body page where a section heading starts."""
    words = title.split()
    prefix = " ".join(words[:3]) if len(words) >= 3 else title
    for index in range(1, len(doc)):  # page 0 is the Contents page
        text = doc[index].get_text("text")
        if title in text:
            return index + 1
        if prefix in text:
            return index + 1
    return None


def cmd_map(args):
    doc = fitz.open(args.pdf)
    sections = load_sections(args.sections)
    mapping = {}
    missing = []
    for section in sections:
        page = find_page(doc, section["title"])
        if page is None:
            missing.append(section["title"])
        else:
            mapping[section["id"]] = page
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(mapping, handle, indent=2)
    print(f"mapped {len(mapping)}/{len(sections)} sections")
    for section in sections:
        print(f"  {section['id']}: {mapping.get(section['id'], 'MISSING')}  {section['title']}")
    if missing:
        print("missing: " + ", ".join(missing), file=sys.stderr)
        return 2
    return 0


def cmd_merge(args):
    cover = fitz.open(args.cover)
    body = fitz.open(args.body)
    mapping = {}
    if os.path.exists(args.toc):
        with open(args.toc, "r", encoding="utf-8") as handle:
            mapping = json.load(handle)
    sections = load_sections(args.sections)

    total_cover_pages = len(cover)
    cover.insert_pdf(body)
    outline = []
    for section in sections:
        page = mapping.get(section["id"])
        if page is None:
            continue
        # Printed body page 1 is the Contents page; the final PDF has the cover
        # in front, so the actual 1-based page index is body page + cover pages.
        outline.append([1, section["title"], page + total_cover_pages])

    cover.set_toc(outline)
    cover.set_metadata({
        "title": "BlockTrack — Final Implementation Report",
        "author": "BlockTrack Team",
        "subject": "Privacy-preserving parcel tracking DApp; final implementation report",
        "keywords": "blockchain, Ethereum, privacy, parcel tracking, Foundry, Caliper",
        "creator": "BlockTrack report build",
        "producer": "Chrome + PyMuPDF",
    })
    cover.save(args.out, garbage=4, deflate=True)
    print(f"merged cover ({total_cover_pages} page(s)) + body ({len(body)} pages) -> {args.out}")
    print(f"bookmarks: {len(outline)}")
    return 0


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    p_map = sub.add_parser("map")
    p_map.add_argument("--pdf", required=True)
    p_map.add_argument("--sections", required=True)
    p_map.add_argument("--out", required=True)
    p_map.set_defaults(func=cmd_map)

    p_merge = sub.add_parser("merge")
    p_merge.add_argument("--cover", required=True)
    p_merge.add_argument("--body", required=True)
    p_merge.add_argument("--toc", required=True)
    p_merge.add_argument("--sections", required=True)
    p_merge.add_argument("--out", required=True)
    p_merge.set_defaults(func=cmd_merge)

    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
