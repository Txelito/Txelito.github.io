document.querySelectorAll(".project-card").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--y", `${e.clientY - rect.top}px`);
  });
});

if (window.lucide && typeof window.lucide.createIcons === "function") {
  window.lucide.createIcons();
}

const initPhotoSlider = (selector, delay = 2500) => {
  const photos = document.querySelectorAll(selector);
  if (!photos.length) return;

  let idx = 0;

  setInterval(() => {
    photos[idx].classList.remove("active");
    idx = (idx + 1) % photos.length;
    photos[idx].classList.add("active");
  }, delay);
};

initPhotoSlider(".seaum-photo");
initPhotoSlider(".acfab-photo");

const navToggle = document.getElementById("navToggle");
const navMenu = document.getElementById("navMenu");

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    navMenu.classList.toggle("open");
  });

  // fecha ao clicar num link (mobile)
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => navMenu.classList.remove("open"));
  });
}

// =====================
// MODE SWITCHER
// =====================

const VALID_MODES = ["pro", "academic", "personal"];
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Slides the highlight behind the active mode button (see .mode-switcher::before).
function moveModePill() {
  const switcher = document.getElementById("modeSwitcher");
  const active = switcher?.querySelector(".mode-btn.active");
  if (!active || !active.offsetWidth) return; // menu closed on mobile
  switcher.style.setProperty("--pill-x", `${active.offsetLeft}px`);
  switcher.style.setProperty("--pill-w", `${active.offsetWidth}px`);
  switcher.classList.add("has-pill");
}

function setMode(mode, { animate = false } = {}) {
  const changed = document.body.getAttribute("data-view") !== mode;
  document.body.setAttribute("data-view", mode);
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === mode);
  });
  moveModePill();
  try { localStorage.setItem("portfolioMode", mode); } catch {}

  if (animate && changed && !prefersReducedMotion.matches) {
    // restart the CSS entrance animation
    document.body.classList.remove("mode-enter");
    void document.body.offsetWidth;
    document.body.classList.add("mode-enter");
  }
}

document.body.addEventListener("animationend", (e) => {
  if (e.target.classList?.contains("hero-text")) document.body.classList.remove("mode-enter");
});

(function initMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get("v");
  let saved = null;
  try { saved = localStorage.getItem("portfolioMode"); } catch {}
  setMode(VALID_MODES.includes(fromUrl) ? fromUrl : (VALID_MODES.includes(saved) ? saved : "pro"));
})();

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.target, { animate: true }));
});

window.addEventListener("resize", moveModePill);
document.fonts?.ready.then(moveModePill);
navToggle?.addEventListener("click", () => requestAnimationFrame(moveModePill));

