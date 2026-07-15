/**
 * main.js — application entry point.
 * Loads directory data from ./sites.json (works on any static host).
 * Falls back to an embedded copy if fetch fails — e.g. the page was
 * opened directly from disk (file://) instead of served over http(s).
 */
import { initHeroScene } from "./scene.js";

const FALLBACK_DATA_NOTE =
  "Loaded from bundled fallback data (fetch failed — are you opening this file directly instead of via a local server?)";

// Minimal embedded fallback so the page still works over file://.
// Kept in sync with sites.json; sites.json is the source of truth.
const FALLBACK = {
  sites: [
    {
      cat: "General Marketplace", name: "Daraz Nepal", url: "https://www.daraz.com.np/",
      delivery: "nationwide", deliveryLabel: "Nationwide — confirmed",
      note: "47+ cities, 15+ delivery hubs including a dedicated Bharatpur (Chitwan) pickup point.",
      trust: "verified",
    },
  ],
  problems: [
    { title: "Fetch fallback active", body: "This is a minimal dataset. Serve the site over http(s) (npm start, or any static server) to load the full sites.json." },
  ],
};

async function loadData() {
  try {
    const res = await fetch("./sites.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json.sites)) throw new Error("Malformed sites.json");
    return json;
  } catch (err) {
    console.warn("sites.json fetch failed, using embedded fallback:", err);
    return FALLBACK;
  }
}

function buildProblems(problems) {
  const list = document.getElementById("problemsList");
  if (!list) return;
  list.innerHTML = "";
  problems.forEach((p, i) => {
    const num = String(i + 1).padStart(2, "0");
    const item = document.createElement("div");
    item.className = "problem-item";
    item.innerHTML = `<span class="problem-num">${num}</span><span><b>${p.title}</b> — ${p.body}</span>`;
    list.appendChild(item);
  });
}

/**
 * crossSearchModule — "search every site at once" launcher.
 *
 * Important honesty note: this does NOT scrape or fetch live results from
 * any site. There's no public product-search API for these platforms, and
 * scraping them client-side is blocked by CORS (and server-side scraping
 * would be fragile and against most sites' terms). What it actually does:
 * builds each site's own search-results URL for the typed query and opens
 * it in a new tab — a real, working shortcut, just not a live results feed.
 */
function crossSearchModule(SITES) {
  const form = document.getElementById("crossSearchForm");
  const input = document.getElementById("crossSearchInput");
  const results = document.getElementById("crossSearchResults");
  if (!form || !input || !results) return;

  const searchable = SITES.filter((s) => !!s.searchUrl);

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    results.innerHTML = "";
    results.classList.add("show");

    if (searchable.length === 0) {
      results.innerHTML = `<p class="cross-search-empty">No sites with a known search pattern yet.</p>`;
      return;
    }

    const frag = document.createDocumentFragment();
    searchable.forEach((site) => {
      const url = site.searchUrl.replace("{q}", encodeURIComponent(query));
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "cross-result";
      const badgeClass = site.searchConfidence === "confirmed" ? "confirmed" : "best-guess";
      const badgeText = site.searchConfidence === "confirmed" ? "Confirmed pattern" : "Best-guess — verify";
      a.innerHTML = `
        <div class="cross-result-top">
          <span class="cross-result-name">${escapeHtml(site.name)}</span>
          <span class="cross-result-go">Open ↗</span>
        </div>
        <span class="confidence-badge ${badgeClass}">${badgeText}</span>
        <span class="cross-result-note">${escapeHtml(site.cat)} · ${escapeHtml(site.deliveryLabel)}</span>
      `;
      frag.appendChild(a);
    });
    results.appendChild(frag);

    const skipped = SITES.length - searchable.length;
    if (skipped > 0) {
      const note = document.createElement("p");
      note.className = "cross-search-empty";
      note.textContent = `${skipped} site(s) skipped — no confirmed search URL pattern on file, visit their homepage directly.`;
      results.appendChild(note);
    }
  });
}

/**
 * Adds a real 3D perspective tilt to a card, following the pointer.
 * Skipped entirely under prefers-reduced-motion.
 */
function attachTilt(card) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const MAX_TILT = 7; // degrees
  function onMove(e) {
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    const rotY = (px - 0.5) * MAX_TILT * 2;
    const rotX = (0.5 - py) * MAX_TILT * 2;
    card.style.transform = `rotate(var(--rest-rotate, 0deg)) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-3px)`;
  }
  function onLeave() {
    card.style.transform = "";
  }
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerleave", onLeave);
  card.addEventListener("blur", onLeave);
}

