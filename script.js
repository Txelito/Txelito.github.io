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
  localStorage.setItem("portfolioMode", mode);
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
// PERSONAL VAULT (gate)
// =====================

(function initVault() {
  const gate = document.getElementById("vaultGate");
  const content = document.getElementById("vaultContent");
  const form = document.getElementById("vaultUnlockForm");
  const input = document.getElementById("vaultPassphrase");
  const feedback = document.getElementById("vaultFeedback");
  if (!gate || !content || !form || !input) return;

  // Change this word whenever you want to reset who has access.
  const PASSPHRASE = "grogue";

  function unlock() {
    gate.hidden = true;
    content.hidden = false;
  }

  if (localStorage.getItem("vaultUnlocked") === "true") {
    unlock();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const guess = input.value.trim().toLowerCase();
    if (guess === PASSPHRASE) {
      localStorage.setItem("vaultUnlocked", "true");
      feedback.textContent = "";
      feedback.className = "vault-feedback";
      unlock();
    } else {
      feedback.textContent = "Não é essa. Tenta outra vez, ou pede acesso acima.";
      feedback.className = "vault-feedback error";
    }
  });
})();