// Used by the footer date.
function relativeTime(date, lang) {
  const rtf = new Intl.RelativeTimeFormat(lang === "pt" ? "pt-PT" : "en", { numeric: "auto" });
  const days = Math.round((date - Date.now()) / 86400000);
  if (days > -1) return rtf.format(0, "day");
  if (days > -30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (months > -12) return rtf.format(months, "month");
  return rtf.format(Math.round(days / 365), "year");
}

// =====================
// ROTATING HELLO (hero)
// =====================

(function initHello() {
  const word = document.getElementById("helloWord");
  const label = document.getElementById("helloLang");
  if (!word || !label) return;

  const pt = document.documentElement.lang === "pt";
  const GREETINGS = [
    ["Olá", pt ? "Português" : "Portuguese"],
    ["Modi ki bu sta?", pt ? "Crioulo cabo-verdiano" : "Cape Verdean Creole"],
    ["Hello", pt ? "Inglês" : "English"],
    ["Bonjour", pt ? "Francês" : "French"],
    ["¡Hola!", pt ? "Espanhol" : "Spanish"],
  ];
  let i = 0;
  label.textContent = GREETINGS[0][1];
  if (prefersReducedMotion.matches) return;

  setInterval(() => {
    word.classList.add("is-leaving");
    setTimeout(() => {
      i = (i + 1) % GREETINGS.length;
      [word.textContent, label.textContent] = GREETINGS[i];
      word.classList.remove("is-leaving");
    }, 300);
  }, 2600);
})();

// =====================
// PERSONAL VAULT
// =====================
// The content lives encrypted in assets/vault.json (AES-GCM, key derived from the
// passphrase with PBKDF2). No passphrase is stored in this repo: generate the file
// with tools/vault.py. Links like pt.html#k=PASSPHRASE open the vault directly.

(function initVault() {
  const gate = document.getElementById("vaultGate");
  const content = document.getElementById("vaultContent");
  const body = document.getElementById("vaultBody");
  const form = document.getElementById("vaultUnlockForm");
  const input = document.getElementById("vaultPassphrase");
  const feedback = document.getElementById("vaultFeedback");
  const lockBtn = document.getElementById("vaultLock");
  if (!gate || !content || !body || !form || !input) return;

  const lang = document.documentElement.lang === "pt" ? "pt" : "en";
  const MESSAGES = {
    en: {
      wrong: "That's not it. Try again, or request access below.",
      checking: "Checking…",
      unavailable: "The vault is unavailable right now. Try again later.",
    },
    pt: {
      wrong: "Não é essa. Tenta outra vez, ou pede acesso abaixo.",
      checking: "A verificar…",
      unavailable: "O cofre não está disponível agora. Tenta mais tarde.",
    },
  }[lang];

  const STORAGE_KEY = "vaultPass";
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  // Same rule as tools/vault.py: case, accents, hyphens and extra spaces don't matter,
  // so "Jean-Baptiste" and "jean  baptiste" are the same answer.
  const normalise = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let vaultPromise = null;

  function loadVault() {
    vaultPromise ||= fetch("assets/vault.json", { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`vault.json: ${r.status}`);
      return r.json();
    });
    return vaultPromise;
  }

  // Returns {data, key}: the decrypted {en, pt, travel} content and the key that also
  // opens the photo files. Null if no slot accepts the passphrase.
  async function decrypt(passphrase, vault) {
    const baseKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    const kek = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: fromB64(vault.salt), iterations: vault.iterations, hash: "SHA-256" },
      baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    for (const slot of vault.slots) {
      try {
        const rawKey = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: fromB64(slot.iv) }, kek, fromB64(slot.key)
        );
        const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: fromB64(vault.content.iv) }, key, fromB64(vault.content.data)
        );
        return { data: JSON.parse(new TextDecoder().decode(plain)), key };
      } catch {
        // wrong slot, try the next one
      }
    }
    return null;
  }

  function show({ data, key }) {
    body.innerHTML = data[lang] || data.en || "";
    if (data.travel) {
      const travel = document.createElement("div");
      const slot = body.querySelector("[data-travel]");
      if (slot) slot.replaceWith(travel);
      else body.append(travel);
      renderTravelMap(travel, data.travel, key, lang).catch((err) => console.error(err));
    }
    observeReveal(body);
    observeCounters(body);
    gate.hidden = true;
    content.hidden = false;
  }

  function lock() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    releaseTravelPhotos();
    body.innerHTML = "";
    content.hidden = true;
    gate.hidden = false;
    input.value = "";
  }

  async function tryUnlock(passphrase, { silent = false } = {}) {
    if (!silent) {
      feedback.textContent = MESSAGES.checking;
      feedback.className = "vault-feedback";
    }
    try {
      const opened = await decrypt(normalise(passphrase), await loadVault());
      if (!opened) {
        if (!silent) {
          feedback.textContent = MESSAGES.wrong;
          feedback.className = "vault-feedback error";
        }
        return false;
      }
      try { localStorage.setItem(STORAGE_KEY, normalise(passphrase)); } catch {}
      feedback.textContent = "";
      show(opened);
      return true;
    } catch (err) {
      console.error(err);
      if (!silent) {
        feedback.textContent = MESSAGES.unavailable;
        feedback.className = "vault-feedback error";
      }
      return false;
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) tryUnlock(input.value);
  });

  lockBtn?.addEventListener("click", lock);

  try { localStorage.removeItem("vaultUnlocked"); } catch {} // old plaintext gate

  const hashMatch = window.location.hash.match(/^#k=(.+)$/);
  if (hashMatch) {
    // Keep the passphrase out of the address bar and browser history.
    history.replaceState(null, "", window.location.pathname + window.location.search + "#personal-vault");
    setMode("personal");
    tryUnlock(decodeURIComponent(hashMatch[1])).then(() => {
      document.getElementById("personal-vault")?.scrollIntoView();
    });
  } else {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
    if (saved) {
      // A revoked passphrase simply stops working after the next vault.json update.
      tryUnlock(saved, { silent: true }).then((ok) => {
        if (!ok) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
      });
    }
  }
})();

