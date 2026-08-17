(() => {
  const agendaLink = document.querySelector("[data-open-agenda]");
  const agendaToggle = document.querySelector("[data-agenda-toggle]");
  const agendaPanel = document.querySelector("[data-agenda-panel]");

  if (!agendaLink || !agendaToggle || !agendaPanel) return;

  const openAgenda = () => {
    if (!agendaPanel.classList.contains("is-open")) agendaToggle.click();
  };

  agendaLink.addEventListener("click", () => {
    window.setTimeout(openAgenda, 0);
  });
})();
