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
  const defaultLabels = {
    "contents": "СОДЕРЖАНИЕ",
    "versionPrefix": "Практикум · версия",
    "objectiveTitle": "Цель лабораторной",
    "reportTitle": "Итоговый отчёт",
    "experimentsIntro": "Заполните результат и ответ с выводами — задание автоматически засчитается в прогресс. Если опыт недоступен, опишите причину и сделайте вывод.",
    "author": "Автор отчёта",
    "group": "Группа / курс",
    "results": "Результат / JSON или текст",
    "answer": "Ответ",
    "conclusion": "Ответ и выводы",
    "answerHint": "Объясните полученный результат. Запишите выводы.",
    "reportConclusion": "Общий вывод по лабораторной",
    "reportNote": "Экспорт содержит автора, задания, статусы и введённые ответы. Проверьте вложенные JSON: не включайте API-ключи. Отправьте скачанный файл преподавателю самостоятельно.",
    "download": "Скачать отчёт",
    "downloadFormat": "Формат отчёта",
    "example": "Пример",
    "copy": "Копировать",
    "copied": "Текст скопирован.",
    "copyFallback": "Текст выделен. Используйте команду «Копировать» браузера.",
    "progress": "Выполнено {completed} из {total}",
    "saved": "Сохранено в этом браузере",
    "autosave": "Ответы сохраняются автоматически в этом браузере.",
    "statusTodo": "Не начато",
    "statusInProgress": "В работе",
    "statusCompleted": "Выполнено",
    "statusUnavailable": "Недоступно",
    "exportReady": "Отчёт подготовлен к скачиванию. Его можно отправить на проверку."
  };
  const experimentsOf = lab => Array.isArray(lab.experiments) ? lab.experiments : lab.experiments?.items;
  const blocksOf = section => Array.isArray(section) ? section : section?.blocks;
  const labText = key => {
    const section = ['objectiveTitle'].includes(key) ? selected?.objective
      : ['reportTitle', 'reportConclusion', 'reportNote'].includes(key) ? selected?.reportInstructions
      : ['experimentsIntro', 'results', 'answer', 'conclusion', 'answerHint', 'statusTodo', 'statusInProgress', 'statusCompleted', 'statusUnavailable'].includes(key) ? selected?.experiments
      : ['progress', 'saved', 'autosave', 'download', 'downloadFormat', 'author', 'group'].includes(key) ? selected?.progress : null;
    if (key === 'objectiveTitle' || key === 'reportTitle') return section?.title ?? selected?.labels?.[key] ?? defaultLabels[key];
    if (key === 'experimentsIntro') return section?.description ?? selected?.labels?.[key] ?? defaultLabels[key];
    return section?.labels?.[key] ?? selected?.labels?.[key] ?? defaultLabels[key];
  };
  const statuses = { get todo() { return labText('statusTodo'); }, get 'in-progress'() { return labText('statusInProgress'); }, get completed() { return labText('statusCompleted'); }, get unavailable() { return labText('statusUnavailable'); } };
  const answerStatus = answer => answer.results.trim() && answer.conclusion.trim() ? 'completed' : answer.results.trim() || answer.conclusion.trim() ? 'in-progress' : 'todo';
  function validateBlocks(blocks, depth = 0) {
    if (!Array.isArray(blocks) || blocks.length > 100 || depth > 4) fail('Неверный список блоков задания.');
    blocks.forEach(block => {
      if (!object(block)) fail('Неверный блок задания.');
      if (block.type === 'paragraph') {
        if (![undefined, 'normal', 'muted', 'question'].includes(block.tone)) fail('Неверный стиль абзаца.');
        if (block.content !== undefined) {
          if (block.text !== undefined || !Array.isArray(block.content) || block.content.length > 100) fail('Для абзаца используйте text или массив content.');
          block.content.forEach(part => {
            if (typeof part === 'string') { if (!string(part)) fail('Неверный текст абзаца.'); }
            else { if (!object(part) || part.type !== 'link') fail('В content допустимы строки и ссылки.'); validateBlocks([part], depth + 1); }
          });
        } else if (!string(block.text)) fail('Неверный текст задания.');
      } else if (block.type === 'link') {
        if (!string(block.text, 3000) || !string(block.href, 2000) || new URL(block.href, location.href).origin !== location.origin || ![undefined, 'help', 'chat', 'settings', 'labs', 'tools', 'mcp'].includes(block.openBeside)) fail('Неверная ссылка в задании.');
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
    if (!string(lab.title, 200) || !lab.title.trim() || (lab.description !== undefined && !string(lab.description, 3000))) fail('Нужны название и описание лабораторной.');
    if (!Array.isArray(experimentsOf(lab)) || !experimentsOf(lab).length || experimentsOf(lab).length > 100) fail('В лабораторной должно быть от 1 до 100 заданий.');
    if (lab.progress !== undefined && (!object(lab.progress) || lab.progress.type !== 'progress')) fail('Неверный блок прогресса: нужен type: progress.');
    if (object(lab.experiments) && (!string(lab.experiments.title, 300) || (lab.experiments.description !== undefined && !string(lab.experiments.description, 5000)))) fail('Неверный заголовок или описание экспериментов.');
    ['preparationTitle', 'experimentsTitle'].forEach(key => { if (lab[key] !== undefined && (!string(lab[key], 300) || !lab[key].trim())) fail('Неверный заголовок раздела: ' + key); });
    [lab, lab.progress, lab.objective, lab.introduction, lab.preparation, lab.experiments, lab.reportInstructions].forEach(section => {
      if (object(section) && section.labels !== undefined && (!object(section.labels) || Object.values(section.labels).some(value => !string(value, 5000)))) fail('Подписи labels должны быть строками.');
    });
    const ids = new Set(['prepare', 'report', 'experiments', 'objective']);
    experimentsOf(lab).forEach(experiment => {
      if (!object(experiment) || !identifier(experiment.id) || ids.has(experiment.id) || !string(experiment.title, 200) || !experiment.title.trim()) fail('У заданий должны быть уникальные id и названия.');
      ids.add(experiment.id); validateBlocks(experiment.blocks);
    });
    ['objective', 'introduction', 'preparation', 'reportInstructions'].forEach(key => {
      if (lab[key] === undefined) return;
      if (object(lab[key])) {
        if (!string(lab[key].title, 300) || !lab[key].title.trim()) fail('Неверный заголовок раздела: ' + key);
        validateBlocks(lab[key].blocks);
      } else validateBlocks(lab[key]);
    });
    Object.values(lab).filter(value => object(value) && value.type === 'link').forEach(value => validateBlocks([value]));
    return lab;
  }
  function emptyReport(lab) {
    return { schemaVersion: 1, kind: 'ai-lab-report', labId: lab.id, labVersion: lab.version, author: '', group: '', conclusion: '', updatedAt: null, answers: Object.fromEntries(experimentsOf(lab).map(experiment => [experiment.id, { results: '', evidence: '', conclusion: '', status: 'todo' }])) };
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
    experimentsOf(lab).forEach(experiment => {
      const answer = value.answers[experiment.id];
      if (answer === undefined) return; // Newly added tasks start empty in existing reports.
      if (!object(answer) || !Object.hasOwn(statuses, answer.status) || !string(answer.results, 200002) || !['evidence', 'conclusion'].every(key => string(answer[key]))) fail('Неверные ответы задания: ' + experiment.id);
      // Fold the old third field into results without losing existing reports.
      const merged = { results: [answer.results, answer.evidence].filter(Boolean).join('\n\n'), evidence: '', conclusion: answer.conclusion };
      clean.answers[experiment.id] = { ...merged, status: answerStatus(merged) };
    });
    return clean;
  }
  function readReport(lab) {
    storageError = '';
    const cached = drafts.get(reportKey(lab));
    if (cached) { storageError = cached.error; return cached.report; }
    try {
      const raw = localStorage.getItem(reportKey(lab));
      if (!raw && lab.id === 'tool-calling') {
        const priorToolReport = localStorage.getItem(CFG_LAB_REPORT_PREFIX + 'tool-calling:1.0');
        if (priorToolReport) {
          const previousVersion = JSON.parse(priorToolReport);
          if (previousVersion.labVersion === '1.0') {
            previousVersion.labVersion = lab.version;
            return validateReport(previousVersion, lab);
          }
        }
        const previous = JSON.parse(localStorage.getItem(CFG_LAB_REPORT_PREFIX + 'chat-completions:1.0') || 'null');
        if (previous?.answers?.lab12) {
          const migrated = emptyReport(lab);
          migrated.author = previous.author; migrated.group = previous.group;
          migrated.answers.lab12 = previous.answers.lab12;
          return validateReport(migrated, lab);
        }
      }
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
    const answers = experimentsOf(lab).map(experiment => value.answers[experiment.id]);
    return { completed: answers.filter(answer => answerStatus(answer) === 'completed').length, total: answers.length };
  }
  function updateProgress() {
    const count = progress(selected, report);
    $('lab-progress').value = count.completed; $('lab-progress').max = count.total;
    $('progress-label').textContent = labText('progress').replaceAll('{completed}', count.completed).replaceAll('{total}', count.total);
    const saveStatus = $('save-status');
    saveStatus.textContent = storageError || (report.updatedAt ? labText('saved') + ' · ' : labText('autosave'));
    if (!storageError && report.updatedAt) {
      const timestamp = node('time', new Date(report.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), 'save-timestamp');
      timestamp.dateTime = report.updatedAt;
      saveStatus.append(timestamp);
    }
    $('save-status').classList.toggle('save-error', Boolean(storageError));
    $('storage-warning').textContent = storageError; $('storage-warning').hidden = !storageError;
    experimentsOf(selected).forEach(experiment => {
      const status = answerStatus(report.answers[experiment.id]);
      const link = $('lab-toc').querySelector(`[data-experiment="${experiment.id}"]`);
      link.querySelector('small').textContent = statuses[status]; link.dataset.status = status;
      $('answer-summary-' + experiment.id).textContent = labText('answer') + ' · ' + statuses[status];
    });
    const link = $('lab-links').querySelector('[aria-current="page"]');
    if (link) link.querySelector('small').textContent = `${count.completed}/${count.total}`;
  }
  function renderBlocks(container, blocks = []) {
    blocks.forEach(block => {
      if (block.type === 'paragraph') {
        const paragraph = node('p', undefined, block.tone === 'question' ? 'question' : block.tone === 'muted' ? 'observe' : '');
        (block.content || [block.text]).forEach(part => {
          if (typeof part === 'string') paragraph.append(document.createTextNode(part));
          else {
            const link = linkTo(part.text, part.href);
            if (part.openBeside) link.dataset.openBeside = part.openBeside;
            paragraph.append(link);
          }
        });
        container.append(paragraph);
      }
      if (block.type === 'link') {
        const link = linkTo(block.text, block.href);
        if (block.openBeside) link.dataset.openBeside = block.openBeside;
        if (block.icon === 'settings') {
          const icon = node('span'); icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="vertical-align:-3px;margin-right:5px"><path d="M9.5 2h5l.5 3 2 1.2 2.8-1 2.5 4.3L20 11.4v2.2l2.3 1.9-2.5 4.3-2.8-1-2 1.2-.5 3h-5L9 20l-2-1.2-2.8 1-2.5-4.3L4 13.6v-2.2L1.7 9.5l2.5-4.3 2.8 1L9 5Z" transform="translate(0 -.5)"/><circle cx="12" cy="12" r="3.5"/></svg>';
          link.replaceChildren(icon, document.createTextNode(block.text));
        }
        if (block.icon === 'help') {
          const icon = node('span'); icon.setAttribute('aria-hidden', 'true');
          icon.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:5px"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 16h.01"/></svg>';
          link.prepend(icon);
        }
        const line = node('div', undefined, 'lab-link-block'); line.append(link); container.append(line);
      }
      if (block.type === 'list') {
        const list = node(block.ordered ? 'ol' : 'ul'); block.items.forEach(item => list.append(node('li', item))); container.append(list);
      }
      if (block.type === 'details') {
        const details = node('details'); details.open = true; details.append(node('summary', block.title)); renderBlocks(details, block.blocks); container.append(details);
      }
      if (block.type === 'code') {
        const box = node('div', undefined, 'copybox'); const bar = node('div', block.label || labText('example'), 'copybar');
        const button = node('button', labText('copy')); button.type = 'button'; const pre = node('pre', block.text);
        button.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(block.text); $('action-status').textContent = labText('copied'); }
          catch (_) { const range = document.createRange(); range.selectNodeContents(pre); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); $('action-status').textContent = labText('copyFallback'); }
        });
        bar.append(button); box.append(bar, pre); container.append(box);
      }
    });
  }
  function field(labelText, id, value, onInput, multiline = true, maxLength = 100000) {
    const label = node('label', labelText, 'answer-field');
    const input = node(multiline ? 'textarea' : 'input'); input.id = id; input.value = value; input.maxLength = maxLength; input.className = 'ym-disable-keys';
    if (multiline) input.rows = 2; else input.type = 'text';
    input.addEventListener('input', () => { input.setCustomValidity(''); onInput(input.value); saveReport(); });
    label.append(input); return label;
  }
  function linkTo(text, href) { const a = node('a', text); a.href = href; return a; }
  function exportButtons() {
    const bar = node('div', undefined, 'report-toolbar');
    const picker = node('details', undefined, 'report-download');
    const trigger = node('summary', labText('download'));
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 10 6'); arrow.setAttribute('fill', 'none'); arrow.setAttribute('stroke', 'currentColor'); arrow.setAttribute('stroke-width', '1.5'); arrow.setAttribute('aria-hidden', 'true');
    const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); arrowPath.setAttribute('d', 'm1 1 4 4 4-4'); arrow.append(arrowPath); trigger.append(arrow);
    const panel = node('div', undefined, 'report-download-options');
    panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', labText('downloadFormat'));
    picker.append(trigger, panel); bar.append(picker);
    picker.addEventListener('toggle', () => {
      if (!picker.open) return;
      const rect = picker.getBoundingClientRect();
      panel.style.left = Math.max(8 - rect.left, Math.min(0, innerWidth - rect.left - panel.offsetWidth - 8)) + 'px';
      const above = innerHeight - rect.bottom < panel.offsetHeight && rect.top > panel.offsetHeight;
      panel.style.top = above ? 'auto' : '100%'; panel.style.bottom = above ? '100%' : 'auto';
    });
    picker.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') picker.open = true; });
    picker.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse' && !picker.contains(document.activeElement)) picker.open = false; });
    picker.addEventListener('focusout', () => { setTimeout(() => { if (!picker.contains(document.activeElement) && !picker.matches(':hover')) picker.open = false; }, 0); });
    picker.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); picker.open = false; trigger.focus(); } });
    for (const format of ['md', 'json', 'html']) {
      const button = node('button'); button.type = 'button';
      const icon = node('span', undefined, 'report-file-icon'); icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M14 2H5v20h14V7z M14 2v5h5"/><text x="12" y="16" text-anchor="middle" fill="currentColor" stroke="none" font-family="monospace" font-size="6">' + ({ md: 'MD', json: '{}', html: '&lt;/&gt;' })[format] + '</text></svg>';
      button.append(icon, node('span', ({ md: 'Markdown', json: 'JSON', html: 'HTML' })[format]), node('small', '.' + format));
      button.addEventListener('click', () => { exportReport(format); picker.open = false; trigger.focus(); }); panel.append(button);
    }
    return bar;
  }
  document.addEventListener('pointerdown', event => { document.querySelectorAll('.report-download[open]').forEach(picker => { if (!picker.contains(event.target)) picker.open = false; }); });
  function renderLab() {
    const main = $('lab-main'); const toc = $('lab-toc'); main.replaceChildren(); toc.replaceChildren(node('strong', labText('contents')));
    main.append(node('p', labText('versionPrefix') + ' ' + selected.version, 'eyebrow'), node('h1', selected.title), node('p', selected.description, 'lead'));
    const toolbar = exportButtons();
    const summary = node('div', undefined, 'progress-summary');
    const label = node('label'); label.id = 'progress-label'; label.htmlFor = 'lab-progress';
    const meter = node('progress'); meter.id = 'lab-progress';
    const saveStatus = node('p', '', 'status'); saveStatus.id = 'save-status'; saveStatus.setAttribute('role', 'status');
    const actionStatus = node('p', '', 'status'); actionStatus.id = 'action-status'; actionStatus.setAttribute('role', 'status');
    const progressCount = node('div', undefined, 'progress-count'); progressCount.append(label, meter);
    const progressPanel = node('div', undefined, 'progress-panel');
    progressPanel.append(progressCount, saveStatus);
    summary.append(progressPanel, toolbar, actionStatus); main.append(summary);
    const identity = node('div', undefined, 'report-identity ym-hide-content');
    identity.append(field(labText('author'), 'report-author', report.author, value => { report.author = value; }, false, 200), field(labText('group'), 'report-group', report.group, value => { report.group = value; }, false, 200)); main.append(identity);
    const objective = node('section'); objective.id = 'objective'; objective.append(node('h2', labText('objectiveTitle'))); renderBlocks(objective, blocksOf(selected.objective) || [{ type: 'paragraph', text: selected.description }]); main.append(objective); toc.append(linkTo(labText('objectiveTitle'), '#objective'));
    const introduction = node('section'); introduction.id = 'introduction';
    renderBlocks(introduction, blocksOf(selected.introduction));
    main.append(introduction);
    const preparation = node('section'); preparation.id = 'prepare'; preparation.append(node('h2', selected.preparation?.title || selected.preparationTitle || 'Подготовка')); renderBlocks(preparation, selected.preparation?.blocks || selected.preparation); main.append(preparation); toc.append(linkTo(selected.preparation?.title || selected.preparationTitle || 'Подготовка', '#prepare'));
    const experiments = node('section'); experiments.id = 'experiments'; experiments.append(node('h2', selected.experiments?.title || selected.experimentsTitle || 'Эксперименты'), node('p', labText('experimentsIntro'), 'observe')); main.append(experiments);
    experimentsOf(selected).forEach((experiment, index) => {
      const link = linkTo(`${String(index + 1).padStart(2, '0')} · ${experiment.title}`, '#task-' + experiment.id); link.dataset.experiment = experiment.id; link.append(node('small')); toc.append(link);
      const article = node('article', undefined, 'experiment'); article.id = 'task-' + experiment.id;
      const head = node('div', undefined, 'experiment-head'); head.append(node('span', String(index + 1).padStart(2, '0'), 'number'), node('h3', experiment.title)); article.append(head);
      renderBlocks(article, experiment.blocks);
      const answer = report.answers[experiment.id]; const form = node('div', undefined, 'answer-form ym-hide-content');
      const changed = (key, value) => {
        answer[key] = value;
        answer.status = answerStatus(answer);
      };
      form.append(field(labText('results'), 'results-' + experiment.id, answer.results, value => changed('results', value), true, 200002));
      const question = node('p', labText('answerHint'), 'question');
      form.append(question);
      form.append(field(labText('conclusion'), 'conclusion-' + experiment.id, answer.conclusion, value => changed('conclusion', value)));
      const answers = node('details', undefined, 'answer-details'); answers.open = true;
      const answerSummary = node('summary'); answerSummary.id = 'answer-summary-' + experiment.id;
      answers.append(answerSummary, form); article.append(answers); experiments.append(article);
    });
    const final = node('section'); final.id = 'report'; final.append(node('h2', labText('reportTitle'))); renderBlocks(final, blocksOf(selected.reportInstructions));
    const finalForm = node('div', undefined, 'ym-hide-content'); finalForm.append(field(labText('reportConclusion'), 'report-conclusion', report.conclusion, value => { report.conclusion = value; })); final.append(finalForm);
    final.append(node('p', labText('reportNote'), 'observe'), exportButtons());
    main.append(final); toc.append(linkTo(labText('reportTitle'), '#report'));
    // Content sections follow their property order in the source JSON.
    // Arrays (including nested blocks and experiments) retain their original order.
    const eyebrow = main.querySelector('.eyebrow');
    const sections = { title: main.querySelector('h1'), progress: summary, description: main.querySelector('.lead'), objective, introduction, preparation, experiments, reportInstructions: final };
    Object.entries(selected).forEach(([key, value]) => {
      if (!Object.hasOwn(sections, key) && object(value) && value.type === 'link') {
        const section = node('div', undefined, 'lab-link-block');
        renderBlocks(section, [value]);
        Object.defineProperty(sections, key, { value: section, enumerable: true });
      }
    });
    const orderedKeys = Object.keys(selected).filter(key => Object.hasOwn(sections, key));
    if (!orderedKeys.includes('progress')) orderedKeys.splice(orderedKeys.indexOf('title') + 1, 0, 'progress');
    if (!orderedKeys.includes('objective')) orderedKeys.splice(orderedKeys.indexOf('description') + 1, 0, 'objective');
    if (!orderedKeys.includes('reportInstructions')) orderedKeys.push('reportInstructions');
    const orderedContent = document.createDocumentFragment();
    orderedKeys.forEach(key => {
      const section = sections[key]; orderedContent.append(section);
      if (key === 'progress') orderedContent.append(identity);
      const ids = [section.id, ...section.querySelectorAll('[id]')].map(value => typeof value === 'string' ? value : value.id);
      [...toc.querySelectorAll('a')].filter(link => ids.includes(link.hash.slice(1))).forEach(link => toc.append(link));
    });
    main.replaceChildren(eyebrow, orderedContent);
    $('lab-layout').hidden = false; updateProgress(); highlightTask();
  }
  function renderCatalog() {
    $('lab-links').replaceChildren();
    labs.forEach(lab => {
      const url = new URL(location.href); url.searchParams.set('lab', lab.id); url.hash = '';
      const link = linkTo('', url.href); link.append(node('span', lab.title)); link.title = lab.title; link.dataset.labId = lab.id;
      if (lab === selected) link.setAttribute('aria-current', 'page');
      let count = '0/' + experimentsOf(lab).length;
      try {
        const raw = localStorage.getItem(reportKey(lab)); const value = drafts.get(reportKey(lab))?.report || (raw ? validateReport(JSON.parse(raw), lab) : null);
        if (value) count = progress(lab, value).completed + '/' + experimentsOf(lab).length;
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
    const describe = blocks => blocks.flatMap(block => block.type === 'details' ? [block.title, ...describe(block.blocks)] : block.type === 'list' ? block.items : [block.content ? block.content.map(part => typeof part === 'string' ? part : part.text).join('') : block.text]);
    let content;
    if (format === 'json') content = JSON.stringify(snapshot, null, 2);
    else if (format === 'html') {
      // Build text nodes so submitted HTML/JSON stays literal in the standalone file.
      const doc = document.implementation.createHTMLDocument('Отчёт · ' + selected.title);
      doc.documentElement.lang = 'ru';
      const charset = doc.createElement('meta'); charset.setAttribute('charset', 'utf-8'); doc.head.prepend(charset);
      const viewport = doc.createElement('meta'); viewport.name = 'viewport'; viewport.content = 'width=device-width, initial-scale=1'; doc.head.append(viewport);
      doc.head.append(node('style', 'body{max-width:900px;margin:24px auto;padding:0 16px;font:14px/1.5 system-ui;color:#192036}h1{font-size:24px}h2{font-size:18px}h3{font-size:14px;margin-bottom:6px}section{border-top:1px solid #ccd3df;margin-top:18px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f9;padding:10px;font:13px/1.5 monospace}@media print{body{margin:0;max-width:none}pre{background:none}}'));
      doc.body.append(node('h1', selected.title), node('p', `Версия: ${selected.version} · ID: ${selected.id}`), node('p', `Автор: ${report.author || 'Не указан'} · Группа / курс: ${report.group || 'Не указаны'}`), node('p', `Выгружено: ${snapshot.exportedAt} · Выполнено: ${count.completed}/${count.total}`));
      experimentsOf(selected).forEach((experiment, index) => {
        const answer = report.answers[experiment.id], section = node('section');
        section.append(node('h2', `${index + 1}. ${experiment.title}`), node('p', statuses[answerStatus(answer)]));
        for (const [heading, value] of [['Условие', describe(experiment.blocks).join('\n\n')], [labText('results'), answer.results], [labText('conclusion'), answer.conclusion]]) section.append(node('h3', heading), node('pre', value || 'Не заполнено'));
        doc.body.append(section);
      });
      doc.body.append(node('h2', 'Общий вывод'), node('pre', report.conclusion || 'Не заполнено'));
      content = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    }
    else {
      // Keep arbitrary Markdown/HTML in submitted text literal in the report.
      const literal = value => { const runs = value.match(/`+/g) || []; const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1))); return `${fence}\n${value || 'Не заполнено'}\n${fence}`; };
      const lines = ['# Отчёт по лабораторной', literal(selected.title), `Версия: ${selected.version} · ID: ${selected.id}`, '## Автор', literal(report.author), '## Группа / курс', literal(report.group), `Выгружено: ${snapshot.exportedAt}`, `Выполнено: ${count.completed}/${count.total}.`];
      experimentsOf(selected).forEach((experiment, index) => {
        const answer = report.answers[experiment.id];
        lines.push(`## Задание ${index + 1}`, literal(experiment.title), `Статус: ${statuses[answerStatus(answer)]}`, '### Условие', literal(describe(experiment.blocks).join('\n\n')), '### Результат / JSON или текст', literal(answer.results), '### Ответ и выводы', literal(answer.conclusion));
      });
      lines.push('## Общий вывод', literal(report.conclusion)); content = lines.join('\n\n') + '\n';
    }
    const url = URL.createObjectURL(new Blob([content], { type: ({ json: 'application/json', html: 'text/html', md: 'text/markdown' })[format] + ';charset=utf-8' }));
    const link = node('a'); link.href = url; link.download = `${selected.id}-report-${snapshot.exportedAt.slice(0, 10)}.${format}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('action-status').textContent = labText('exportReady');
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
  async function start() {
    const errors = [];
    const catalog = await MaterialCatalog.load(CFG_LAB_MANIFEST, 'labs', validateLab);
    errors.push(...catalog.errors);
    catalog.records.forEach(lab => labs.set(lab.id, lab));
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
  const labBar = document.querySelector('.lab-bar');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--lab-bar-height', labBar.offsetHeight + 'px');
  }).observe(labBar);
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