// =====================
// CERTIFICATE VIEWER
// =====================

(function initCertModal() {
  const modal = document.getElementById("certModal");
  const frame = document.getElementById("certModalFrame");
  const title = document.getElementById("certModalTitle");
  const openLink = document.getElementById("certModalOpen");
  const closeBtn = document.getElementById("certModalClose");
  if (!modal || typeof modal.showModal !== "function") return;

  // Phones rarely render PDFs inside an iframe, so there the link just opens the file.
  const inlinePdf = window.matchMedia("(min-width: 768px)");

  document.querySelectorAll(".cert-open").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!inlinePdf.matches) return;
      e.preventDefault();
      frame.src = link.href;
      openLink.href = link.href;
      title.textContent = link.dataset.title || link.textContent;
      modal.showModal();
    });
  });

  closeBtn.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.close();
  });
  modal.addEventListener("close", () => {
    frame.removeAttribute("src");
  });
})();

// =====================
// LAST UPDATED (footer)
// =====================
// Date of the latest commit, from the public GitHub API (60 requests/hour per
// visitor IP, so it is cached for the session). Stays hidden if the call fails.

(function initLastUpdated() {
  const el = document.getElementById("lastUpdated");
  if (!el) return;

  const lang = document.documentElement.lang === "pt" ? "pt" : "en";
  const REPO = "Txelito/Txelito.github.io";
  const CACHE_KEY = "lastCommitDate";
  const LABEL = { en: "Last updated", pt: "Última atualização" }[lang];

  function render(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    const link = document.createElement("a");
    link.href = `https://github.com/${REPO}/commits/main`;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = date.toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", { dateStyle: "long" });
    link.textContent = relativeTime(date, lang);
    el.replaceChildren(`${LABEL}: `, link);
    el.hidden = false;
  }

  let cached = null;
  try { cached = sessionStorage.getItem(CACHE_KEY); } catch {}
  if (cached) {
    render(cached);
    return;
  }

  fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(([latest]) => {
      const iso = latest?.commit?.committer?.date;
      if (!iso) return;
      try { sessionStorage.setItem(CACHE_KEY, iso); } catch {}
      render(iso);
    })
    .catch(() => {});
})();

// =====================
// TRAVEL MAP (inside the vault)
// =====================
// Countries and photos come from the decrypted vault. Photos are separate encrypted
// files in assets/vault/, decrypted in the browser only when a country is opened.

const MAP_LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js",
];
const WORLD_ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const photoUrls = new Map(); // encrypted file name -> blob: URL

function loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  });
}

function releaseTravelPhotos() {
  photoUrls.forEach((url) => URL.revokeObjectURL(url));
  photoUrls.clear();
}

async function decryptPhoto(ref, key) {
  if (photoUrls.has(ref.f)) return photoUrls.get(ref.f);
  const res = await fetch(`assets/vault/${ref.f}`);
  if (!res.ok) throw new Error(`${ref.f}: ${res.status}`);
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ref.iv) }, key, await res.arrayBuffer()
  );
  const url = URL.createObjectURL(new Blob([plain], { type: "image/jpeg" }));
  photoUrls.set(ref.f, url);
  return url;
}

