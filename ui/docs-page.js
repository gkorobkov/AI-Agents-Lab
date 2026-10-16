(() => {
  const $ = id => document.getElementById(id);
  let lang = localStorage.getItem('n8n_lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');
  const sections = [...document.querySelectorAll('main details')];
  function syncToggle() {
    const expanded = sections.length > 0 && sections.every(section => section.open);
    const caption = lang === 'ru' ? (expanded ? 'Свернуть все разделы' : 'Раскрыть все разделы') : (expanded ? 'Collapse all sections' : 'Expand all sections');
    $('toggle-all-sections').textContent = expanded ? '▾' : '▸';
    $('toggle-all-sections').title = caption;
    $('toggle-all-sections').setAttribute('aria-label', caption);
    $('toggle-all-sections').setAttribute('aria-expanded', String(expanded));
  }
  function applyLang(value) {
    lang = value;
    document.documentElement.lang = lang;
    document.title = (lang === 'ru' ? 'Доки' : 'Docs') + ' — AI Agents Lab';
    document.querySelectorAll('[data-ru]').forEach(item => { item.textContent = item.dataset[lang]; });
    $('lang').textContent = lang === 'ru' ? 'EN' : 'RU';
    syncToggle();
  }
  function applyTheme(value) { document.documentElement.dataset.theme = value; }
  $('lang').onclick = () => {
    const value = lang === 'ru' ? 'en' : 'ru';
    localStorage.setItem('n8n_lang', value);applyLang(value);
  };
  $('theme').onclick = () => {
    const value = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('n8n_theme', value);applyTheme(value);
  };
  $('toggle-all-sections').onclick = () => {
    const expand = !sections.every(section => section.open);
    sections.forEach(section => { section.open = expand; });syncToggle();
  };
  sections.forEach(section => section.addEventListener('toggle', syncToggle));
  window.addEventListener('storage', event => {
    if (event.key === 'n8n_lang' && ['ru', 'en'].includes(event.newValue)) applyLang(event.newValue);
    if (event.key === 'n8n_theme' && ['dark', 'light'].includes(event.newValue)) applyTheme(event.newValue);
  });
  applyTheme(localStorage.getItem('n8n_theme') || 'dark');applyLang(lang);
})();
