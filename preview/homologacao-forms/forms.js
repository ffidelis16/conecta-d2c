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
  const formContexts = new Map();
  const formInstances = new Map();
  let formContextQueue = Promise.resolve();
  let lastFocus = null;
  let formScriptPromise = null;
  let modalContext = {};
  // Impede que os dois callbacks do HubSpot registrem a mesma submissão.
  // É reiniciado a cada nova abertura do lightbox para não bloquear uma nova tentativa legítima.
  const trackedConversions = new Set();
  let currentFormSubmissionKey = "";

  const trackSubmission = (type, formId, context, conversionId) => {
    const eventId = context.eventId || "";
    const submissionKey = [type || "unknown", formId || "unknown", eventId].join(":");
    const conversionKey = conversionId ? formId + ":" + conversionId : submissionKey;
    if (trackedConversions.has(conversionKey)) return;
    trackedConversions.add(conversionKey);
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

  const focusableElements = () => modal ? Array.from(modal.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex='-1'])")).filter(node => !node.closest("[hidden], [inert]") && node.getClientRects().length) : [];

  const closeForm = () => {
    if (!modal || !modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.dataset.formState = "closed";
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("form-modal-open");
    if (modalContext.type === interestType) updateRequestedEvent("");
    modalContext = {};
    window.conectaD2CFormContext = {};
    app.querySelectorAll("header, main, footer").forEach(node => { if(node.dataset.hubModalInert === "true"){node.inert=false;delete node.dataset.hubModalInert;} });
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

  function applyFormContext(record, context) {
    // Serializa o campo oculto: uma abertura antiga não pode vencer a nova.
    formContextQueue = formContextQueue.catch(() => {}).then(() => applyQueuedFormContext(record, context));
    return formContextQueue;
  }
  const withFormTimeout = promise => Promise.race([Promise.resolve(promise),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo de leitura do formulário excedido.')),6000))]);
  async function applyQueuedFormContext(record, context) {
    if (modalContext !== context || !record.instance || record.context.eventId !== context.eventId) return;
    record.frame.inert = true;
    try {
      if (context.type === interestType) {
        const field = "0-1/" + eventProperty;
        await withFormTimeout(record.instance.setFieldValue(field, [context.eventId]));
        const value = await withFormTimeout(record.instance.getFieldValue(field));
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
    record.failed=true;
    embedStatus.textContent = "O formulário não está disponível agora. Recarregue a página para tentar novamente.";
    modal.dataset.formState = "error";
    track("form_error", { form_context: modalContext.type, page_type: pageType });
  }

  window.addEventListener("hs-form-event:on-ready", event => {
    const record = formFrames.get(event.detail?.formId);
    if (!record) return;
    if (!record.frame.isConnected || record.failed) return;
    const instance=window.HubSpotFormsV4?.getFormFromEvent(event);
    if (!instance || instance.getFormId() !== event.detail.formId) return;
    if (formInstances.has(instance.getInstanceId()) && formInstances.get(instance.getInstanceId()) !== record) return;
    if (record.instance && record.instance.getInstanceId() !== instance.getInstanceId()) return;
    record.instance = instance;
    formInstances.set(instance.getInstanceId(), record);
    record.resolveReady?.();
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
    for (const record of formContexts.values()) { record.frame.hidden = true; record.frame.inert = true; }
    // Uma instância por edição: retorno tardio de A nunca é atribuído a B.
    const pendingRecord=formFrames.get(config.id);
    if(pendingRecord && !pendingRecord.instance && pendingRecord.frame.isConnected){
      try { await withFormTimeout(pendingRecord.readyPromise); } catch { if(modalContext===context)showFormError(pendingRecord);return; }
      if(modalContext!==context)return;
    }
    const contextKey=config.id+':'+(type===interestType?context.eventId:'regional');
    let record = formContexts.get(contextKey);
    if(record?.failed){showFormError(record);return;}
    if(record)formFrames.set(config.id,record);
    if (record?.instance) return applyFormContext(record, context);
    if (!record) {
      const frame = document.createElement("div");
      frame.className = "hs-form-frame";
      frame.dataset.portalId = app.dataset.hubspotPortalId;
      frame.dataset.formId = config.id;
      frame.dataset.region = "na1";
      frame.inert = true;
      frame.hidden = true;
      record = { frame, instance: null, context: Object.freeze({...context}) };
      record.readyPromise=new Promise(resolve=>{record.resolveReady=resolve;});
      formFrames.set(config.id, record);
      formContexts.set(contextKey,record);
    }
    try {
      await ensureHubSpotScript(app.dataset.hubspotPortalId);
      if (modalContext !== context) return;
      if (!record.frame.isConnected) target.append(record.frame);
      window.setTimeout(() => {
        if (modalContext !== context || modal.dataset.formState !== "loading") return;
        showFormError(record);
        if (!record.instance) {
          record.failed=true;
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
    if (type === interestType && (!modalContext.eventId || window.ConectaHubFeedAvailability?.canRequestInterest(modalContext.eventId) === false)) return;
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
    app.querySelectorAll("header, main, footer").forEach(node=>{if(!node.inert){node.inert=true;node.dataset.hubModalInert="true";}});
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

  window.addEventListener("hs-form-event:on-submission:success", async event => {
    if(formPreview) return;
    const record=formInstances.get(event.detail?.instanceId);
    if(!record?.instance || !record.context || record.instance.getFormId()!==event.detail?.formId || record.instance.getInstanceId()!==event.detail?.instanceId) return;
    const context=record.context;
    const conversionId=record.instance.getConversionId();
    if(!conversionId) return;
    // Não inferir lead de clique, tentativa, formulário de terceiro ou mensagem legacy.
    trackSubmission(context.type,event.detail.formId,context,conversionId);
  });
  window.addEventListener("hs-form-event:on-submission:failed", event => {
    const record=formInstances.get(event.detail?.instanceId);
    if(record?.instance?.getInstanceId()!==event.detail?.instanceId) return;
    track("form_error",{form_context:record.context?.type,page_type:pageType});
  });
  document.addEventListener('hub:feed-unavailable',()=>{
    if(modalContext.type===interestType){
      for(const record of formFrames.values())record.frame.inert=true;
      closeForm();
    }
  });
  document.addEventListener('hub:feed-updated',event=>{
    if(modalContext.type===interestType && !event.detail?.interestEventIds?.includes(modalContext.eventId)) closeForm();
  });


})();

