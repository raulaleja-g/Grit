"""
Vista previa de Grit sin tocar datos reales.

Abre index.html en Chromium (Playwright), responde a la API de Apps Script con datos
de prueba (dev/mock-data.json + actividades inventadas) y guarda capturas de las
3 pestañas en dev/shots/. También imprime los errores de JavaScript.

Uso:
  pip install playwright && playwright install chromium   (si no está instalado)
  python dev/preview.py                 # hoy
  python dev/preview.py 2026-10-03      # simula esa fecha (sábado: día libre + lista de compra)
  python dev/preview.py 2026-09-30 --ciclo   # perfil sin menú y con ciclo (como el de Nicolle)
"""
import datetime, json, pathlib, random, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dev" / "shots"
API = "https://script.google.com/macros/s/TEST/exec"

args = [a for a in sys.argv[1:] if not a.startswith("--")]
date = args[0] if args else datetime.date.today().isoformat()
ciclo = "--ciclo" in sys.argv

mock = json.loads((ROOT / "dev" / "mock-data.json").read_text(encoding="utf-8"))
profile, week = mock["profile"], mock["week"]

# Mueve la semana de prueba a la semana de la fecha simulada
d = datetime.date.fromisoformat(date)
mon = d - datetime.timedelta(days=d.weekday())
week = json.loads(json.dumps(week))
week["start"] = mon.isoformat()
for i, day in enumerate(week["days"]):
    day["date"] = (mon + datetime.timedelta(days=i)).isoformat()

if ciclo:  # perfil tipo Nicolle: sin menú semanal y con ciclo activado
    n = profile["nutrition"]
    profile = {**profile, "name": "Demo ciclo", "features": {"cycle": True},
               "cycle": {"length": 28, "period": 5, "dayOne": "Texto de prueba para el día 1.",
                         "phases": {p: {"train": "Consejo de entreno de prueba.", "food": "Consejo de comida de prueba."}
                                    for p in ("menstrual", "folicular", "ovulatoria", "lutea")}},
               "nutrition": {"goal": "Objetivo de prueba", "kcal": 1750, "protein": 115, "carbs": 180, "fat": 60,
                             "lutealExtraKcal": 150, "meals": n["meals"][:8]}}

random.seed(1)
acts = []
for w in range(12):
    for k, km in ((1, 6 + w * 0.5), (5, 10 + w)):
        day = mon - datetime.timedelta(days=7 * (12 - w)) + datetime.timedelta(days=k)
        acts.append(dict(d=day.isoformat(), id=str(len(acts)), t="Run", min=km * 6.6, km=km, p=6.6,
                         hr=random.choice([150, 155, 162])))
data = dict(ok=True, profile=profile, activities=acts, weeks={mon.isoformat(): week}, logs={},
            cycles=[{"start": (d - datetime.timedelta(days=10)).isoformat(), "end": (d - datetime.timedelta(days=6)).isoformat()}] if ciclo else [],
            lastSync=datetime.datetime.now().isoformat())

def handle(route):
    if route.request.method == "POST":
        body = json.loads(route.request.post_data or "{}")
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "log": body.get("log"), "cycles": data["cycles"]}))
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps(data))

OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.clock.install(time=datetime.datetime.fromisoformat(date + "T08:00:00"))
    pg.route(API + "**", handle)
    pg.goto((ROOT / "index.html").as_uri() + "#api=" + API + "&k=test")
    pg.wait_for_timeout(800)
    tag = "ciclo" if ciclo else "menu"
    for t in ("overview", "training", "food"):
        pg.click(f'.tab[data-tab="{t}"]')
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / f"{date}-{tag}-{t}.png"), full_page=True)
    b.close()
print("Capturas en", OUT)
print("Errores JS:", errs or "ninguno")
