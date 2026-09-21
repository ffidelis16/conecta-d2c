/* Prévia local — E-commerce Prateado. Sem formulário ou tracking externo. */
(() => {
  const modal = document.querySelector("[data-form-modal]");
  const nav = document.querySelector("[data-conecta-nav]");
  let lastFocus = null;

  const closeModal = () => {
    if (!modal?.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("form-modal-open");
    lastFocus?.focus();
  };

  const openModal = (trigger) => {
    lastFocus = trigger;
    modal?.classList.add("is-open");
    modal?.setAttribute("aria-hidden", "false");
    document.body.classList.add("form-modal-open");
    requestAnimationFrame(() => modal?.querySelector("button[data-close-registration]")?.focus());
  };

  document.querySelectorAll("[data-open-registration]").forEach((trigger) => trigger.addEventListener("click", () => openModal(trigger)));
  document.querySelectorAll("[data-close-registration]").forEach((trigger) => trigger.addEventListener("click", closeModal));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key !== "Tab" || !modal?.classList.contains("is-open")) return;
    const items = Array.from(modal.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
    const first = items.at(0);
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  window.addEventListener("scroll", () => nav?.classList.toggle("is-scrolled", window.scrollY > 64), { passive: true });
})();
