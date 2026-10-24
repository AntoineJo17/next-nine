#!/usr/bin/env python3
"""NEXT NINE - protocole de mesure de performance (Chromium, Playwright).

Mesure, phase par phase, le temps de frame (rAF), la duree JS des callbacks rAF du jeu,
les appels de dessin / triangles WebGL (compteurs injectes sur le contexte, game.js
n'expose pas renderer.info) et la memoire JS (performance.memory, Chromium).

Usage : voir docs/PERF.md. Exemple :
  PY="/Users/AJ/Downloads/NEXT NINE - Agents de test/.venv/bin/python"
  python3 -m http.server 8773 --directory dist &
  "$PY" scripts/perf/measure.py --phases all --pages 1 --backend default --out /tmp/r.json
"""
import argparse, asyncio, json, subprocess, sys
from playwright.async_api import async_playwright

READY_MS = 180000
BACKENDS = {
    "default": [],
    "metal": ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
    "swiftshader": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    # sans plafond vsync : montre le cout reel de rendu (la marge au-dela de 60 Hz) ; non representatif d'un telephone
    "metal-uncapped": ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync"],
}

INIT_JS = r"""
(() => {
  const P = window.__perf = { on:false, frames:[], cb:[], drawCalls:0, tris:0, perFrameDraw:[], perFrameTris:[], mem:[], cbAcc:0, vis:[] };
  const TRI = {4:(n)=>n/3, 5:(n)=>Math.max(0,n-2), 6:(n)=>Math.max(0,n-2)};
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const pr = C.prototype;
    const wrap = (name, countIdx, instIdx) => {
      const o = pr[name]; if (!o) return;
      pr[name] = function(...a){
        if (P.on) { P.drawCalls++; const f = TRI[a[0]]; if (f) P.tris += f(a[countIdx]) * (instIdx!=null ? (a[instIdx]||1) : 1); }
        return o.apply(this, a);
      };
    };
    wrap('drawElements',1); wrap('drawArrays',2);
    wrap('drawElementsInstanced',1,4); wrap('drawArraysInstanced',2,4);
    wrap('drawRangeElements',3);
  }
  // callbacks rAF du jeu : duree JS (inclut la soumission GL, pas le travail GPU/raster)
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const s = performance.now(); try { cb(t); } finally { if (P.on) P.cbAcc += performance.now() - s; }
  });
  P.start = () => {
    P.frames = []; P.cb = []; P.perFrameDraw = []; P.perFrameTris = []; P.mem = []; P.vis = [];
    P.drawCalls = 0; P.tris = 0; P.cbAcc = 0; P.on = true;
    let last = null;
    const tick = (t) => {
      if (!P.on) return;
      if (last !== null) {
        P.frames.push(t - last); P.cb.push(P.cbAcc); P.perFrameDraw.push(P.drawCalls); P.perFrameTris.push(P.tris);
        const tp = document.getElementById('tacticalPitch');
        P.vis.push(tp && !tp.hidden ? 1 : 0);
      }
      last = t; P.cbAcc = 0; P.drawCalls = 0; P.tris = 0;
      if (performance.memory && P.frames.length % 30 === 0) P.mem.push(performance.memory.usedJSHeapSize);
      raf(tick);
    };
    raf(tick);
  };
  P.stop = () => { P.on = false; return { frames:P.frames, cb:P.cb, draw:P.perFrameDraw, tris:P.perFrameTris, mem:P.mem, vis:P.vis }; };
})();
"""

GL_INFO_JS = """() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl');
 if (!gl) return {error:'no webgl'}; const e = gl.getExtension('WEBGL_debug_renderer_info');
 return {version: gl.getParameter(gl.VERSION), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL):null}; }"""


def pct(a, p):
    if not a: return None
    s = sorted(a); k = (len(s) - 1) * p / 100; f = int(k); c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)


