/* Qur — Quran Study Companion
 * Data sources (all open / freely licensed for non-commercial study):
 *  - Quran.com API (api.qurancdn.com): Uthmani text (Tanzil), translations,
 *    word-by-word gloss & transliteration, English tafsirs, chapter intros.
 *  - Quranic Arabic Corpus (corpus.quran.com): per-word morphology deep links.
 *  - QuranicAudio via Quran.com: Mishary Alafasy recitation.
 */

const API = "https://api.qurancdn.com/api/qdc";
const AUDIO_BASE = "https://verses.quran.com/";

const TRANSLATIONS = [
  { id: 20, name: "Saheeh International" },
  { id: 85, name: "M.A.S. Abdel Haleem (Oxford)" },
  { id: 84, name: "Mufti Taqi Usmani" },
  { id: 95, name: "A. Maududi — Tafhim commentary" },
];
const TRANSLIT_ID = 57; // full-verse transliteration, fetched alongside translations

const TAFSIRS = [
  { id: 169, key: "en-tafisr-ibn-kathir", name: "Ibn Kathir (Abridged)", author: "Hafiz Ibn Kathir (d. 1373 CE)" },
  { id: 168, key: "en-tafsir-maarif-ul-quran", name: "Ma'arif al-Qur'an", author: "Mufti Muhammad Shafi (d. 1976 CE)" },
  { id: 817, key: "en-tazkirul-quran", name: "Tazkirul Quran", author: "Maulana Wahiduddin Khan (d. 2021 CE)" },
];

const ICONS = {
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5c-2.2-1.4-4.8-2-8-2v16c3.2 0 5.8.6 8 2 2.2-1.4 4.8-2 8-2V3c-3.2 0-5.8.6-8 2v16"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21c0-9 4.5-14.5 13-16-1 8.5-5.5 13.5-13 14.5"/><path d="M6 21c2-5 5-8.5 9-11"/></svg>',
  letters: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3M12 4v16M9 20h6"/></svg>',
  arch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-8c0-5 3.5-8.5 8-10.5C16.5 4.5 20 8 20 13v8"/><path d="M3 21h18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v17l-6-4.5L6 21z"/></svg>',
  bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v17l-6-4.5L6 21z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M10 10l4.5 2.5L10 15z"/></svg>',
};

const PROMPTS = [
  "What does this verse teach you about who Allah is?",
  "Which single word stands out to you here — and why?",
  "If you truly lived by this verse, what would change in your day tomorrow?",
  "Is there a promise, a warning, or a command in this verse? Which one speaks to you now?",
  "What emotion does this verse stir in you — hope, awe, fear, gratitude?",
  "Who do you know that embodies this verse? What can you learn from them?",
  "What question would you ask about this verse if you could sit with a scholar?",
  "How does this verse connect to something you are going through right now?",
  "What is this verse asking you to let go of?",
  "Read the verse slowly three times. What did you notice on the third reading that you missed on the first?",
  "If this verse were the last advice you ever received, how would you act on it?",
  "What does this verse reveal about human nature — including your own?",
];

/* ---------- state ---------- */
const state = {
  chapters: [],
  verseCache: new Map(),   // chapterId -> verses[] (complete chapters only)
  partial: null,           // { chapterId, verses } while a chapter is streaming in
  pendingTarget: null,     // verse number to scroll to once its card exists
  infoCache: new Map(),    // chapterId -> chapter info
  tafsirCache: new Map(),  // `${tafsirId}:${verseKey}` -> html
  morphCache: new Map(),   // chapterId -> word morphology map
  rootsIndex: null,        // root -> ["c:v:w", ...]
  translationId: (() => {
    const saved = Number(localStorage.getItem("qur.translation"));
    return TRANSLATIONS.some((t) => t.id === saved) ? saved : TRANSLATIONS[0].id;
  })(),
  wbw: localStorage.getItem("qur.wbw") === "1",
  prefs: (() => {
    const defaults = { arabicSize: 1.9, translit: false, mode: "both", theme: "auto", bayyinah: false };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem("qur.prefs")) }; }
    catch { return defaults; }
  })(),
  currentChapter: null,
  playingKey: null,
};

function savePrefs() { localStorage.setItem("qur.prefs", JSON.stringify(state.prefs)); }

function applyPrefs() {
  const p = state.prefs;
  document.documentElement.style.setProperty("--arabic-size", `${p.arabicSize}rem`);
  if (p.theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = p.theme;
  document.body.classList.toggle("mode-arabic", p.mode === "arabic");
  document.body.classList.toggle("mode-translation", p.mode === "translation");
  document.body.classList.toggle("btv-on", !!p.bayyinah);
}

const $ = (sel, el = document) => el.querySelector(sel);
const main = $("#main");
const player = $("#player");

/* ---------- utils ---------- */
async function getJSON(url, retried) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } catch (e) {
    if (retried) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return getJSON(url, true);
  }
}

