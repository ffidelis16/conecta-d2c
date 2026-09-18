(() => {
  const modal = document.querySelector("[data-preview-modal]");
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
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("form-modal-open");
    // O clique no CTA recebe foco ao fim do evento; aguardar esse ciclo garante que o foco migre ao diálogo.
    window.setTimeout(() => modal.querySelector("button[data-close-preview-modal]")?.focus(), 120);
  };

  document.querySelectorAll("[data-open-preview-modal]").forEach((trigger) => {
    trigger.addEventListener("click", () => openModal(trigger));
  });
  document.querySelectorAll("[data-close-preview-modal]").forEach((trigger) => {
    trigger.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (event) => {
    if (!modal?.classList.contains("is-open")) return;
    if (event.key === "Escape") closeModal();
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: .12 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  const nav = document.querySelector("[data-conecta-nav]");
  window.addEventListener("scroll", () => nav?.classList.toggle("is-scrolled", window.scrollY > 64), { passive: true });
})();
