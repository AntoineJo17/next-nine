#!/usr/bin/env python3
"""Profil CPU (CDP Profiler) de la phase 3D 'match3d' : temps propre par fonction et par fichier.

Complete measure.py : indique OU part le temps JS d'une frame (Three.js render vs code du jeu).
  profile.py [--backend metal-uncapped] [--seconds 8]
"""
import argparse, asyncio, collections, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.async_api import async_playwright

BACKENDS = {"default": [], "metal": ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
            "metal-uncapped": ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync"]}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8773")
    ap.add_argument("--backend", default="metal-uncapped", choices=list(BACKENDS))
    ap.add_argument("--seconds", type=float, default=8)
    ap.add_argument("--top", type=int, default=15)
    a = ap.parse_args()
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=BACKENDS[a.backend])
        page = await b.new_page(viewport={"width": 390, "height": 844})
        await page.goto(a.base + "/index.html")
        await page.wait_for_function("() => !document.getElementById('play').disabled", timeout=60000)
        await page.click("#practice"); await page.wait_for_timeout(3500)
        cdp = await page.context.new_cdp_session(page)
        await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {"interval": 200})
        await cdp.send("Profiler.start"); await asyncio.sleep(a.seconds)
        prof = (await cdp.send("Profiler.stop"))["profile"]
        await b.close()
    nodes = {n["id"]: n for n in prof["nodes"]}
    self_us = collections.Counter(); total = 0
    dts = prof["timeDeltas"]
    for sid, dt in zip(prof["samples"], dts):
        self_us[sid] += dt; total += dt
    by_fn, by_file = collections.Counter(), collections.Counter()
    for sid, us in self_us.items():
        cf = nodes[sid]["callFrame"]
        fn = cf["functionName"] or "(anonyme)"
        f = cf["url"].split("/")[-1].split("?")[0] or "(natif)"
        by_fn[f"{fn} [{f}:{cf['lineNumber']+1}]"] += us; by_file[f] += us
    idle = by_fn.get("(idle) [(natif):1]", 0)
    busy = total - idle
    print(f"echantillonnage {total/1e6:.2f}s, actif (hors idle) {busy/1e6:.2f}s = {100*busy/total:.1f}% du temps")
    print("-- par fichier (part du temps actif)")
    for f, us in by_file.most_common(8):
        if f != "(natif)" or True: print(f"  {f:28s} {100*us/busy:5.1f}%")
    print("-- top fonctions (temps propre, part du temps actif)")
    for k, us in by_fn.most_common(a.top):
        print(f"  {100*us/busy:5.1f}%  {k}")

asyncio.run(main())
