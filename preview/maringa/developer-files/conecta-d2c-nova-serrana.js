/* Conecta D2C Maringá | prévia local · formulário demonstrativo · v0.1 */
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
      eyebrow: "PRÉ-CADASTRO",
      title: "Registre seu interesse",
      description: "Este é um formulário demonstrativo da prévia local. A inscrição final e o critério de confirmação ainda dependem da configuração da edição.",
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
  const trackedFormSubmissions = new Set();
  window.addEventListener("hs-form-event:on-submission:success", (event) => {
    const submittedFormId = event.detail?.formId || event.detail?.form_id;
    const config = formConfig[modalContext.type];
    if (!submittedFormId || submittedFormId !== config?.id) return;
    const instanceId = event.detail?.instanceId || event.detail?.instance_id || modalContext.type || "unknown";
    const key = `${submittedFormId}:${instanceId}`;
    if (trackedFormSubmissions.has(key)) return;
    trackedFormSubmissions.add(key);
    window.setTimeout(() => trackedFormSubmissions.delete(key), 2500);
    track("form_submit", {
      form_context: modalContext.type,
      form_id: submittedFormId,
      event_id: modalContext.eventId || undefined,
      page_type: pageType,
    });
    track("generate_lead", {
      form_context: modalContext.type,
      form_id: submittedFormId,
      event_id: modalContext.eventId || undefined,
      page_type: pageType,
    });
  });

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
    if (lastFocus instanceof HTMLElement) lastFocus.focus();
  };

  const ensureHubSpotScript = () => {
    if (formScriptPromise) return formScriptPromise;
    const source = "https://js.hsforms.net/forms/embed/8180620.js";
    const existing = document.querySelector(`script[src="${source}"]`);
    if (existing) return Promise.resolve();

    formScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.async = true;
      script.dataset.conectaHubspotEmbed = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Não foi possível carregar o script de formulários do HubSpot."));
      document.head.appendChild(script);
    });
    return formScriptPromise;
  };

  const renderForm = async (type) => {
    const config = formConfig[type];
    const target = modal?.querySelector("[data-form-modal-embed]");
    if (!config || !target) return;

    target.replaceChildren();
    target.setAttribute("aria-busy", "true");
    if (!config.id) {
      const pending = document.createElement("p");
      pending.className = "form-modal__pending";
      pending.textContent = "O formulário deste fluxo será conectado na configuração final do HubSpot.";
      target.appendChild(pending);
      target.setAttribute("aria-busy", "false");
      return;
    }

    const loading = document.createElement("p");
    loading.className = "form-modal__loading";
    loading.textContent = "Carregando formulário…";
    target.appendChild(loading);

    try {
      await ensureHubSpotScript(app.dataset.hubspotPortalId);
      const form = document.createElement("div");
      form.className = "hs-form-frame";
      form.setAttribute("data-portal-id", app.dataset.hubspotPortalId);
      form.setAttribute("data-form-id", config.id);
      form.setAttribute("data-region", "na1");
      form.dataset.formContext = type;
      form.dataset.eventId = modalContext.eventId || "";
      form.dataset.eventName = modalContext.eventName || "";
      target.replaceChildren(form);
    } catch (error) {
      const failure = document.createElement("p");
      failure.className = "form-modal__pending";
      failure.textContent = "Não foi possível carregar o formulário agora. Tente novamente em alguns instantes.";
      target.replaceChildren(failure);
      track("form_error", { form_context: type, page_type: pageType });
    } finally {
      target.setAttribute("aria-busy", "false");
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
      runAfterCtaResponse(trigger, () => openForm(type, trigger));
    });
  });
  document.querySelectorAll("[data-close-form]").forEach((trigger) => trigger.addEventListener("click", closeForm));

  const trackAndOpenForm = (type, trigger) => {
    track("cta_click", { cta: trigger.dataset.cta || "cta", form_context: type, page_type: pageType });
    runAfterCtaResponse(trigger, () => openForm(type, trigger));
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

  const galleryLightbox = document.querySelector("[data-gallery-lightbox]");
  const galleryImage = galleryLightbox?.querySelector("[data-gallery-lightbox-image]");
  const galleryTitle = galleryLightbox?.querySelector("[data-gallery-title]");
  const galleryCaption = galleryLightbox?.querySelector("[data-gallery-lightbox-caption]");
  const galleryCounter = galleryLightbox?.querySelector("[data-gallery-counter]");
  const galleryPrevious = galleryLightbox?.querySelector("[data-gallery-prev]");
  const galleryNext = galleryLightbox?.querySelector("[data-gallery-next]");
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
    requestAnimationFrame(() => galleryLightbox.querySelector("[data-gallery-close]")?.focus());
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

})();
