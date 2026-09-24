/**
 * Grit – API para la app (va en el MISMO proyecto de Apps Script que garmin_sync.gs)
 *
 * Qué hace:
 *   GET  → devuelve actividades (pestaña Actividades), planes semanales (carpeta
 *          "Grit – Planes" en Drive), registros de fuerza (pestaña Logs) y la hora
 *          de la última sincronización.
 *   POST → guarda o reemplaza el registro de fuerza de un día en la pestaña Logs.
 *
 * Configuración (una sola vez):
 *   1. Pega este archivo como un archivo nuevo del proyecto (+ → Secuencia de comandos → "grit_api").
 *   2. Ejecuta `crearClave` y copia la clave que aparece en el registro de ejecución.
 *   3. Implementar → Nueva implementación → tipo "Aplicación web":
 *        Ejecutar como: Yo · Quién tiene acceso: Cualquier persona
 *      Copia la URL que termina en /exec.
 *   4. Si cambias este código después: Implementar → Gestionar implementaciones →
 *      editar (lápiz) → Versión: "Nueva versión". Así la URL no cambia.
 */

const PLANES_FOLDER_ID = '1lvgxCH0lR3-Hk4UPEVFOusNBXkuiXkYi'; // carpeta "Grit – Planes"
const COLS_LOGS = ['fecha', 'semana', 'datos_json', 'guardado'];

function crearClave() {
  const clave = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('GRIT_TOKEN', clave);
  Logger.log('Tu clave de Grit: ' + clave);
}

// ---------------------------------------------------------------------------

function doGet(e) {
  if (!claveValida_(e.parameter.k)) return json_({ ok: false, error: 'clave' });
  return json_({
    ok: true,
    activities: actividades_(),
    weeks: semanas_(),
    logs: logs_(),
    lastSync: PropertiesService.getScriptProperties().getProperty('LAST_SYNC')
  });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'json' }); }
  if (!claveValida_(body.k)) return json_({ ok: false, error: 'clave' });
  if (body.action !== 'saveLog' || !body.log || !/^\d{4}-\d{2}-\d{2}$/.test(body.log.date || '')) {
    return json_({ ok: false, error: 'datos' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const log = body.log;
    log.savedAt = new Date().toISOString();
    const sh = hojaLogs_();
    const ultima = sh.getLastRow();
    const fechas = ultima > 1 ? sh.getRange(2, 1, ultima - 1, 1).getValues().map(r => texto_(r[0])) : [];
    const fila = [log.date, log.week || '', JSON.stringify(log), log.savedAt];
    const i = fechas.indexOf(log.date);
    if (i >= 0) sh.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
    else sh.appendRow(fila);
    return json_({ ok: true, log: log });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------

function actividades_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Actividades');
  if (!sh || sh.getLastRow() < 2) return [];
  const filas = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getValues();
  const num = (v, d) => (v === '' || v === null || isNaN(Number(v))) ? undefined : redondear_(Number(v), d);
  return filas
    .filter(r => r[0] && r[2] !== 'Transition')
    .map(r => limpiar_({
      d: texto_(r[0]), id: String(r[1]), t: r[2], n: r[3],
      min: num(r[4], 1), km: num(r[5], 2), p: num(r[6], 2),
      hr: num(r[7], 0), hrmax: num(r[8], 0), load: num(r[9], 0), rpe: num(r[12], 0)
    }));
}

// Lee week_YYYY-MM-DD.json y review_YYYY-MM-DD.json de la carpeta de planes.
// Si hay varios con el mismo nombre, gana el modificado más recientemente.
function semanas_() {
  const archivos = {};
  const it = DriveApp.getFolderById(PLANES_FOLDER_ID).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    const m = f.getName().match(/^(week|review)_(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    const prev = archivos[f.getName()];
    if (!prev || f.getLastUpdated() > prev.getLastUpdated()) archivos[f.getName()] = f;
  }
  const semanas = {};
  Object.keys(archivos).sort().forEach(nombre => {
    const [, tipo, fecha] = nombre.match(/^(week|review)_(.+)\.json$/);
    let data;
    try { data = JSON.parse(archivos[nombre].getBlob().getDataAsString('UTF-8')); } catch (err) { return; }
    if (tipo === 'week') semanas[fecha] = Object.assign(semanas[fecha] || {}, data, { start: fecha });
    else semanas[fecha] = Object.assign(semanas[fecha] || { start: fecha }, { review: data });
  });
  return semanas;
}

function logs_() {
  const sh = hojaLogs_();
  if (sh.getLastRow() < 2) return {};
  const out = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
    try { const v = JSON.parse(r[2]); out[texto_(r[0])] = v; } catch (err) {}
  });
  return out;
}

function hojaLogs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Logs');
  if (!sh) {
    sh = ss.insertSheet('Logs');
    sh.getRange(1, 1, 1, COLS_LOGS.length).setValues([COLS_LOGS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@');
  }
  return sh;
}

// ---------------------------------------------------------------------------

function claveValida_(k) {
  const clave = PropertiesService.getScriptProperties().getProperty('GRIT_TOKEN');
  return !!clave && k === clave;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function texto_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

function limpiar_(o) {
  Object.keys(o).forEach(k => { if (o[k] === undefined || o[k] === '') delete o[k]; });
  return o;
}
