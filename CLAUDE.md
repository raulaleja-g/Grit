# Grit · contexto para Claude Code

Grit es la app personal de entrenamiento y comida de Raúl (y de su novia, que usa la misma app con sus propios datos). Es una PWA estática publicada con GitHub Pages desde la rama `main`. Responde siempre en español neutro.

## Reparto de trabajo
- **Aquí (Claude Code):** solo el código de la app (`index.html`, `sw.js`, `manifest.webmanifest`, íconos) y los scripts de Apps Script (`apps-script/`).
- **Fuera de este repo (Claude en Cowork + tareas programadas de los domingos):** el contenido. Los planes semanales, el menú, el meal prep y la lista de compra son archivos JSON en una carpeta de Google Drive de cada persona. Desde aquí no se editan: si un cambio necesita datos nuevos, diseña el formato, documéntalo abajo y avisa a Raúl para que lo pida en Cowork.

## Arquitectura
- `index.html`: toda la app (HTML + CSS + JS, sin build ni dependencias; fuentes de Google Fonts). Interfaz en español.
- Datos: la app llama a una URL de Apps Script (`/exec`) con una clave. Ambas se guardan solo en el teléfono (`localStorage`, `grit-config`) y **nunca** van al repo.
  - `GET ?k=<clave>` → `{ok, profile, activities, weeks, logs, cycles, lastSync}`.
  - `POST {k, action: "saveLog", log}` guarda una sesión de fuerza · `{action: "saveCycle", cycle, prevStart}` / `{action: "deleteCycle", start}` para el ciclo.
- `apps-script/grit_api.gs` (y la copia `grit_api_nicolle.gs`, que solo cambia el id de carpeta) sirve esa API leyendo la hoja de Google y la carpeta de planes. `apps-script/garmin_sync.gs` trae las actividades de Garmin cada noche. Si cambias un `.gs`, Raúl tiene que pegarlo en el editor de Apps Script y hacer Implementar → Gestionar implementaciones → lápiz → Versión nueva (la URL no cambia). Díselo siempre.
- `sw.js`: caché offline. `index.html` va por red primero; si cambias otros archivos, sube `VERSION` en `sw.js`.

## Modelo de datos (lo que devuelve el GET)
- `activities`: `[{d: "YYYY-MM-DD", id, t: "Run"|"WeightTraining"|…, n, min, km, p (ritmo min/km decimal), hr, hrmax, load, rpe}]`.
- `logs`: `{ "YYYY-MM-DD": {date, week, title, exercises: {<id>: {name, sets: [{kg, reps}]}}, rpe, note, savedAt} }`.
- `cycles`: `[{start, end, note}]` (solo si `profile.features.cycle`).
- `weeks`: `{ "<lunes>": {start, label, targetKm, targetFuerza, notes, general, review?: {summary, changes, at}, nutrition?, days: [7 × {date, type: "fuerza"|"run"|"rest"|"otro", title, short, detail, exercises?: [{id, name, sets, reps, unit? ("s"), rir, load, rest, note?}]}]} }`.
  - Los `id` de ejercicio son estables y en español (`sentadilla`, `remo-t`…): la app los usa para "Última vez". Los `name` de Raúl van en inglés.
- `profile`: `{name, zones: [[min, max, "Z1"], …], races: [{d, label, full}], blockStart, features: {cycle}, cycle?: {length, period, dayOne, phases: {menstrual|folicular|ovulatoria|lutea: {train, food}}}, nutrition}`.
  - `nutrition`: `{goal, kcal, protein, carbs, fat, lutealExtraKcal?, phaseNotes?, meals, week?, prep?, shopping?}`.
  - `meals`: `[{id, type: desayuno|almuerzo|cena|snack, name, kcal, p, c, f, ingredients: [texto] (o texto), steps?: [texto], from?: etiqueta tipo "Meal prep del domingo", why?, phases?}]`.
  - `week` (menú fijo; claves "1" = lunes … "7" = domingo): `[{slot, time, meal: <id>}]` o `{free: true, title, text}` (día libre).
  - `prep` (claves de día): `{title, when, makes: [..], groups: [{name, items: [..]}], steps: [..], storage}`.
  - `shopping`: `{title, items: [{cat, name, qty, price}]}`.
  - `rotation` (alternativa a `week`/`prep`/`shopping` fijos): `{start: <lunes del primer menú>, weeks: [{name: "Menú A", days, prep, shopping}, …]}`. `days` y `prep` usan las mismas claves "1"…"7" que `week`/`prep`. Los menús rotan en orden cada semana; cada menú va de **domingo a sábado**: el domingo ("7", con su meal prep) es el anterior a su lunes, y la lista de compra se muestra el sábado anterior (día libre del menú previo). Si hay `week`, gana `week`.
  - `nutrition.notes` existe en perfiles viejos pero **no se muestra** (Raúl no quiere notas de sección en la app).

## Pantallas
- Barra inferior con 3 pestañas: **Overview**, **Training**, **Comida** (nombres elegidos por Raúl; no los traduzcas).
- Overview (semana elegida con flechas): contadores (km vs objetivo, sesiones de fuerza, corridas en Z2), ciclo (si aplica), notas de la semana + revisión, plan semanal resumido (un toque abre el día en Training), gráfica de km (12 sem / 8 sem / Actual), menú de hoy, actividades de Garmin.
- Training: selector de día; detalle, datos de Garmin y registro de series (kg × reps), RPE y notas en días `fuerza`. Borradores en `localStorage` (`grit-drafts`).
- Comida: selector de día (semana actual). Con `nutrition.week`: menú del día con hora y título; al tocar una comida se abre la receta. Meal prep los días que tengan `prep` (dom y mié), con pasos marcables. Día libre (sábado) + lista de compra de la semana siguiente con casillas. Recetario al final. Sin `week`: macros + ideas de comidas por tipo.

## Preferencias de Raúl para la app
- Todo en español salvo los nombres de las pestañas y de los ejercicios.
- Nada de textos de ayuda o notas de sección ("toca aquí para…", pautas generales). Las notas de la semana sí se muestran.
- Pensada para el móvil (390 px): nada de scroll horizontal, objetivos táctiles ≥ 44 px, modo oscuro automático (tokens CSS en `:root`).
- Cambios pequeños y claros; explica en 2–3 frases qué cambió.

## Probar antes de subir
1. `python dev/preview.py [YYYY-MM-DD] [--ciclo]` → abre la app con datos de prueba (`dev/mock-data.json`, sin datos reales), guarda capturas de las 3 pestañas en `dev/shots/` (ignorado por git) e imprime errores de JS. Mira las capturas.
2. Prueba al menos: un lunes, un miércoles (meal prep), un sábado (lista de compra) y `--ciclo` (perfil sin menú).
3. Nunca pongas datos personales reales (salud, ids de Drive o de la hoja, la URL `/exec` o la clave) en el repo: es público.

## Publicar
Commit en `main` y push: GitHub Pages publica en 1–2 minutos. En el teléfono basta con cerrar y abrir la app (o tocar Actualizar).
