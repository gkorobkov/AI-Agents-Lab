(() => {
  'use strict';
  const CFG_LAB_MANIFEST = 'labs-manifest.json';
  const CFG_LAB_CATALOG_KEY = 'ai_lab_definitions_v1';
  const CFG_LAB_REPORT_PREFIX = 'ai_lab_report_v1:';
  const CFG_LAB_MAX_FILE = 2 * 1024 * 1024;
  const CFG_LAB_MAX_REPORT = 32 * 1024 * 1024;
  const labs = new Map();
  const drafts = new Map();
  let selected, report;
  let storageError = '';
  let pendingOpen = null;
  let ready = false;
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const fail = message => { throw new Error(message); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const string = (value, max = 100000) => typeof value === 'string' && value.length <= max;
  const identifier = value => string(value, 64) && /^[a-z0-9][a-z0-9-]*$/.test(value);
  const reportKey = lab => CFG_LAB_REPORT_PREFIX + lab.id + ':' + lab.version;
  const statuses = { todo: 'Не начато', 'in-progress': 'В работе', completed: 'Выполнено', unavailable: 'Недоступно' };
  function validateBlocks(blocks, depth = 0) {
    if (!Array.isArray(blocks) || blocks.length > 100 || depth > 4) fail('Неверный список блоков задания.');
    blocks.forEach(block => {
      if (!object(block)) fail('Неверный блок задания.');
      if (block.type === 'paragraph') {
        if (!string(block.text) || ![undefined, 'normal', 'muted', 'question'].includes(block.tone)) fail('Неверный текст задания.');
      } else if (block.type === 'code') {
        if (!string(block.text) || (block.label !== undefined && !string(block.label, 200))) fail('Неверный блок кода.');
      } else if (block.type === 'list') {
        if (!Array.isArray(block.items) || block.items.length > 100 || !block.items.every(item => string(item)) || (block.ordered !== undefined && typeof block.ordered !== 'boolean')) fail('Неверный список шагов.');
      } else if (block.type === 'details') {
        if (!string(block.title, 300)) fail('Нет заголовка пояснения.');
        validateBlocks(block.blocks, depth + 1);
      } else fail('Неизвестный тип блока: ' + String(block.type));
    });
  }
  function validateLab(lab) {
    if (!object(lab) || lab.schemaVersion !== 1 || !identifier(lab.id) || !string(lab.version, 32) || !/^[a-z0-9][a-z0-9.-]*$/.test(lab.version)) fail('Нужны schemaVersion: 1, id и version лабораторной.');
    if (!string(lab.title, 200) || !lab.title.trim() || !string(lab.description, 3000)) fail('Нужны название и описание лабораторной.');
    if (!Array.isArray(lab.experiments) || !lab.experiments.length || lab.experiments.length > 100) fail('В лабораторной должно быть от 1 до 100 заданий.');
    const ids = new Set(['prepare', 'report', 'experiments']);
    lab.experiments.forEach(experiment => {
      if (!object(experiment) || !identifier(experiment.id) || ids.has(experiment.id) || !string(experiment.title, 200) || !experiment.title.trim()) fail('У заданий должны быть уникальные id и названия.');
      ids.add(experiment.id); validateBlocks(experiment.blocks);
    });
    ['introduction', 'preparation', 'reportInstructions'].forEach(key => { if (lab[key] !== undefined) validateBlocks(lab[key]); });
    return lab;
  }
  function emptyReport(lab) {
    return { schemaVersion: 1, kind: 'ai-lab-report', labId: lab.id, labVersion: lab.version, author: '', group: '', conclusion: '', updatedAt: null, answers: Object.fromEntries(lab.experiments.map(experiment => [experiment.id, { results: '', evidence: '', conclusion: '', status: 'todo' }])) };
  }
  function validateReport(value, lab) {
    if (!object(value) || value.schemaVersion !== 1 || value.kind !== 'ai-lab-report' || value.labId !== lab.id || value.labVersion !== lab.version || !object(value.answers)) fail('Отчёт не соответствует версии лабораторной.');
    const clean = emptyReport(lab);
    for (const key of ['author', 'group', 'conclusion']) {
      if (!string(value[key], key === 'conclusion' ? 100000 : 200)) fail('Неверное поле отчёта: ' + key);
      clean[key] = value[key];
    }
    if (value.updatedAt !== null && (!string(value.updatedAt, 40) || !Number.isFinite(Date.parse(value.updatedAt)))) fail('Неверная дата отчёта.');
    clean.updatedAt = value.updatedAt;
    lab.experiments.forEach(experiment => {
      const answer = value.answers[experiment.id];
      if (!object(answer) || !Object.hasOwn(statuses, answer.status) || !['results', 'evidence', 'conclusion'].every(key => string(answer[key]))) fail('Неверные ответы задания: ' + experiment.id);
      if (answer.status === 'completed' && (!answer.results.trim() || !answer.conclusion.trim())) fail('Для выполненного задания нужны результат и вывод.');
      if (answer.status === 'unavailable' && !answer.results.trim()) fail('Укажите причину недоступности задания.');
      clean.answers[experiment.id] = { results: answer.results, evidence: answer.evidence, conclusion: answer.conclusion, status: answer.status };
    });
    return clean;
  }
  function readReport(lab) {
    storageError = '';
    const cached = drafts.get(reportKey(lab));
    if (cached) { storageError = cached.error; return cached.report; }
    try {
      const raw = localStorage.getItem(reportKey(lab));
      return raw ? validateReport(JSON.parse(raw), lab) : emptyReport(lab);
    } catch (_) {
      storageError = 'Не удалось прочитать сохранённый отчёт. Исходные данные оставлены в браузере; новые ответы можно экспортировать.';
      return emptyReport(lab);
    }
  }
  function saveReport() {
    report.updatedAt = new Date().toISOString();
    // Keep an unreadable report intact; retain unsaved work when switching labs.
    if (!storageError.startsWith('Не удалось прочитать')) {
      try { localStorage.setItem(reportKey(selected), JSON.stringify(report)); storageError = ''; }
      catch (_) { storageError = 'Не удалось сохранить в браузере. Скачайте отчёт, чтобы не потерять ответы.'; }
    }
    drafts.set(reportKey(selected), { report, error: storageError });
    updateProgress();
  }
  function progress(lab, value) {
    const answers = lab.experiments.map(experiment => value.answers[experiment.id]);
    return { completed: answers.filter(answer => answer.status === 'completed').length, unavailable: answers.filter(answer => answer.status === 'unavailable').length, total: answers.length };
  }
  function updateProgress() {
    const count = progress(selected, report);
    $('lab-progress').value = count.completed; $('lab-progress').max = count.total;
    $('progress-label').textContent = `Выполнено ${count.completed} из ${count.total}` + (count.unavailable ? ` · Недоступно: ${count.unavailable}` : '');
    $('save-status').textContent = storageError || (report.updatedAt ? 'Сохранено в этом браузере · ' + new Date(report.updatedAt).toLocaleTimeString('ru-RU') : 'Ответы сохраняются автоматически в этом браузере.');
    $('save-status').classList.toggle('save-error', Boolean(storageError));
    $('storage-warning').textContent = storageError; $('storage-warning').hidden = !storageError;
    selected.experiments.forEach(experiment => {
      const status = report.answers[experiment.id].status;
      const link = $('lab-toc').querySelector(`[data-experiment="${experiment.id}"]`);
      link.querySelector('small').textContent = statuses[status]; link.dataset.status = status;
      $('status-' + experiment.id).value = status;
    });
    const link = $('lab-links').querySelector('[aria-current="page"]');
    if (link) link.querySelector('small').textContent = `${count.completed}/${count.total}`;
  }
  function renderBlocks(container, blocks = []) {
    blocks.forEach(block => {
      if (block.type === 'paragraph') container.append(node('p', block.text, block.tone === 'question' ? 'question' : block.tone === 'muted' ? 'observe' : ''));
      if (block.type === 'list') {
        const list = node(block.ordered ? 'ol' : 'ul'); block.items.forEach(item => list.append(node('li', item))); container.append(list);
      }
      if (block.type === 'details') {
        const details = node('details'); details.append(node('summary', block.title)); renderBlocks(details, block.blocks); container.append(details);
      }
      if (block.type === 'code') {
        const box = node('div', undefined, 'copybox'); const bar = node('div', block.label || 'Пример', 'copybar');
        const button = node('button', 'Копировать'); button.type = 'button'; const pre = node('pre', block.text);
        button.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(block.text); $('action-status').textContent = 'Текст скопирован.'; }
          catch (_) { const range = document.createRange(); range.selectNodeContents(pre); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); $('action-status').textContent = 'Текст выделен. Используйте команду «Копировать» браузера.'; }
        });
        bar.append(button); box.append(bar, pre); container.append(box);
      }
    });
  }
  function field(labelText, id, value, onInput, multiline = true, maxLength = 100000) {
    const label = node('label', labelText, 'answer-field');
    const input = node(multiline ? 'textarea' : 'input'); input.id = id; input.value = value; input.maxLength = maxLength; input.className = 'ym-disable-keys';
    if (multiline) input.rows = 4; else input.type = 'text';
    input.addEventListener('input', () => { input.setCustomValidity(''); onInput(input.value); saveReport(); });
    label.append(input); return label;
  }
  function linkTo(text, href) { const a = node('a', text); a.href = href; return a; }
  function exportButtons() {
    const bar = node('div', undefined, 'report-toolbar');
    for (const format of ['md', 'json']) {
      const button = node('button', 'Скачать отчёт .' + format); button.type = 'button'; button.addEventListener('click', () => exportReport(format)); bar.append(button);
    }
    return bar;
  }
  function renderLab() {
    const main = $('lab-main'); const toc = $('lab-toc'); main.replaceChildren(); toc.replaceChildren(node('strong', 'СОДЕРЖАНИЕ'));
    main.append(node('p', 'Практикум · версия ' + selected.version, 'eyebrow'), node('h1', selected.title), node('p', selected.description, 'lead'));
    const toolbar = exportButtons(); toolbar.prepend(linkTo('Открыть чат для практики →', 'index.html')); main.append(toolbar);
    const summary = node('div', undefined, 'progress-summary');
    const label = node('label'); label.id = 'progress-label'; label.htmlFor = 'lab-progress';
    const meter = node('progress'); meter.id = 'lab-progress';
    const saveStatus = node('p', '', 'status'); saveStatus.id = 'save-status'; saveStatus.setAttribute('role', 'status');
    const actionStatus = node('p', '', 'status'); actionStatus.id = 'action-status'; actionStatus.setAttribute('role', 'status');
    summary.append(label, meter, saveStatus, actionStatus); main.append(summary);
    const identity = node('div', undefined, 'report-identity ym-hide-content');
    identity.append(field('Автор отчёта', 'report-author', report.author, value => { report.author = value; }, false, 200), field('Группа / курс', 'report-group', report.group, value => { report.group = value; }, false, 200)); main.append(identity);
    renderBlocks(main, selected.introduction);
    const preparation = node('section'); preparation.id = 'prepare'; preparation.append(node('h2', 'Подготовка')); renderBlocks(preparation, selected.preparation); main.append(preparation); toc.append(linkTo('Подготовка', '#prepare'));
    const experiments = node('section'); experiments.id = 'experiments'; experiments.append(node('h2', 'Эксперименты'), node('p', 'Зафиксируйте результат и вывод, затем отметьте задание выполненным. Если выполнить его невозможно, выберите «Недоступно» и укажите причину в результате.', 'observe')); main.append(experiments);
    selected.experiments.forEach((experiment, index) => {
      const link = linkTo(`${String(index + 1).padStart(2, '0')} · ${experiment.title}`, '#task-' + experiment.id); link.dataset.experiment = experiment.id; link.append(node('small')); toc.append(link);
      const article = node('article', undefined, 'experiment'); article.id = 'task-' + experiment.id;
      const head = node('div', undefined, 'experiment-head'); head.append(node('span', String(index + 1).padStart(2, '0'), 'number'), node('h3', experiment.title)); article.append(head); renderBlocks(article, experiment.blocks);
      const answer = report.answers[experiment.id]; const form = node('div', undefined, 'answer-form ym-hide-content');
      const changed = (key, value) => {
        answer[key] = value;
        if ((answer.status === 'completed' && (!answer.results.trim() || !answer.conclusion.trim())) || (answer.status === 'unavailable' && !answer.results.trim())) answer.status = 'in-progress';
        if (answer.status === 'todo' && value.trim()) answer.status = 'in-progress';
      };
      form.append(field('Результат / наблюдения', 'results-' + experiment.id, answer.results, value => changed('results', value)), field('Запросы, ответы JSON и параметры опыта', 'evidence-' + experiment.id, answer.evidence, value => changed('evidence', value)), field('Вывод', 'conclusion-' + experiment.id, answer.conclusion, value => changed('conclusion', value)));
      const statusLabel = node('label', 'Статус задания', 'answer-field'); const status = node('select'); status.id = 'status-' + experiment.id;
      Object.entries(statuses).forEach(([value, caption]) => { const option = node('option', caption); option.value = value; status.append(option); });
      status.addEventListener('change', () => {
        const required = status.value === 'completed' ? ['results', 'conclusion'] : status.value === 'unavailable' ? ['results'] : [];
        for (const key of required) {
          if (!answer[key].trim()) {
            const input = $(key + '-' + experiment.id); input.setCustomValidity(key === 'conclusion' ? 'Добавьте вывод.' : 'Добавьте результат или причину недоступности.'); input.reportValidity(); status.value = answer.status; return;
          }
        }
        answer.status = status.value; saveReport();
      });
      statusLabel.append(status); form.append(statusLabel); article.append(form); main.append(article);
    });
    const final = node('section'); final.id = 'report'; final.append(node('h2', 'Итоговый отчёт')); renderBlocks(final, selected.reportInstructions);
    const finalForm = node('div', undefined, 'ym-hide-content'); finalForm.append(field('Общий вывод по лабораторной', 'report-conclusion', report.conclusion, value => { report.conclusion = value; })); final.append(finalForm);
    final.append(node('p', 'Экспорт содержит автора, задания, статусы и введённые ответы. Проверьте вложенные JSON: не включайте API-ключи. Отправьте скачанный файл преподавателю самостоятельно.', 'observe'), exportButtons());
    main.append(final); toc.append(linkTo('Итоговый отчёт', '#report')); $('lab-layout').hidden = false; updateProgress(); highlightTask();
  }
  function renderCatalog() {
    $('lab-links').replaceChildren();
    labs.forEach(lab => {
      const url = new URL(location.href); url.searchParams.set('lab', lab.id); url.hash = '';
      const link = linkTo('', url.href); link.append(node('span', lab.title)); link.title = lab.title; link.dataset.labId = lab.id;
      if (lab === selected) link.setAttribute('aria-current', 'page');
      let count = '0/' + lab.experiments.length;
      try {
        const raw = localStorage.getItem(reportKey(lab)); const value = drafts.get(reportKey(lab))?.report || (raw ? validateReport(JSON.parse(raw), lab) : null);
        if (value) count = progress(lab, value).completed + '/' + lab.experiments.length;
      } catch (_) { count = '—'; }
      link.append(node('small', count));
      link.addEventListener('click', event => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); selectLab(lab.id, true);
      });
      $('lab-links').append(link);
    });
  }
  function selectLab(id, push = false) {
    const next = labs.get(id);
    if (!next) { $('catalog-status').textContent = 'Лабораторная не найдена. Выберите работу в полосе «Лабы» или загрузите её JSON.'; return; }
    selected = next; report = readReport(next); renderCatalog(); renderLab();
    $('lab-links').querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (push) {
      const url = new URL(location.href); url.searchParams.set('lab', id); url.hash = ''; history.pushState(null, '', url); scrollTo(0, 0);
      if (window !== parent) parent.appWorkspace?.setLabLocation(id);
    }
  }
  function exportReport(format) {
    const count = progress(selected, report);
    const snapshot = { ...report, exportedAt: new Date().toISOString(), progress: count, lab: selected };
    let content;
    if (format === 'json') content = JSON.stringify(snapshot, null, 2);
    else {
      // Keep arbitrary Markdown/HTML in submitted text literal in the report.
      const literal = value => { const runs = value.match(/`+/g) || []; const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1))); return `${fence}\n${value || 'Не заполнено'}\n${fence}`; };
      const lines = ['# Отчёт по лабораторной', literal(selected.title), `Версия: ${selected.version} · ID: ${selected.id}`, '## Автор', literal(report.author), '## Группа / курс', literal(report.group), `Выгружено: ${snapshot.exportedAt}`, `Выполнено: ${count.completed}/${count.total}. Недоступно: ${count.unavailable}.`];
      const describe = blocks => blocks.flatMap(block => block.type === 'details' ? [block.title, ...describe(block.blocks)] : block.type === 'list' ? block.items : [block.text]);
      selected.experiments.forEach((experiment, index) => {
        const answer = report.answers[experiment.id];
        lines.push(`## Задание ${index + 1}`, literal(experiment.title), `Статус: ${statuses[answer.status]}`, '### Условие', literal(describe(experiment.blocks).join('\n\n')), '### Результат / наблюдения', literal(answer.results), '### Запросы, ответы и параметры', literal(answer.evidence), '### Вывод', literal(answer.conclusion));
      });
      lines.push('## Общий вывод', literal(report.conclusion)); content = lines.join('\n\n') + '\n';
    }
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
    const link = node('a'); link.href = url; link.download = `${selected.id}-report-${snapshot.exportedAt.slice(0, 10)}.${format}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('action-status').textContent = 'Отчёт подготовлен к скачиванию. Его можно отправить на проверку.';
  }
  async function importFile(file) {
    if (!file) return;
    try {
      if (file.size > CFG_LAB_MAX_REPORT) fail('Размер отчёта не должен превышать 32 МБ.');
      const value = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const importedReport = object(value) && value.kind === 'ai-lab-report';
      if (!importedReport && file.size > CFG_LAB_MAX_FILE) fail('Размер лабораторной не должен превышать 2 МБ.');
      const lab = validateLab(importedReport ? value.lab : value);
      const restored = importedReport ? validateReport(value, lab) : null;
      const existing = labs.get(lab.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(lab)) fail('Лаба с таким id уже подключена с другим содержимым. Используйте новый id для отдельной работы.');
      if (restored && !confirm('Заменить ответы этой лабораторной данными из отчёта? Текущие ответы можно предварительно экспортировать.')) return;
      if (!existing) {
        const saved = JSON.parse(localStorage.getItem(CFG_LAB_CATALOG_KEY) || '[]');
        if (!Array.isArray(saved) || saved.length >= 100) fail('Не удалось дополнить каталог загруженных лаб (максимум 100).');
        localStorage.setItem(CFG_LAB_CATALOG_KEY, JSON.stringify([...saved, lab])); labs.set(lab.id, lab);
      }
      if (restored) { localStorage.setItem(reportKey(lab), JSON.stringify(restored)); drafts.delete(reportKey(lab)); }
      selectLab(lab.id, true);
      $('catalog-status').textContent = restored ? 'Отчёт восстановлен. Можно продолжить работу.' : 'Лабораторная подключена и сохранена в этом браузере.';
    } catch (error) { $('catalog-status').textContent = 'Не удалось загрузить JSON: ' + error.message; }
    finally { $('lab-file').value = ''; }
  }
  async function fetchJSON(url) {
    const response = await fetch(url);
    if (!response.ok) fail('HTTP ' + response.status);
    const value = await response.text(); if (value.length > CFG_LAB_MAX_FILE) fail('Файл слишком большой.');
    return JSON.parse(value.replace(/^\uFEFF/, ''));
  }
  async function start() {
    const errors = [];
    try {
      const manifest = await fetchJSON(CFG_LAB_MANIFEST);
      if (!object(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.labs) || manifest.labs.length > 100) fail('Неверный каталог лабораторных.');
      const loaded = await Promise.allSettled(manifest.labs.map(async path => {
        if (!string(path, 200) || !/^[a-z0-9][a-z0-9-]*\.json$/.test(path)) fail('Используйте имя локального JSON-файла.');
        return validateLab(await fetchJSON(path));
      }));
      loaded.forEach((result, index) => {
        if (result.status === 'rejected') errors.push(`${manifest.labs[index]}: ${result.reason.message}`);
        else if (labs.has(result.value.id)) errors.push('Повторяющийся id: ' + result.value.id);
        else labs.set(result.value.id, result.value);
      });
    } catch (error) { errors.push('Каталог: ' + error.message); }
    try {
      const saved = JSON.parse(localStorage.getItem(CFG_LAB_CATALOG_KEY) || '[]');
      if (!Array.isArray(saved) || saved.length > 100) fail('Неверный локальный каталог.');
      saved.forEach(value => { try { const lab = validateLab(value); if (!labs.has(lab.id)) labs.set(lab.id, lab); } catch (error) { errors.push(error.message); } });
    } catch (error) { errors.push('Локальные лабы: ' + error.message); }
    $('catalog-status').textContent = errors.length ? 'Часть лабораторных не загружена. ' + errors.join(' · ') : 'Выберите лабораторную. JSON-файл добавляет новую работу; JSON-отчёт восстанавливает ответы.';
    renderCatalog(); ready = true;
    if (pendingOpen) { window.openLab(...pendingOpen); pendingOpen = null; }
    else if (labs.size) selectLab(new URL(location.href).searchParams.get('lab') || labs.keys().next().value);
    else $('catalog-status').textContent += ' Загрузите JSON лабораторной, чтобы начать.';
    jumpToHash();
  }
  function jumpToHash() {
    try { const id = decodeURIComponent(location.hash.slice(1)); if (id) (document.getElementById(id) || document.getElementById('task-' + id))?.scrollIntoView(); } catch (_) {}
  }
  function highlightTask() {
    const links = [...$('lab-toc').querySelectorAll('a')];
    const threshold = document.querySelector('.lab-bar').getBoundingClientRect().bottom + 70;
    let active = links[0];
    links.forEach(link => { if (document.getElementById(link.hash.slice(1))?.getBoundingClientRect().top <= threshold) active = link; });
    links.forEach(link => { if (link === active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  let scrollScheduled = false;
  addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true; requestAnimationFrame(() => { scrollScheduled = false; highlightTask(); });
  }, { passive: true });
  // Select without reloading the iframe or losing an unsaved draft.
  window.openLab = (id, hash = '') => {
    if (!ready) { pendingOpen = [id, hash]; return; }
    if (id || !selected) selectLab(id || labs.keys().next().value);
    const url = new URL(location.href);
    if (id) url.searchParams.set('lab', id);
    url.hash = hash; history.replaceState(null, '', url);
    if (hash) jumpToHash();
  };
  function renderTheme() { $('theme').textContent = document.documentElement.dataset.theme === 'light' ? 'Тёмная тема' : 'Светлая тема'; }
  $('theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = next;
    try { localStorage.setItem('n8n_theme', next); } catch (_) {} renderTheme();
  });
  $('import-lab').addEventListener('click', () => $('lab-file').click());
  $('lab-file').addEventListener('change', event => importFile(event.target.files[0]));
  addEventListener('popstate', () => {
    const id = new URL(location.href).searchParams.get('lab') || labs.keys().next().value;
    if (id && id !== selected?.id) { selectLab(id); if (window !== parent) parent.appWorkspace?.setLabLocation(id); }
    jumpToHash();
  });
  addEventListener('hashchange', jumpToHash);
  addEventListener('storage', event => {
    if (event.key === 'n8n_theme') { document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark'; renderTheme(); }
    if (selected && event.key === reportKey(selected)) $('action-status').textContent = 'Отчёт изменён в другой вкладке. Перезагрузите страницу, чтобы открыть ту версию; перед этим экспортируйте текущие ответы, если нужно их сохранить.';
  });
  renderTheme(); start();
})();