function sanitize(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, iframe, object, embed").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    [...n.attributes].forEach((a) => {
      const name = a.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || (name === "href" && a.value.trim().toLowerCase().startsWith("javascript:"))) {
        n.removeAttribute(a.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function stripFootnotes(html) {
  return html.replace(/<sup[^>]*>.*?<\/sup>/g, "");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loadingHTML(msg) {
  return `<div class="loading"><div class="spinner"></div>${esc(msg)}</div>`;
}

function errorHTML(msg) {
  return `<div class="error-box">Could not load data — ${esc(msg)}. Check your internet connection and try again.</div>`;
}

/* ---------- reflections storage ---------- */
function getReflections() {
  try { return JSON.parse(localStorage.getItem("qur.reflections")) || {}; }
  catch { return {}; }
}
function saveReflection(verseKey, prompt, text) {
  const all = getReflections();
  (all[verseKey] = all[verseKey] || []).push({ t: Date.now(), prompt, text });
  localStorage.setItem("qur.reflections", JSON.stringify(all));
}
function deleteReflection(verseKey, t) {
  const all = getReflections();
  all[verseKey] = (all[verseKey] || []).filter((n) => n.t !== t);
  if (!all[verseKey].length) delete all[verseKey];
  localStorage.setItem("qur.reflections", JSON.stringify(all));
}

/* ---------- streak & verse of the day ---------- */
const localDate = (d = new Date()) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local tz

function trackDay() {
  let days = [];
  try { days = JSON.parse(localStorage.getItem("qur.days")) || []; } catch { /* fresh start */ }
  const today = localDate();
  if (!days.includes(today)) {
    days.push(today);
    localStorage.setItem("qur.days", JSON.stringify(days));
  }
  return days;
}

function currentStreak() {
  const days = new Set(trackDay());
  let streak = 0;
  const d = new Date();
  while (days.has(localDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function loadVOTD() {
  const today = localDate();
  try {
    const saved = JSON.parse(localStorage.getItem("qur.votd"));
    if (saved && saved.date === today && saved.key) return saved;
  } catch { /* refetch */ }
  // Deterministic pick: same verse for everyone all day, different each day.
  const counts = state.chapters.map((c) => c.verses_count);
  const total = counts.reduce((a, b) => a + b, 0);
  let idx = (Math.floor(Date.now() / 86400000) * 2654435761) % total;
  let chapter = counts.length;
  for (let i = 0; i < counts.length; i++) {
    if (idx < counts[i]) { chapter = i + 1; break; }
    idx -= counts[i];
  }
  const key = `${chapter}:${idx + 1}`;
  const trIds = TRANSLATIONS.map((t) => t.id).join(",");
  const data = await getJSON(`${API}/verses/by_key/${key}?language=en&words=false&translations=${trIds}&fields=text_uthmani`);
  const v = data.verse;
  const tr = (v.translations || []).find((t) => t.resource_id === state.translationId) || (v.translations || [])[0];
  const votd = {
    date: today, key,
    arabic: v.text_uthmani,
    tr: tr ? stripFootnotes(tr.text).replace(/<[^>]+>/g, "") : "",
  };
  localStorage.setItem("qur.votd", JSON.stringify(votd));
  return votd;
}

const chapterNameById = (id) =>
  state.chapters.find((c) => c.id === Number(id))?.name_simple || `Surah ${id}`;

/* ---------- bookmarks storage ---------- */
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem("qur.bookmarks")) || {}; }
  catch { return {}; }
}
function toggleBookmark(verseKey, verse) {
  const all = getBookmarks();
  if (all[verseKey]) {
    delete all[verseKey];
  } else {
    const tr = verse ? (verse.translations || []).find((t) => t.resource_id === state.translationId) : null;
    const plain = tr ? stripFootnotes(tr.text).replace(/<[^>]+>/g, "") : "";
    all[verseKey] = { t: Date.now(), arabic: verse ? verse.text_uthmani : "", tr: plain };
  }
  localStorage.setItem("qur.bookmarks", JSON.stringify(all));
  return !!all[verseKey];
}

/* ---------- data fetchers ---------- */
async function loadChapters() {
  if (state.chapters.length) return state.chapters;
  const data = await getJSON(`${API}/chapters?language=en`);
  state.chapters = data.chapters;
  return state.chapters;
}

function versesFor(chapterId) {
  if (state.verseCache.has(chapterId)) return state.verseCache.get(chapterId);
  if (state.partial && state.partial.chapterId === chapterId) return state.partial.verses;
  return [];
}

function versePageURL(chapterId, page) {
  const trIds = [...TRANSLATIONS.map((t) => t.id), TRANSLIT_ID].join(",");
  return `${API}/verses/by_chapter/${chapterId}?language=en&words=true&translations=${trIds}` +
    `&fields=text_uthmani&word_fields=text_uthmani&word_translation_language=en&per_page=50&page=${page}`;
}

async function loadMorph(chapterId) {
  if (!state.morphCache.has(chapterId)) {
    state.morphCache.set(chapterId, await getJSON(`data/morph/${chapterId}.json`));
  }
  return state.morphCache.get(chapterId);
}

async function loadRoots() {
  if (!state.rootsIndex) state.rootsIndex = await getJSON("data/roots.json");
  return state.rootsIndex;
}

async function loadMeanings() {
  if (!state.meaningsIndex) state.meaningsIndex = await getJSON("data/meanings.json");
  return state.meaningsIndex;
}

async function loadNAK() {
  if (!state.nakIndex) {
    try { state.nakIndex = await getJSON("data/nak.json"); }
    catch { state.nakIndex = {}; } // optional content — never block the reader
  }
  return state.nakIndex;
}

async function loadChapterInfo(chapterId) {
  if (state.infoCache.has(chapterId)) return state.infoCache.get(chapterId);
  const data = await getJSON(`${API}/chapters/${chapterId}/info?language=en`);
  state.infoCache.set(chapterId, data.chapter_info);
  return data.chapter_info;
}

async function loadTafsir(tafsirId, verseKey) {
  const cacheKey = `${tafsirId}:${verseKey}`;
  if (state.tafsirCache.has(cacheKey)) return state.tafsirCache.get(cacheKey);
  const data = await getJSON(`${API}/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
  const text = data.tafsir && data.tafsir.text ? data.tafsir.text : "";
  state.tafsirCache.set(cacheKey, text);
  return text;
}

/* ---------- sidebar ---------- */
function renderSurahList(filter = "") {
  const list = $("#surah-list");
  const q = filter.trim().toLowerCase();
  const items = state.chapters.filter((c) =>
    !q ||
    c.name_simple.toLowerCase().includes(q) ||
    c.translated_name.name.toLowerCase().includes(q) ||
    String(c.id) === q
  );
  list.innerHTML = items.map((c) => `
    <a class="surah-item ${state.currentChapter === c.id ? "active" : ""}" role="listitem" href="#/surah/${c.id}">
      <span class="surah-num"><i>${c.id}</i></span>
      <span class="surah-meta">
        <span class="name">${esc(c.name_simple)}</span>
        <span class="tname">${esc(c.translated_name.name)} · ${c.verses_count} verses</span>
      </span>
      <span class="surah-arabic">${c.name_arabic}</span>
    </a>`).join("");
  const active = list.querySelector(".surah-item.active");
  if (active) active.scrollIntoView({ block: "center" });
}

function setNav(route) {
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === route);
  });
}

/* ---------- views ---------- */
function viewHome() {
  setNav("home");
  state.currentChapter = null;
  renderSurahList($("#surah-search").value);
  const last = JSON.parse(localStorage.getItem("qur.lastRead") || "null");
  const bookmarks = getBookmarks();
  const reflections = getReflections();
  const bmKeys = Object.keys(bookmarks);
  const refCount = Object.values(reflections).reduce((a, arr) => a + arr.length, 0);
  const visited = JSON.parse(localStorage.getItem("qur.visited") || "[]");
  const streak = currentStreak();
  const recentBm = bmKeys.sort((a, b) => bookmarks[b].t - bookmarks[a].t).slice(0, 3);
  const recentRef = Object.entries(reflections)
    .flatMap(([k, arr]) => arr.map((n) => ({ k, ...n })))
    .sort((a, b) => b.t - a.t).slice(0, 3);
  const verseLink = (k) => `#/surah/${k.split(":")[0]}?verse=${k.split(":")[1]}`;

  main.innerHTML = `
    <div class="container">
      <div class="hero home-hero">
        <span class="hero-ayah">﴿ أَفَلَا يَتَدَبَّرُونَ الْقُرْآنَ ﴾</span>
        <h1>Will they not reflect on the Quran?</h1>
        ${!last ? `<p>A quiet space to read, understand, and reflect — verse by verse, with classical commentary, word-level Arabic, and the story behind each surah.</p>` : ""}
        <div class="ornament"><span>۞</span></div>
      </div>

      <div class="votd" id="votd">${loadingHTML("Choosing today's verse…")}</div>

      <div class="home-row">
        ${last ? `
        <a class="continue-card" href="#/surah/${last.chapter}${last.verse > 1 ? `?verse=${last.verse}` : ""}">
          <div>
            <div class="label">Continue reading</div>
            <div class="name">Surah ${esc(last.name)}${last.verse > 1 ? ` · verse ${last.verse}` : ""}</div>
          </div>
          <span class="arrow">→</span>
        </a>` : ""}
        <button class="continue-card random-card" id="random-surah">
          <div>
            <div class="label">Somewhere new</div>
            <div class="name">Open a random surah</div>
          </div>
          <span class="arrow">۝</span>
        </button>
      </div>

      <div class="stat-grid">
        <div class="stat"><span class="num">${streak}</span><span class="lbl">day streak</span></div>
        <div class="stat"><span class="num">${visited.length}<small> / 114</small></span><span class="lbl">surahs opened</span></div>
        <a class="stat" href="#/bookmarks"><span class="num">${bmKeys.length}</span><span class="lbl">bookmarks</span></a>
        <a class="stat" href="#/reflections"><span class="num">${refCount}</span><span class="lbl">reflections</span></a>
      </div>

      ${recentBm.length || recentRef.length ? `
      <div class="recent-grid">
        ${recentBm.length ? `
        <div class="recent-col">
          <h3 class="home-h3">Recent bookmarks</h3>
          ${recentBm.map((k) => `
          <a class="recent-item" href="${verseLink(k)}">
            <span class="rk">${k}</span>
            <span class="rt">${esc((bookmarks[k].tr || chapterNameById(k.split(":")[0])).slice(0, 90))}</span>
          </a>`).join("")}
        </div>` : ""}
        ${recentRef.length ? `
        <div class="recent-col">
          <h3 class="home-h3">Recent reflections</h3>
          ${recentRef.map((n) => `
          <a class="recent-item" href="${verseLink(n.k)}">
            <span class="rk">${n.k}</span>
            <span class="rt">${esc(n.text.slice(0, 90))}</span>
          </a>`).join("")}
        </div>` : ""}
      </div>` : ""}

      ${!last ? `
      <div class="feature-grid">
        <div class="feature-card"><span class="icon">${ICONS.book}</span><h3>Tafsir</h3><p>Classical and modern commentary in English — Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran — on every verse.</p></div>
        <div class="feature-card"><span class="icon">${ICONS.leaf}</span><h3>Tadabbur</h3><p>Guided reflection prompts and a private journal, saved on your device, to slow down and internalise each verse.</p></div>
        <div class="feature-card"><span class="icon">${ICONS.letters}</span><h3>Linguistic analysis</h3><p>Word-by-word Arabic with transliteration and meaning, with full morphology and a root explorer built in.</p></div>
        <div class="feature-card"><span class="icon">${ICONS.arch}</span><h3>Historical context</h3><p>When and where each surah was revealed, its themes and background, from Maududi's Tafhim al-Qur'an.</p></div>
      </div>
      <p class="page-sub" style="text-align:center">Choose a surah from the list to begin${window.innerWidth <= 900 ? " — open it with the button below" : ""}.</p>` : ""}
    </div>`;

  $("#random-surah").addEventListener("click", () => {
    location.hash = `#/surah/${1 + Math.floor(Math.random() * 114)}`;
  });
  renderVOTD();
}

async function renderVOTD() {
  const box = $("#votd");
  if (!box) return;
  let votd;
  try {
    votd = await loadVOTD();
  } catch {
    box.innerHTML = ""; // offline before first fetch of the day — just hide it
    box.style.display = "none";
    return;
  }
  state.votd = votd;
  if (!$("#votd")) return; // navigated away
  const [c, v] = votd.key.split(":");
  $("#votd").innerHTML = `
    <div class="votd-head">
      <span class="votd-label">Verse of the day</span>
      <span class="verse-key"><i>${votd.key}</i></span>
    </div>
    <div class="votd-ar">${votd.arabic}</div>
    <div class="votd-tr">${esc(votd.tr)}</div>
    <div class="verse-actions">
      <a class="va-btn" href="#/surah/${c}?verse=${v}">${ICONS.book}<span>Read in ${esc(chapterNameById(c))}</span></a>
      <button class="va-btn act-play">${ICONS.play}<span>Listen</span></button>
      <button class="va-btn act-reflect">${ICONS.leaf}<span>Reflect</span></button>
    </div>`;
  const card = $("#votd");
  card.dataset.key = votd.key;
  card.querySelector(".act-play").addEventListener("click", () => togglePlay(votd.key, card));
  card.querySelector(".act-reflect").addEventListener("click", () => openReflect(votd.key));
}

function viewSources() {
  setNav("sources");
  state.currentChapter = null;
  renderSurahList($("#surah-search").value);
  main.innerHTML = `
    <div class="container">
      <h1 class="page-title">Sources</h1>
      <p class="page-sub">Everything in this app comes from established, freely accessible scholarly sources. Nothing is generated — texts are shown as published.</p>
      <div class="source-card"><h3>Quran text — Tanzil Uthmani</h3><p>The Arabic text follows the verified Tanzil Uthmani edition, served through the Quran.com open API.</p><a href="https://tanzil.net" target="_blank" rel="noopener">tanzil.net</a></div>
      <div class="source-card"><h3>Translations</h3><p><em>Saheeh International</em>, <em>M.A.S. Abdel Haleem</em> (Oxford World's Classics), <em>Mufti Taqi Usmani</em>, and <em>A. Maududi</em> — widely used, readable modern English translations.</p><a href="https://quran.com" target="_blank" rel="noopener">quran.com</a></div>
      <div class="source-card"><h3>Tafsir — Ibn Kathir (Abridged)</h3><p>The classical 14th-century commentary of Hafiz Ibn Kathir, in the widely distributed abridged English translation.</p></div>
      <div class="source-card"><h3>Tafsir — Ma'arif al-Qur'an</h3><p>The comprehensive 20th-century commentary of Mufti Muhammad Shafi, translated from Urdu.</p></div>
      <div class="source-card"><h3>Tafsir — Tazkirul Quran</h3><p>Maulana Wahiduddin Khan's reflective modern commentary, translated from Urdu.</p></div>
      <div class="source-card"><h3>Historical context — Tafhim al-Qur'an</h3><p>Surah introductions (name, period of revelation, background, themes) from Sayyid Abul Ala Maududi's <em>The Meaning of the Quran</em>.</p></div>
      <div class="source-card"><h3>Linguistics — Quranic Arabic Corpus</h3><p>Word-level morphology (root, lemma, part of speech, grammar) from the University of Leeds' Quranic Arabic Corpus, bundled with the app so every word can be analysed instantly — including all other occurrences of its root.</p><a href="https://corpus.quran.com" target="_blank" rel="noopener">corpus.quran.com</a></div>
      <div class="source-card"><h3>Video commentary — Nouman Ali Khan (Bayyinah)</h3><p>Surah lecture series and clips by Ustadh Nouman Ali Khan, indexed from the official Bayyinah YouTube channel and played through YouTube's embedded player. The videos remain on YouTube — this app stores only titles and links. Subscribers can enable Bayyinah TV handoff links in Reading preferences; sign-in and playback happen entirely on bayyinah.tv.</p><a href="https://www.youtube.com/@bayyinah" target="_blank" rel="noopener">youtube.com/@bayyinah</a></div>
      <div class="source-card"><h3>Recitation</h3><p>Verse audio by Sheikh Mishary Rashid Alafasy, via QuranicAudio.</p><a href="https://quranicaudio.com" target="_blank" rel="noopener">quranicaudio.com</a></div>
    </div>`;
}

function viewReflections() {
  setNav("reflections");
  state.currentChapter = null;
  renderSurahList($("#surah-search").value);
  const all = getReflections();
  const keys = Object.keys(all).sort((a, b) => {
    const [ca, va] = a.split(":").map(Number), [cb, vb] = b.split(":").map(Number);
    return ca - cb || va - vb;
  });
  const chapterName = (id) => {
    const c = state.chapters.find((c) => c.id === Number(id));
    return c ? c.name_simple : `Surah ${id}`;
  };
  main.innerHTML = `
    <div class="container">
      <h1 class="page-title">Journal</h1>
      <p class="page-sub">Your tadabbur reflections. Notes are stored only on this device.</p>
      ${keys.length ? `<p><button class="btn-primary" id="export-md">${ICONS.download} Download as Markdown</button></p>` : ""}
      ${keys.length ? keys.map((k) => {
        const [c, v] = k.split(":");
        return all[k].map((n) => `
          <div class="note-item" data-key="${k}" data-t="${n.t}">
            <div class="meta">
              <a href="#/surah/${c}?verse=${v}">${esc(chapterName(c))} ${k}</a>
              <span>${new Date(n.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · <button class="del">delete</button></span>
            </div>
            ${n.prompt ? `<div class="prompt">${esc(n.prompt)}</div>` : ""}
            <div class="text">${esc(n.text)}</div>
          </div>`).join("");
      }).join("") : `<div class="empty">No reflections yet. Open any verse and press <strong>Reflect</strong> to begin your tadabbur journal.</div>`}
    </div>`;
  main.querySelectorAll(".note-item .del").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".note-item");
      deleteReflection(item.dataset.key, Number(item.dataset.t));
      viewReflections();
    });
  });
  const exportBtn = $("#export-md");
  if (exportBtn) exportBtn.addEventListener("click", () => {
    const lines = ["# Tadabbur journal", ""];
    keys.forEach((k) => {
      const [c] = k.split(":");
      lines.push(`## ${chapterName(c)} ${k}`, "");
      all[k].forEach((n) => {
        lines.push(`*${new Date(n.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}*`);
        if (n.prompt) lines.push(`> ${n.prompt}`);
        lines.push("", n.text, "");
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tadabbur-journal.md";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function viewBookmarks() {
  setNav("bookmarks");
  state.currentChapter = null;
  renderSurahList($("#surah-search").value);
  const all = getBookmarks();
  const keys = Object.keys(all).sort((a, b) => {
    const [ca, va] = a.split(":").map(Number), [cb, vb] = b.split(":").map(Number);
    return ca - cb || va - vb;
  });
  const chapterName = (id) => state.chapters.find((c) => c.id === Number(id))?.name_simple || `Surah ${id}`;
  main.innerHTML = `
    <div class="container">
      <h1 class="page-title">Bookmarks</h1>
      <p class="page-sub">Verses you have saved. Stored only on this device.</p>
      ${keys.length ? keys.map((k) => {
        const [c, v] = k.split(":");
        const bm = all[k];
        return `
        <div class="bm-item" data-key="${k}">
          <span class="verse-key"><i>${k}</i></span>
          <div class="bm-body">
            ${bm.arabic ? `<div class="bm-arabic">${bm.arabic}</div>` : ""}
            ${bm.tr ? `<div class="bm-tr">${esc(bm.tr)}</div>` : ""}
            <div class="bm-actions">
              <a href="#/surah/${c}?verse=${v}">Open in ${esc(chapterName(c))}</a>
              <button class="bm-remove">Remove</button>
            </div>
          </div>
        </div>`;
      }).join("") : `<div class="empty">No bookmarks yet. Press <strong>Save</strong> on any verse to keep it here.</div>`}
    </div>`;
  main.querySelectorAll(".bm-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleBookmark(btn.closest(".bm-item").dataset.key, null);
      viewBookmarks();
    });
  });
}

async function viewSearch(query) {
  setNav("");
  state.currentChapter = null;
  renderSurahList($("#surah-search").value);
  const q = query.trim();
  main.innerHTML = `
    <div class="container">
      <h1 class="page-title">Search</h1>
      <p class="page-sub">Verses matching “${esc(q)}” across translations</p>
      <div id="search-results"></div>
      <div id="search-more"></div>
    </div>`;
  if (!q) { $("#search-results").innerHTML = `<div class="empty">Type a word or phrase in the sidebar and press Enter.</div>`; return; }

  let page = 1;
  const resultCard = (v) => {
    const arabic = (v.words || []).map((w) => w.text).join(" ");
    const tr = (v.translations || [])[0];
    const [c, vn] = v.verse_key.split(":");
    return `
    <a class="search-hit" href="#/surah/${c}?verse=${vn}">
      <span class="verse-key"><i>${v.verse_key}</i></span>
      <div class="hit-body">
        <div class="hit-arabic">${arabic}</div>
        ${tr ? `<div class="hit-tr">${sanitize(tr.text)}<span class="t-author">— ${esc(tr.resource_name || "")}</span></div>` : ""}
      </div>
    </a>`;
  };
  const loadPage = async () => {
    $("#search-more").innerHTML = loadingHTML("Searching…");
    try {
      const data = await getJSON(`${API}/search?q=${encodeURIComponent(q)}&size=20&page=${page}`);
      const verses = data.result?.verses || [];
      const pag = data.pagination || {};
      if (page === 1 && !verses.length) {
        $("#search-results").innerHTML = `<div class="empty">No verses found for “${esc(q)}”. Try a different word or phrase.</div>`;
        $("#search-more").innerHTML = "";
        return;
      }
      if (page === 1) {
        $("#search-results").insertAdjacentHTML("afterbegin",
          `<p class="page-sub">${pag.total_records || verses.length} result${(pag.total_records || 0) === 1 ? "" : "s"}</p>`);
      }
      $("#search-results").insertAdjacentHTML("beforeend", verses.map(resultCard).join(""));
      if (pag.next_page) {
        $("#search-more").innerHTML = `<button class="btn-primary" id="search-load-more">Load more</button>`;
        $("#search-load-more").addEventListener("click", () => { page++; loadPage(); });
      } else {
        $("#search-more").innerHTML = "";
      }
    } catch (e) {
      $("#search-more").innerHTML = errorHTML(e.message);
    }
  };
  loadPage();
}

async function viewSurah(chapterId, targetVerse) {
  setNav("");
  state.currentChapter = chapterId;
  renderSurahList($("#surah-search").value);
  const chapter = state.chapters.find((c) => c.id === chapterId);
  if (!chapter) { main.innerHTML = `<div class="container">${errorHTML("surah not found")}</div>`; return; }
  state.pendingTarget = targetVerse ? Number(targetVerse) : null;
  localStorage.setItem("qur.lastRead", JSON.stringify({
    chapter: chapterId, name: chapter.name_simple, verse: Number(targetVerse) || 1,
  }));
  const visited = JSON.parse(localStorage.getItem("qur.visited") || "[]");
  if (!visited.includes(chapterId)) {
    visited.push(chapterId);
    localStorage.setItem("qur.visited", JSON.stringify(visited));
  }
  const nak = (await loadNAK())[String(chapterId)] || null;
  if (state.currentChapter !== chapterId) return;

  main.innerHTML = `
    <div class="container">
      <div class="surah-header">
        <span class="header-star">۞</span>
        <div class="arabic-name">${chapter.name_arabic}</div>
        <h1>${esc(chapter.name_simple)}</h1>
        <p class="tname">${esc(chapter.translated_name.name)}</p>
        <div class="chips">
          <span class="chip ${chapter.revelation_place}">${chapter.revelation_place === "makkah" ? "Makkan" : "Madinan"}</span>
          <span class="chip">${chapter.verses_count} verses</span>
          <span class="chip">Revelation order: ${chapter.revelation_order} of 114</span>
        </div>
      </div>
      <details class="context-box" id="context-box">
        <summary>${ICONS.arch} Historical context &amp; themes</summary>
        <div class="context-body" id="context-body">${loadingHTML("Loading background…")}</div>
      </details>
      ${nak ? `
      <details class="context-box" id="nak-box">
        <summary>${ICONS.video} Video insights — Nouman Ali Khan</summary>
        <div class="context-body">
          <div class="nak-grid">
            ${nak.playlists.map((p) => `
            <div class="nak-card" data-list="${esc(p.list)}" role="button" tabindex="0">
              <div class="nak-thumb nak-thumb-series"><span class="nak-play">${ICONS.play}</span></div>
              <div class="nak-title"><span class="nak-t">${esc(p.t)}</span><span class="nak-kind">Full series</span></div>
            </div>`).join("")}
            ${nak.videos.slice(0, 9).map((v) => `
            <div class="nak-card" data-vid="${esc(v.id)}" role="button" tabindex="0">
              <div class="nak-thumb"><img loading="lazy" src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" /><span class="nak-play">${ICONS.play}</span></div>
              <div class="nak-title"><span class="nak-t">${esc(v.t.split("|")[0].trim())}</span></div>
            </div>`).join("")}
          </div>
          <div class="source-note">Lectures by Ustadh Nouman Ali Khan — played from the official Bayyinah YouTube channel. Content stays on YouTube; only titles are indexed here.</div>
        </div>
      </details>` : ""}
      <div class="btv-card" id="btv-card">
        <div>
          <div class="label">Bayyinah TV · your subscription</div>
          <div class="name">Study ${esc(chapter.name_simple)} in the full Deeper Look library</div>
        </div>
        <button id="btv-open">Copy name &amp; open ↗</button>
      </div>
      <div class="toolbar">
        <label for="tr-select">Translation</label>
        <select id="tr-select">
          ${TRANSLATIONS.map((t) => `<option value="${t.id}" ${t.id === state.translationId ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
        </select>
        <button id="wbw-toggle" class="toggle-btn ${state.wbw ? "on" : ""}">Word by Word</button>
        <button id="pref-btn" class="toggle-btn" title="Reading preferences">Aa</button>
      </div>
      ${chapter.bismillah_pre ? `<div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</div>` : ""}
      <div id="verses">${loadingHTML(`Loading ${chapter.verses_count} verses…`)}</div>
      <div id="verses-more"></div>
    </div>`;

  // lazy-load historical context on first open
  const ctxBox = $("#context-box");
  let ctxLoaded = false;
  ctxBox.addEventListener("toggle", async () => {
    if (!ctxBox.open || ctxLoaded) return;
    ctxLoaded = true;
    try {
      const info = await loadChapterInfo(chapterId);
      $("#context-body").innerHTML = `
        <div class="prose">${sanitize(info.text)}</div>
        <div class="source-note">Source: ${esc(info.source || "Quran.com")}</div>`;
    } catch (e) {
      $("#context-body").innerHTML = errorHTML(e.message);
      ctxLoaded = false;
    }
  });

  $("#btv-open").addEventListener("click", async (e) => {
    const name = `Surah ${chapter.name_simple}`;
    try {
      await navigator.clipboard.writeText(name);
      e.target.textContent = `“${name}” copied — paste it in Bayyinah TV's search`;
    } catch {
      e.target.textContent = `Search “${name}” on Bayyinah TV`;
    }
    window.open("https://bayyinah.tv/", "_blank", "noopener");
  });

  const nakBox = $("#nak-box");
  if (nakBox) {
    const embed = (card) => {
      const src = card.dataset.vid
        ? `https://www.youtube-nocookie.com/embed/${card.dataset.vid}?autoplay=1`
        : `https://www.youtube-nocookie.com/embed/videoseries?list=${card.dataset.list}&autoplay=1`;
      card.classList.add("playing");
      card.querySelector(".nak-thumb").outerHTML =
        `<iframe class="nak-frame" src="${src}" title="YouTube video player" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    };
    nakBox.querySelectorAll(".nak-card").forEach((card) => {
      card.addEventListener("click", () => { if (!card.classList.contains("playing")) embed(card); });
      card.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && !card.classList.contains("playing")) {
          e.preventDefault();
          embed(card);
        }
      });
    });
  }

  $("#tr-select").addEventListener("change", (e) => {
    state.translationId = Number(e.target.value);
    localStorage.setItem("qur.translation", state.translationId);
    renderVerses(chapterId);
  });
  $("#wbw-toggle").addEventListener("click", (e) => {
    state.wbw = !state.wbw;
    localStorage.setItem("qur.wbw", state.wbw ? "1" : "0");
    e.target.classList.toggle("on", state.wbw);
    renderVerses(chapterId);
  });
  $("#pref-btn").addEventListener("click", openSettings);

  if (state.verseCache.has(chapterId)) {
    renderVerses(chapterId);
    tryScrollTarget(chapterId);
    return;
  }

  // Progressive load: render the first page immediately, stream in the rest.
  state.partial = { chapterId, verses: [] };
  let page = 1, totalPages = 1;
  try {
    do {
      const data = await getJSON(versePageURL(chapterId, page));
      if (state.currentChapter !== chapterId) return; // user navigated away mid-load
      state.partial.verses.push(...data.verses);
      totalPages = data.pagination.total_pages;
      if (page === 1) renderVerses(chapterId);
      else appendVerses(chapterId, data.verses);
      setLoadingMore(page < totalPages
        ? `Loading verses… ${state.partial.verses.length} / ${data.pagination.total_records}` : "");
      tryScrollTarget(chapterId);
      page++;
    } while (page <= totalPages);
    state.verseCache.set(chapterId, state.partial.verses);
    state.partial = null;
  } catch (e) {
    const box = $("#verses");
    if (box && state.currentChapter === chapterId) {
      if (versesFor(chapterId).length) setLoadingMore("");
      else box.innerHTML = "";
      $("#verses-more").innerHTML = errorHTML(e.message);
    }
  }
}

function setLoadingMore(msg) {
  const el = $("#verses-more");
  if (el) el.innerHTML = msg ? `<div class="loading"><div class="spinner"></div>${esc(msg)}</div>` : "";
}

function tryScrollTarget(chapterId) {
  if (!state.pendingTarget) return;
  const el = document.getElementById(`v-${chapterId}-${state.pendingTarget}`);
  if (!el) return;
  state.pendingTarget = null;
  // Instant, not smooth: streaming in later pages cancels an in-flight smooth scroll.
  el.scrollIntoView({ block: "start", behavior: "instant" });
  el.classList.add("targeted");
  setTimeout(() => el.classList.remove("targeted"), 4000);
}

function verseCardHTML(chapterId, v, notes, trMeta, bookmarks) {
  const tr = (v.translations || []).find((t) => t.resource_id === state.translationId);
  const translit = state.prefs.translit ? (v.translations || []).find((t) => t.resource_id === TRANSLIT_ID) : null;
  const words = (v.words || []).filter((w) => w.char_type_name === "word");
  const bm = !!bookmarks[v.verse_key];
  return `
  <article class="verse-card" id="v-${chapterId}-${v.verse_number}" data-key="${v.verse_key}" data-vnum="${v.verse_number}">
    <div class="verse-top">
      <span class="verse-key"><i>${v.verse_key}</i></span>
      <div class="verse-arabic">${v.text_uthmani}</div>
    </div>
    ${state.wbw ? `
    <div class="wbw">
      ${words.map((w) => `
        <button class="wbw-word" data-pos="${w.position}" title="Root, grammar &amp; occurrences">
          <span class="ar">${w.text_uthmani || w.text}</span>
          <span class="tr">${esc(w.transliteration?.text || "")}</span>
          <span class="gl">${esc(w.translation?.text || "")}</span>
        </button>`).join("")}
    </div>
    <div class="wbw-hint">Tap a word for its root, grammar, and other occurrences in the Quran</div>` : ""}
    ${translit ? `<div class="verse-translit">${sanitize(translit.text)}</div>` : ""}
    <div class="verse-translation">
      ${tr ? stripFootnotes(sanitize(tr.text)) : "<em>Translation unavailable</em>"}
      <span class="t-author">— ${esc(trMeta.name)}</span>
    </div>
    <div class="verse-actions">
      <button class="va-btn act-play" title="Play recitation">${ICONS.play}<span>Listen</span></button>
      <button class="va-btn act-tafsir">${ICONS.book}<span>Tafsir</span></button>
      <button class="va-btn act-reflect ${notes[v.verse_key] ? "has-note" : ""}">${ICONS.leaf}<span>Reflect${notes[v.verse_key] ? ` (${notes[v.verse_key].length})` : ""}</span></button>
      <button class="va-btn act-bookmark ${bm ? "bookmarked" : ""}">${bm ? ICONS.bookmarkFill : ICONS.bookmark}<span>${bm ? "Saved" : "Save"}</span></button>
    </div>
  </article>`;
}

function bindVerseCard(card, chapterId) {
  const key = card.dataset.key;
  card.querySelector(".act-play").addEventListener("click", () => togglePlay(key, card));
  card.querySelector(".act-tafsir").addEventListener("click", () => openTafsir(key));
  card.querySelector(".act-reflect").addEventListener("click", () => openReflect(key));
  card.querySelector(".act-bookmark").addEventListener("click", (e) => {
    const verse = versesFor(chapterId).find((v) => v.verse_key === key);
    const on = toggleBookmark(key, verse);
    const btn = e.currentTarget;
    btn.classList.toggle("bookmarked", on);
    btn.innerHTML = `${on ? ICONS.bookmarkFill : ICONS.bookmark}<span>${on ? "Saved" : "Save"}</span>`;
  });
  card.querySelectorAll(".wbw-word").forEach((btn) => {
    btn.addEventListener("click", () =>
      openMorph(chapterId, Number(card.dataset.vnum), Number(btn.dataset.pos), btn));
  });
  positionObserver().observe(card);
}

/* Track the topmost visible verse so reading position survives reloads. */
let verseObserver = null;
const visibleVerses = new Set();
function positionObserver() {
  if (!verseObserver) {
    verseObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const vn = Number(en.target.dataset.vnum);
        if (en.isIntersecting) visibleVerses.add(vn);
        else visibleVerses.delete(vn);
      });
      if (!visibleVerses.size || !state.currentChapter) return;
      const chapter = state.chapters.find((c) => c.id === state.currentChapter);
      if (!chapter) return;
      localStorage.setItem("qur.lastRead", JSON.stringify({
        chapter: state.currentChapter, name: chapter.name_simple, verse: Math.min(...visibleVerses),
      }));
    }, { rootMargin: "-15% 0px -55% 0px" });
  }
  return verseObserver;
}
function resetPositionObserver() {
  if (verseObserver) verseObserver.disconnect();
  visibleVerses.clear();
}

function renderVerses(chapterId) {
  const verses = versesFor(chapterId);
  const trMeta = TRANSLATIONS.find((t) => t.id === state.translationId);
  const notes = getReflections();
  const bookmarks = getBookmarks();
  resetPositionObserver();
  $("#verses").innerHTML = verses.map((v) => verseCardHTML(chapterId, v, notes, trMeta, bookmarks)).join("");
  $("#verses").querySelectorAll(".verse-card").forEach((card) => bindVerseCard(card, chapterId));
}

function appendVerses(chapterId, newVerses) {
  const box = $("#verses");
  if (!box) return;
  const trMeta = TRANSLATIONS.find((t) => t.id === state.translationId);
  const notes = getReflections();
  const bookmarks = getBookmarks();
  const frag = document.createElement("div");
  frag.innerHTML = newVerses.map((v) => verseCardHTML(chapterId, v, notes, trMeta, bookmarks)).join("");
  [...frag.children].forEach((card) => {
    bindVerseCard(card, chapterId);
    box.appendChild(card);
  });
}

/* ---------- audio ---------- */
function togglePlay(verseKey, card) {
  const btn = card.querySelector(".act-play");
  if (state.playingKey === verseKey && !player.paused) {
    player.pause();
    return;
  }
  const [c, v] = verseKey.split(":").map(Number);
  const pad = (n) => String(n).padStart(3, "0");
  player.src = `${AUDIO_BASE}Alafasy/mp3/${pad(c)}${pad(v)}.mp3`;
  state.playingKey = verseKey;
  const setPlayLabel = (b) => (b.innerHTML = `${ICONS.play}<span>Listen</span>`);
  document.querySelectorAll(".verse-card.playing").forEach((el) => el.classList.remove("playing"));
  document.querySelectorAll(".act-play").forEach(setPlayLabel);
  card.classList.add("playing");
  btn.innerHTML = `${ICONS.pause}<span>Pause</span>`;
  player.play().catch(() => { setPlayLabel(btn); card.classList.remove("playing"); });
}
player.addEventListener("pause", () => {
  document.querySelectorAll(".verse-card.playing").forEach((el) => el.classList.remove("playing"));
  document.querySelectorAll(".act-play").forEach((b) => (b.innerHTML = `${ICONS.play}<span>Listen</span>`));
});
player.addEventListener("ended", () => {
  const key = state.playingKey;
  state.playingKey = null;
  if (!key) return;
  const [c, v] = key.split(":").map(Number);
  const nextCard = document.querySelector(`.verse-card[data-key="${c}:${v + 1}"]`);
  if (nextCard) {
    nextCard.scrollIntoView({ block: "center", behavior: "smooth" });
    togglePlay(`${c}:${v + 1}`, nextCard);
  }
});

/* ---------- drawer ---------- */
const drawer = $("#drawer");
function openDrawer(titleHTML) {
  $("#drawer-title").innerHTML = titleHTML;
  $("#drawer-body").innerHTML = "";
  drawer.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeDrawer() {
  drawer.hidden = true;
  document.body.style.overflow = "";
}
$("#drawer-close").addEventListener("click", closeDrawer);
drawer.addEventListener("click", (e) => { if (e.target === drawer) closeDrawer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });

async function openTafsir(verseKey) {
  openDrawer(`<h2>Tafsir — ${verseKey}</h2><span class="sub">Commentary from classical &amp; modern scholars</span>`);
  const body = $("#drawer-body");
  body.innerHTML = `
    <div class="tabs">
      ${TAFSIRS.map((t, i) => `<button class="tab ${i === 0 ? "active" : ""}" data-id="${t.id}">${esc(t.name)}</button>`).join("")}
    </div>
    <div id="tafsir-content"></div>`;
  const show = async (tafsirId) => {
    const meta = TAFSIRS.find((t) => t.id === tafsirId);
    const box = $("#tafsir-content");
    box.innerHTML = loadingHTML(`Loading ${meta.name}…`);
    try {
      const html = await loadTafsir(tafsirId, verseKey);
      box.innerHTML = html
        ? `<div class="prose">${sanitize(html)}</div><div class="source-note">${esc(meta.name)} — ${esc(meta.author)}</div>`
        : `<div class="empty">${esc(meta.name)} discusses this verse as part of a nearby passage — try the adjacent verses.</div>`;
    } catch (e) {
      box.innerHTML = errorHTML(e.message);
    }
  };
  body.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      body.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      show(Number(tab.dataset.id));
    });
  });
  show(TAFSIRS[0].id);
}

/* ---------- reading preferences ---------- */
function openSettings() {
  openDrawer(`<h2>Reading preferences</h2><span class="sub">Applied everywhere, saved on this device</span>`);
  const body = $("#drawer-body");
  const p = state.prefs;
  const chips = (pref, options) => `
    <div class="pref-chips" data-pref="${pref}">
      ${options.map(([val, label]) =>
        `<button class="tab ${String(p[pref]) === val ? "active" : ""}" data-val="${val}">${label}</button>`).join("")}
    </div>`;
  body.innerHTML = `
    <div class="pref-group">
      <div class="pref-label">Arabic text size</div>
      <input type="range" id="pref-size" min="1.4" max="3" step="0.1" value="${p.arabicSize}" />
      <div class="pref-preview">بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ</div>
    </div>
    <div class="pref-group">
      <div class="pref-label">Transliteration</div>
      ${chips("translit", [["false", "Hidden"], ["true", "Shown"]])}
    </div>
    <div class="pref-group">
      <div class="pref-label">Display</div>
      ${chips("mode", [["both", "Arabic &amp; translation"], ["arabic", "Arabic only"], ["translation", "Translation only"]])}
    </div>
    <div class="pref-group">
      <div class="pref-label">Theme</div>
      ${chips("theme", [["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]])}
    </div>
    <div class="pref-group">
      <div class="pref-label">Bayyinah TV</div>
      ${chips("bayyinah", [["false", "Not a subscriber"], ["true", "Subscriber — show handoff links"]])}
      <p class="pref-note">If you subscribe to <a href="https://bayyinah.tv" target="_blank" rel="noopener">bayyinah.tv</a>, each surah gets a shortcut that copies the surah name and opens Bayyinah TV so you can jump straight to Ustadh Nouman's full Deeper Look. Sign-in and playback stay on their site.</p>
    </div>`;

  $("#pref-size", body).addEventListener("input", (e) => {
    state.prefs.arabicSize = Number(e.target.value);
    savePrefs();
    applyPrefs();
  });
  body.querySelectorAll(".pref-chips").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-val]");
      if (!btn) return;
      const pref = group.dataset.pref;
      const val = btn.dataset.val;
      state.prefs[pref] = (pref === "translit" || pref === "bayyinah") ? val === "true" : val;
      savePrefs();
      applyPrefs();
      group.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
      if (pref === "translit" && state.currentChapter) renderVerses(state.currentChapter);
    });
  });
}

/* ---------- morphology (Quranic Arabic Corpus data, bundled) ---------- */
const TAG_NAMES = { N: "Noun", V: "Verb", P: "Particle" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const FEAT_NAMES = {
  PREF: "prefix", SUFF: "suffix", PRON: "pronoun", DET: "definite article",
  CONJ: "conjunction", NEG: "negation", REL: "relative pronoun", DEM: "demonstrative",
  COND: "conditional", INDEF: "indefinite", EMPH: "emphatic", PN: "proper noun",
  ADJ: "adjective", T: "time adverb", LOC: "location adverb", REM: "resumption",
  ACC: "accusative", GEN: "genitive", NOM: "nominative",
  PERF: "perfect (past)", IMPF: "imperfect (present)", IMPV: "imperative",
  PASS: "passive", ACT_PCPL: "active participle", PASS_PCPL: "passive participle",
  VN: "verbal noun", M: "masculine", F: "feminine", S: "singular", D: "dual", P: "plural",
  MS: "masc. singular", MP: "masc. plural", MD: "masc. dual",
  FS: "fem. singular", FP: "fem. plural", FD: "fem. dual",
  "1S": "1st person sing.", "1P": "1st person pl.", "1D": "1st person dual",
  "2MS": "2nd masc. sing.", "2MP": "2nd masc. pl.", "2MD": "2nd masc. dual",
  "2FS": "2nd fem. sing.", "2FP": "2nd fem. pl.", "2FD": "2nd fem. dual", "2D": "2nd person dual",
  "3MS": "3rd masc. sing.", "3MP": "3rd masc. pl.", "3MD": "3rd masc. dual",
  "3FS": "3rd fem. sing.", "3FP": "3rd fem. pl.", "3FD": "3rd fem. dual", "3D": "3rd person dual",
  INTG: "interrogative", EXH: "exhortation", FUT: "future", CERT: "certainty",
  RES: "restriction", SUP: "supplemental", PRO: "prohibition", CIRC: "circumstantial",
  COM: "comitative", CAUS: "cause", EXP: "exceptive", INC: "inceptive",
  INT: "interpretation", PREV: "preventive", ANS: "answer", RET: "retraction",
  AVR: "aversion", EQ: "equalization", SUR: "surprise", VOC: "vocative",
  AMD: "amendment", EXL: "explanation", IMPN: "imperative verbal noun",
};
function featName(tok) {
  if (tok.startsWith("VF:")) return `Form ${ROMAN[Number(tok.slice(3))] || tok.slice(3)}`;
  if (tok.startsWith("MOOD:")) return { IND: "indicative", JUS: "jussive", SUBJ: "subjunctive" }[tok.slice(5)] || tok.slice(5).toLowerCase();
  if (tok.startsWith("FAM:")) return `${tok.slice(4)} family`;
  return FEAT_NAMES[tok] || tok.toLowerCase();
}

async function openMorph(chapterId, verseNum, pos, wordBtn) {
  const wordAr = wordBtn.querySelector(".ar")?.textContent || "";
  const wordTr = wordBtn.querySelector(".tr")?.textContent || "";
  const wordGl = wordBtn.querySelector(".gl")?.textContent || "";
  const loc = `${chapterId}:${verseNum}:${pos}`;
  openDrawer(`<h2>Word — ${loc}</h2><span class="sub">Morphology from the Quranic Arabic Corpus</span>`);
  const body = $("#drawer-body");
  body.innerHTML = loadingHTML("Loading analysis…");
  let segs = [];
  try {
    const morph = await loadMorph(chapterId);
    segs = morph[`${verseNum}:${pos}`] || [];
  } catch {
    body.innerHTML = errorHTML("morphology data missing — make sure the data/ folder is served with the app");
    return;
  }
  let root = null, lemma = null;
  const segRows = segs.map(([text, tag, feats]) => {
    const chips = [];
    feats.split("|").forEach((tok) => {
      if (tok.startsWith("ROOT:")) { root = tok.slice(5); return; }
      if (tok.startsWith("LEM:")) { lemma = tok.slice(4); return; }
      chips.push(featName(tok));
    });
    return `
    <div class="seg">
      <span class="seg-ar">${esc(text)}</span>
      <span class="seg-tag">${TAG_NAMES[tag] || esc(tag)}</span>
      <span class="seg-feats">${chips.map((c) => `<i>${esc(c)}</i>`).join("")}</span>
    </div>`;
  }).join("");

  body.innerHTML = `
    <div class="word-hero">
      <span class="ar">${esc(wordAr)}</span>
      <span class="tr">${esc(wordTr)}</span>
      <span class="gl">${esc(wordGl)}</span>
    </div>
    ${lemma ? `<div class="morph-row"><span class="morph-label">Lemma</span><span class="morph-ar">${esc(lemma)}</span></div>` : ""}
    ${root ? `<div class="morph-row"><span class="morph-label">Root</span><span class="morph-ar">${esc(root)}</span></div>` : ""}
    <h3 class="drawer-section">Segments</h3>
    ${segRows || `<div class="empty">No analysis available for this word.</div>`}
    ${root ? `<h3 class="drawer-section">The root ${esc(root)} across the Quran</h3><div id="root-occ">${loadingHTML("Loading senses and occurrences…")}</div>` : ""}
    <div class="source-note">
      Analysis: Quranic Arabic Corpus (University of Leeds), bundled with this app ·
      <a href="https://corpus.quran.com/wordmorphology.jsp?location=(${loc})" target="_blank" rel="noopener">full analysis at corpus.quran.com</a>
    </div>`;

  if (!root) return;
  try {
    const [roots, meaningsIndex] = await Promise.all([loadRoots(), loadMeanings()]);
    const occ = roots[root] || [];
    const meanings = meaningsIndex[root] || [];
    const occMap = new Map(); // verseKey -> [word positions bearing the root]
    occ.forEach((l) => {
      const [oc, ov, ow] = l.split(":");
      const k = `${oc}:${ov}`;
      if (!occMap.has(k)) occMap.set(k, []);
      occMap.get(k).push(Number(ow));
    });
    const verseKeys = [...occMap.keys()];
    const shown = verseKeys.filter((k) => k !== `${chapterId}:${verseNum}`).slice(0, 60);
    const box = $("#root-occ");
    if (!box) return;
    box.innerHTML = `
      ${meanings.length > 1 ? `
      <p class="occ-count">This root is rendered ${meanings.length} different ways in the Quran — tap a sense to see it in place:</p>
      <div class="meaning-list">
        ${meanings.map(([t, n, l]) => {
          const k = l.split(":").slice(0, 2).join(":");
          return `<button data-key="${k}" title="Example: ${k}">${esc(t)}${n > 1 ? `<i>×${n}</i>` : ""}</button>`;
        }).join("")}
      </div>` : ""}
      <p class="occ-count">${occ.length} occurrence${occ.length === 1 ? "" : "s"} in ${verseKeys.length} verse${verseKeys.length === 1 ? "" : "s"} — tap one to preview it here</p>
      <div class="occ-list">
        ${shown.map((k) => `<button data-key="${k}">${k}</button>`).join("")}
        ${verseKeys.length - 1 > shown.length ? `<span class="occ-more">+ ${verseKeys.length - 1 - shown.length} more</span>` : ""}
      </div>
      <div id="occ-preview"></div>`;
    box.querySelectorAll(".meaning-list button, .occ-list button").forEach((btn) => {
      btn.addEventListener("click", () =>
        showOccPreview(btn.dataset.key, occMap.get(btn.dataset.key) || [], box));
    });
  } catch {
    const box = $("#root-occ");
    if (box) box.innerHTML = errorHTML("could not load the root index");
  }
}

/* Inline verse preview inside the morphology drawer: shows the occurrence
 * with the root-bearing word highlighted in the Arabic, its word-by-word
 * gloss, and (where it can be matched) the phrase highlighted in the
 * translation too — all without leaving the current page. */
function markGlossInTranslation(html, glosses) {
  let marked = false;
  for (const g of glosses) {
    const cleaned = g.replace(/\([^)]*\)/g, "").trim();
    if (cleaned.length < 3) continue;
    const pattern = cleaned.split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s-]+");
    const re = new RegExp(pattern, "i");
    if (re.test(html)) {
      html = html.replace(re, (m) => `<mark class="occ-hit-en">${m}</mark>`);
      marked = true;
    }
  }
  return { html, marked };
}

async function showOccPreview(key, positions, container) {
  container.querySelectorAll(".meaning-list button, .occ-list button").forEach((b) =>
    b.classList.toggle("active", b.dataset.key === key));
  const box = $("#occ-preview");
  if (!box) return;
  box.innerHTML = loadingHTML(`Loading ${key}…`);
  try {
    if (!state.verseKeyCache) state.verseKeyCache = new Map();
    let v = state.verseKeyCache.get(key);
    if (!v) {
      const trIds = TRANSLATIONS.map((t) => t.id).join(",");
      const data = await getJSON(`${API}/verses/by_key/${key}?language=en&words=true&word_fields=text_uthmani&word_translation_language=en&translations=${trIds}&fields=text_uthmani`);
      v = data.verse;
      state.verseKeyCache.set(key, v);
    }
    const words = (v.words || []).filter((w) => w.char_type_name === "word");
    const hits = words.filter((w) => positions.includes(w.position));
    const ar = words.map((w) => positions.includes(w.position)
      ? `<span class="occ-hit">${w.text_uthmani || w.text}</span>`
      : (w.text_uthmani || w.text)).join(" ");
    const glosses = hits.map((w) => (w.translation?.text || "").trim()).filter(Boolean);
    const tr = (v.translations || []).find((t) => t.resource_id === state.translationId) || (v.translations || [])[0];
    let trBlock = "";
    if (tr) {
      const { html } = markGlossInTranslation(stripFootnotes(sanitize(tr.text)), glosses);
      trBlock = `<div class="occ-card-tr">${html}</div>`;
    }
    const glossLine = hits.length ? `
      <div class="occ-gloss">${hits.map((w) => `<span class="occ-hit">${w.text_uthmani || w.text}</span><em>“${esc((w.translation?.text || "—").trim())}”</em>`).join("<span class='occ-gloss-sep'>·</span>")}</div>` : "";
    const [oc, ov] = key.split(":");
    box.innerHTML = `
      <div class="occ-card">
        <div class="occ-card-ar">${ar}</div>
        ${glossLine}
        ${trBlock}
        <div class="occ-card-actions">
          <a class="va-btn" href="#/surah/${oc}?verse=${ov}">${ICONS.book}<span>Open in ${esc(chapterNameById(oc))}</span></a>
        </div>
      </div>`;
  } catch (e) {
    box.innerHTML = errorHTML(e.message);
  }
}

function openReflect(verseKey) {
  const [c] = verseKey.split(":").map(Number);
  const verse = versesFor(c).find((v) => v.verse_key === verseKey) ||
    (state.votd && state.votd.key === verseKey
      ? { text_uthmani: state.votd.arabic, translations: [{ resource_id: state.translationId, text: state.votd.tr }] }
      : null);
  const tr = verse ? (verse.translations || []).find((t) => t.resource_id === state.translationId) : null;
  let prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  openDrawer(`<h2>Tadabbur — ${verseKey}</h2><span class="sub">Pause. Reflect. Write it down.</span>`);
  const body = $("#drawer-body");

  const render = () => {
    const notes = getReflections()[verseKey] || [];
    body.innerHTML = `
      ${verse ? `
      <div class="reflect-verse">
        <div class="ar">${verse.text_uthmani}</div>
        ${tr ? `<div class="tr">${stripFootnotes(sanitize(tr.text))}</div>` : ""}
      </div>` : ""}
      <div class="prompt-box">
        <p id="prompt-text">${esc(prompt)}</p>
        <button id="new-prompt" title="New prompt">${ICONS.refresh}</button>
      </div>
      <div class="reflect-form">
        <textarea id="reflect-text" placeholder="Write your reflection… (saved privately on this device)"></textarea>
        <button class="btn-primary" id="reflect-save">Save reflection</button>
      </div>
      ${notes.length ? `
      <div class="note-list">
        ${notes.slice().reverse().map((n) => `
          <div class="note-item" data-t="${n.t}">
            <div class="meta">
              <span>${new Date(n.t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <button class="del">delete</button>
            </div>
            ${n.prompt ? `<div class="prompt">${esc(n.prompt)}</div>` : ""}
            <div class="text">${esc(n.text)}</div>
          </div>`).join("")}
      </div>` : ""}`;

    $("#new-prompt", body).addEventListener("click", () => {
      let next;
      do { next = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]; } while (next === prompt && PROMPTS.length > 1);
      prompt = next;
      $("#prompt-text", body).textContent = prompt;
    });
    $("#reflect-save", body).addEventListener("click", () => {
      const text = $("#reflect-text", body).value.trim();
      if (!text) return;
      saveReflection(verseKey, prompt, text);
      render();
      if (state.currentChapter) renderVerses(state.currentChapter);
    });
    body.querySelectorAll(".note-item .del").forEach((btn) => {
      btn.addEventListener("click", () => {
        deleteReflection(verseKey, Number(btn.closest(".note-item").dataset.t));
        render();
        if (state.currentChapter) renderVerses(state.currentChapter);
      });
    });
  };
  render();
}

/* ---------- routing ---------- */
function route() {
  closeDrawer();
  document.body.classList.remove("sidebar-open");
  const hash = location.hash.replace(/^#\/?/, "");
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");
  const m = path.match(/^surah\/(\d+)/);
  if (m) {
    const id = Number(m[1]);
    if (id >= 1 && id <= 114) { viewSurah(id, params.get("verse")); return; }
  }
  if (path === "reflections") { viewReflections(); return; }
  if (path === "bookmarks") { viewBookmarks(); return; }
  if (path === "sources") { viewSources(); return; }
  if (path === "search") { viewSearch(params.get("q") || ""); return; }
  viewHome();
}

/* ---------- boot ---------- */
async function init() {
  $("#surah-search").addEventListener("input", (e) => renderSurahList(e.target.value));
  $("#surah-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.value.trim()) {
      location.hash = `#/search?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  });
  $("#sidebar-toggle").addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  $("#scrim").addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  $("#sidebar").addEventListener("click", (e) => {
    if (e.target.closest("a")) document.body.classList.remove("sidebar-open");
  });
  window.addEventListener("hashchange", route);
  applyPrefs();
  trackDay();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {}); // offline is best-effort
  }
  main.innerHTML = loadingHTML("Loading surahs…");
  try {
    await loadChapters();
  } catch (e) {
    main.innerHTML = `<div class="container">${errorHTML(e.message)}</div>`;
    return;
  }
  route();
}
init();
