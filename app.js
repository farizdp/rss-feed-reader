/* ===================================================================
   PRESSROOM — editorial RSS reader
   Vanilla JS · localStorage("pressroom.v1") · rss2json · DOMPurify
   =================================================================== */
(function () {
  "use strict";

  const STORE_KEY = "pressroom.v1";
  const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
  const REMOTE_FEEDS_URL = "https://cdn.jsdelivr.net/gh/farizdp/web-data-store@main/warta-rss/feeds.json";
  const REMOTE_FEEDS_URL_FALLBACK = "https://raw.githubusercontent.com/farizdp/web-data-store/main/warta-rss/feeds.json";

  /* ---- category color palette ---- */
  const PALETTE = [
    "#FF3366", "#0066FF", "#0F5132", "#FFD600",
    "#C026D3", "#EA580C", "#0891B2", "#65A30D",
  ];

  /* ---- default seed ---- */
  function seed() {
    return {
      categories: [
        { id: "c-tech", name: "Teknologi", color: "#0066FF" },
        { id: "c-design", name: "Desain", color: "#FF3366" },
      ],
      feeds: [
        { id: "f-verge", url: "https://www.theverge.com/rss/index.xml", name: "The Verge", category: "c-tech", error: null },
        { id: "f-ars", url: "https://feeds.arstechnica.com/arstechnica/index", name: "Ars Technica", category: "c-tech", error: null },
        { id: "f-smashing", url: "https://www.smashingmagazine.com/feed/", name: "Smashing Magazine", category: "c-design", error: null },
      ],
      read: [],
      starred: [],
      lang: "id",
      theme: "light",
      version: 1,
    };
  }

  /* ---- state ---- */
  let store = load();
  let posts = [];                 // flattened, fetched this session
  let activeView = "all";         // 'all' | 'unread' | 'starred' | category id
  let loadingFeeds = new Set();   // feed ids currently fetching
  let editingFeedId = null;       // feed modal edit mode
  let editingCatId = null;        // cat modal edit mode
  let pendingPreview = null;      // validated feed preview before save

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return seed();
      const d = JSON.parse(raw);
      if (!d.feeds || !d.categories) return seed();
      d.read = d.read || [];
      d.starred = d.starred || [];
      d.lang = d.lang || "id";
      d.theme = d.theme || "light";
      return d;
    } catch (e) { return seed(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
  }

  /* ===================================================================
     I18N — bilingual UI (Indonesian / English)
     =================================================================== */
  const I18N = {
    id: {
      refresh: "Segarkan", loading: "Memuat…", views: "Tampilan", categories: "Kategori",
      new_short: "+ Baru", add_feed: "Tambah Feed", f_url: "URL Feed RSS",
      f_url_hint: "Tempel URL RSS/Atom, lalu kami validasi.", f_name: "Nama Kustom",
      optional: "(opsional)", f_name_ph: "Otomatis dari feed", category: "Kategori",
      f_newcat_name: "Nama kategori baru", newcat_ph: "mis. Sains", cancel: "Batal",
      save_feed: "Simpan Feed", save: "Simpan", name: "Nama", color: "Warna", delete: "Hapus",
      cat_ph: "mis. Politik", uncategorized: "Tanpa kategori", no_cats: "Belum ada kategori.",
      untitled: "(Tanpa judul)", general: "Umum", by: "Oleh", read_original: "Baca artikel asli",
      no_preview: "Pratinjau penuh tidak tersedia untuk feed ini. Buka artikel asli untuk membaca selengkapnya.",
      title_all: "Semua Cerita", title_unread: "Belum Dibaca", title_starred: "Berbintang", title_story: "Cerita",
      sv_all: "Semua", sv_unread: "Belum dibaca", sv_starred: "Berbintang",
      empty_title: "Mejanya masih kosong.",
      empty_body: "Tambahkan feed RSS pertama Anda dan biarkan kisah-kisah terbaik mengalir ke meja redaksi.",
      empty_cta: "+ Tambah feed pertama", quiet_title: "Sunyi di sini.",
      no_posts: "Tidak ada cerita di tampilan ini.", all_read: "Semua sudah dibaca. Kerja bagus!",
      no_starred: "Belum ada cerita berbintang. Tekan ★ pada kartu untuk menyimpan.",
      loading_feeds: "Memuat feed…", modal_add_feed: "Tambah Feed", modal_edit_feed: "Edit Feed",
      newcat_opt: "+ Kategori baru…", cat_new_title: "Kategori Baru", cat_edit_title: "Edit Kategori",
      validating: "Memvalidasi…", invalid_feed: "Bukan feed RSS yang valid", check_url: "Periksa kembali URL feed.",
      err_unreadable: "Feed tidak dapat dibaca", err_failed: "Gagal memuat",
      edit_feed: "✎ Edit feed", move_to_cat: "Pindah ke kategori", del_feed: "🗑 Hapus feed",
      feed_opts: "Opsi feed", edit_cat: "Edit kategori",
      feed_updated: "Feed diperbarui", feed_added: "Feed ditambahkan", feed_dup: "Feed itu sudah ada",
      feed_deleted: "Feed dihapus", cat_deleted: "Kategori dihapus", name_cat_first: "Beri nama kategori baru dulu",
      collapse_hide: "Sembunyikan panel samping", collapse_show: "Tampilkan panel samping",
      theme_dark: "Mode gelap", theme_light: "Mode terang",
      stories: (n) => n + " cerita", articles: (n) => n + " artikel", updated: (s) => "Diperbarui " + s,
      feeds_failed: (n) => n + " feed gagal dimuat — lihat titik merah di sidebar",
      confirm_del_feed: (name) => "Hapus feed “" + name + "”?",
      confirm_del_cat: (name, n) => "Hapus kategori “" + name + "”?" + (n ? " " + n + " feed akan menjadi tanpa kategori." : ""),
    },
    en: {
      refresh: "Refresh", loading: "Loading…", views: "Views", categories: "Categories",
      new_short: "+ New", add_feed: "Add Feed", f_url: "RSS Feed URL",
      f_url_hint: "Paste an RSS/Atom URL and we'll validate it.", f_name: "Custom Name",
      optional: "(optional)", f_name_ph: "Auto from feed", category: "Category",
      f_newcat_name: "New category name", newcat_ph: "e.g. Science", cancel: "Cancel",
      save_feed: "Save Feed", save: "Save", name: "Name", color: "Color", delete: "Delete",
      cat_ph: "e.g. Politics", uncategorized: "Uncategorized", no_cats: "No categories yet.",
      untitled: "(Untitled)", general: "General", by: "By", read_original: "Read the original",
      no_preview: "A full preview isn't available for this feed. Open the original article to read more.",
      title_all: "All Stories", title_unread: "Unread", title_starred: "Starred", title_story: "Stories",
      sv_all: "All", sv_unread: "Unread", sv_starred: "Starred",
      empty_title: "Your desk is empty.",
      empty_body: "Add your first RSS feed and let the best stories flow onto your newsroom desk.",
      empty_cta: "+ Add your first feed", quiet_title: "Quiet here.",
      no_posts: "No stories in this view.", all_read: "All caught up. Nice work!",
      no_starred: "No starred stories yet. Tap ★ on a card to save it.",
      loading_feeds: "Fetching feeds…", modal_add_feed: "Add Feed", modal_edit_feed: "Edit Feed",
      newcat_opt: "+ New category…", cat_new_title: "New Category", cat_edit_title: "Edit Category",
      validating: "Validating…", invalid_feed: "Not a valid RSS feed", check_url: "Double-check the feed URL.",
      err_unreadable: "Feed could not be read", err_failed: "Failed to load",
      edit_feed: "✎ Edit feed", move_to_cat: "Move to category", del_feed: "🗑 Delete feed",
      feed_opts: "Feed options", edit_cat: "Edit category",
      feed_updated: "Feed updated", feed_added: "Feed added", feed_dup: "That feed already exists",
      feed_deleted: "Feed deleted", cat_deleted: "Category deleted", name_cat_first: "Name the new category first",
      collapse_hide: "Hide side panel", collapse_show: "Show side panel",
      theme_dark: "Dark mode", theme_light: "Light mode",
      stories: (n) => n + (n === 1 ? " story" : " stories"), articles: (n) => n + (n === 1 ? " article" : " articles"),
      updated: (s) => "Updated " + s,
      feeds_failed: (n) => n + (n === 1 ? " feed" : " feeds") + " failed to load — see the red dots in the sidebar",
      confirm_del_feed: (name) => "Delete feed “" + name + "”?",
      confirm_del_cat: (name, n) => "Delete category “" + name + "”?" + (n ? " " + n + (n === 1 ? " feed" : " feeds") + " will become uncategorized." : ""),
    },
  };
  function t(key, ...args) {
    const dict = I18N[store.lang] || I18N.id;
    let v = dict[key];
    if (v === undefined) v = I18N.id[key];
    if (v === undefined) return key;
    return typeof v === "function" ? v(...args) : v;
  }

  /* ---- helpers ---- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = (s) => (s == null ? "" : String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 9);
  const catById = (id) => store.categories.find(c => c.id === id);
  const feedById = (id) => store.feeds.find(f => f.id === id);
  const postKey = (p) => p.guid || p.link || (p.title + p.pubDate);
  const isRead = (p) => store.read.includes(postKey(p));
  const isStarred = (p) => store.starred.includes(postKey(p));
  const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };
  const faviconFor = (u) => "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(domainOf(u) || u);

  /* ---- relative time (locale-aware) ---- */
  let rtf = new Intl.RelativeTimeFormat(store.lang === "en" ? "en" : "id-ID", { numeric: "auto" });
  function relTime(dateStr) {
    if (!dateStr) return "";
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) return "";
    const diff = (t - Date.now()) / 1000; // seconds, negative for past
    const abs = Math.abs(diff);
    const units = [
      ["year", 31536000], ["month", 2592000], ["week", 604800],
      ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
    ];
    for (const [unit, s] of units) {
      if (abs >= s || unit === "second") return rtf.format(Math.round(diff / s), unit);
    }
    return "";
  }

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }
  function excerptOf(p, len) {
    const txt = stripHtml(p.description || p.content || "");
    return txt.length > len ? txt.slice(0, len).replace(/\s+\S*$/, "") + "…" : txt;
  }
  function firstImage(p) {
    if (p.thumbnail) return p.thumbnail;
    if (p.enclosure && p.enclosure.link && /\.(jpg|jpeg|png|webp|gif|avif)/i.test(p.enclosure.link)) return p.enclosure.link;
    const html = p.content || p.description || "";
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : null;
  }

  /* ===================================================================
     RENDER: SIDEBAR
     =================================================================== */
  const SMART = [
    { id: "all", label: "Semua", icon: '<path d="M3 9 12 2l9 7v11a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>' },
    { id: "unread", label: "Belum dibaca", icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/>' },
    { id: "starred", label: "Berbintang", icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  ];

  function countFor(view) {
    if (view === "all") return posts.filter(p => !p._hiddenErr).length;
    if (view === "unread") return posts.filter(p => !isRead(p)).length;
    if (view === "starred") return posts.filter(p => isStarred(p)).length;
    // category
    const feedIds = store.feeds.filter(f => f.category === view).map(f => f.id);
    return posts.filter(p => feedIds.includes(p._feedId)).length;
  }

  function renderSidebar() {
    // smart views
    const sv = $("#smartViews");
    sv.innerHTML = "";
    SMART.forEach(v => {
      const n = el("div", "nav-item" + (activeView === v.id ? " active" : ""));
      n.innerHTML =
        '<svg class="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + v.icon + '</svg>' +
        '<span class="ni-label">' + t("sv_" + v.id) + '</span>' +
        '<span class="ni-count">' + countFor(v.id) + '</span>';
      n.onclick = () => setView(v.id);
      sv.appendChild(n);
    });

    // categories + their feeds
    const cl = $("#catList");
    cl.innerHTML = "";
    if (store.categories.length === 0) {
      cl.appendChild(el("div", "", '<div style="color:var(--muted);font-size:12.5px;padding:6px 8px">' + t("no_cats") + '</div>'));
    }
    store.categories.forEach(cat => {
      const n = el("div", "nav-item" + (activeView === cat.id ? " active" : ""));
      n.innerHTML =
        '<span class="cat-dot" style="background:' + cat.color + '"></span>' +
        '<span class="ni-label">' + esc(cat.name) + '</span>' +
        '<button class="cat-edit" title="' + t("edit_cat") + '">✎</button>' +
        '<span class="ni-count">' + countFor(cat.id) + '</span>';
      n.onclick = (e) => { if (e.target.closest(".cat-edit")) return; setView(cat.id); };
      n.querySelector(".cat-edit").onclick = (e) => { e.stopPropagation(); openCatModal(cat.id); };
      cl.appendChild(n);

      // feeds in category
      store.feeds.filter(f => f.category === cat.id).forEach(f => cl.appendChild(feedRow(f)));
    });

    // uncategorized feeds
    const orphan = store.feeds.filter(f => !catById(f.category));
    if (orphan.length) {
      cl.appendChild(el("div", "sb-section-label meta", t("uncategorized")));
      orphan.forEach(f => cl.appendChild(feedRow(f)));
    }
  }

  function feedRow(f) {
    const row = el("div", "feed-item");
    const loading = loadingFeeds.has(f.id);
    row.innerHTML =
      '<img src="' + faviconFor(f.url) + '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
      '<span class="fi-name">' + esc(f.name) + '</span>' +
      (loading ? '<span style="font-size:11px;color:var(--blue)">…</span>' : '') +
      (f.error ? '<span class="err-dot" title="' + esc(f.error) + '"></span>' : '') +
      '<button class="fi-menu-btn" title="' + t("feed_opts") + '">⋯</button>';
    row.querySelector(".fi-menu-btn").onclick = (e) => { e.stopPropagation(); openFeedMenu(e.currentTarget, f); };
    return row;
  }

  /* ===================================================================
     RENDER: TOP CHIP ROW
     =================================================================== */
  function renderChips() {
    const cr = $("#chiprow");
    cr.innerHTML = "";
    const mk = (id, label, color) => {
      const c = el("button", "chip" + (activeView === id ? " active" : ""));
      c.innerHTML = (color ? '<span class="dot" style="background:' + color + '"></span>' : "") + esc(label);
      c.onclick = () => setView(id);
      return c;
    };
    cr.appendChild(mk("all", t("sv_all")));
    store.categories.forEach(cat => cr.appendChild(mk(cat.id, cat.name, cat.color)));
  }

  /* ===================================================================
     RENDER: MAIN CANVAS
     =================================================================== */
  function viewTitle() {
    if (activeView === "all") return t("title_all");
    if (activeView === "unread") return t("title_unread");
    if (activeView === "starred") return t("title_starred");
    const c = catById(activeView); return c ? c.name : t("title_story");
  }

  function filteredPosts() {
    let list = posts.slice();
    if (activeView === "unread") list = list.filter(p => !isRead(p));
    else if (activeView === "starred") list = list.filter(p => isStarred(p));
    else if (activeView !== "all") {
      const feedIds = store.feeds.filter(f => f.category === activeView).map(f => f.id);
      list = list.filter(p => feedIds.includes(p._feedId));
    }
    list.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    return list;
  }

  function render() {
    renderChips();
    renderSidebar();
    $("#canvasTitle").textContent = viewTitle();

    const content = $("#content");
    content.innerHTML = "";

    // empty: no feeds at all
    if (store.feeds.length === 0) {
      $("#canvasSub").textContent = "";
      content.appendChild(emptyState());
      return;
    }

    // loading + nothing yet
    if (loadingFeeds.size > 0 && posts.length === 0) {
      $("#canvasSub").textContent = t("loading_feeds");
      content.appendChild(skeletonGrid());
      return;
    }

    const list = filteredPosts();
    const total = list.length;
    const stamp = store.lastRefresh ? t("updated", relTime(store.lastRefresh)) : "";
    $("#canvasSub").textContent = t("stories", total) + (stamp ? " · " + stamp : "");

    if (total === 0) {
      content.appendChild(noPostsState());
      if (loadingFeeds.size > 0) content.appendChild(skeletonGrid());
      return;
    }

    content.appendChild(magazineGrid(list));
  }

  function magazineGrid(list) {
    const grid = el("div", "grid");
    let quoteSlots = 0;

    list.forEach((p, i) => {
      let type;
      if (i === 0) type = "hero";
      else if (i === 1) type = "side";
      else if (i === 2) type = "side";
      else if (i === 3) type = "sec";
      else if (i === 4) type = "sec";
      else if (i === 5) type = "sec";
      else {
        // mosaic rhythm
        const r = (i - 6) % 7;
        if (r === 2 && quoteSlots < 6) { type = "quote"; quoteSlots++; }
        else if (r === 0) type = "wide";
        else if (r === 4) type = "text";
        else if (r === 6) type = "small";
        else type = "sec";
      }
      // text-led if no image (except hero/quote)
      const img = firstImage(p);
      if (!img && type !== "quote" && type !== "hero") type = "text";
      grid.appendChild(card(p, type, img));
    });
    return grid;
  }

  function card(p, type, img) {
    const feed = feedById(p._feedId);
    const cat = feed ? catById(feed.category) : null;
    const accent = cat ? cat.color : "#111";
    const c = el("div", "card " + type + (isRead(p) ? " is-read" : ""));
    c.style.setProperty("--accent", accent);
    const catName = cat ? cat.name : t("general");
    const src = (feed && feed.name) || p._source || "";
    const time = relTime(p.pubDate);
    const metaLine = '<span class="meta src-meta">' + esc(catName) + ' · ' + esc(src) + (time ? ' · ' + esc(time) : "") + '</span>';

    if (type === "quote") {
      const lite = accent.toUpperCase() === "#FFD600";
      c.className = "card quote" + (lite ? " lite" : "") + (isRead(p) ? " is-read" : "");
      c.innerHTML =
        '<div class="qmark">“</div>' +
        '<h3>' + esc(excerptOf(p, 130) || p.title) + '</h3>' +
        '<div class="byline meta">' + esc(src) + (time ? ' · ' + esc(time) : "") + '</div>';
      c.onclick = () => openReader(p);
      return c;
    }

    const thumb = img
      ? '<div class="thumb" style="background-image:url(\'' + esc(img) + '\')"></div>'
      : "";
    const tag = '<span class="tag-pill">' + esc(catName) + '</span>';
    const excerpt = (type === "hero" || type === "wide" || type === "text")
      ? '<p class="excerpt">' + esc(excerptOf(p, type === "hero" ? 180 : 110)) + '</p>' : "";

    c.innerHTML =
      starButton(p) +
      thumb +
      '<div class="kicker">' + tag + metaLine + '</div>' +
      '<h3>' + esc(p.title || t("untitled")) + '</h3>' +
      excerpt;
    c.onclick = (e) => { if (e.target.closest(".star-btn")) return; openReader(p); };
    c.querySelector(".star-btn").onclick = (e) => { e.stopPropagation(); toggleStar(p); };
    return c;
  }

  function starButton(p) {
    const on = isStarred(p);
    return '<button class="star-btn' + (on ? " on" : "") + '" aria-label="Bintangi">' +
      '<svg viewBox="0 0 24 24" fill="' + (on ? "var(--ink)" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
      '</button>';
  }

  function skeletonGrid() {
    const g = el("div", "grid");
    const layout = ["big", "", "", "", "", "", "", ""];
    layout.forEach(extra => {
      const s = el("div", "skel " + extra);
      s.innerHTML =
        '<div class="sk-img skeleton-anim"></div>' +
        '<div class="sk-line w40 skeleton-anim"></div>' +
        '<div class="sk-line skeleton-anim"></div>' +
        '<div class="sk-line w70 skeleton-anim"></div>';
      g.appendChild(s);
    });
    return g;
  }

  function emptyState() {
    const e = el("div", "empty");
    e.innerHTML = illustration() +
      '<h2>' + t("empty_title") + '</h2>' +
      '<p>' + t("empty_body") + '</p>' +
      '<button class="cta">' + t("empty_cta") + '</button>';
    e.querySelector(".cta").onclick = () => openFeedModal();
    return e;
  }
  function noPostsState() {
    const e = el("div", "empty");
    let msg = t("no_posts");
    if (activeView === "unread") msg = t("all_read");
    if (activeView === "starred") msg = t("no_starred");
    e.innerHTML = illustration() + '<h2>' + t("quiet_title") + '</h2><p>' + msg + '</p>';
    return e;
  }
  function illustration() {
    return '<svg width="150" height="120" viewBox="0 0 150 120" fill="none" aria-hidden="true" style="color:var(--ink)">' +
      '<rect x="20" y="26" width="92" height="78" fill="#FFD600" stroke="currentColor" stroke-width="3"/>' +
      '<rect x="34" y="14" width="92" height="78" fill="var(--paper)" stroke="currentColor" stroke-width="3"/>' +
      '<line x1="44" y1="32" x2="116" y2="32" stroke="currentColor" stroke-width="3"/>' +
      '<rect x="44" y="42" width="34" height="26" fill="#FF3366" stroke="currentColor" stroke-width="3"/>' +
      '<line x1="84" y1="44" x2="116" y2="44" stroke="currentColor" stroke-width="3"/>' +
      '<line x1="84" y1="52" x2="116" y2="52" stroke="currentColor" stroke-width="3"/>' +
      '<line x1="84" y1="60" x2="110" y2="60" stroke="currentColor" stroke-width="3"/>' +
      '<line x1="44" y1="76" x2="116" y2="76" stroke="#0066FF" stroke-width="3"/>' +
      '<line x1="44" y1="82" x2="100" y2="82" stroke="currentColor" stroke-width="3"/>' +
      '<circle cx="118" cy="92" r="15" fill="#0066FF" stroke="currentColor" stroke-width="3"/>' +
      '<path d="M118 86v12M112 92h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ===================================================================
     READER PANE
     =================================================================== */
  let readerPost = null;
  function openReader(p) {
    readerPost = p;
    const k = postKey(p);
    if (!store.read.includes(k)) { store.read.push(k); save(); }

    const feed = feedById(p._feedId);
    const cat = feed ? catById(feed.category) : null;
    const accent = cat ? cat.color : "#111";
    const src = (feed && feed.name) || p._source || domainOf(p.link);
    const time = relTime(p.pubDate);
    const heroImg = firstImage(p);

    const rawHtml = p.content && p.content.length > (p.description || "").length ? p.content : (p.description || p.content || "");
    let clean = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: ["p", "a", "b", "strong", "i", "em", "u", "h1", "h2", "h3", "h4", "blockquote", "ul", "ol", "li", "img", "figure", "figcaption", "pre", "code", "br", "hr", "span", "table", "thead", "tbody", "tr", "td", "th"],
      ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel"],
      ADD_ATTR: ["target"],
    });
    // remove a leading duplicate hero image inside content if same as heroImg
    if (!stripHtml(clean)) clean = "<p style='color:var(--muted)'>" + t("no_preview") + "</p>";

    const scroll = $("#readerScroll");
    scroll.innerHTML =
      '<div class="reader-kicker">' +
        '<span class="tag-pill" style="background:' + accent + '">' + esc(cat ? cat.name : t("general")) + '</span>' +
        '<span class="meta src-meta">' + esc(src) + (time ? ' · ' + esc(time) : "") + '</span>' +
      '</div>' +
      '<h1>' + esc(p.title || t("untitled")) + '</h1>' +
      '<div class="reader-byline">' + (p.author ? t("by") + " " + esc(p.author) + " · " : "") + esc(domainOf(p.link)) + '</div>' +
      (heroImg ? '<img class="reader-hero" src="' + esc(heroImg) + '" alt="" onerror="this.style.display=\'none\'" />' : "") +
      '<div class="article" id="articleBody"></div>' +
      '<a class="read-original" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' + t("read_original") + ' ' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M7 7h10v10"/></svg></a>';

    const body = $("#articleBody");
    body.innerHTML = clean;
    // open links in new tab + strip duplicate hero
    $$("#articleBody a").forEach(a => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
    const firstImgEl = body.querySelector("img");
    if (firstImgEl && heroImg && firstImgEl.src === heroImg && body.firstElementChild === firstImgEl) firstImgEl.remove();
    scroll.scrollTop = 0;

    // star button state
    const sb = $("#readerStar");
    sb.classList.toggle("on", isStarred(p));

    $("#reader").classList.add("show");
    $("#reader").setAttribute("aria-hidden", "false");
    $("#readerScrim").classList.add("show");
    render(); // refresh read-state on cards/counts
  }
  function closeReader() {
    $("#reader").classList.remove("show");
    $("#reader").setAttribute("aria-hidden", "true");
    $("#readerScrim").classList.remove("show");
    readerPost = null;
  }

  /* ===================================================================
     STARRING
     =================================================================== */
  function toggleStar(p) {
    const k = postKey(p);
    const i = store.starred.indexOf(k);
    if (i >= 0) store.starred.splice(i, 1); else store.starred.push(k);
    save();
    if (readerPost && postKey(readerPost) === k) $("#readerStar").classList.toggle("on", isStarred(p));
    render();
  }

  /* ===================================================================
     FETCHING
     =================================================================== */
  async function fetchFeed(feed) {
    loadingFeeds.add(feed.id);
    renderSidebar();
    try {
      const res = await fetch(RSS2JSON + encodeURIComponent(feed.url));
      const data = await res.json();
      if (data.status !== "ok" || !data.items) throw new Error(data.message || t("err_unreadable"));
      feed.error = null;
      feed._title = data.feed && data.feed.title;
      const items = data.items.map(it => ({ ...it, _feedId: feed.id, _source: (data.feed && data.feed.title) || feed.name }));
      // merge: drop old posts from this feed, add fresh
      posts = posts.filter(p => p._feedId !== feed.id).concat(items);
    } catch (err) {
      feed.error = err.message || t("err_failed");
    } finally {
      loadingFeeds.delete(feed.id);
    }
  }

  async function syncRemoteFeeds() {
    try {
      let res = await fetch(REMOTE_FEEDS_URL);
      if (!res.ok) res = await fetch(REMOTE_FEEDS_URL_FALLBACK);
      if (!res.ok) return;
      const data = await res.json();
      let changed = false;

      (data.categories || []).forEach(rc => {
        if (!store.categories.find(c => c.id === rc.id)) {
          store.categories.push(rc);
          changed = true;
        }
      });

      const newFeeds = [];
      (data.feeds || []).forEach(rf => {
        const existing = store.feeds.find(f => f.id === rf.id);
        if (!existing) {
          store.feeds.push({ ...rf, error: null });
          newFeeds.push(store.feeds[store.feeds.length - 1]);
          changed = true;
        } else if (existing.url !== rf.url || existing.name !== rf.name) {
          existing.url = rf.url;
          existing.name = rf.name || existing.name;
          changed = true;
        }
      });

      if (changed) {
        save();
        render();
        if (newFeeds.length > 0) {
          await Promise.all(newFeeds.map(f => fetchFeed(f).then(() => render())));
          save();
        }
      }
    } catch (e) { /* silent fail — app works with stored data */ }
  }

  async function refreshAll() {
    if (store.feeds.length === 0) { render(); return; }
    const btn = $("#refreshBtn");
    btn.classList.add("spinning");
    $("#refreshLabel").textContent = t("loading");
    render(); // show skeletons if empty
    await Promise.all(store.feeds.map(f => fetchFeed(f).then(() => render())));
    store.lastRefresh = new Date().toISOString();
    save();
    btn.classList.remove("spinning");
    $("#refreshLabel").textContent = t("refresh");
    render();
    const errs = store.feeds.filter(f => f.error).length;
    if (errs) toast(t("feeds_failed", errs));
  }

  /* validate a single url, return preview */
  async function validateFeed(url) {
    const res = await fetch(RSS2JSON + encodeURIComponent(url));
    const data = await res.json();
    if (data.status !== "ok" || !data.feed) throw new Error(data.message || t("invalid_feed"));
    return { title: data.feed.title || domainOf(url), url, count: (data.items || []).length, link: data.feed.link };
  }

  /* ===================================================================
     ADD / EDIT FEED MODAL
     =================================================================== */
  function refreshCatSelect() {
    const sel = $("#feedCat");
    sel.innerHTML = "";
    store.categories.forEach(c => {
      const o = el("option"); o.value = c.id; o.textContent = c.name; sel.appendChild(o);
    });
    const o = el("option"); o.value = "__new"; o.textContent = t("newcat_opt"); sel.appendChild(o);
  }

  let newCatColor = PALETTE[0];
  function buildNewCatSwatches() {
    const box = $("#newCatSwatches");
    box.innerHTML = "";
    PALETTE.forEach((col, i) => {
      const s = el("button", "swatch" + (i === 0 ? " sel" : ""));
      s.style.background = col; s.dataset.col = col;
      s.onclick = (e) => { e.preventDefault(); newCatColor = col; $$(".swatch", box).forEach(x => x.classList.remove("sel")); s.classList.add("sel"); };
      box.appendChild(s);
    });
    newCatColor = PALETTE[0];
  }

  function openFeedModal(feedId) {
    editingFeedId = feedId || null;
    pendingPreview = null;
    refreshCatSelect();
    buildNewCatSwatches();
    const titleEl = $("#feedModalTitle");
    const urlIn = $("#feedUrl"), nameIn = $("#feedName"), catSel = $("#feedCat");
    $("#previewSlot").innerHTML = "";
    $("#newCatField").classList.add("hide");

    if (feedId) {
      const f = feedById(feedId);
      titleEl.textContent = t("modal_edit_feed");
      urlIn.value = f.url; nameIn.value = f.name;
      catSel.value = f.category;
      $("#feedSave").disabled = false;
      pendingPreview = { title: f.name, url: f.url };
    } else {
      titleEl.textContent = t("modal_add_feed");
      urlIn.value = ""; nameIn.value = "";
      catSel.value = store.categories[0] ? store.categories[0].id : "__new";
      if (catSel.value === "__new") $("#newCatField").classList.remove("hide");
      $("#feedSave").disabled = true;
    }
    $("#feedModal").classList.add("show");
    setTimeout(() => urlIn.focus(), 50);
  }
  function closeFeedModal() { $("#feedModal").classList.remove("show"); }

  let validateTimer = null;
  function onUrlInput() {
    clearTimeout(validateTimer);
    const url = $("#feedUrl").value.trim();
    pendingPreview = null;
    $("#feedSave").disabled = true;
    if (!/^https?:\/\/.+\..+/.test(url)) { $("#previewSlot").innerHTML = ""; return; }
    $("#previewSlot").innerHTML = '<div class="preview-box"><div class="skeleton-anim" style="width:38px;height:38px;border:2px solid var(--ink);background:var(--skel)"></div><div><div class="pv-title">' + t("validating") + '</div><div class="pv-sub">' + esc(domainOf(url)) + '</div></div></div>';
    validateTimer = setTimeout(async () => {
      try {
        const pv = await validateFeed(url);
        pendingPreview = pv;
        $("#previewSlot").innerHTML =
          '<div class="preview-box">' +
          '<img src="' + faviconFor(url) + '" alt="" onerror="this.style.visibility=\'hidden\'"/>' +
          '<div><div class="pv-title">' + esc(pv.title) + '</div><div class="pv-sub">' + t("articles", pv.count) + ' · ' + esc(domainOf(url)) + '</div></div>' +
          '</div>';
        if (!$("#feedName").value.trim()) $("#feedName").placeholder = pv.title;
        $("#feedSave").disabled = false;
      } catch (err) {
        $("#previewSlot").innerHTML = '<div class="preview-box error"><strong>⚠</strong><div><div class="pv-title" style="font-family:var(--sans);font-size:14px">' + esc(err.message) + '</div><div class="pv-sub">' + t("check_url") + '</div></div></div>';
        $("#feedSave").disabled = true;
      }
    }, 600);
  }

  async function saveFeed() {
    const url = $("#feedUrl").value.trim();
    let catId = $("#feedCat").value;
    const customName = $("#feedName").value.trim();
    const name = customName || (pendingPreview && pendingPreview.title) || domainOf(url);

    // new category inline
    if (catId === "__new") {
      const cn = $("#newCatName").value.trim();
      if (!cn) { toast(t("name_cat_first")); return; }
      const nc = { id: uid("c"), name: cn, color: newCatColor };
      store.categories.push(nc);
      catId = nc.id;
    }

    if (editingFeedId) {
      const f = feedById(editingFeedId);
      const urlChanged = f.url !== url;
      f.url = url; f.name = name; f.category = catId;
      save(); closeFeedModal();
      if (urlChanged) { posts = posts.filter(p => p._feedId !== f.id); await fetchFeed(f); store.lastRefresh = new Date().toISOString(); save(); }
      render(); toast(t("feed_updated"));
    } else {
      // prevent dupes
      if (store.feeds.some(f => f.url === url)) { toast(t("feed_dup")); return; }
      const f = { id: uid("f"), url, name, category: catId, error: null };
      store.feeds.push(f);
      save(); closeFeedModal();
      await fetchFeed(f);
      store.lastRefresh = new Date().toISOString(); save();
      render(); toast(t("feed_added"));
    }
  }

  /* feed hover menu (reassign category / edit / delete) */
  function openFeedMenu(anchor, f) {
    const m = $("#ctxMenu");
    let html = '<div class="ctx-label">' + esc(f.name) + '</div>';
    html += '<button data-act="edit">' + t("edit_feed") + '</button>';
    html += '<div class="ctx-label">' + t("move_to_cat") + '</div>';
    store.categories.forEach(c => {
      html += '<button data-cat="' + c.id + '"><span class="cat-dot" style="width:10px;height:10px;background:' + c.color + '"></span>' + esc(c.name) + (c.id === f.category ? " ✓" : "") + '</button>';
    });
    html += '<hr><button class="danger" data-act="del">' + t("del_feed") + '</button>';
    m.innerHTML = html;
    m.querySelectorAll("button").forEach(b => {
      b.onclick = () => {
        if (b.dataset.cat) { f.category = b.dataset.cat; save(); render(); }
        else if (b.dataset.act === "edit") openFeedModal(f.id);
        else if (b.dataset.act === "del") {
          if (confirm(t("confirm_del_feed", f.name))) { store.feeds = store.feeds.filter(x => x.id !== f.id); posts = posts.filter(p => p._feedId !== f.id); save(); render(); toast(t("feed_deleted")); }
        }
        hideCtx();
      };
    });
    positionCtx(m, anchor);
  }

  /* ===================================================================
     CATEGORY MODAL
     =================================================================== */
  let catColor = PALETTE[0];
  function buildCatSwatches(selected) {
    const box = $("#catSwatches");
    box.innerHTML = "";
    PALETTE.forEach((col) => {
      const s = el("button", "swatch" + (col === selected ? " sel" : ""));
      s.style.background = col;
      s.onclick = (e) => { e.preventDefault(); catColor = col; $$(".swatch", box).forEach(x => x.classList.remove("sel")); s.classList.add("sel"); };
      box.appendChild(s);
    });
  }
  function openCatModal(catId) {
    editingCatId = catId || null;
    const c = catId ? catById(catId) : null;
    $("#catModalTitle").textContent = c ? t("cat_edit_title") : t("cat_new_title");
    $("#catName").value = c ? c.name : "";
    catColor = c ? c.color : PALETTE[0];
    buildCatSwatches(catColor);
    $("#catDelete").classList.toggle("hide", !c);
    $("#catSave").disabled = !(c && c.name);
    $("#catModal").classList.add("show");
    setTimeout(() => $("#catName").focus(), 50);
  }
  function closeCatModal() { $("#catModal").classList.remove("show"); }
  function saveCat() {
    const name = $("#catName").value.trim();
    if (!name) return;
    if (editingCatId) {
      const c = catById(editingCatId); c.name = name; c.color = catColor;
    } else {
      store.categories.push({ id: uid("c"), name, color: catColor });
    }
    save(); closeCatModal(); render();
  }
  function deleteCat() {
    const c = catById(editingCatId); if (!c) return;
    const n = store.feeds.filter(f => f.category === c.id).length;
    if (!confirm(t("confirm_del_cat", c.name, n))) return;
    store.feeds.forEach(f => { if (f.category === c.id) f.category = null; });
    store.categories = store.categories.filter(x => x.id !== c.id);
    if (activeView === c.id) activeView = "all";
    save(); closeCatModal(); render(); toast(t("cat_deleted"));
  }

  /* ===================================================================
     CONTEXT MENU positioning + global dismiss
     =================================================================== */
  function positionCtx(m, anchor) {
    m.classList.add("show");
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let x = r.left, y = r.bottom + 4;
    if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
    if (y + mh > window.innerHeight - 8) y = r.top - mh - 4;
    m.style.left = x + "px"; m.style.top = y + "px";
  }
  function hideCtx() { $("#ctxMenu").classList.remove("show"); }

  /* ===================================================================
     VIEW SWITCH
     =================================================================== */
  function setView(v) {
    activeView = v;
    closeDrawer();
    render();
    $("#canvas").scrollTop = 0;
  }

  /* ---- mobile drawer ---- */
  function openDrawer() { $("#sidebar").classList.add("drawer-open"); $("#readerScrim").classList.add("show"); document.body.dataset.drawer = "1"; }
  function closeDrawer() { $("#sidebar").classList.remove("drawer-open"); if (document.body.dataset.drawer) { $("#readerScrim").classList.remove("show"); delete document.body.dataset.drawer; } }

  /* ---- toast ---- */
  let toastTimer = null;
  function toast(msg) {
    const t2 = $("#toast"); t2.textContent = msg; t2.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t2.classList.remove("show"), 3200);
  }

  /* ===================================================================
     LANGUAGE + THEME
     =================================================================== */
  function applyStatic() {
    $$("[data-i18n]").forEach(n => { n.textContent = t(n.dataset.i18n); });
    $$("[data-i18n-ph]").forEach(n => { n.placeholder = t(n.dataset.i18nPh); });
    $$("[data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === store.lang));
    const col = $("#sidebar").classList.contains("collapsed");
    $("#collapseBtn").title = col ? t("collapse_show") : t("collapse_hide");
    updateThemeBtn();
    document.documentElement.lang = store.lang === "en" ? "en" : "id";
  }
  function updateThemeBtn() {
    const dark = store.theme === "dark";
    $("#themeBtn").title = dark ? t("theme_light") : t("theme_dark");
    $("#themeIcon").innerHTML = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  }
  function applyTheme(theme) {
    store.theme = theme; save();
    if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    updateThemeBtn();
  }
  function applyLang(lang) {
    store.lang = lang; save();
    rtf = new Intl.RelativeTimeFormat(lang === "en" ? "en" : "id-ID", { numeric: "auto" });
    applyStatic();
    render();
  }

  /* ===================================================================
     WIRE UP
     =================================================================== */
  function init() {
    // language + theme (apply before first render)
    if (store.theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
    rtf = new Intl.RelativeTimeFormat(store.lang === "en" ? "en" : "id-ID", { numeric: "auto" });
    applyStatic();
    $$("[data-lang]").forEach(b => {
      b.onclick = () => { if (store.lang !== b.dataset.lang) applyLang(b.dataset.lang); };
    });
    $("#themeBtn").onclick = () => applyTheme(store.theme === "dark" ? "light" : "dark");

    // top bar
    $("#refreshBtn").onclick = refreshAll;
    $("#brand").onclick = () => setView("all");
    $("#hamburger").onclick = () => { $("#sidebar").classList.contains("drawer-open") ? closeDrawer() : openDrawer(); };
    $("#collapseBtn").onclick = () => {
      const collapsed = $("#sidebar").classList.toggle("collapsed");
      $("#collapseBtn").classList.toggle("is-collapsed", collapsed);
      $("#collapseBtn").title = collapsed ? t("collapse_show") : t("collapse_hide");
      store.sidebarCollapsed = collapsed; save();
    };
    if (store.sidebarCollapsed) {
      $("#sidebar").classList.add("collapsed");
      $("#collapseBtn").classList.add("is-collapsed");
    }

    // sidebar
    $("#addCatBtn").onclick = () => openCatModal();
    $("#fab").onclick = () => openFeedModal();

    // reader
    $("#readerClose").onclick = closeReader;
    $("#readerScrim").onclick = () => { closeReader(); closeDrawer(); };
    $("#readerStar").onclick = () => { if (readerPost) toggleStar(readerPost); };

    // feed modal
    $("#feedModalClose").onclick = closeFeedModal;
    $("#feedCancel").onclick = closeFeedModal;
    $("#feedSave").onclick = saveFeed;
    $("#feedUrl").addEventListener("input", onUrlInput);
    $("#feedCat").addEventListener("change", (e) => { $("#newCatField").classList.toggle("hide", e.target.value !== "__new"); });

    // cat modal
    $("#catModalClose").onclick = closeCatModal;
    $("#catCancel").onclick = closeCatModal;
    $("#catSave").onclick = saveCat;
    $("#catDelete").onclick = deleteCat;
    $("#catName").addEventListener("input", (e) => { $("#catSave").disabled = !e.target.value.trim(); });

    // global
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($("#feedModal").classList.contains("show")) closeFeedModal();
        else if ($("#catModal").classList.contains("show")) closeCatModal();
        else if ($("#reader").classList.contains("show")) closeReader();
        else closeDrawer();
        hideCtx();
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#ctxMenu") && !e.target.closest(".fi-menu-btn")) hideCtx();
    });
    // click outside modal closes
    $$(".modal-wrap").forEach(w => w.addEventListener("mousedown", (e) => { if (e.target === w) w.classList.remove("show"); }));

    render();
    syncRemoteFeeds();
    refreshAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

