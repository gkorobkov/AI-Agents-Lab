// Shared help popovers for settings and library pages.
(() => {
  const tooltip = document.createElement('div'); tooltip.id = 'api-field-tooltip'; tooltip.role = 'tooltip'; tooltip.hidden = true; document.body.append(tooltip);
  const content = new WeakMap();
  const anchors = new WeakMap();
  let current, hideTimer, pinned = false;
  const cancelHide = () => clearTimeout(hideTimer);
  const hide = () => { cancelHide(); tooltip.hidden = true; current?.removeAttribute('aria-describedby'); if (current && content.has(current)) current.setAttribute('aria-expanded', 'false'); current = null; pinned = false; };
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
    if (current === button && content.has(button)) { cancelHide(); return; }
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
    if (!position(button)) hide();
  };
  function position(button) {
    const anchor = anchors.get(button) || button.closest('#tool-chain-controls, label, summary') || button;
    const trigger = button.getBoundingClientRect();
    const field = anchor.getClientRects().length ? anchor.getBoundingClientRect() : trigger;
    const source = {
      left:Math.min(field.left, trigger.left), right:Math.max(field.right, trigger.right),
      top:Math.min(field.top, trigger.top), bottom:Math.max(field.bottom, trigger.bottom)
    };
    const margin = 8, gap = 7;
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft || 0) + margin, top = (viewport?.offsetTop || 0) + margin;
    const right = left + (viewport?.width || document.documentElement.clientWidth) - margin * 2;
    const bottom = top + (viewport?.height || innerHeight) - margin * 2;
    tooltip.style.maxWidth = Math.min(330, right - left) + 'px';
    if (right - left < 36 || bottom - top < 36) return false;
    tooltip.style.maxHeight = bottom - top + 'px';
    const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
    const belowEdge = Math.max(top, source.bottom + gap);
    const aboveEdge = Math.min(bottom, source.top - gap);
    const below = bottom - belowEdge, above = aboveEdge - top;
    const clamp = (value, lo, hi) => Math.max(lo, Math.min(value, hi));
    const sideRight = Math.max(left, source.right + gap);
    const sideLeft = Math.min(right, source.left - gap);
    tooltip.style.right = tooltip.style.bottom = '';
    tooltip.style.left = clamp(trigger.left, left, right - width) + 'px';
    if (below < height && above < height && (sideRight + width <= right || sideLeft - width >= left)) {
      if (sideRight + width <= right) {
        tooltip.style.left = sideRight + 'px';
        tooltip.style.maxWidth = Math.min(330, right - sideRight) + 'px';
      } else {
        tooltip.style.left = '';
        tooltip.style.right = innerWidth - sideLeft + 'px';
        tooltip.style.maxWidth = Math.min(330, sideLeft - left) + 'px';
      }
      const y = clamp(trigger.top, top, bottom - height);
      tooltip.style.top = y + 'px';
      tooltip.style.maxHeight = bottom - y + 'px';
    } else {
      const useBelow = below >= height || (above < height && below >= above);
      const available = useBelow ? below : above;
      if (available < 36) return false;
      tooltip.style.maxHeight = available + 'px';
      // Pin the edge nearest the field so new content cannot grow over it.
      if (useBelow) tooltip.style.top = belowEdge + 'px';
      else {
        tooltip.style.top = '';
        tooltip.style.bottom = innerHeight - aboveEdge + 'px';
      }
    }
    return true;
  }
  function attach(button, render, anchor) {
    if (anchor) anchors.set(button, anchor);
    if (render) {
      content.set(button, render);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', tooltip.id);
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') show(button); });
      button.addEventListener('pointerleave', scheduleHide);
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (current === button && pinned) hide();
        else {
          show(button);
          if (!tooltip.hidden) {
            pinned = true;
            tooltip.querySelector('input, button')?.focus({preventScroll:true});
          }
        }
      });
      return;
    }
    button.addEventListener('pointerenter', () => show(button)); button.addEventListener('pointerleave', scheduleHide);
    button.addEventListener('focus', () => show(button)); button.addEventListener('blur', scheduleHide);
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); show(button); });
    button.addEventListener('keydown', event => { if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') hide(); else show(button); } });
  }
  const reposition = () => { if (current && !position(current)) hide(); };
  new ResizeObserver(reposition).observe(tooltip);
  window.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
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
