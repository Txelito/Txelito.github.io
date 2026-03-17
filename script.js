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