async function renderTravelMap(root, travel, key, lang) {
  const T = {
    en: {
      title: "Places I've been", countries: "countries", continents: "continents",
      hint: "Pick a country to see the photos.", soon: "Photos coming soon.",
      close: "Close", photo: "Photo",
    },
    pt: {
      title: "Por onde já passei", countries: "países", continents: "continentes",
      hint: "Escolhe um país para ver as fotos.", soon: "Fotos em breve.",
      close: "Fechar", photo: "Foto",
    },
  }[lang];
  const countries = travel.countries || [];
  const name = (c) => c.name[lang] || c.name.en;
  const note = (c) => (c.note && (c.note[lang] || c.note.en)) || "";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // --- skeleton -----------------------------------------------------------
  root.className = "travel";
  const head = el("div", "travel-head");
  const stats = el("p", "travel-stats");
  const continents = new Set(countries.map((c) => c.continent)).size;
  stats.append(el("strong", "", String(countries.length)), ` ${T.countries} · `,
               el("strong", "", String(continents)), ` ${T.continents}`);
  head.append(el("h3", "", T.title), stats);

  const mapBox = el("div", "travel-map");
  const chips = el("div", "travel-chips");
  const panel = el("div", "travel-panel");
  const panelTitle = el("h4");
  const panelNote = el("p", "travel-note");
  const grid = el("div", "travel-photos");
  panel.append(panelTitle, panelNote, grid);
  panel.hidden = true;
  const hint = el("p", "travel-hint", T.hint);

  const viewer = el("dialog", "travel-viewer");
  const viewerImg = el("img");
  const viewerClose = el("button", "travel-viewer-close", "×");
  viewerClose.type = "button";
  viewerClose.setAttribute("aria-label", T.close);
  viewer.append(viewerClose, viewerImg);
  viewerClose.addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", (e) => { if (e.target === viewer) viewer.close(); });

  root.replaceChildren(head, mapBox, chips, hint, panel, viewer);

  // --- selection ----------------------------------------------------------
  let current = null;

  function select(country) {
    current = country.slug;
    root.querySelectorAll("[data-slug]").forEach((node) => {
      node.classList.toggle("is-active", node.dataset.slug === current);
    });
    hint.hidden = true;
    panel.hidden = false;
    panelTitle.textContent = name(country);
    panelNote.textContent = note(country);
    panelNote.hidden = !note(country);
    grid.replaceChildren();

    if (!country.photos?.length) {
      grid.append(el("p", "travel-soon", T.soon));
      return;
    }
    country.photos.forEach((photo, i) => {
      const button = el("button", "travel-photo");
      button.type = "button";
      button.style.aspectRatio = `${photo.w} / ${photo.h}`;
      button.setAttribute("aria-label", `${T.photo} ${i + 1} · ${name(country)}`);
      const img = el("img");
      img.alt = "";
      button.append(img);
      grid.append(button);
      decryptPhoto(photo.thumb, key).then((url) => {
        if (current === country.slug) img.src = url;
      }).catch((err) => console.error(err));
      button.addEventListener("click", async () => {
        viewerImg.src = img.src; // thumbnail first, then the full-size version
        viewerImg.alt = `${name(country)} · ${T.photo} ${i + 1}`;
        viewer.showModal();
        try { viewerImg.src = await decryptPhoto(photo.full, key); } catch (err) { console.error(err); }
      });
    });
  }

  countries.forEach((country) => {
    const chip = el("button", "travel-chip", name(country));
    chip.type = "button";
    chip.dataset.slug = country.slug;
    chip.addEventListener("click", () => select(country));
    chips.append(chip);
  });

  // --- map (if the libraries load; the chips work without it) -------------
  await Promise.all(MAP_LIBS.map(loadScript));
  const world = await fetch(WORLD_ATLAS).then((r) => r.json());
  const { d3, topojson } = window;
  const W = 960;
  const H = 440;
  // frame the region from the Americas to central Europe, Cape Verde included
  const frame = { type: "MultiPoint", coordinates: [[-128, 8], [32, 8], [-128, 62], [32, 62]] };
  const projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], frame);
  const path = d3.geoPath(projection);
  const byIso = new Map(countries.map((c) => [c.iso, c]));

  const svg = d3.create("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", `${T.title}: ${countries.map(name).join(", ")}`);

  svg.append("g")
    .selectAll("path")
    .data(topojson.feature(world, world.objects.countries).features)
    .join("path")
    .attr("d", path)
    .attr("class", (f) => (byIso.has(f.id) ? "country visited" : "country"))
    .attr("data-slug", (f) => byIso.get(f.id)?.slug ?? null)
    .on("click", (_, f) => { if (byIso.has(f.id)) select(byIso.get(f.id)); })
    .filter((f) => byIso.has(f.id))
    .append("title")
    .text((f) => name(byIso.get(f.id)));

  const pins = svg.append("g")
    .selectAll("g")
    .data(countries)
    .join("g")
    .attr("class", "pin")
    .attr("data-slug", (c) => c.slug)
    .attr("transform", (c) => `translate(${projection(c.coords)})`)
    .on("click", (_, c) => select(c));
  pins.append("circle").attr("class", "pin-pulse").attr("r", 6);
  pins.append("circle").attr("class", "pin-dot").attr("r", 4.5);
  pins.append("title").text(name);

  mapBox.append(svg.node());
  if (current) root.querySelectorAll(`[data-slug="${current}"]`).forEach((n) => n.classList.add("is-active"));
}

