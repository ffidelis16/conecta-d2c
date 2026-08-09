(function conectaD2C() {
  "use strict";

  const app = document.querySelector("[data-conecta-app]");
  if (!app) return;

  const track = (event, params = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  };

  const safeUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const pageType = app.dataset.page || "hub";

  const formConfig = {
    regional_interest: {
      id: app.dataset.formRegionalInterest || "",
      eyebrow: "NOVIDADES NA SUA REGIÃO",
      title: "Receba avisos",
      description: "Conte em qual região você quer receber novidades do Conecta D2C.",
    },
    event_pre_registration: {
      id: app.dataset.formEventPreRegistration || "",
      eyebrow: "PRÉ-CADASTRO",
      title: "Solicitar pré-cadastro",
      description: "Preencha seus dados para solicitar sua participação. A confirmação será enviada por e-mail, conforme a disponibilidade.",
    },
    event_registration: {
      id: app.dataset.formEventRegistration || "",
      eyebrow: "INSCRIÇÃO",
      title: "Confirmar presença",
      description: "Preencha seus dados para solicitar sua participação. A confirmação será enviada por e-mail, conforme a disponibilidade.",
    },
  };

  const modal = document.querySelector("[data-form-modal]");
  let lastFocus = null;
  let formScriptPromise = null;
  let modalContext = {};

  const focusableElements = () => modal ? Array.from(modal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")) : [];

  const closeForm = () => {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("form-modal-open");
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  const ensureHubSpotScript = (portalId) => {
    if (window.customElements && customElements.get("hs-form-frame")) return Promise.resolve();
    if (formScriptPromise) return formScriptPromise;

    formScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://js.hsforms.net/forms/embed/${portalId}.js`;
      script.async = true;
      script.dataset.conectaHubspotEmbed = "true";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return formScriptPromise;
  };

  const renderForm = async (type) => {
    const config = formConfig[type];
    const target = modal?.querySelector("[data-form-modal-embed]");
    if (!config || !target) return;

    target.replaceChildren();
    if (!config.id) {
      const pending = document.createElement("p");
      pending.className = "form-modal__pending";
      pending.textContent = "O formulário deste fluxo será conectado na configuração final do HubSpot.";
      target.appendChild(pending);
      return;
    }

    try {
      await ensureHubSpotScript(app.dataset.hubspotPortalId);
      const form = document.createElement("hs-form-frame");
      form.setAttribute("data-portal-id", app.dataset.hubspotPortalId);
      form.setAttribute("data-form-id", config.id);
      form.setAttribute("data-region", "na1");
      form.dataset.formContext = type;
      form.dataset.eventId = modalContext.eventId || "";
      form.dataset.eventName = modalContext.eventName || "";
      target.appendChild(form);
    } catch (error) {
      const failure = document.createElement("p");
      failure.className = "form-modal__pending";
      failure.textContent = "Não foi possível carregar o formulário agora. Tente novamente em alguns instantes.";
      target.appendChild(failure);
      track("form_error", { form_context: type, page_type: pageType });
    }
  };

  const openForm = async (type, trigger) => {
    const config = formConfig[type];
    if (!modal || !config) return;
    lastFocus = trigger || document.activeElement;
    modalContext = {
      type,
      eventId: trigger?.dataset.eventId || "",
      eventName: trigger?.dataset.eventName || "",
      cta: trigger?.dataset.cta || "cta",
    };
    window.conectaD2CFormContext = modalContext;
    modal.querySelector("[data-form-modal-eyebrow]").textContent = config.eyebrow;
    modal.querySelector("[data-form-modal-title]").textContent = config.title;
    modal.querySelector("[data-form-modal-description]").textContent = config.description;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("form-modal-open");
    track("form_open", {
      form_context: type,
      event_id: modalContext.eventId || undefined,
      cta: modalContext.cta,
      page_type: pageType,
    });
    requestAnimationFrame(() => modal.querySelector("[data-close-form]")?.focus());
    await renderForm(type);
  };

  document.querySelectorAll("[data-open-form]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const type = trigger.dataset.openForm;
      track("cta_click", { cta: trigger.dataset.cta || "cta", form_context: type, page_type: pageType });
      openForm(type, trigger);
    });
  });
  document.querySelectorAll("[data-close-form]").forEach((trigger) => trigger.addEventListener("click", closeForm));

  const trackAndOpenForm = (type, trigger) => {
    track("cta_click", { cta: trigger.dataset.cta || "cta", form_context: type, page_type: pageType });
    openForm(type, trigger);
  };

  document.addEventListener("keydown", (event) => {
    if (!modal?.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      closeForm();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "hsFormCallback" || message.eventName !== "onFormSubmitted") return;
    track("form_submit", {
      form_context: modalContext.type || "unknown",
      event_id: modalContext.eventId || undefined,
      form_id: formConfig[modalContext.type]?.id || undefined,
      page_type: pageType,
    });
    track("generate_lead", { form_context: modalContext.type || "unknown", page_type: pageType });
  });

  const nav = document.querySelector("[data-conecta-nav]");
  const navToggle = nav?.querySelector("[data-nav-toggle]");
  const navLinks = nav?.querySelector(".conecta-nav__links");
  const updateNav = () => nav?.classList.toggle("is-scrolled", window.scrollY > 64);
  updateNav();
  window.addEventListener("scroll", updateNav, { passive: true });
  navToggle?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }));

  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const trackElement = carousel.querySelector("[data-carousel-track]");
    carousel.querySelector("[data-carousel-prev]")?.addEventListener("click", () => trackElement?.scrollBy({ left: -315, behavior: "smooth" }));
    carousel.querySelector("[data-carousel-next]")?.addEventListener("click", () => trackElement?.scrollBy({ left: 315, behavior: "smooth" }));
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  }

  if (pageType !== "hub") return;

  const seedEvents = [
    {
      event_id: "fortaleza-2026-08-20",
      event_name: "Conecta D2C Fortaleza",
      city: "Fortaleza",
      state: "CE",
      region: "Nordeste",
      venue: "Esttaleiro Parrilla do Mar",
      date: "2026-08-20",
      time: "16:30",
      status: "confirmed",
      featured: "SIM",
      display_order: "1",
      theme: "Negócios, conteúdo e conexões em um fim de tarde à beira-mar.",
      partner: "Nuvemshop + Salte Commerce",
      event_url: "/eventos/conecta-d2c/fortaleza",
      cta_type: "event_pre_registration",
      published: "SIM",
      last_updated: "2026-08-09",
    },
    {
      event_id: "porto-alegre-2026",
      event_name: "Conecta D2C Porto Alegre",
      city: "Porto Alegre",
      state: "RS",
      region: "Sul",
      venue: "",
      date: "",
      time: "",
      status: "coming_soon",
      featured: "NÃO",
      display_order: "2",
      theme: "Recorrência, margem e fidelização no e-commerce",
      partner: "",
      event_url: "",
      cta_type: "regional_interest",
      published: "SIM",
      last_updated: "2026-08-09",
    },
  ];

  const isPlaceholderUrl = (value) => !value || value.includes("__AGENDA_PUBLIC_URL__");
  const parseDelimited = (text) => {
    const delimiter = text.split("\n").find((line) => line.trim())?.includes(";") ? ";" : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows.shift().map((header) => header.replace(/^\uFEFF/, "").trim());
    return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  };

  const normalizeEvent = (event) => ({
    ...event,
    display_order: Number(event.display_order || 999),
    published: normalizeText(event.published) === "sim",
    status: normalizeText(event.status || "coming_soon"),
    cta_type: normalizeText(event.cta_type || "regional_interest"),
    latitude: Number(event.latitude),
    longitude: Number(event.longitude),
  });

  const agendaToggle = document.querySelector("[data-agenda-toggle]");
  const agendaPanel = document.querySelector("[data-agenda-panel]");
  const agendaSearch = document.querySelector("[data-agenda-search]");
  const agendaSummary = document.querySelector("[data-agenda-summary]");
  const agendaResults = document.querySelector("[data-agenda-results]");
  const agendaPagination = document.querySelector("[data-agenda-pagination]");
  let events = seedEvents.map(normalizeEvent);
  let currentPage = 1;
  const PAGE_SIZE = 10;

  const formatDate = (value) => {
    if (!value) return "EM BREVE";
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return "EM BREVE";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(year, month - 1, day)).replace(".", "").toUpperCase();
  };

  const actionForEvent = (event) => {
    if (event.cta_type === "none" || event.status === "past") return null;
    if (event.event_url && safeUrl(event.event_url)) {
      const link = document.createElement("a");
      link.className = "button";
      link.href = safeUrl(event.event_url);
      link.textContent = "Ver edição";
      link.addEventListener("click", () => track("cta_click", { cta: "agenda-event-page", event_id: event.event_id || undefined, page_type: pageType }));
      return link;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.dataset.openForm = event.cta_type === "event_registration" ? "event_registration" : event.cta_type === "event_pre_registration" ? "event_pre_registration" : "regional_interest";
    button.dataset.eventId = event.event_id || "";
    button.dataset.eventName = event.event_name || "";
    button.dataset.cta = "agenda-event";
    button.textContent = button.dataset.openForm === "regional_interest" ? "Cadastrar interesse" : "Pré-cadastro";
    button.addEventListener("click", () => trackAndOpenForm(button.dataset.openForm, button));
    return button;
  };

  const createRow = (event) => {
    const row = document.createElement("article");
    row.className = "agenda-row";
    const date = document.createElement("p");
    date.className = "agenda-row__date";
    date.textContent = formatDate(event.date);
    const title = document.createElement("h3");
    title.textContent = `${event.city || event.event_name || "Nova edição"}${event.state ? ` / ${event.state}` : ""}`;
    const details = document.createElement("p");
    details.textContent = [event.theme, event.venue, event.time && `${event.time}`].filter(Boolean).join(" · ") || "Mais informações em breve";
    row.append(date, title, details);
    const action = actionForEvent(event);
    if (action) row.appendChild(action);
    return row;
  };

  const activeEvents = () => events.filter((event) => event.published && event.status !== "past").sort((a, b) => a.display_order - b.display_order);
  const eventsWithCoordinates = () => activeEvents().filter((event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude));
  const distanceInKilometers = (from, to) => {
    const earthRadiusKm = 6371;
    const toRadians = (value) => value * Math.PI / 180;
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const distance = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));
  };
  const renderNearestEvents = (origin) => {
    const nearest = eventsWithCoordinates()
      .map((event) => ({ event, distance: distanceInKilometers(origin, event) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    agendaResults.replaceChildren();
    agendaPagination.replaceChildren();
    nearest.forEach(({ event }) => agendaResults.appendChild(createRow(event)));
    agendaSummary.textContent = nearest.length ? `${nearest.length} ${nearest.length === 1 ? "edição próxima" : "edições próximas"}` : "Nenhuma edição próxima encontrada";
  };
  const renderAgenda = () => {
    if (!agendaResults || !agendaSummary || !agendaPagination) return;
    const search = normalizeText(agendaSearch?.value);
    const list = activeEvents().filter((event) => !search || [event.city, event.state, event.region, event.event_name, event.theme].some((value) => normalizeText(value).includes(search)));
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    agendaResults.replaceChildren();
    agendaPagination.replaceChildren();
    if (!pageItems.length) {
      const empty = document.createElement("div");
      empty.className = "agenda-empty";
      const message = document.createElement("p");
      message.textContent = "Não encontramos uma edição para essa busca. Receba avisos quando o Conecta D2C chegar perto de você.";
      const action = document.createElement("button");
      action.type = "button";
      action.className = "button button--outline";
      action.dataset.openForm = "regional_interest";
      action.dataset.cta = "agenda-empty";
      action.textContent = "Receber avisos";
      action.addEventListener("click", () => trackAndOpenForm("regional_interest", action));
      empty.append(message, action);
      if (search && eventsWithCoordinates().length) {
        const nearestAction = document.createElement("button");
        const nearestStatus = document.createElement("p");
        nearestAction.type = "button";
        nearestAction.className = "button button--text";
        nearestAction.textContent = "Ver até 3 edições mais próximas";
        nearestAction.addEventListener("click", () => {
          track("agenda_nearest_requested", { page_type: pageType });
          if (!navigator.geolocation) {
            nearestStatus.textContent = "Seu navegador não disponibiliza a localização. Você ainda pode receber avisos para sua região.";
            return;
          }
          nearestAction.disabled = true;
          nearestAction.textContent = "Buscando edições próximas…";
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => renderNearestEvents({ latitude: coords.latitude, longitude: coords.longitude }),
            () => {
              nearestAction.disabled = false;
              nearestAction.textContent = "Tentar localizar novamente";
              nearestStatus.textContent = "Não foi possível acessar sua localização. Você ainda pode receber avisos para sua região.";
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
          );
        });
        empty.append(nearestAction, nearestStatus);
      }
      agendaResults.appendChild(empty);
      agendaSummary.textContent = "Nenhuma edição encontrada";
      return;
    }
    pageItems.forEach((event) => agendaResults.appendChild(createRow(event)));
    agendaSummary.textContent = `${list.length} ${list.length === 1 ? "edição encontrada" : "edições encontradas"}`;
    if (totalPages > 1) {
      for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(page);
        if (page === currentPage) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => {
          currentPage = page;
          renderAgenda();
          agendaPanel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        });
        agendaPagination.appendChild(button);
      }
    }
  };

  const loadAgenda = async () => {
    const source = app.dataset.agendaUrl || "";
    if (isPlaceholderUrl(source)) {
      renderAgenda();
      return;
    }
    try {
      const response = await fetch(source, { credentials: "omit" });
      if (!response.ok) throw new Error(`Agenda indisponível: ${response.status}`);
      const parsed = parseDelimited(await response.text()).map(normalizeEvent).filter((event) => event.event_id);
      if (parsed.length) events = parsed;
      renderAgenda();
    } catch (error) {
      renderAgenda();
      track("agenda_load_error", { page_type: pageType });
    }
  };

  agendaToggle?.addEventListener("click", () => {
    const opening = agendaPanel.hidden;
    agendaPanel.hidden = !opening;
    agendaToggle.setAttribute("aria-expanded", String(opening));
    agendaToggle.innerHTML = opening ? "Fechar agenda <span aria-hidden=\"true\">−</span>" : "Abrir agenda <span aria-hidden=\"true\">+</span>";
    if (opening) {
      track("agenda_open", { page_type: pageType });
      loadAgenda();
    }
  });
  agendaSearch?.addEventListener("input", () => {
    currentPage = 1;
    renderAgenda();
  });
})();
