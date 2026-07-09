"""Build data/nak.json — an index of Nouman Ali Khan's public Quran commentary
on the official Bayyinah YouTube channel, mapped to surah numbers.

Only titles, video ids, and playlist ids are stored (factual metadata); the
videos themselves play through YouTube's embedded player in the app.

Requires: pip install yt-dlp, network access.
Usage:  python3 tools/build_nak.py
"""
import json
import os
import re
import sys
import urllib.request

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "nak.json")
CHANNEL_PLAYLISTS = "https://www.youtube.com/@bayyinah/playlists"
SCAN_PLAYLISTS = {  # playlists whose individual videos are worth scanning for surah titles
    "A Deeper Look": None,
    "Khutbah (Friday Sermons)": None,
}

def normalize(s):
    s = s.lower()
    s = re.sub(r"[’‘'`ʼ-]", "", s)
    return re.sub(r"[^a-z]", "", s)

def strip_article(s):
    return re.sub(r"^(ash|adh|ath|al|an|ar|as|at|az|ad)(?=[a-z]{3})", "", s)

def build_name_map():
    req = urllib.request.Request(
        "https://api.qurancdn.com/api/qdc/chapters?language=en",
        headers={"User-Agent": "Mozilla/5.0 (Qur study app data build)"})
    with urllib.request.urlopen(req) as r:
        chapters = json.load(r)["chapters"]
    names = {}
    for c in chapters:
        for variant in (c["name_simple"], c["name_complex"]):
            key = strip_article(normalize(variant))
            if key:
                names.setdefault(key, c["id"])
    # common alternate spellings not derivable from the API names
    names.update({k: v for k, v in {
        "fatiha": 1, "baqara": 2, "imraan": 3, "nisaa": 4, "yaseen": 36,
        "muzammil": 73, "muddathir": 74, "jumah": 62, "juma": 62,
        "rahmaan": 55, "hujuraat": 49, "qiyama": 75, "mulk": 67,
    }.items() if k not in names})
    return names

SURAH_REF = re.compile(r"sur(?:ah|at|a)h?\s+((?:[A-Za-z'’\-]+\s*){1,2})", re.IGNORECASE)

def surah_from_title(title, names):
    m = SURAH_REF.search(title)
    if not m:
        return None
    words = m.group(1).split()
    for candidate in (" ".join(words[:2]), words[0]):
        key = strip_article(normalize(candidate))
        if key in names:
            return names[key]
    return None

def flat(url):
    from yt_dlp import YoutubeDL
    with YoutubeDL({"extract_flat": True, "quiet": True}) as ydl:
        return ydl.extract_info(url, download=False)

def main():
    names = build_name_map()
    index = {}  # surah -> {"playlists": [...], "videos": [...]}

    def bucket(n):
        return index.setdefault(str(n), {"playlists": [], "videos": []})

    channel = flat(CHANNEL_PLAYLISTS)
    for pl in channel.get("entries", []):
        title = pl.get("title") or ""
        url = pl.get("url") or ""
        list_id = re.search(r"list=([\w-]+)", url)
        if not list_id:
            continue
        if title in SCAN_PLAYLISTS:
            SCAN_PLAYLISTS[title] = url
        if "urdu" in title.lower():
            continue
        n = surah_from_title(title, names)
        if n:
            bucket(n)["playlists"].append({"list": list_id.group(1), "t": title})

    seen = set()
    for name, url in SCAN_PLAYLISTS.items():
        if not url:
            print(f"warning: playlist not found on channel: {name}", file=sys.stderr)
            continue
        data = flat(url)
        for v in data.get("entries", []):
            title, vid = v.get("title"), v.get("id")
            if not title or not vid or vid in seen:
                continue
            n = surah_from_title(title, names)
            if n:
                seen.add(vid)
                bucket(n)["videos"].append({"id": vid, "t": title})

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    covered = sorted(int(k) for k in index)
    total_v = sum(len(b["videos"]) for b in index.values())
    total_p = sum(len(b["playlists"]) for b in index.values())
    print(f"surahs covered: {len(covered)} -> {covered}")
    print(f"videos: {total_v}, playlists: {total_p}, written to {OUT}")

if __name__ == "__main__":
    main()