// =====================
// CURIOSITIES (flip cards)
// =====================

// Delegated: the cards live inside the vault, which is filled in after unlocking.
document.addEventListener("click", (e) => {
  const card = e.target.closest(".curio-card");
  if (!card) return;
  const flipped = card.classList.toggle("is-flipped");
  card.setAttribute("aria-pressed", String(flipped));
});

// =====================
// MOTION
// =====================
// Scroll reveals, drawn timelines, counters, the streaming hero text, the
// language network behind the hero and the journey map.
// Everything is skipped when the visitor prefers reduced motion.

const motionOK = () => !prefersReducedMotion.matches && "IntersectionObserver" in window;

// --- scroll reveal ---------------------------------------------------------

const REVEAL_SELECTOR = [
  "section:not(.hero) > h2", ".what-card", ".project-card", ".academic-card",
  ".cert-card", ".skill-card", ".contact-card", ".journey-step",
  ".vault-hero", ".curio-card", ".travel",
].join(", ");
let revealObserver = null;

function observeReveal(root = document) {
  if (!motionOK()) return;
  revealObserver ||= new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      revealObserver.unobserve(el);
      el.classList.add("is-visible");
      // drop the classes afterwards so hover transforms work again
      const delay = parseInt(el.style.getPropertyValue("--reveal-delay"), 10) || 0;
      setTimeout(() => el.classList.remove("reveal", "is-visible"), 700 + delay);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

  root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
    if (el.classList.contains("reveal")) return;
    const siblings = [...el.parentElement.children].filter((c) => c.matches(REVEAL_SELECTOR));
    el.style.setProperty("--reveal-delay", `${Math.min(siblings.indexOf(el), 5) * 80}ms`);
    el.classList.add("reveal");
    revealObserver.observe(el);
  });
}

// --- counters (5 languages, 8 countries, ...) -------------------------------

let counterObserver = null;

function countUp(el) {
  const original = el.textContent.trim();
  const target = parseFloat(original.replace(",", "."));
  if (!Number.isFinite(target) || target === 0) return;
  const decimals = (original.split(/[.,]/)[1] || "").length;
  const comma = original.includes(",");
  const start = performance.now();
  const DURATION = 1100;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const value = target * (1 - Math.pow(1 - t, 3));
    let text = value.toFixed(decimals);
    if (comma) text = text.replace(".", ",");
    el.textContent = t < 1 ? text : original;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function observeCounters(root = document) {
  if (!motionOK()) return;
  counterObserver ||= new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      counterObserver.unobserve(entry.target);
      countUp(entry.target);
    });
  }, { threshold: 0.6 });
  root.querySelectorAll(".curio-big, .travel-stats strong").forEach((el) => counterObserver.observe(el));
}

