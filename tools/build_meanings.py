"""Build data/meanings.json — the distinct English senses of every Arabic root
across the whole Quran, with occurrence counts and one example location each.

Joins the Quran.com word-by-word glosses (fetched live) with the bundled
corpus morphology (data/morph/*.json) that maps each word to its root.

Usage:  python3 tools/build_meanings.py     (takes a few minutes; ~300 requests)
"""
import json
import os
import re
import time
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = ("https://api.qurancdn.com/api/qdc/verses/by_chapter/{c}"
       "?language=en&words=true&word_fields=text_uthmani"
       "&word_translation_language=en&per_page=50&page={p}")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Qur study app data build)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))

# word location -> root, from the bundled morphology
loc_root = {}
for c in range(1, 115):
    with open(f"{BASE}/data/morph/{c}.json", encoding="utf-8") as f:
        for vw, segs in json.load(f).items():
            for seg in segs:
                m = re.search(r"ROOT:([^|]+)", seg[2])
                if m:
                    loc_root[f"{c}:{vw}"] = m.group(1)
                    break

def clean(gloss):
    g = re.sub(r"\([^)]*\)", "", gloss).strip().lower()
    return re.sub(r"\s+", " ", g)

roots = {}
for c in range(1, 115):
    page, total = 1, 1
    while page <= total:
        d = get(API.format(c=c, p=page))
        total = d["pagination"]["total_pages"]
        for v in d["verses"]:
            for w in v["words"]:
                if w.get("char_type_name") != "word":
                    continue
                loc = f'{c}:{v["verse_number"]}:{w["position"]}'
                root = loc_root.get(loc)
                gloss = ((w.get("translation") or {}).get("text") or "").strip()
                key = clean(gloss)
                if not root or not key:
                    continue
                senses = roots.setdefault(root, {})
                e = senses.setdefault(key, {"n": 0, "t": gloss, "loc": loc})
                e["n"] += 1
        page += 1
        time.sleep(0.1)
    print(c, end=" ", flush=True)

out = {}
for root, senses in roots.items():
    top = sorted(senses.values(), key=lambda e: -e["n"])[:12]
    out[root] = [[e["t"], e["n"], e["loc"]] for e in top]

with open(f"{BASE}/data/meanings.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"\nroots with senses: {len(out)}")
