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

// Shared by the footer date and the GitHub activity list.
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
      wrong: "That's not it. Try again, or request access above.",
      checking: "Checking…",
      unavailable: "The vault is unavailable right now. Try again later.",
    },
    pt: {
      wrong: "Não é essa. Tenta outra vez, ou pede acesso acima.",
      checking: "A verificar…",
      unavailable: "O cofre não está disponível agora. Tenta mais tarde.",
    },
  }[lang];

  const STORAGE_KEY = "vaultPass";
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const normalise = (s) => s.trim().toLowerCase();
  let vaultPromise = null;

  function loadVault() {
    vaultPromise ||= fetch("assets/vault.json", { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`vault.json: ${r.status}`);
      return r.json();
    });
    return vaultPromise;
  }

  // Returns the decrypted {en, pt} content, or null if no slot accepts the passphrase.
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
        return JSON.parse(new TextDecoder().decode(plain));
      } catch {
        // wrong slot, try the next one
      }
    }
    return null;
  }

  function show(data) {
    body.innerHTML = data[lang] || data.en || "";
    gate.hidden = true;
    content.hidden = false;
  }

  function lock() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
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
      const data = await decrypt(normalise(passphrase), await loadVault());
      if (!data) {
        if (!silent) {
          feedback.textContent = MESSAGES.wrong;
          feedback.className = "vault-feedback error";
        }
        return false;
      }
      try { localStorage.setItem(STORAGE_KEY, normalise(passphrase)); } catch {}
      feedback.textContent = "";
      show(data);
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
// GITHUB ACTIVITY (academic mode)
// =====================

(function initGithubActivity() {
  const section = document.getElementById("github-activity");
  const list = document.getElementById("githubRepos");
  if (!section || !list) return;

  const lang = document.documentElement.lang === "pt" ? "pt" : "en";
  const USER = "Txelito";
  const CACHE_KEY = "githubRepos";
  const UPDATED = { en: "Updated", pt: "Atualizado" }[lang];
  const NO_DESC = { en: "No description yet.", pt: "Ainda sem descrição." }[lang];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function render(repos) {
    const shown = repos
      .filter((r) => !r.fork && r.name.toLowerCase() !== USER.toLowerCase()) // skip the profile README repo
      .slice(0, 4);
    if (!shown.length) return;

    list.replaceChildren(...shown.map((repo) => {
      const card = el("a", "github-card");
      card.href = repo.html_url;
      card.target = "_blank";
      card.rel = "noopener";

      const head = el("div", "github-card-head");
      head.append(el("i", "fa-brands fa-github"), el("span", "github-name", repo.name));
      card.append(head, el("p", "github-desc", repo.description || NO_DESC));

      const meta = el("div", "github-meta");
      if (repo.language) meta.append(el("span", "github-lang", repo.language));
      meta.append(el("span", "", `${UPDATED} ${relativeTime(new Date(repo.pushed_at), lang)}`));
      card.append(meta);
      return card;
    }));
    section.hidden = false;
  }

  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch {}
  if (cached) {
    render(cached);
    return;
  }

  fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=10`)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((repos) => {
      // keep only what render() needs, so the cache stays small
      const slim = repos.map(({ name, html_url, description, language, pushed_at, fork }) =>
        ({ name, html_url, description, language, pushed_at, fork }));
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(slim)); } catch {}
      render(slim);
    })
    .catch(() => {});
})();
