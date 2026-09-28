// Shared file-loading contract for labs, HTTP tools and MCP definitions.
(() => {
  const CFG_MATERIAL_MAX_BYTES = 2000000;
  async function readFile(file) {
    if (file.size > CFG_MATERIAL_MAX_BYTES) throw new Error('JSON: максимум 2 МБ.');
    return JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
  }
  async function fetchJSON(path) {
    const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return readFile(await response.blob());
  }
  async function load(manifestPath, collection, validate) {
    const records = [], errors = [], ids = new Set();
    try {
      const manifest = await fetchJSON(manifestPath);
      if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest[collection]) || manifest[collection].length > 100) throw new Error('Неверный манифест ' + collection);
      const results = await Promise.allSettled(manifest[collection].map(async path => {
        if (typeof path !== 'string' || path.length > 200 || !/^[a-z0-9][a-z0-9-]*\.json$/.test(path)) throw new Error('Нужно имя локального JSON-файла рядом с манифестом.');
        return validate(await fetchJSON(new URL(path, new URL(manifestPath, location.href))));
      }));
      results.forEach((result, index) => {
        if (result.status === 'rejected') errors.push(manifest[collection][index] + ': ' + result.reason.message);
        else if (ids.has(result.value.id)) errors.push('Повторяющийся id: ' + result.value.id);
        else { ids.add(result.value.id); records.push(result.value); }
      });
    } catch (error) { errors.push(manifestPath + ': ' + error.message); }
    return { records, errors };
  }
  window.MaterialCatalog = { load, readFile };
})();
