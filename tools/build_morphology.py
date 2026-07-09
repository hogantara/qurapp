"""Regenerate the bundled morphology data in data/ from the Quranic Arabic Corpus.

Source file (Arabic-script edition of the corpus morphology, GPL):
  https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt
Line format: chapter:verse:word:segment TAB text TAB tag(N|V|P) TAB features

Usage:
  python3 tools/build_morphology.py quran-morphology.txt
"""
import collections
import json
import os
import sys

src = sys.argv[1] if len(sys.argv) > 1 else "quran-morphology.txt"
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

chapters = collections.defaultdict(dict)   # chapter -> {"verse:word": [segments]}
roots = collections.defaultdict(list)      # root -> ["c:v:w", ...]

with open(src, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line or line.startswith("#"):
            continue
        loc, text, tag, feats = line.split("\t")
        c, v, w, s = loc.split(":")
        chapters[c].setdefault(f"{v}:{w}", []).append([text, tag, feats])
        for tok in feats.split("|"):
            if tok.startswith("ROOT:"):
                wloc = f"{c}:{v}:{w}"
                if not roots[tok[5:]] or roots[tok[5:]][-1] != wloc:
                    roots[tok[5:]].append(wloc)

os.makedirs(f"{out}/morph", exist_ok=True)
for c, words in chapters.items():
    with open(f"{out}/morph/{c}.json", "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, separators=(",", ":"))

with open(f"{out}/roots.json", "w", encoding="utf-8") as f:
    json.dump(roots, f, ensure_ascii=False, separators=(",", ":"))

print(f"chapters: {len(chapters)}, words: {sum(len(w) for w in chapters.values())}, roots: {len(roots)}")
