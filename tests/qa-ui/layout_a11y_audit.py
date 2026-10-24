"""Audit mise en page / accessibilite / cibles tactiles a 390 et 360 px (Chromium).
Usage: python layout_a11y_audit.py   (serveur sur 8772)"""
import json, pathlib
from playwright.sync_api import sync_playwright
URL = "http://127.0.0.1:8772/index.html"
OUT = pathlib.Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)

JS_OVER = """()=>{const W=document.documentElement.clientWidth;const bad=[];
 for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;
  const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')continue;
  if(e.closest('[hidden],.sr-only,.locker-hidden'))continue;
  if(r.right>W+1||r.left<-1)bad.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+(e.className||'').toString().split(' ')[0])+' '+Math.round(r.left)+'..'+Math.round(r.right));}
 return {scrollW:document.documentElement.scrollWidth,W,bodyScrollW:document.body.scrollWidth,bad:bad.slice(0,8)}}"""

JS_TARGETS = """()=>{const out=[];const sel='button,a[href],input,select,summary,label,[role=button],[role=tab]';
 for(const e of document.querySelectorAll(sel)){if(e.closest('[hidden],.sr-only,.locker-hidden'))continue;
  const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;
  let r=e.getBoundingClientRect();
  if(e.tagName==='INPUT'&&e.labels&&e.labels[0])r=e.labels[0].getBoundingClientRect();
  if(e.tagName==='LABEL'&&e.querySelector('input,select'))continue;
  if(!r.width)continue;
  if(r.height<44||r.width<44)out.push((e.id?'#'+e.id:e.tagName.toLowerCase())+' "'+(e.innerText||e.getAttribute('aria-label')||e.type||'').trim().slice(0,28)+'" '+Math.round(r.width)+'x'+Math.round(r.height));}
 return out}"""

JS_A11Y = """()=>{const out=[];for(const e of document.querySelectorAll('input,select,textarea,button,canvas')){
 if(e.closest('[hidden]')&&!e.closest('.locker-hidden'))continue;
 if(e.tagName==='CANVAS'){if(!e.getAttribute('aria-label')&&!e.getAttribute('role')&&!e.getAttribute('aria-hidden'))out.push('canvas#'+e.id+' sans role/aria');continue}
 const name=(e.labels&&e.labels.length)||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||(e.tagName==='BUTTON'&&e.innerText.trim());
 if(!name)out.push(e.tagName.toLowerCase()+'#'+e.id+' sans nom accessible');}
 const dup={};document.querySelectorAll('[id]').forEach(e=>dup[e.id]=(dup[e.id]||0)+1);
 for(const k in dup)if(dup[k]>1)out.push('id duplique '+k);
 return out}"""

def audit(page, tag):
    r = {"over": page.evaluate(JS_OVER), "small": page.evaluate(JS_TARGETS)}
    page.screenshot(path=str(OUT / f"{tag}.png"), full_page=True)
    return r

res = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    for w in (390, 360):
        c = b.new_context(viewport={"width": w, "height": 800}, has_touch=True, is_mobile=True)
        p = c.new_page(); p.goto(URL)
        p.wait_for_function("!document.querySelector('#play').disabled", timeout=90000)
        res[f"{w}/accueil"] = audit(p, f"{w}_accueil")
        p.click("details.home-settings summary")
        res[f"{w}/profil_options"] = audit(p, f"{w}_profil")
        p.click("#openLocker"); p.wait_for_selector("#locker:not([hidden])", timeout=120000); p.wait_for_timeout(1500)
        for t in ("coupe", "cheveux", "teint", "barbe", "visage", "maillot"):
            p.click(f'.locker-tabs [data-tab="{t}"]'); p.wait_for_timeout(300)
            res[f"{w}/vestiaire_{t}"] = audit(p, f"{w}_vest_{t}")
            if w == 390: res[f"{w}/vestiaire_{t}"]["a11y"] = p.evaluate(JS_A11Y)
        if w == 390:
            res["a11y_global"] = p.evaluate(JS_A11Y)
            res["dialog"] = p.evaluate("()=>{const l=document.querySelector('#locker');return {role:l.getAttribute('role'),modal:l.getAttribute('aria-modal'),label:l.getAttribute('aria-label'),tabsRole:document.querySelector('.locker-tabs').getAttribute('role'),tabAria:[...document.querySelectorAll('.locker-tabs button')].map(b=>b.getAttribute('role')+':'+b.getAttribute('aria-selected')),panelRole:document.querySelector('#lockerPanel').getAttribute('role')}}")
        c.close()
    b.close()
s = json.dumps(res, ensure_ascii=False, indent=1); print(s)
(OUT / "layout_a11y.json").write_text(s)