// --- timelines draw themselves as you scroll --------------------------------

(function initTimelines() {
  if (!motionOK()) return;
  const timelines = [...document.querySelectorAll(".timeline")];
  timelines.forEach((t) => t.classList.add("is-drawing"));
  let queued = false;

  function update() {
    queued = false;
    const line = window.innerHeight * 0.7;
    timelines.forEach((timeline) => {
      const rect = timeline.getBoundingClientRect();
      if (!rect.height) return; // hidden in this mode
      const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
      timeline.style.setProperty("--progress", progress.toFixed(3));
      timeline.querySelectorAll(".timeline-item").forEach((item) => {
        item.classList.toggle("is-reached", item.getBoundingClientRect().top < line);
      });
    });
  }
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  update();
})();

// --- hero text streams in like an LLM answer -----------------------------
// Words are wrapped in spans that start transparent, so the layout never jumps
// and screen readers still get the full text.

(function initStream() {
  if (prefersReducedMotion.matches) return;
  const STREAMED = ".hero-text > [data-mode] > :is(h1, p)";
  const cursor = document.createElement("span");
  cursor.className = "stream-cursor";
  cursor.setAttribute("aria-hidden", "true");
  let timer = 0;

  function tokenize(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        tokenize(child);
        return;
      }
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.append(part);
        } else {
          const tok = document.createElement("span");
          tok.className = "tok";
          tok.textContent = part;
          frag.append(tok);
        }
      });
      child.replaceWith(frag);
    });
  }
  document.querySelectorAll(STREAMED).forEach(tokenize);

  function play() {
    clearInterval(timer);
    const block = [...document.querySelectorAll(".hero-text > [data-mode]")].find((b) => b.offsetParent);
    if (!block) return;
    const toks = [...block.querySelectorAll(".tok")];
    toks.forEach((t) => t.classList.remove("on"));
    cursor.classList.remove("is-done");
    let i = 0;
    timer = setInterval(() => {
      const tok = toks[i++];
      if (!tok) {
        clearInterval(timer);
        cursor.classList.add("is-done");
        return;
      }
      tok.classList.add("on");
      tok.after(cursor);
    }, 45);
  }

  setTimeout(play, 300);
  new MutationObserver(() => setTimeout(play, 150))
    .observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
})();

// --- language network behind the hero ---------------------------------------

(function initHeroNet() {
  const hero = document.querySelector(".hero");
  if (!hero || !motionOK()) return;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-net";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d");

  // academic mode draws words in four of my languages instead of dots
  const WORDS = ["língua", "language", "langue", "lengua", "dados", "data", "données", "datos",
    "palavra", "word", "mot", "palabra", "saber", "knowledge", "savoir", "texto", "text",
    "sentido", "meaning", "sens", "IA", "AI"];
  const LINK = 130;
  let nodes = [];
  let width = 0;
  let height = 0;
  let running = false;
  let frame = 0;
  const mouse = { x: -1e4, y: -1e4 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(70, Math.round((width * height) / 22000));
    nodes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      word: WORDS[i % WORDS.length],
    }));
    return true;
  }

  function draw() {
    if (!running) return;
    const words = document.body.dataset.view === "academic";
    ctx.clearRect(0, 0, width, height);

    for (const n of nodes) {
      // drift, with a gentle pull towards the cursor
      const dx = mouse.x - n.x;
      const dy = mouse.y - n.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 200) {
        n.vx += (dx / dist) * 0.012;
        n.vy += (dy / dist) * 0.012;
      }
      n.vx *= 0.99;
      n.vy *= 0.99;
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
        if (d > LINK) continue;
        ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - d / LINK) * 0.22})`;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }

    if (words) {
      ctx.font = `12px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = "rgba(199, 210, 254, 0.32)";
      for (const n of nodes) ctx.fillText(n.word, n.x + 4, n.y - 4);
    }
    ctx.fillStyle = "rgba(165, 180, 252, 0.7)";
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  }

  function start() {
    if (running || document.hidden) return;
    if (!resize()) return;
    running = true;
    canvas.classList.add("is-on");
    frame = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  let heroVisible = false;
  new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting;
    heroVisible ? start() : stop();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : heroVisible && start()));
  window.addEventListener("resize", () => { if (running) resize(); });
  window.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }, { passive: true });
})();

