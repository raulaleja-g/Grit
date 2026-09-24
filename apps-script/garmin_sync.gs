/**
 * Garmin → intervals.icu → Google Sheet (gratis, corre en la nube de Google)
 *
 * Configuración (una sola vez):
 * 1. En la hoja "Garmin Log – Fitness": Extensiones → Apps Script → pega este código.
 * 2. Engranaje "Configuración del proyecto":
 *    - Zona horaria: (GMT+01:00) Berlin
 *    - Propiedades de la secuencia de comandos → añade:
 *        INTERVALS_API_KEY = tu API key (intervals.icu → Settings → Developer Settings)
 *        INTERVALS_ATHLETE_ID = tu ID de atleta (ej. i123456, aparece en la misma pantalla)
 * 3. Ejecuta la función `backfill` una vez (acepta los permisos): trae los últimos 60 días.
 * 4. Ejecuta la función `crearTriggerDiario` una vez: sincroniza cada noche a las 22:00.
 */

const DIAS_SYNC_DIARIO = 7; // re-lee la última semana por si editaste algo (RPE, nombre)

function syncDiario() { sincronizar_(DIAS_SYNC_DIARIO); }
function backfill()   { sincronizar_(60); }

function crearTriggerDiario() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncDiario')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncDiario').timeBased().everyDays(1).atHour(22).create();
}

// ---------------------------------------------------------------------------

const COLS_ACT = ['fecha', 'id', 'tipo', 'nombre', 'duracion_min', 'distancia_km',
  'ritmo_min_km', 'fc_media', 'fc_max', 'carga', 'desnivel_m', 'calorias', 'rpe'];
const COLS_WELL = ['fecha', 'fc_reposo', 'hrv', 'sueno_h', 'sueno_score', 'peso_kg', 'pasos'];

function sincronizar_(dias) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('INTERVALS_API_KEY');
  const athlete = props.getProperty('INTERVALS_ATHLETE_ID') || '0';
  if (!key) throw new Error('Falta INTERVALS_API_KEY en Propiedades de la secuencia de comandos');

  const tz = Session.getScriptTimeZone();
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - dias * 86400000);
  const f = d => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const qs = `oldest=${f(desde)}&newest=${f(hoy)}`;
  const base = `https://intervals.icu/api/v1/athlete/${athlete}`;

  // Actividades
  const acts = llamar_(`${base}/activities?${qs}`, key);
  const filasAct = acts.map(a => {
    const km = a.distance ? a.distance / 1000 : 0;
    const min = (a.moving_time || a.elapsed_time || 0) / 60;
    return [
      (a.start_date_local || '').slice(0, 10),
      String(a.id),
      a.type || '',
      a.name || '',
      redondear_(min, 1),
      km ? redondear_(km, 2) : '',
      km >= 0.5 ? redondear_(min / km, 2) : '',
      a.average_heartrate || '',
      a.max_heartrate || '',
      a.icu_training_load || '',
      a.total_elevation_gain ? Math.round(a.total_elevation_gain) : '',
      a.calories || '',
      a.icu_rpe || a.perceived_exertion || ''
    ];
  });
  upsert_(hoja_('Actividades', COLS_ACT, true), filasAct, 1); // clave: id

  // Wellness (sueño, FC reposo, HRV, peso)
  const well = llamar_(`${base}/wellness?${qs}`, key);
  const filasWell = well.map(w => [
    w.id,
    w.restingHR || '',
    w.hrv || '',
    w.sleepSecs ? redondear_(w.sleepSecs / 3600, 2) : '',
    w.sleepScore || '',
    w.weight || '',
    w.steps || ''
  ]);
  upsert_(hoja_('Wellness', COLS_WELL, false), filasWell, 0); // clave: fecha

  props.setProperty('LAST_SYNC', new Date().toISOString()); // la app Grit muestra esta hora
}

function llamar_(url, key) {
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Basic ' + Utilities.base64Encode('API_KEY:' + key) },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(`intervals.icu respondió ${res.getResponseCode()}: ${res.getContentText().slice(0, 200)}`);
  }
  return JSON.parse(res.getContentText());
}

function hoja_(nombre, cols, usarPrimera) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh && usarPrimera) { sh = ss.getSheets()[0]; sh.setName(nombre); }
  if (!sh) sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.getRange('A:B').setNumberFormat('@'); // fecha e id como texto (evita que Sheets los convierta)
  return sh;
}

// Inserta filas nuevas o actualiza las existentes según la columna clave; ordena por fecha.
function upsert_(sh, filas, colClave) {
  if (!filas.length) return;
  const ancho = filas[0].length;
  const ultima = sh.getLastRow();
  const existentes = ultima > 1 ? sh.getRange(2, 1, ultima - 1, ancho).getValues() : [];
  const mapa = new Map(existentes.map(r => [String(r[colClave]), r]));
  filas.forEach(r => mapa.set(String(r[colClave]), r));
  const todas = [...mapa.values()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (ultima > 1) sh.getRange(2, 1, ultima - 1, ancho).clearContent();
  sh.getRange(2, 1, todas.length, ancho).setValues(todas);
}

function redondear_(n, d) { const p = Math.pow(10, d); return Math.round(n * p) / p; }
