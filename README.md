# Grit

Diario de entrenamiento de Raúl como app (PWA): plan semanal, registro de pesos, km por semana y actividades de Garmin.

- **App:** estos archivos, publicados con GitHub Pages.
- **Datos:** Google Sheet "Garmin Log – Fitness" (pestañas `Actividades` y `Logs`) + carpeta de Drive "Grit – Planes" (`week_YYYY-MM-DD.json`, `review_YYYY-MM-DD.json`).
- **Puente:** `apps-script/grit_api.gs`, publicado como aplicación web en el proyecto de Apps Script de la hoja.

## Puesta en marcha

### 1. Apps Script (en la hoja)
1. Abre la hoja → Extensiones → Apps Script.
2. Reemplaza el contenido de tu archivo actual con `apps-script/garmin_sync.gs` (solo añade una línea que guarda la hora de sincronización).
3. Crea un archivo nuevo (+ → Secuencia de comandos) llamado `grit_api` y pega `apps-script/grit_api.gs`. Guarda.
4. En el selector de funciones elige `crearClave` → Ejecutar → acepta los permisos (ahora pide también Drive). Copia la clave que sale en el registro.
5. Implementar → Nueva implementación → engranaje → **Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**. Implementar y copia la URL que termina en `/exec`.

### 2. GitHub Pages
1. En GitHub: New repository → nombre `grit` → Public → Create.
2. "uploading an existing file" → arrastra todo el contenido de esta carpeta (index.html, manifest.webmanifest, sw.js, icons/, apps-script/, README.md) → Commit.
3. Settings → Pages → Source: "Deploy from a branch" → Branch `main` / `(root)` → Save.
4. En 1–2 minutos la app queda en `https://<tu-usuario>.github.io/grit/`.

### 3. En el teléfono
1. Abre la URL en Safari (iPhone) o Chrome (Android).
2. Pega la URL `/exec` y la clave → Conectar.
3. Compartir → "Añadir a pantalla de inicio" (iPhone) · menú ⋮ → "Instalar app" (Android).

## Cambios futuros
- **App:** sube el archivo cambiado a GitHub. Si cambias algo además de `index.html`, sube también `VERSION` en `sw.js`.
- **grit_api.gs:** Implementar → Gestionar implementaciones → lápiz → Versión "Nueva versión" (la URL no cambia).

La clave no está en el repositorio: solo se guarda en cada teléfono. Si la cambias (ejecutando `crearClave` otra vez), toca "Cambiar conexión" al final de la app.
