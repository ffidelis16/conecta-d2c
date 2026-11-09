/* Transporte público do hub. A origem é fixa e nenhum segredo vai para o navegador. */
(function(root){
  'use strict';
  const pending = new Map();
  function validateEndpoint(value) {
    const url = new URL(value);
    if(url.protocol!=='https:' || url.hostname!=='script.google.com' || !/^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname) || url.username || url.password || url.search || url.hash) throw new Error('Use a URL /exec da implantação Apps Script.');
    return url;
  }
  root.__conectaHubFeed = function(data) {
    const entry = pending.get(data?.requestId);
    if(entry) entry.finish(data);
  };
  function validateSnapshot(data, now=Date.now()) {
    if(!data || data.ok!==true || data.schemaVersion!==1 || !Array.isArray(data.events) || !Array.isArray(data.visuals) || !/^[a-f0-9]{64}$/.test(data.revision || '')) throw new Error('Resposta de agenda inválida.');
    const time=Date.parse(data.generatedAt), expiry=Date.parse(data.expiresAt);
    if(!Number.isFinite(time) || !Number.isFinite(expiry) || time>now+60000 || now-time>900000 || expiry<=time || expiry>time+900000) throw new Error('Agenda desatualizada.');
    if(data.events.length>1500 || data.visuals.length>2000) throw new Error('Resposta de agenda excedeu o limite.');
    return data;
  }
  function load(url) {
    return new Promise((resolve,reject)=>{
      let endpoint; try {endpoint=validateEndpoint(url);} catch(error){reject(error);return;}
      const bytes=new Uint32Array(3); root.crypto.getRandomValues(bytes);
      const id='h'+Array.from(bytes,n=>n.toString(36)).join('');
      endpoint.searchParams.set('callback','__conectaHubFeed');
      endpoint.searchParams.set('requestId',id); endpoint.searchParams.set('v',String(Date.now()));
      const script=document.createElement('script'); script.async=true; script.referrerPolicy='no-referrer';
      let timer;
      const end=(data,error)=>{
        pending.delete(id); clearTimeout(timer); script.remove();
        if(error){reject(error);return;}
        try {resolve(validateSnapshot(data));}catch(e){reject(e);}
      };
      pending.set(id,{finish:data=>end(data)});
      script.onerror=()=>end(null,new Error('Não foi possível consultar a agenda.'));
      timer=setTimeout(()=>end(null,new Error('Tempo de resposta da agenda excedido.')),25000);
      script.src=endpoint.href; document.head.append(script);
    });
  }
  root.ConectaHubFeedClient={load,validateEndpoint,validateSnapshot};
})(typeof window!=='undefined'?window:globalThis);

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
      const url = new URL(value, document.baseURI);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };

  const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const pageType = app.dataset.page || "hub";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const formConfig = {
    regional_interest: {
      id: app.dataset.formRegionalInterest || "",
      eyebrow: "NOVIDADES NA SUA REGIÃO",
      title: "Receba avisos",
      description: "Conte em qual região você quer receber novidades do Conecta D2C.",
    },
    event_pre_registration: {
      id: app.dataset.formEventPreRegistration || "",
      eyebrow: "INTERESSE NA EDIÇÃO",
      title: "Receba um aviso quando abrirem as inscrições",
      description: "Deixe seu contato para saber quando as inscrições desta edição abrirem.",
    },
    event_registration: {
      id: app.dataset.formEventRegistration || "",
      eyebrow: "INSCRIÇÃO",
      title: "Confirmar presença",
      description: "Preencha seus dados para solicitar sua participação. A confirmação será enviada por e-mail, conforme a disponibilidade.",
    },
  };
  const formAvailable = type => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(formConfig[type]?.id || "");
  for (const selector of [".regional-section", ".agenda-aside--blue"]) {
    const section = app.querySelector(selector);
    if (section) section.hidden = !formAvailable("regional_interest");
  }

  const modal = document.querySelector("[data-form-modal]");
  const interestType = "event_pre_registration";
  const eventProperty = "conecta_d2c_event_requested";
  const formPreview = Boolean(app.dataset.previewDate);
  const formFrames = new Map();
  let lastFocus = null;
  let formScriptPromise = null;
  let modalContext = {};
  // Impede que os dois callbacks do HubSpot registrem a mesma submissão.
  // É reiniciado a cada nova abertura do lightbox para não bloquear uma nova tentativa legítima.
  let currentFormSubmissionKey = "";

  const trackSubmission = (type, formId) => {
    const eventId = modalContext.eventId || "";
    const submissionKey = [type || "unknown", formId || "unknown", eventId].join(":");
    if (currentFormSubmissionKey === submissionKey) return;
    currentFormSubmissionKey = submissionKey;
    track("form_submit", {
      form_context: type || "unknown",
      form_id: formId || undefined,
      event_id: eventId || undefined,
      page_type: pageType,
    });
    track("generate_lead", {
      form_context: type || "unknown",
      form_id: formId || undefined,
      event_id: eventId || undefined,
      page_type: pageType,
    });
  };

  const runAfterCtaResponse = (trigger, callback) => {
    if (!(trigger instanceof HTMLElement) || reducedMotion) {
      callback();
      return;
    }
    trigger.classList.remove("is-activating");
    requestAnimationFrame(() => trigger.classList.add("is-activating"));
    window.setTimeout(() => {
      trigger.classList.remove("is-activating");
      callback();
    }, 120);
  };

  const focusableElements = () => modal ? Array.from(modal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")) : [];

  const closeForm = () => {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("form-modal-open");
    if (modalContext.type === interestType) updateRequestedEvent("");
    modalContext = {};
    if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus();
    else document.querySelector("[data-agenda-toggle]")?.focus();
  };

  function updateRequestedEvent(eventId) {
    const url = new URL(location.href);
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (eventId) url.searchParams.set(eventProperty, eventId);
    else url.searchParams.delete(eventProperty);
    history.replaceState(history.state, "", url);
  }

  const ensureHubSpotScript = (portalId) => {
    if (formScriptPromise) return formScriptPromise;

    const formSource = `https://js.hsforms.net/forms/embed/${portalId}.js`;

    formScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${formSource}"]`);
      if (existing?.dataset.loaded === "true" || window.HubSpotFormsV4) {
        resolve();
        return;
      }
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = formSource;
      script.async = true;
      script.dataset.conectaHubspotEmbed = "true";
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
    formScriptPromise = formScriptPromise.catch(error => {
      document.querySelector('script[data-conecta-hubspot-embed="true"]')?.remove();
      formScriptPromise = null;
      throw error;
    });
    return formScriptPromise;
  };

  const embedStatus = document.createElement("p");
  embedStatus.className = "form-modal__loading";
  embedStatus.setAttribute("role", "status");

  async function applyFormContext(record, context) {
    if (modalContext !== context || !record.instance) return;
    record.frame.inert = true;
    try {
      if (context.type === interestType) {
        const field = "0-1/" + eventProperty;
        await record.instance.setFieldValue(field, [context.eventId]);
        const value = await record.instance.getFieldValue(field);
        if ((Array.isArray(value) ? value.join("") : value) !== context.eventId) throw new Error("Identificação da edição não confirmada.");
      }
      if (modalContext !== context) return;
      record.frame.inert = formPreview;
      record.frame.hidden = false;
      embedStatus.textContent = formPreview ? "Formulário em demonstração. O envio é habilitado na página oficial." : "";
      modal.dataset.formState = "ready";
    } catch {
      if (modalContext === context) showFormError(record);
    }
  }

  function showFormError(record) {
    record.frame.hidden = true;
    embedStatus.textContent = "O formulário não está disponível agora. Feche esta janela e tente novamente.";
    modal.dataset.formState = "error";
    track("form_error", { form_context: modalContext.type, page_type: pageType });
  }

  window.addEventListener("hs-form-event:on-ready", event => {
    const record = formFrames.get(event.detail?.formId);
    if (!record) return;
    record.instance = window.HubSpotFormsV4?.getFormFromEvent(event);
    if (formConfig[modalContext.type]?.id === event.detail.formId) void applyFormContext(record, modalContext);
  });

  const renderForm = async (type) => {
    const config = formConfig[type];
    const target = modal?.querySelector("[data-form-modal-embed]");
    if (!config || !target) return;

    const context = modalContext;
    modal.dataset.formState = "loading";
    embedStatus.textContent = "Carregando formulário…";
    if (!embedStatus.isConnected) target.prepend(embedStatus);
    for (const record of formFrames.values()) { record.frame.hidden = true; record.frame.inert = true; }
    let record = formFrames.get(config.id);
    if (record?.instance) return applyFormContext(record, context);
    if (!record) {
      const frame = document.createElement("div");
      frame.className = "hs-form-frame";
      frame.dataset.portalId = app.dataset.hubspotPortalId;
      frame.dataset.formId = config.id;
      frame.dataset.region = "na1";
      frame.inert = true;
      frame.hidden = true;
      record = { frame, instance: null };
      formFrames.set(config.id, record);
    }
    try {
      await ensureHubSpotScript(app.dataset.hubspotPortalId);
      if (modalContext !== context) return;
      if (!record.frame.isConnected) target.append(record.frame);
      window.setTimeout(() => {
        if (modalContext !== context || modal.dataset.formState !== "loading") return;
        showFormError(record);
        if (!record.instance) {
          record.frame.remove();
          formFrames.delete(config.id);
        }
      }, 12000);
    } catch {
      if (modalContext === context) showFormError(record);
    }
  };

  const openForm = async (type, trigger) => {
    const config = formConfig[type];
    if (!modal || !formAvailable(type)) return;
    lastFocus = trigger || document.activeElement;
    modalContext = {
      type,
      eventId: trigger?.dataset.eventId || "",
      eventName: trigger?.dataset.eventName || "",
      cta: trigger?.dataset.cta || "cta",
    };
    if (type === interestType && !modalContext.eventId) return;
    if (type === interestType) updateRequestedEvent(modalContext.eventId);
    currentFormSubmissionKey = "";
    window.conectaD2CFormContext = modalContext;
    modal.querySelector("[data-form-modal-eyebrow]").textContent = config.eyebrow;
    modal.querySelector("[data-form-modal-title]").textContent = type === interestType && modalContext.eventName
      ? config.title + " para " + modalContext.eventName
      : config.title;
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

  const trackAndOpenForm = (type, trigger) => {
    track("cta_click", { cta: trigger.dataset.cta || "cta", form_context: type,
      event_id: trigger.dataset.eventId || undefined, page_type: pageType });
    runAfterCtaResponse(trigger, () => openForm(type, trigger));
  };
  document.querySelectorAll("[data-open-form]").forEach((trigger) => {
    trigger.addEventListener("click", () => trackAndOpenForm(trigger.dataset.openForm, trigger));
  });
  document.querySelectorAll("[data-close-form]").forEach((trigger) => trigger.addEventListener("click", closeForm));


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

  window.addEventListener("hs-form-event:on-submission:success", (event) => {
    if (formPreview) return;
    const submittedFormId = event.detail?.formId || event.detail?.form_id;
    const config = formConfig[modalContext.type];
    if (!submittedFormId || submittedFormId !== config?.id) return;
    trackSubmission(modalContext.type, submittedFormId);
  });

  const nav = document.querySelector("[data-conecta-nav]");
  const navToggle = nav?.querySelector("[data-nav-toggle]");
  const navLinks = nav?.querySelector(".conecta-nav__links");
  const scrollProgress = nav?.querySelector("[data-scroll-progress]");
  let pendingScrollUpdate = false;
  const updateNav = () => {
    nav?.classList.toggle("is-scrolled", window.scrollY > 64);
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight)) : 0;
    scrollProgress?.style.setProperty("--scroll-progress", String(progress));
  };
  const scheduleNavUpdate = () => {
    if (pendingScrollUpdate) return;
    pendingScrollUpdate = true;
    requestAnimationFrame(() => {
      updateNav();
      pendingScrollUpdate = false;
    });
  };
  updateNav();
  window.addEventListener("scroll", scheduleNavUpdate, { passive: true });
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

  document.querySelectorAll("[data-principle-slider]").forEach((slider) => {
    const trackElement = slider.querySelector("[data-principle-track]");
    const cards = Array.from(slider.querySelectorAll(".principle-card"));
    const counter = slider.querySelector("[data-principle-counter]");
    const previous = slider.querySelector('[data-principle-prev]');
    const next = slider.querySelector('[data-principle-next]');
    if (counter) {
      counter.className = 'principle-slider__dots';
      counter.replaceChildren(...cards.map(() => document.createElement('i')));
    }
    const updateCounter = () => {
      if (!trackElement || !counter || !cards.length) return;
      const nearest = cards.reduce((best, card, index) => {
        const distance = Math.abs(card.getBoundingClientRect().left - trackElement.getBoundingClientRect().left);
        return distance < best.distance ? { index, distance } : best;
      }, { index: 0, distance: Infinity });
      counter.setAttribute('aria-label', `Card ${nearest.index + 1} de ${cards.length}`);
      Array.from(counter.children).forEach((dot, index) => dot.classList.toggle('is-current', index === nearest.index));
      if (previous) previous.disabled = nearest.index === 0;
      if (next) next.disabled = nearest.index === cards.length - 1;
    };
    const move = (direction) => {
      if (!trackElement || !cards.length) return;
      const step = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(trackElement).gap || 0);
      trackElement.scrollBy({ left: step * direction, behavior: reducedMotion ? "auto" : "smooth" });
    };
    slider.querySelector("[data-principle-prev]")?.addEventListener("click", () => move(-1));
    slider.querySelector("[data-principle-next]")?.addEventListener("click", () => move(1));
    trackElement?.addEventListener("scroll", updateCounter, { passive: true });
    updateCounter();
  });

  const galleryLightbox = document.querySelector("[data-gallery-lightbox]");
  const galleryImage = galleryLightbox?.querySelector("[data-gallery-lightbox-image]");
  const galleryTitle = galleryLightbox?.querySelector("[data-gallery-title]");
  const galleryCaption = galleryLightbox?.querySelector("[data-gallery-lightbox-caption]");
  const galleryCounter = galleryLightbox?.querySelector("[data-gallery-counter]");
  const galleryPrevious = galleryLightbox?.querySelector("[data-gallery-prev]");
  const galleryNext = galleryLightbox?.querySelector("[data-gallery-next]");
  const galleryThumbnails = galleryLightbox?.querySelector("[data-gallery-thumbnails]");
  let galleryItems = [];
  let galleryIndex = 0;
  let galleryLastFocus = null;

  const renderGallery = () => {
    const item = galleryItems[galleryIndex];
    if (!item || !galleryImage || !galleryCaption || !galleryCounter) return;
    galleryImage.src = item.src;
    galleryImage.alt = item.alt;
    galleryCaption.textContent = item.caption;
    galleryCounter.textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
    if (galleryPrevious) galleryPrevious.disabled = galleryItems.length < 2;
    if (galleryNext) galleryNext.disabled = galleryItems.length < 2;
    if (galleryThumbnails) {
      const radius = window.matchMedia("(max-width: 760px)").matches ? 2 : 4;
      const start = Math.max(0, Math.min(galleryIndex - radius, galleryItems.length - (radius * 2 + 1)));
      const end = Math.min(galleryItems.length, start + radius * 2 + 1);
      galleryThumbnails.replaceChildren();
      for (let index = start; index < end; index++) {
        const thumbnail = document.createElement("button");
        thumbnail.type = "button";
        thumbnail.className = "gallery-lightbox__thumbnail";
        thumbnail.setAttribute("aria-label", `Abrir imagem ${index + 1}`);
        thumbnail.setAttribute("aria-current", index === galleryIndex ? "true" : "false");
        const thumbnailImage = document.createElement("img");
        thumbnailImage.src = galleryItems[index].src;
        thumbnailImage.alt = "";
        thumbnailImage.loading = "lazy";
        thumbnail.appendChild(thumbnailImage);
        thumbnail.addEventListener("click", () => {
          galleryIndex = index;
          renderGallery();
        });
        galleryThumbnails.appendChild(thumbnail);
      }
    }
    [-1, 1].forEach((offset) => {
      if (galleryItems.length < 2) return;
      const preload = new Image();
      preload.src = galleryItems[(galleryIndex + offset + galleryItems.length) % galleryItems.length].src;
    });
  };

  const closeGallery = () => {
    if (!galleryLightbox?.classList.contains("is-open")) return;
    galleryLightbox.classList.remove("is-open");
    galleryLightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gallery-lightbox-open");
    if (galleryLastFocus instanceof HTMLElement) galleryLastFocus.focus();
  };

  const openGallery = (card) => {
    if (!galleryLightbox || !galleryImage) return;
    const title = card.querySelector("h3")?.textContent?.trim() || "Edição anterior";
    galleryItems = Array.from(card.querySelectorAll("[data-gallery-image]")).map((item) => ({
      src: item instanceof HTMLImageElement ? item.currentSrc || item.src : item.getAttribute("href") || "",
      alt: item.getAttribute("data-gallery-alt") || item.getAttribute("alt") || title,
      caption: item.getAttribute("data-gallery-caption") || title,
    })).filter((item) => item.src);
    if (!galleryItems.length) return;
    galleryIndex = 0;
    galleryLastFocus = card;
    if (galleryTitle) galleryTitle.textContent = title;
    renderGallery();
    galleryLightbox.classList.add("is-open");
    galleryLightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
    requestAnimationFrame(() => galleryLightbox.querySelector("button[data-gallery-close]")?.focus());
  };

  const moveGallery = (direction) => {
    if (galleryItems.length < 2) return;
    galleryIndex = (galleryIndex + direction + galleryItems.length) % galleryItems.length;
    renderGallery();
  };

  document.querySelectorAll("[data-gallery-carousel]").forEach((carousel) => {
    const maxCards = Number(carousel.dataset.maxCards || 10);
    const cards = Array.from(carousel.querySelectorAll(".past-card")).slice(0, maxCards);
    cards.forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) return;
        runAfterCtaResponse(card, () => openGallery(card));
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        runAfterCtaResponse(card, () => openGallery(card));
      });
      if (!reducedMotion) {
        card.addEventListener("pointermove", (event) => {
          if (event.pointerType === "touch") return;
          const bounds = card.getBoundingClientRect();
          const imageHeight = Math.min(bounds.height, 222);
          const offsetX = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
          const localY = Math.min(imageHeight, Math.max(0, event.clientY - bounds.top));
          const offsetY = (localY - imageHeight / 2) / (imageHeight / 2);
          card.style.setProperty("--image-x", `${(-offsetX * 7).toFixed(2)}px`);
          card.style.setProperty("--image-y", `${(-offsetY * 5).toFixed(2)}px`);
        });
        card.addEventListener("pointerleave", () => {
          card.style.removeProperty("--image-x");
          card.style.removeProperty("--image-y");
        });
      }
    });
  });
  galleryLightbox?.querySelectorAll("[data-gallery-close]").forEach((button) => button.addEventListener("click", closeGallery));
  galleryPrevious?.addEventListener("click", () => moveGallery(-1));
  galleryNext?.addEventListener("click", () => moveGallery(1));
  document.addEventListener("keydown", (event) => {
    if (!galleryLightbox?.classList.contains("is-open")) return;
    if (event.key === "Escape") closeGallery();
    if (event.key === "ArrowLeft") moveGallery(-1);
    if (event.key === "ArrowRight") moveGallery(1);
  });

  const revealTargets = document.querySelectorAll(".reveal, [data-motion-flow], [data-motion-carousel], [data-motion-arrival], [data-motion-footer]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    revealTargets.forEach((element) => observer.observe(element));
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
  let events = app.dataset.hubDynamic === "true" ? [] : seedEvents.map(normalizeEvent);
  let currentPage = 1;
  const PAGE_SIZE = 10;

  const formatDate = (value) => {
    if (!value) return "EM BREVE";
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return "EM BREVE";
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(year, month - 1, day)).replace(".", "").toUpperCase();
  };

  const appendCtaArrow = (element) => {
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    element.appendChild(arrow);
  };

  const actionForEvent = (event, pageLabel = "Ver edição") => {
    if (event.cta_type === "none" || event.status === "past") return null;
    if (event.cta_type === "event_page" && event.event_url && safeUrl(event.event_url)) {
      const link = document.createElement("a");
      link.className = "button";
      link.href = safeUrl(event.event_url);
      link.textContent = pageLabel;
      appendCtaArrow(link);
      link.addEventListener("click", () => track("cta_click", { cta: "agenda-event-page", event_id: event.event_id || undefined, page_type: pageType }));
      return link;
    }

    if (normalizeText(event.evento_esgotado) === "sim") return null;
    const type = event.cta_type;
    if (!formAvailable(type)) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button";
    button.dataset.openForm = type;
    button.dataset.eventId = event.event_id || "";
    button.dataset.eventName = event.event_name || "";
    button.dataset.cta = "agenda-event";
    button.textContent = type === interestType ? "Avise-me quando abrir" : type === "regional_interest" ? "Receber avisos" : "Inscrever-se";
    appendCtaArrow(button);
    button.addEventListener("click", () => trackAndOpenForm(button.dataset.openForm, button));
    return button;
  };

  const createRow = (event, { distance } = {}) => {
    const row = document.createElement("article");
    row.className = "agenda-row";
    row.style.viewTransitionName = `agenda-${String(event.event_id || event.event_name || "edition").replace(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
    const date = document.createElement("time");
    date.className = "agenda-row__date";
    date.dateTime = event.date;
    date.textContent = `${formatDate(event.date)} ${event.date.slice(0, 4)}`;
    const title = document.createElement("h3");
    title.textContent = `${event.city || event.event_name || "Nova edição"}${event.state ? ` / ${event.state}` : ""}`;
    const details = document.createElement("p");
    const facts = [event.venue, event.time, Number.isFinite(distance) && `${Math.round(distance)} km de você`].filter(Boolean);
    details.textContent = event.theme || facts.join(" · ") || "Mais informações em breve";
    if (event.theme && facts.length) {
      const meta = document.createElement("span");
      meta.className = "agenda-row__facts";
      meta.textContent = facts.join(" · ");
      details.append(meta);
    }
    row.append(date, title, details);
    if (event.availability) details.append(document.createElement("br"), event.availability);
    const action = actionForEvent(event);
    if (action) row.appendChild(action);
    return row;
  };

  const markAgendaEntries = () => {
    agendaResults?.querySelectorAll(".agenda-row, .agenda-empty").forEach((element, index) => {
      element.classList.add("is-entering");
      element.style.setProperty("--motion-index", String(index));
    });
  };

  const runAgendaUpdate = (update, withTransition = false) => {
    const canTransition = withTransition && !reducedMotion && agendaPanel?.classList.contains("is-open") && typeof document.startViewTransition === "function";
    if (canTransition) {
      document.startViewTransition(update);
      return;
    }
    update();
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
    runAgendaUpdate(() => {
      agendaResults.replaceChildren();
      agendaPagination.replaceChildren();
      nearest.forEach(({ event, distance }) => agendaResults.appendChild(createRow(event, { distance })));
      markAgendaEntries();
      agendaSummary.textContent = nearest.length ? `${nearest.length} ${nearest.length === 1 ? "edição próxima" : "edições próximas"}` : "Nenhuma edição próxima encontrada";
    }, true);
  };
  const renderAgenda = ({ withTransition = false } = {}) => {
    if (!agendaResults || !agendaSummary || !agendaPagination) return;
    runAgendaUpdate(() => {
      const search = normalizeText(agendaSearch?.value);
      const list = activeEvents().filter((event) => !search || [event.city, event.state, event.region, event.event_name, event.theme, event.search_aliases].some((value) => normalizeText(value).includes(search)));
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      currentPage = Math.min(currentPage, totalPages);
      const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      agendaResults.replaceChildren();
      agendaPagination.replaceChildren();
      if (!pageItems.length) {
        const empty = document.createElement("div");
        empty.className = "agenda-empty";
        const message = document.createElement("p");
        message.textContent = search ? "Nenhuma edição encontrada. Tente outra cidade ou estado." : "Novas datas serão divulgadas nesta agenda.";
        const action = document.createElement("button");
        action.type = "button";
        action.className = "button button--outline";
        action.dataset.openForm = "regional_interest";
        action.dataset.cta = "agenda-empty";
        action.textContent = "Receber avisos";
        appendCtaArrow(action);
        action.addEventListener("click", () => trackAndOpenForm("regional_interest", action));
        empty.append(message);
        if (formAvailable("regional_interest")) empty.append(action);
        if (search && eventsWithCoordinates().length) {
          const nearestAction = document.createElement("button");
          const nearestStatus = document.createElement("p");
          nearestAction.type = "button";
          nearestAction.className = "button button--text";
          nearestAction.textContent = "Ver até 3 edições mais próximas";
          appendCtaArrow(nearestAction);
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
        markAgendaEntries();
        agendaSummary.textContent = "Nenhuma edição encontrada";
        return;
      }
      pageItems.forEach((event) => agendaResults.appendChild(createRow(event)));
      markAgendaEntries();
      agendaSummary.textContent = `${list.length} ${list.length === 1 ? "edição encontrada" : "edições encontradas"}`;
      if (totalPages > 1) {
        for (let page = 1; page <= totalPages; page += 1) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = String(page);
          if (page === currentPage) button.setAttribute("aria-current", "page");
          button.addEventListener("click", () => {
            currentPage = page;
            renderAgenda({ withTransition: true });
            agendaPanel?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
          });
          agendaPagination.appendChild(button);
        }
      }
    }, withTransition);
  };

  const loadAgenda = async () => {
    if (app.dataset.hubDynamic === "true") {
      window.conectaHubBindings = {
        updateAgenda(items) { events = items.map(normalizeEvent); currentPage = 1; renderAgenda(); },
        createAction: actionForEvent,
        openGallery,
        restoreInterest(items) {
          const eventId = new URL(location.href).searchParams.get(eventProperty);
          const event = items.find(item => item.event_id === eventId && item.cta_type === interestType
            && normalizeText(item.evento_esgotado) !== "sim");
          if (!event) return;
          const trigger = Array.from(document.querySelectorAll("[data-open-form]"))
            .find(button => button.dataset.openForm === interestType && button.dataset.eventId === eventId
              && button.getClientRects().length > 0) || actionForEvent(event);
          if (trigger) void openForm(interestType, trigger);
        },
      };
      renderAgenda();
      return;
    }
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

  if (app.dataset.hubDynamic === "true") loadAgenda();

  agendaToggle?.addEventListener("click", () => {
    const opening = !agendaPanel?.classList.contains("is-open");
    agendaPanel?.classList.toggle("is-open", opening);
    agendaPanel?.setAttribute("aria-hidden", String(!opening));
    if (agendaPanel) agendaPanel.inert = !opening;
    agendaToggle.classList.toggle("is-open", opening);
    agendaToggle.setAttribute("aria-expanded", String(opening));
    const label = agendaToggle.querySelector("[data-agenda-toggle-label]");
    if (label) label.textContent = opening ? "Fechar agenda" : "Abrir agenda";
    if (opening) {
      track("agenda_open", { page_type: pageType });
      loadAgenda();
    }
  });
  let agendaSearchTimer = 0;
  agendaSearch?.addEventListener("input", () => {
    currentPage = 1;
    window.clearTimeout(agendaSearchTimer);
    agendaSearchTimer = window.setTimeout(() => renderAgenda({ withTransition: true }), 80);
  });
})();

;
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

;
/* Contrato de dados do Hub: duas abas CSV. Sem credenciais no navegador. */
(function (root) {
  "use strict";
  const clean = value => String(value ?? "").trim();
  const key = value => clean(value).replace(/^\uFEFF/, "").replace(/\s*\(origem\)/g, "").replace(/\*/g, "");
  const yes = value => clean(value).toLowerCase() === "sim";
  const https = value => {
    try {
      const url = new URL(clean(value), typeof document !== 'undefined' ? document.baseURI : undefined);
      const localPreview = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
      const filePreview = url.protocol === "file:" && typeof document !== "undefined" && document.querySelector("[data-hub-preview-snapshot]") && /^\.\/files-upload\//.test(clean(value));
      return (url.protocol === "https:" || localPreview || filePreview) && !/SEU-PORTAL|\.\.\./i.test(value) ? url.href : "";
    } catch { return ""; }
  };
  function parseCsv(text, requiredHeader) {
    // Publicação do Sheets usa vírgula; respeita aspas, vírgulas e quebras dentro das células.
    const rows = []; let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = !quoted;
      else if (c === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("CSV com aspas incompletas");
    row.push(cell); rows.push(row);
    const start = rows.findIndex(values => key(values[0]) === requiredHeader);
    if (start < 0) throw new Error(`Cabeçalho ausente: ${requiredHeader}`);
    const headers = rows[start].map(key);
    return rows.slice(start + 1).filter(values => clean(values[0])).map(values =>
      Object.fromEntries(headers.filter(Boolean).map(header => [header, clean(values[headers.indexOf(header)])])));
  }
  function dateOnly(value) {
    const v = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v ? v : "";
  }
  function buildModel(eventRows, visualRows, now = new Date()) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const unique = (rows, field) => rows.filter(r => r[field] && rows.filter(x => x[field] === r[field]).length === 1);
    const visuals = unique(visualRows, "visual_id").filter(v => yes(v.enabled) && v.asset_status === "pronto" && https(v.asset_url) && v.alt &&
      ["gallery", "edition_partner", "merchant", "agency"].includes(v.item_type) &&
      (!["gallery", "edition_partner"].includes(v.item_type) || v.event_id))
      .map(v => ({ ...v, asset_url: https(v.asset_url), display_order: Number(v.display_order) || 999 }))
      .sort((a, b) => a.display_order - b.display_order || a.visual_id.localeCompare(b.visual_id));
    const normalized = unique(eventRows, "event_id").filter(e => e.source_status === "OK" && e.lifecycle_status !== "cancelled" &&
      !(yes(e.evento_esgotado) && yes(e.ultimas_vagas)) && e.city && e.state && dateOnly(e.event_date))
      .map(e => ({ ...e, cover_image_url: https(e.cover_image_url), event_url: https(e.public_page_url),
        date: dateOnly(e.event_date), time: clean(e.event_time), published: "Sim",
        availability: yes(e.evento_esgotado) ? "Vagas esgotadas" : yes(e.ultimas_vagas) ? "Últimas vagas" : "",
        status: e.lifecycle_status === "completed" ? "past" : "confirmed", theme: e.headline,
        photos: visuals.filter(v => v.item_type === "gallery" && v.event_id === e.event_id).filter((v, i, all) => all.findIndex(other => other.asset_url === v.asset_url) === i).slice(0, 100),
        partners: visuals.filter(v => v.item_type === "edition_partner" && v.event_id === e.event_id),
      }));
    const agenda = normalized.filter(e => yes(e.confirmed) && yes(e.show_in_hub) && ["registration_open", "coming_soon", "interest_only", "confirmed"].includes(e.lifecycle_status) &&
      e.date >= today &&
      ["PRONTO", "AGENDA"].includes(e.quality_status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.event_id.localeCompare(b.event_id))
      .map((e, i) => ({ ...e, display_order: i + 1 }));
    const upcoming = agenda.filter(e => e.quality_status === "PRONTO" && e.cover_image_url && e.cover_image_alt && e.venue && e.audience_tag && e.headline && e.subtext &&
      (e.cta_type === "event_page" ? !!e.event_url : ["event_pre_registration", "regional_interest"].includes(e.cta_type)));
    const past = normalized.filter(e => e.quality_status === "PRONTO" && e.cover_image_url && e.cover_image_alt && e.lifecycle_status === "completed" && yes(e.show_in_history) && e.date <= today && e.photos.length)
      .sort((a, b) => b.date.localeCompare(a.date) || a.event_id.localeCompare(b.event_id));
    return { agenda, upcoming, past, agencies: visuals.filter(v => v.item_type === "agency"), merchants: visuals.filter(v => v.item_type === "merchant") };
  }
  root.ConectaHubData = { parseCsv, buildModel, https };
  if (typeof module !== "undefined") module.exports = root.ConectaHubData;
})(typeof window !== "undefined" ? window : globalThis);

;
(async function () {
  "use strict";
  const app = document.querySelector('[data-hub-dynamic="true"]');
  if (!app) return;
  const api = window.ConectaHubData, bindings = window.conectaHubBindings;
  if (!api || !bindings) return;
  const el = (tag, cls, text) => { const node = document.createElement(tag); node.className = cls || ""; if (text) node.textContent = text; return node; };
  const image = (src, alt, cls = "") => { const img = el("img", cls); img.src = src; img.alt = alt; img.loading = "lazy"; return img; };
  const dateLabel = e => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${e.date}T12:00:00-03:00`));
  const dateParts = e => {
    const date = new Date(`${e.date}T12:00:00-03:00`);
    return {
      dayMonth: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" }).format(date).replace(".", "").toUpperCase(),
      year: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(date),
    };
  };
  const action = (e, label) => {
    const a = bindings.createAction(e, label);
    if (a) a.classList.add("button--small");
    return a;
  };
  const logos = items => {
    const box = el("div", "hub-edition-logos");
    for (const visual of new Map(items.map(item => [item.asset_url, item])).values()) {
      const mark = image(visual.asset_url, visual.alt);
      mark.dataset.colorMode = "mono";
      if (visual.alt?.trim().toLowerCase() === "conecta d2c") mark.dataset.logoVariant = "badge";
      box.append(mark);
    }
    return box;
  };
  const next = document.querySelector("[data-next-event-card]");
  const featured = document.querySelector(".featured-event-card");
  const soon = document.querySelector(".agenda-aside--green");
  const pastSection = document.querySelector(".past-section");
  const agenciesSection = document.querySelector(".agency-partners-section");
  const merchantsSection = document.querySelector(".proof-strip");
  [next, featured, soon, pastSection, agenciesSection, merchantsSection].forEach(n => { if (n) n.hidden = true; });
  const heroImage = document.querySelector(".hub-hero__image");
  const message = el("p", "hub-data-message", "Carregando próximas edições…");
  featured?.parentNode.insertBefore(message, featured);
  let agencyResizeCleanup=null;
  function render(model) {
    [next,featured,soon].forEach(n=>{if(n)n.hidden=true;});
    bindings.updateAgenda(model.agenda);
    const first = model.upcoming[0];
    message.hidden = !!first;
    message.textContent = model.agenda.length
      ? "Abra a agenda para conferir as próximas cidades e datas."
      : "Novas datas serão divulgadas nesta agenda.";
    if (first) {
      next.hidden = false; next.replaceChildren();
      const top = el("div", "next-event-card__top");
      const eventDate = el("time", "next-event-card__date");
      eventDate.dateTime = first.date;
      const parts = dateParts(first);
      eventDate.append(el("strong", "", parts.dayMonth), el("small", "", parts.year));
      top.append(el("span", "", "PRÓXIMA EDIÇÃO"), eventDate);
      next.append(top, el("h2", "", first.city), el("p", "next-event-card__venue", [first.venue, first.time].filter(Boolean).join(" · ")));
      const a = action(first, "Ver mais"); if (a) next.append(a);
      heroImage.src = first.cover_image_url; heroImage.alt = first.cover_image_alt; heroImage.hidden = false;
      featured.hidden = false; featured.replaceChildren();
      const cover = image(first.cover_image_url, first.cover_image_alt); cover.style.objectPosition = first.cover_image_position || "center";
      const body = el("div", "featured-event-card__body");
      const intro=el("div","featured-event-card__intro");
      if(first.audience_tag)intro.append(el("p","eyebrow",first.audience_tag));
      const date=el("div","event-date"),day=el("time","",dateLabel(first)),city=el("span","featured-event-card__city",`${first.city}, ${first.state}`);day.dateTime=first.date;date.append(day,city);intro.append(date);
      const copy=el("div","featured-event-card__copy");copy.append(el("h3","",first.headline));
      if(first.subtext)copy.append(el("p","",first.subtext));
      body.append(intro,copy);
      const details=el("div","featured-event-card__details");
      if(first.venue)details.append(el("p","featured-event-card__venue",[first.venue,first.time].filter(Boolean).join(" · ")));
      if(first.availability)details.append(el("p","eyebrow",first.availability));
      if(details.children.length)body.append(details);
      const cta = action(first); if (cta) body.append(cta);
      if (first.partners.length) body.append(logos(first.partners));
      featured.append(cover, body);
    }
    const second = model.agenda.find(e => e.event_id !== first?.event_id);
    if (second) {
      soon.hidden = false;
      const label = el("p", "eyebrow");
      const calendar = image(app.dataset.upcomingIcon, "");
      calendar.width = 26; calendar.height = 26; calendar.setAttribute("aria-hidden", "true");
      label.append(calendar, el("span", "", "VEM AÍ"));
      soon.replaceChildren(label, el("h3", "", `${second.city} / ${second.state}`), el("p", "", dateLabel(second)));
      if (second.subtext) soon.append(el("p", "", second.subtext));
      const a = action(second); if (a) { a.classList.remove("button", "button--small"); a.classList.add("text-link"); soon.append(a); }
    }
    const track = pastSection.querySelector("[data-carousel-track]"); track.replaceChildren();
    pastSection.hidden = !model.past.length;
    model.past.forEach(e => {
      const card = el("article", "past-card"); card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-haspopup", "dialog"); card.setAttribute("aria-label", `Abrir galeria: ${e.city}, ${dateLabel(e)}`);
      const cover = image(e.cover_image_url, e.cover_image_alt);
      cover.style.objectPosition = e.cover_image_position || "center";
      card.append(cover);
      const body = el("div", "hub-past-body"); body.append(el("h3", "", `${e.city} / ${e.state}`), el("p", "", dateLabel(e)));
      if (e.partners.length) body.append(logos(e.partners)); card.append(body);
      e.photos.forEach(v => { const link = el("a", ""); link.hidden = true; link.href = v.asset_url; link.dataset.galleryImage = ""; link.dataset.galleryAlt = v.alt; link.dataset.galleryCaption = v.caption || dateLabel(e); card.append(link); });
      card.addEventListener("click", () => bindings.openGallery(card));
      card.addEventListener("keydown", evt => { if (["Enter", " "].includes(evt.key)) { evt.preventDefault(); bindings.openGallery(card); } });
      track.append(card);
    });
    agencyResizeCleanup?.();
    const drawAgencies=()=>{
    const matrix=agenciesSection.querySelector('.agency-logo-matrix');
    matrix.replaceChildren(); matrix.setAttribute('aria-label','Agências parceiras');
    let mosaic=agenciesSection.querySelector('.agency-partners__mosaic');
    if(!mosaic){mosaic=el('div','agency-partners__mosaic');matrix.before(mosaic);mosaic.append(matrix);}
    agenciesSection.querySelector('.hub-agency-controls')?.remove();
    const agencies=Array.from(new Map(model.agencies.map(v=>[v.visual_id,v])).values());
    agenciesSection.hidden=!agencies.length;
    const slotCount=Math.min(window.matchMedia('(max-width:760px)').matches?8:16,agencies.length);
    const makeMark=v=>{const mark=image(v.asset_url,v.alt);mark.loading='eager';mark.dataset.agencyId=v.visual_id;return mark;};
    agencies.slice(0,slotCount).forEach(v=>{const slot=el('li','agency-logo-slot');slot.append(makeMark(v));matrix.append(slot);});
    if(agencies.length>slotCount) {
      let cursor=slotCount, busy=false;
      const controls=el('div','hub-agency-controls');
      const advance=el('button','hub-agency-controls__next');advance.type='button';
      advance.setAttribute('aria-label','Ver outras agências');advance.title='Ver outras agências';
      const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
      icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('aria-hidden','true');
      path.setAttribute('d','M20 7v5h-5M4 17v-5h5M5.6 7a7.5 7.5 0 0 1 12.4-1L20 9M4 15l2 3a7.5 7.5 0 0 0 12.4-1');
      path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');icon.append(path);advance.append(icon);
      // Troca manual em lotes: todas as marcas são alcançáveis, sem repetição na grade.
      advance.addEventListener('click',async()=>{
        if(busy||!matrix.isConnected)return;busy=true;advance.disabled=true;matrix.setAttribute('aria-busy','true');
        const batch=Array.from({length:slotCount},(_,i)=>agencies[(cursor+i)%agencies.length]);
        const pending=batch.map(v=>new Promise(resolve=>{
          const mark=new Image();mark.alt=v.alt;mark.loading='eager';mark.dataset.agencyId=v.visual_id;
          const timeout=setTimeout(()=>resolve(null),8000);
          mark.onload=()=>{clearTimeout(timeout);resolve(mark);};mark.onerror=()=>{clearTimeout(timeout);resolve(null);};mark.src=v.asset_url;
        }));
        const loaded=await Promise.all(pending);
        if(matrix.isConnected&&loaded.every(Boolean)){
          Array.from(matrix.children).forEach((slot,i)=>slot.replaceChildren(loaded[i]));cursor=(cursor+slotCount)%agencies.length;
        }
        matrix.removeAttribute('aria-busy');advance.disabled=false;busy=false;
      });
      controls.append(advance);mosaic.append(controls);
    }
    agenciesSection.querySelector('.agency-partners__content')?.classList.add('is-visible');matrix.classList.add('is-visible');
    };
    drawAgencies();
    const agencyBreakpoint=window.matchMedia('(max-width:760px)');
    agencyBreakpoint.addEventListener('change',drawAgencies);
    agencyResizeCleanup=()=>agencyBreakpoint.removeEventListener('change',drawAgencies);

    merchantsSection.hidden = false;
    if (model.merchants.length) {
    const marquee = merchantsSection.querySelector(".proof-strip__track"); marquee.replaceChildren();
    for (let copy = 0; copy < 2; copy++) { const group = el("div", "hub-merchant-group"); if (copy) group.setAttribute("aria-hidden", "true"); model.merchants.forEach(v => group.append(image(v.asset_url, copy ? "" : v.alt))); marquee.append(group); }
    }
    app.dataset.hubLoaded = "true";
    if(!restoreDone){bindings.restoreInterest(model.agenda);restoreDone=true;}
  }
  // Um snapshot atômico, sem CSV. A prévia offline é deliberadamente separada.
  let lastRevision='', lastDay='', lastFresh=0, lastSnapshot=null, loading=false, restoreDone=false;
  const preview=document.querySelector('[data-hub-preview-snapshot]');
  const setStatus=(state,description)=>{
    app.dataset.hubFeedState=state;
    const notice=document.querySelector('[data-hub-feed-notice]');
    if(notice){notice.textContent=description||'';notice.hidden=!description;}
  };
  function accept(snapshot, force=false) {
    const now=app.dataset.previewDate?new Date(app.dataset.previewDate):new Date();
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    if(!force && snapshot.revision===lastRevision && day===lastDay){setStatus('live','');return;}
    render(api.buildModel(snapshot.events,snapshot.visuals,now));
    lastRevision=snapshot.revision;lastDay=day;
    setStatus(preview?'preview':'live','');
  }
  function failClosed() {
    // Em falha prolongada, não prometer inscrições com uma data/status antigos.
    const model=api.buildModel(lastSnapshot?.events||[],lastSnapshot?.visuals||[],new Date());
    model.agenda=[];model.upcoming=[];render(model);
    message.hidden=false; message.textContent='Estamos atualizando a agenda. Tente novamente em alguns instantes.';
    setStatus('unavailable','Agenda temporariamente indisponível. As galerias já carregadas continuam disponíveis.');
    lastRevision='';
  }
  async function refresh() {
    if(loading || document.hidden) return;
    if(document.body.classList.contains('form-modal-open') || document.body.classList.contains('gallery-lightbox-open')) return;
    loading=true;
    try {
      const snapshot=await window.ConectaHubFeedClient.load(app.dataset.hubFeedUrl);
      if(snapshot.stale){
        if(!lastSnapshot) {lastSnapshot=snapshot;failClosed();}
        setStatus('stale','A agenda está sendo atualizada. Confira novamente em alguns instantes.');
        return;
      }
      lastFresh=Date.parse(snapshot.generatedAt);lastSnapshot=snapshot;
      accept(snapshot);
    } catch(error) {
      if(!lastSnapshot || Date.now()-lastFresh>900000) failClosed();
      else setStatus('retrying','Atualização temporariamente indisponível. Tentaremos novamente automaticamente.');
    } finally {loading=false;}
  }
  if(preview) {
    const snapshot=JSON.parse(preview.textContent);lastSnapshot=snapshot;accept(snapshot,true);
  } else {
    await refresh();
    window.setInterval(()=>{if(lastFresh && Date.now()-lastFresh>900000) failClosed();void refresh();},120000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden) void refresh();});
  }
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(lastSnapshot && (preview || Date.now()-lastFresh<=900000)) accept(lastSnapshot,true);},200);});

})();