def summarize(raw, only_tactical=False):
    if only_tactical:  # ne garde que les frames ou le terrain tactique 2D est affiche
        keep = [i for i, v in enumerate(raw["vis"]) if v]
        raw = dict(raw, **{k: [raw[k][i] for i in keep] for k in ("frames", "cb", "draw", "tris", "vis")})
    fr, cb, dr, tr, mem, vis = (raw[k] for k in ("frames", "cb", "draw", "tris", "mem", "vis"))
    if not fr: return {"frames": 0}
    r = lambda x: None if x is None else round(x, 2)
    out = {"frames": len(fr), "duration_s": r(sum(fr) / 1000),
           "frame_ms": {"p50": r(pct(fr, 50)), "p95": r(pct(fr, 95)), "p99": r(pct(fr, 99)), "max": r(max(fr))},
           "fps_mean": r(1000 * len(fr) / sum(fr)),
           "js_cb_ms": {"p50": r(pct(cb, 50)), "p95": r(pct(cb, 95)), "max": r(max(cb))},
           "draw_calls": {"p50": r(pct(dr, 50)), "max": max(dr)},
           "triangles": {"p50": r(pct(tr, 50)), "max": r(max(tr))},
           "frames_over_50ms": sum(1 for x in fr if x > 50),
           "tactical_visible_ratio": r(sum(vis) / len(vis))}
    if mem: out["js_heap_mb"] = {"first": r(mem[0] / 1048576), "last": r(mem[-1] / 1048576)}
    return out


async def setup_page(ctx, base, phase, viewport):
    page = await ctx.new_page()
    page.set_default_timeout(180000)  # sous SwiftShader x3 une seule frame 3D peut depasser 30 s
    await page.set_viewport_size(viewport)
    await page.add_init_script(INIT_JS)
    errs = []; pend = set()
    page.on("request", lambda r: pend.add(r.url)); page.on("requestfinished", lambda r: pend.discard(r.url)); page.on("requestfailed", lambda r: pend.discard(r.url))
    page.on("pageerror", lambda e: errs.append((str(e) + " | " + str(getattr(e, "stack", "")))[:400]))
    url = base + "/index.html" + ("?debug=1" if phase == "locker" else "")
    import time; t0 = time.time()
    await page.goto(url)
    try:
        await page.wait_for_function("() => !document.getElementById('play').disabled", timeout=READY_MS)
    except Exception:
        st = await page.evaluate("() => document.getElementById('engineStatus').textContent")
        raise RuntimeError("moteur 3D non pret apres le delai : engineStatus=%r erreurs=%r requetes_en_attente=%r" % (st, errs[:2], sorted(u.split("/")[-1] for u in pend)[:8]))
    info = {"setup_notes": [], "engine_ready_s": round(time.time() - t0, 2)}
    if phase == "locker":
        await page.click("#openLocker")
        await page.wait_for_function("() => !!globalThis.__locker && globalThis.__locker.running", timeout=READY_MS)
    elif phase == "match3d":
        await page.click("#practice")
        await page.wait_for_timeout(500)
        if await page.evaluate("() => !document.getElementById('gestureGuide').hidden"):
            await page.click("#guideClose")
        await page.wait_for_timeout(500)
        mates = await page.query_selector_all(".offscreen-mate")
        if mates:
            await mates[0].dispatch_event("pointerdown"); info["setup_notes"].append("passe declenchee via .offscreen-mate")
        else:
            info["setup_notes"].append("phase 'ready' statique (aucune action declenchee)")
    elif phase == "match3d-action":
        await page.click("#practice")
        await page.wait_for_timeout(500)
        if await page.evaluate("() => !document.getElementById('gestureGuide').hidden"):
            await page.click("#guideClose")
        info["setup_notes"].append("pilote : tir/replay/continuer en boucle pendant la mesure")
    elif phase == "tactical2d":
        await page.click("#play")
        await page.wait_for_function("() => !document.getElementById('tacticalPitch').hidden", timeout=30000)
    elif phase != "home":
        raise SystemExit("phase inconnue " + phase)
    return page, errs, info


async def drive_action(page, stop, counters, replays=True):
    """Boucle de pilotage : provoque du mouvement 3D reel (tir par glisser, replay, scenario suivant)."""
    vp = page.viewport_size
    while not stop.is_set():
        try:
            def vis(i): return page.evaluate("(i)=>{const e=document.getElementById(i);return !!e&&!e.hidden}", i)
            if await page.evaluate("() => !document.getElementById('tacticalPitch').hidden"):
                pass  # simulation 2D en cours : on ne touche a rien
            elif replays and await vis("replayBtn"):
                await page.click("#replayBtn"); counters["replays"] += 1; await asyncio.sleep(4)
            elif await vis("continue"):
                await page.click("#continue"); counters["continues"] += 1
            else:
                x, y = vp["width"] / 2, vp["height"] * 0.47
                await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 100, steps=5); await page.mouse.up()
                counters["gestures"] += 1
        except Exception:
            pass
        await asyncio.sleep(0.7)