function directoryModule(SITES) {
  let currentChip = "All";
  let searchTerm = "";
  let debounceId = null;

  const grid = document.getElementById("grid");
  const chipsEl = document.getElementById("chips");
  const emptyState = document.getElementById("emptyState");
  const resultCount = document.getElementById("resultCount");
  const toast = document.getElementById("toast");

  function buildChips() {
    const cats = ["All", ...new Set(SITES.map((d) => d.cat))];
    chipsEl.innerHTML = "";
    cats.forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.setAttribute("aria-pressed", c === currentChip ? "true" : "false");
      btn.textContent = c;
      btn.addEventListener("click", () => {
        currentChip = c;
        render();
        buildChips();
      });
      chipsEl.appendChild(btn);
    });
  }

  function stampLabel(trust) {
    return trust === "verified" ? "CHECKED · OK" : trust === "caution" ? "VERIFY LIVE" : "KNOWN ISSUE";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    let filtered;
    try {
      filtered = SITES.filter((item) => {
        const matchesChip = currentChip === "All" || item.cat === currentChip;
        const haystack = (item.name + " " + item.cat + " " + item.note + " " + item.deliveryLabel).toLowerCase();
        const matchesSearch = haystack.includes(searchTerm.toLowerCase());
        return matchesChip && matchesSearch;
      });
    } catch (err) {
      console.error("Directory filter error:", err);
      filtered = SITES;
    }

    grid.innerHTML = "";
    const frag = document.createDocumentFragment();
    filtered.forEach((item) => {
      const card = document.createElement("a");
      card.href = item.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.className = "ticket " + item.trust;
      card.innerHTML = `
        <div class="ticket-top">
          <div class="ticket-name">${escapeHtml(item.name)}</div>
          <div class="stamp ${item.trust}" aria-hidden="true">${stampLabel(item.trust)}</div>
        </div>
        <div class="ticket-domain">${escapeHtml(item.url.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</div>
        <div class="delivery-tag ${item.delivery}">📦 ${escapeHtml(item.deliveryLabel)}</div>
        <div class="ticket-note">${escapeHtml(item.note)}</div>
        <div class="ticket-bottom">
          <span class="ticket-url">${escapeHtml(item.cat)}</span>
          <span class="go">
            <button class="copy-btn" title="Copy link" aria-label="Copy ${escapeHtml(item.name)} link" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            Open ↗
          </span>
        </div>
      `;
      const copyBtn = card.querySelector(".copy-btn");
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(item.url)
            .then(() => showToast("Link copied"))
            .catch(() => showToast("Copy failed — long-press to copy"));
        } else {
          showToast("Copy not supported on this browser");
        }
      });
      attachTilt(card);
      frag.appendChild(card);
    });
    grid.appendChild(frag);

    emptyState.hidden = filtered.length !== 0;
    resultCount.textContent = `${filtered.length} of ${SITES.length} listed`;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
  }

  const problemsPanel = document.getElementById("problemsPanel");
  const problemsToggle = document.getElementById("problemsToggle");
  function toggleProblems(forceOpen) {
    const willOpen = typeof forceOpen === "boolean" ? forceOpen : !problemsPanel.classList.contains("open");
    problemsPanel.classList.toggle("open", willOpen);
    problemsToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }
  problemsToggle.addEventListener("click", () => toggleProblems());

  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(debounceId);
    const val = e.target.value;
    debounceId = setTimeout(() => {
      searchTerm = val;
      render();
    }, 120);
  });

  document.getElementById("ctaExplore").addEventListener("click", () => {
    document.getElementById("main-content").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("ctaProblems").addEventListener("click", () => {
    toggleProblems(true);
    document.getElementById("problemsSection").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("scrollCue").addEventListener("click", () => {
    document.getElementById("main-content").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const backTop = document.getElementById("backTop");
  window.addEventListener(
    "scroll",
    () => {
      backTop.hidden = window.scrollY < 700;
      backTop.classList.toggle("show", window.scrollY >= 700);
    },
    { passive: true }
  );
  backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  buildChips();
  render();
}

async function boot() {
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const controls = document.getElementById("controlsSection");
  const main = document.querySelector("main");

  try {
    const data = await loadData();
    if (data === FALLBACK) {
      const note = document.createElement("p");
      note.className = "error-state";
      note.textContent = FALLBACK_DATA_NOTE;
      controls.parentNode.insertBefore(note, controls);
    }
    buildProblems(data.problems || []);
    directoryModule(data.sites || []);
    crossSearchModule(data.sites || []);
    loadingState.classList.add("hidden");
    controls.hidden = false;
    main.hidden = false;
  } catch (err) {
    console.error("Fatal load error:", err);
    loadingState.classList.add("hidden");
    errorState.classList.remove("hidden");
  }
}

boot();
initHeroScene();
