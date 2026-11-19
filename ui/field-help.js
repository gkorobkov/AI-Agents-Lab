// Shared help popovers for settings and library pages.
(() => {
  const tooltip = document.createElement('div'); tooltip.id = 'api-field-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true; document.body.append(tooltip);
  const content = new WeakMap();
  let current, hideTimer;
  const cancelHide = () => clearTimeout(hideTimer);
  const hide = () => { cancelHide(); tooltip.hidden = true; current?.removeAttribute('aria-describedby'); if (current && content.has(current)) current.setAttribute('aria-expanded', 'false'); current = null; };
  const scheduleHide = () => {
    cancelHide();
    hideTimer = setTimeout(() => {
      if (content.has(current) && tooltip.contains(document.activeElement)) return;
      if (!tooltip.matches(':hover') && !current?.matches(':hover') && document.activeElement !== current) hide();
    }, 250);
  };
  tooltip.addEventListener('pointerenter', cancelHide);
  tooltip.addEventListener('pointerleave', scheduleHide);
  tooltip.addEventListener('pointerdown', cancelHide);
  const show = button => {
    if (current === button && content.has(button)) return;
    hide(); current = button; tooltip.replaceChildren();
    if (button.dataset.helpPath) { const path = document.createElement('div'); path.className = 'help-parameter-path'; path.textContent = button.dataset.helpPath; tooltip.append(path); }
    const render = content.get(button);
    if (render) {
      tooltip.setAttribute('role', 'dialog'); tooltip.setAttribute('aria-label', button.getAttribute('aria-label'));
      tooltip.append(render()); button.setAttribute('aria-expanded', 'true');
    } else {
      tooltip.setAttribute('role', 'tooltip'); tooltip.removeAttribute('aria-label');
      const text = document.createElement('div'); text.textContent = button.dataset.helpText; tooltip.append(text);
      button.setAttribute('aria-describedby', tooltip.id);
    }
    tooltip.hidden = false;
    tooltip.style.maxHeight = '';
    const rect = (button.closest('#tool-chain-controls') || button).getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - tooltip.offsetWidth - 8)) + 'px';
    const above = rect.bottom + 6 + tooltip.offsetHeight > innerHeight - 8;
    const available = above ? rect.top - 14 : innerHeight - rect.bottom - 14;
    tooltip.style.maxHeight = Math.max(0, available) + 'px';
    tooltip.style.boxSizing = 'border-box';
    tooltip.style.top = (above ? Math.max(8, rect.top - tooltip.offsetHeight - 6) : rect.bottom + 6) + 'px';
  };
  function attach(button, render) {
    if (render) {
      content.set(button, render);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', tooltip.id);
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (current === button) hide();
        else { show(button); tooltip.querySelector('input, button')?.focus({preventScroll:true}); }
      });
      return;
    }
    button.addEventListener('pointerenter', () => show(button)); button.addEventListener('pointerleave', scheduleHide);
    button.addEventListener('focus', () => show(button)); button.addEventListener('blur', scheduleHide);
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show(button); });
    button.addEventListener('keydown', event => { if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') hide(); else show(button); } });
  }
  window.addEventListener('resize', hide);
  document.addEventListener('app:pagechange', hide);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (current && content.has(current)) current.focus({preventScroll:true});
    hide();
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.api-help, #api-field-tooltip')) hide(); });
  document.addEventListener('scroll', event => { if (!tooltip.contains(event.target)) hide(); }, true);
  window.FieldHelp = { attach, show, hide };
})();