async def run_phase(browser, base, phase, npages, warmup, duration, viewport):
    ctxs = [await browser.new_context() for _ in range(npages)]  # un contexte par page = stockage isole
    setups = await asyncio.gather(*[setup_page(c, base, phase, viewport) for c in ctxs])
    stop = asyncio.Event(); counters = {"gestures": 0, "replays": 0, "continues": 0}
    # tactical2d : la simulation 2D s'arrete a chaque occasion (action 3D) ; le pilote enchaine les occasions et on
    # n'agrege que les frames ou le terrain tactique est affiche, sur une fenetre 4x plus longue.
    drivers = [asyncio.create_task(drive_action(p, stop, counters, replays=(phase == "match3d-action"))) for p, _, _ in setups] if phase in ("match3d-action", "tactical2d") else []
    await asyncio.sleep(warmup)  # le pilote tourne deja pendant l'echauffement
    await asyncio.gather(*[p.evaluate("() => window.__perf.start()") for p, _, _ in setups])
    await asyncio.sleep(duration * 4 if phase == "tactical2d" else duration)
    stop.set(); await asyncio.gather(*drivers)
    raws = await asyncio.gather(*[p.evaluate("() => window.__perf.stop()") for p, _, _ in setups])
    res = []
    for (p, errs, info), raw in zip(setups, raws):
        s = summarize(raw, only_tactical=(phase == "tactical2d")); s["page_errors"] = errs[:3]; s.update(info)
        if drivers: s["driver"] = dict(counters)
        res.append(s)
    for c in ctxs: await c.close()
    return res


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8773")
    ap.add_argument("--phases", default="all", help="home,locker,match3d,match3d-action,tactical2d ou all")
    ap.add_argument("--pages", type=int, default=1)
    ap.add_argument("--backend", choices=list(BACKENDS), default="default")
    ap.add_argument("--warmup", type=float, default=3)
    ap.add_argument("--duration", type=float, default=10)
    ap.add_argument("--viewport", default="390x844", help="LxH (defaut : taille de telephone)")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--out", default=None)
    ap.add_argument("--ready-timeout", type=float, default=180, help="delai (s) d attente du moteur 3D par page")
    a = ap.parse_args()
    global READY_MS; READY_MS = int(a.ready_timeout * 1000)
    phases = ["home", "locker", "match3d", "match3d-action", "tactical2d"] if a.phases == "all" else a.phases.split(",")
    w, h = map(int, a.viewport.split("x"))
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=not a.headed, args=BACKENDS[a.backend])
        probe = await browser.new_page()
        glinfo = await probe.evaluate(GL_INFO_JS); await probe.close()
        meta = {"machine": subprocess.run("sysctl -n machdep.cpu.brand_string; sysctl -n hw.memsize; uname -srm", shell=True, capture_output=True, text=True).stdout.split("\n"),
                "chromium": browser.version, "backend_arg": a.backend, "chromium_args": BACKENDS[a.backend], "webgl": glinfo,
                "pages": a.pages, "warmup_s": a.warmup, "duration_s": a.duration, "viewport": a.viewport, "python": sys.version.split()[0]}
        print(json.dumps(meta, ensure_ascii=False))
        results = {}
        for ph in phases:
            try:
                results[ph] = await run_phase(browser, a.base, ph, a.pages, a.warmup, a.duration, {"width": w, "height": h})
            except Exception as e:
                results[ph] = [{"error": repr(e)[:300]}]
            for i, r in enumerate(results[ph]):
                print(ph, "page", i, json.dumps(r, ensure_ascii=False))
        await browser.close()
    if a.out:
        import os; os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        json.dump({"meta": meta, "results": results}, open(a.out, "w"), ensure_ascii=False, indent=1)

asyncio.run(main())
