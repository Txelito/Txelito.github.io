// Mobile menu
const toggle = document.getElementById("mobileMenuToggle");
const menu = document.getElementById("mobileMenu");

toggle?.addEventListener("click", () => {
    menu.classList.toggle("active");
});

// Fade-in observer
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll(".fade-in").forEach(el => observer.observe(el));
