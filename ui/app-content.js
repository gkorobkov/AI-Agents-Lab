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
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const file = url.pathname.split('/').pop().replace(/\.html$/, '');
    if (!['index', 'labs', 'documentation', 'tools', ''].includes(file) || url.pathname === location.pathname && url.hash) return;
    event.preventDefault();
    parent.navigateApp(file === 'index' || file === '' ? 'chat' : file, url.hash);
  });
})();
