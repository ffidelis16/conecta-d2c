/* Camada do modelo: nenhum formulário, analytics ou envio externo. */
(() => {
  const body = document.body,
    track = document.querySelector(".partner-logos"),
    group = track.firstElementChild;
  const clone = group.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("img").forEach((i) => (i.alt = ""));
  track.append(clone);
  const marquee = document.querySelector(".partners-marquee");
  marquee.tabIndex = 0;
  function motion(off) {
    body.dataset.motion = off ? "off" : "on";
    document.querySelectorAll("#pause-motion").forEach((b) => {
      b.setAttribute("aria-pressed", String(off));
      b.textContent = off ? "Retomar movimento" : "Pausar movimento";
    });
  }
  document
    .getElementById("pause-motion")
    ?.addEventListener("click", () => motion(body.dataset.motion !== "off"));
  new ResizeObserver(() =>
    track.style.setProperty(
      "--partner-duration",
      `${group.getBoundingClientRect().width / 28}s`,
    ),
  ).observe(group);
  document.getElementById("toggle-material")?.addEventListener("click", (e) => {
    const states = ["dark", "silver", "light"];
    const next =
      states[(states.indexOf(body.dataset.material) + 1) % states.length];
    body.dataset.material = next;
    e.currentTarget.setAttribute("aria-pressed", String(next !== "dark"));
    e.currentTarget.textContent =
      next === "dark"
        ? "Testar prateado"
        : next === "silver"
          ? "Testar claro"
          : "Voltar ao azul escuro";
    document
      .getElementById("contexto")
      .scrollIntoView({
        behavior:
          e.detail && !matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "smooth"
            : "instant",
      });
  });
  // A orientação existe só no modelo; um link real de mapa não é interceptado.
  document.querySelector('[data-open-map][href="#mapa-instrucoes"]')?.addEventListener("click", () => {
    const instructions = document.getElementById("mapa-instrucoes");
    instructions?.setAttribute("tabindex", "-1");
    instructions?.focus({ preventScroll: true });
  });
})();
