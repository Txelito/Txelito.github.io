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

function setMode(mode) {
  document.body.setAttribute("data-view", mode);
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === mode);
  });
  try { localStorage.setItem("portfolioMode", mode); } catch {}
}

(function initMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get("v");
  const saved = VALID_MODES.includes(fromUrl)
    ? fromUrl
    : (localStorage.getItem("portfolioMode") || "pro");
  setMode(saved);
})();

document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.target));
});

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
