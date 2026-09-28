// Shared help popovers for settings and library pages.
(() => {
  const tooltip = document.createElement('div'); tooltip.id = 'api-field-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true; document.body.append(tooltip);
  let current, hideTimer;
  const cancelHide = () => clearTimeout(hideTimer);
  const hide = () => { cancelHide(); tooltip.hidden = true; current?.removeAttribute('aria-describedby'); current = null; };
  const scheduleHide = () => { cancelHide(); hideTimer = setTimeout(() => { if (!tooltip.matches(':hover') && !current?.matches(':hover') && document.activeElement !== current) hide(); }, 250); };
  tooltip.addEventListener('pointerenter', cancelHide);
  tooltip.addEventListener('pointerleave', scheduleHide);
  tooltip.addEventListener('pointerdown', cancelHide);
  const show = button => {
    hide(); current = button; tooltip.textContent = button.dataset.helpText; tooltip.hidden = false; button.setAttribute('aria-describedby', tooltip.id);
    const rect = button.getBoundingClientRect();
    tooltip.style.left = Math.max(8, Math.min(rect.left, document.documentElement.clientWidth - tooltip.offsetWidth - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - tooltip.offsetHeight - 8)) + 'px';
  };
  function attach(button) {
    button.addEventListener('pointerenter', () => show(button)); button.addEventListener('pointerleave', scheduleHide);
    button.addEventListener('focus', () => show(button)); button.addEventListener('blur', scheduleHide);
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show(button); });
    button.addEventListener('keydown', event => { if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') hide(); else show(button); } });
  }
  window.addEventListener('resize', hide);
  document.addEventListener('app:pagechange', hide);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.api-help, #api-field-tooltip')) hide(); });
  document.addEventListener('scroll', event => { if (!tooltip.contains(event.target)) hide(); }, true);
  window.FieldHelp = { attach, show, hide };
})();
