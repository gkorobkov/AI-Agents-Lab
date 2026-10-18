// Standalone content URLs enter the same app shell; embedded pages omit their header.
(() => {
  const page = location.pathname.includes('labs') ? 'labs' : location.pathname.includes('tools') ? 'tools' : 'documentation';
  if (window === window.parent) {
    // Keep public content readable at its own URL for readers and search engines.
    return;
  }
  document.documentElement.classList.add('app-embedded');
  const style = document.createElement('style');
  style.textContent = '.app-embedded body > header { display:none!important } .app-embedded nav.toc, .app-embedded .layout > nav { top:24px }';
  document.head.appendChild(style);
  const syncHelpIconColors = () => {
    const settings = parent.document.getElementById('mode-settings-btn');
    document.querySelectorAll('[data-help-highlight="settings"] .help-element-icon').forEach(icon => {
      if (settings) icon.style.color = parent.getComputedStyle(settings).color;
    });
  };
  document.addEventListener('DOMContentLoaded', syncHelpIconColors);
  new MutationObserver(syncHelpIconColors).observe(parent.document.body, { attributes: true, attributeFilter: ['data-transport'] });
  new MutationObserver(syncHelpIconColors).observe(parent.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('click', event => {
    parent.closeCompactSelects();
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (link.dataset.labId) return;
    if (link.dataset.helpHighlight) {
      event.preventDefault();
      parent.appWorkspace.highlightHelp(link.dataset.helpHighlight);
      return;
    }
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.searchParams.get('page') === 'settings') {
      event.preventDefault();
      parent.appWorkspace.openSettings('openai', { profile: url.searchParams.get('profile'), field: url.searchParams.get('field'), sourceWindow: link.dataset.openBeside ? window : undefined });
      return;
    }
    const file = url.pathname.split('/').pop().replace(/\.html$/, '');
    if (!['index', 'labs', 'docs', 'documentation', 'tools', 'mcp', 'help', ''].includes(file) || url.pathname === location.pathname && url.hash) return;
    event.preventDefault();
    if (link.dataset.openBeside) {
      parent.appWorkspace.openBeside(link.dataset.openBeside, window);
      if (link.hasAttribute('data-fill-message')) {
        const input = parent.document.getElementById('msg-input');
        if (input && !input.disabled) {
          input.value = link.textContent.trim();
          input.dispatchEvent(new parent.Event('input', { bubbles: true }));
        }
      }
      if (url.hash) {
        if (link.dataset.openBeside === 'chat') parent.appWorkspace.highlightField(url.hash.slice(1));
        else parent.navigateApp(link.dataset.openBeside, url.hash);
      }
      return;
    }
    parent.navigateApp(file === 'index' || file === '' ? 'chat' : file, url.hash, true, url.searchParams.get('lab'));
  });
})();