// --- journey map --------------------------------------------------------------

(function initJourney() {
  const section = document.getElementById("journey");
  if (!section) return;
  const box = section.querySelector(".journey-map");
  const steps = [...section.querySelectorAll(".journey-step")];
  const points = steps.map((s) => [parseFloat(s.dataset.lon), parseFloat(s.dataset.lat)]);
  const HOME = new Set(["132", "620", "250"]); // Cape Verde, Portugal, France
  let arcs = [];
  let stops = [];
  let current = 0;

  function apply() {
    steps.forEach((step, i) => step.classList.toggle("is-active", i === current));
    arcs.forEach((arc) => { arc.el.style.strokeDashoffset = arc.step <= current ? 0 : arc.length; });
    stops.forEach((stop) => {
      stop.g.classList.toggle("is-lit", stop.steps.some((i) => i <= current));
      stop.g.classList.toggle("is-current", stop.steps.includes(current));
    });
  }

  async function build() {
    await Promise.all(MAP_LIBS.map(loadScript));
    const world = await fetch(WORLD_ATLAS).then((r) => r.json());
    const { d3, topojson } = window;
    const W = 500;
    const H = 600;
    const frame = { type: "MultiPoint", coordinates: [[-27, 11], [7, 11], [-27, 52], [7, 52]] };
    const projection = d3.geoNaturalEarth1().fitExtent([[20, 20], [W - 20, H - 20]], frame);
    const path = d3.geoPath(projection);

    const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid slice");
    svg.append("g")
      .selectAll("path")
      .data(topojson.feature(world, world.objects.countries).features)
      .join("path")
      .attr("d", path)
      .attr("class", (f) => (HOME.has(f.id) ? "country is-home" : "country"));

    // one curved arc per move between different places
    const arcLayer = svg.append("g");
    points.forEach((to, i) => {
      if (i === 0) return;
      const from = points[i - 1];
      if (from[0] === to[0] && from[1] === to[1]) return;
      const [x0, y0] = projection(from);
      const [x1, y1] = projection(to);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const bend = Math.hypot(x1 - x0, y1 - y0) * 0.25;
      const angle = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
      const cx = mx + Math.cos(angle) * bend;
      const cy = my + Math.sin(angle) * bend;
      const el = arcLayer.append("path")
        .attr("class", "arc")
        .attr("d", `M${x0},${y0} Q${cx},${cy} ${x1},${y1}`)
        .node();
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length}`;
      el.style.strokeDashoffset = `${length}`;
      arcs.push({ el, length, step: i });
    });

    // one marker per distinct place, lit by every step that happens there
    const byPlace = new Map();
    steps.forEach((step, i) => {
      const key = points[i].join(",");
      if (!byPlace.has(key)) byPlace.set(key, { coords: points[i], name: step.dataset.place, steps: [] });
      byPlace.get(key).steps.push(i);
    });
    const stopLayer = svg.append("g");
    stops = [...byPlace.values()].map((place) => {
      const [x, y] = projection(place.coords);
      const g = stopLayer.append("g").attr("class", "stop").attr("transform", `translate(${x},${y})`);
      g.append("circle").attr("class", "stop-pulse").attr("r", 8);
      g.append("circle").attr("r", 5);
      g.append("text").attr("x", 12).attr("y", 5).text(place.name);
      return { g: g.node(), steps: place.steps };
    });

    box.append(svg.node());
    apply();
  }

  new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    build().catch((err) => console.error(err));
  }, { rootMargin: "400px 0px" }).observe(section);

  const stepObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      current = steps.indexOf(entry.target);
      apply();
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((step) => stepObserver.observe(step));
  apply();
})();

observeReveal();
observeCounters();
