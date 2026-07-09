# Qur — Quran Study Companion

A quiet, distraction-free web app to learn the Quran through four lenses:

- **Tafsir** — three full English commentaries on every verse: *Ibn Kathir (Abridged)*, *Ma'arif al-Qur'an* (Mufti Muhammad Shafi), and *Tazkirul Quran* (Maulana Wahiduddin Khan).
- **Tadabbur** — guided reflection prompts and a private journal per verse, saved only on your device (localStorage).
- **Linguistic analysis** — word-by-word Arabic with transliteration and English gloss; tap any word for an in-app morphology panel (segments, part of speech, grammar features, lemma, root) with a root explorer listing every other occurrence of that root in the Quran. Data from the Quranic Arabic Corpus, bundled locally in `data/` (77,429 words, 1,651 roots).
- **Historical context** — each surah's name, period of revelation, background, and themes from Maududi's *Tafhim al-Qur'an*.

The home screen is a small dashboard: a deterministic **verse of the day** (same verse for everyone, new each day) with listen/reflect/read-in-context actions, continue-reading and random-surah cards, stat tiles (day streak, surahs opened, bookmarks, reflections), and your most recent bookmarks and reflections.

Plus: four readable English translations (Saheeh International, M.A.S. Abdel Haleem, Taqi Usmani, Maududi), continuous per-verse recitation by Mishary Alafasy (auto-advances with follow-along scrolling), full-text verse search across translations (press Enter in the sidebar search), progressive loading of long surahs, exact-verse resume ("continue reading" returns to the verse you left), per-verse bookmarks, journal export to Markdown, reading preferences (Arabic text size, full-verse transliteration, Arabic-only / translation-only display, manual light/dark/auto theme — the "Aa" button in the reader toolbar), offline support via a service worker (visited surahs, tafsirs, and word data stay readable without a connection), Makkan/Madinan and revelation-order metadata, and a light/dark theme in a warm beige manuscript palette with subtle Islamic geometric ornament (eight-pointed star motifs, arched framing, calligraphic accents).

## Running it

No build step, no dependencies. From this folder:

```sh
python3 -m http.server 8642
```

Then open <http://localhost:8642>. (Any static file server works; opening `index.html` directly also works in most browsers since all data is fetched over HTTPS.)

Content is fetched live from open APIs on first read; a service worker then caches everything you've visited (surahs, tafsirs, morphology, fonts), so previously read material works offline. Search and unvisited surahs need a connection.

## Data sources

| Content | Source |
| --- | --- |
| Arabic text | Tanzil Uthmani edition via Quran.com API |
| Translations, tafsirs, word-by-word, surah intros | Quran.com open API (`api.qurancdn.com`) |
| Word morphology (bundled in `data/`) | [Quranic Arabic Corpus](https://corpus.quran.com) (University of Leeds, GPL), via the [mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology) mirror |
| Verse search | Quran.com open search API |
| Video commentary index (`data/nak.json`) | Official [Bayyinah YouTube channel](https://www.youtube.com/@bayyinah) — titles/ids only; videos play via YouTube embeds |
| Recitation | Mishary Rashid Alafasy via QuranicAudio / verses.quran.com |

Texts are displayed as published — nothing is AI-generated.

## Files

- `index.html` — app shell
- `style.css` — design tokens (light/dark), layout, components
- `app.js` — routing, data fetching/caching, rendering, journal, bookmarks, preferences, morphology viewer
- `sw.js` — service worker: network-first app shell, cache-first Quran content for offline reading
- `data/morph/{1..114}.json` — per-chapter word morphology (lazy-loaded)
- `data/roots.json` — root → word-location index for the root explorer
- `tools/build_morphology.py` — regenerates `data/` from the corpus morphology file
- `tools/build_meanings.py` — regenerates `data/meanings.json` (root → distinct English senses across the Quran, with counts and example verses)
- `tools/build_nak.py` — regenerates `data/nak.json` from the Bayyinah YouTube channel (needs `pip install yt-dlp`)

Surahs with published Nouman Ali Khan series/clips show a **"Video insights"** section (26 surahs covered at last build); videos play inside the app through YouTube's privacy-enhanced embedded player.

Bayyinah TV subscribers can enable a **handoff link** in Reading preferences ("Bayyinah TV → Subscriber"): every surah then shows a card that copies the surah name to the clipboard and opens bayyinah.tv, where sign-in and playback happen entirely on their platform. The app never touches Bayyinah TV's paid streams or credentials.
