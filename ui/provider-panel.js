// Compose live provider controls without replacing their inputs or event handlers.
(() => {
  function create({title, help, links = [], profile, url, key, connection, helpControl, className}) {
    const shell = document.createElement('div');
    shell.className = 'connection-card-shell';
    const panel = document.createElement('section');
    panel.classList.add('connection-panel');
    if (className) panel.classList.add(className);
    panel.setAttribute('aria-label', title);
    const fields = document.createElement('div');
    fields.className = 'settings-field-grid connection-fields';
    const identity = document.createElement('div');
    identity.className = 'connection-provider';
    const caption = document.createElement('div');
    caption.className = 'connection-caption provider-panel-caption';
    const heading = document.createElement('h3');
    heading.className = 'connection-title';
    heading.textContent = title;
    caption.append(heading);
    if (help) helpControl(caption, title, help, identity);
    if (links.length) {
      const separator = document.createElement('span');
      separator.className = 'provider-panel-separator';
      separator.textContent = '·';
      separator.setAttribute('aria-hidden','true');
      caption.append(separator, ...links);
    }
    identity.append(caption, profile);
    fields.append(identity, url.closest('.proxy-field'), key.closest('label'), connection);
    panel.append(fields);
    shell.append(panel);
    return shell;
  }
  window.ProviderPanel = {create};
})();
