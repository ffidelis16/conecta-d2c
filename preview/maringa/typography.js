/* Proteção de última linha: mede palavras renderizadas; não reduz fonte nem corta copy. */
window.ConectaTypography = (() => {
  const selector =
    "h1,h2,h3,h4,p,dd,figcaption,td,.location-list li,.attendees-card li,.quick-fact strong";
  const modified = new Map();
  let frame = 0;
  function blocks() {
    return [...document.querySelectorAll(selector)].filter(
      (el) =>
        el.getClientRects().length &&
        !el.closest('details:not([open]),[aria-hidden="true"]') &&
        !el.closest("pre,code,[data-skip-widows]") &&
        el.textContent.trim().split(/\s+/).length > 1,
    );
  }
  function words(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const list = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest("button,svg,script,style,code,pre"))
        continue;
      for (const m of node.data.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        for (const rect of range.getClientRects())
          if (rect.width && rect.height)
            list.push({
              node,
              start: m.index,
              end: m.index + m[0].length,
              text: m[0],
              rect,
            });
      }
    }
    return list;
  }
  function lastLine(list) {
    const last = list.at(-1);
    if (!last) return [];
    return list.filter(
      (w) =>
        Math.min(w.rect.bottom, last.rect.bottom) -
          Math.max(w.rect.top, last.rect.top) >
        Math.min(w.rect.height, last.rect.height) * 0.5,
    );
  }
  function fix(el) {
    const list = words(el),
      line = lastLine(list);
    if (list.length < 2 || line.length !== 1) return;
    const a = list.at(-2),
      b = list.at(-1),
      style = getComputedStyle(el);
    const available =
      el.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight);
    if (
      a.rect.width + b.rect.width + parseFloat(style.fontSize) * 0.35 >
      available
    )
      return;
    if (a.node === b.node) {
      const between = a.node.data.slice(a.end, b.start);
      if (/^\s+$/.test(between)) {
        if (!modified.has(a.node)) modified.set(a.node, a.node.data);
        a.node.data =
          a.node.data.slice(0, a.end) + "\u00a0" + a.node.data.slice(b.start);
      }
    } else {
      const tail = a.node.data.slice(a.end),
        head = b.node.data.slice(0, b.start);
      if (/^\s+$/.test(tail)) {
        if (!modified.has(a.node)) modified.set(a.node, a.node.data);
        a.node.data = a.node.data.slice(0, a.end) + "\u00a0";
      } else if (/^\s+$/.test(head)) {
        if (!modified.has(b.node)) modified.set(b.node, b.node.data);
        b.node.data = "\u00a0" + b.node.data.slice(b.start);
      }
    }
  }
  function refresh() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const [node, text] of modified)
        if (node.isConnected) node.data = text;
      modified.clear();
      document
        .querySelectorAll("h1 br,h2 br,h3 br,h4 br")
        .forEach((br) => br.replaceWith(document.createTextNode(" ")));
      for (const el of blocks()) fix(el);
    });
  }
  function audit() {
    return blocks()
      .filter((el) => {
        const list = words(el);
        return list.length > 1 && lastLine(list).length === 1;
      })
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().replace(/\s+/g, " ").slice(0, 180),
      }));
  }
  window.addEventListener("resize", refresh, { passive: true });
  document.addEventListener("toggle", refresh, true);
  document.fonts.ready.then(refresh);
  document.querySelectorAll("table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map(
      (th) => th.textContent,
    );
    table
      .querySelectorAll("tbody tr")
      .forEach((row) =>
        [...row.children].forEach(
          (cell, i) => (cell.dataset.label = labels[i] || ""),
        ),
      );
  });
  new MutationObserver((changes) => {
    if (
      changes.some(
        (c) =>
          c.type === "attributes" ||
          (c.addedNodes.length &&
            [...c.addedNodes].some((n) => n.nodeType === 1)),
      )
    )
      refresh();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-hidden"],
  });
  refresh();
  return { refresh, audit };
})();
