import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as T from '../dist/vendor/three.module.js';
import {applyFace,FACE_SLIDERS,MH_LIP_BACK,commissure,landmarks,mouthLine,buildMHHead,morphWeights,mhHair,mhBeard,mhCurls,hairShell,cavity,smoothField,MH_SHAPES,mhShapeParams,MH_NEUTRAL_MODS,MH_HAIR} from '../dist/mh.js';
const D=JSON.parse(fs.readFileSync(new URL('../dist/mh/head.json',import.meta.url),'utf8'));
const bbox=g=>{g.computeBoundingBox();return g.boundingBox;};

test('Lot 8 · the data file holds a head, its eyes and the targets we use',()=>{assert.ok(D.pos.length/3>4000&&D.idx.length/3>8000,'head mesh');assert.ok(D.eyes.fit.length>1000&&D.ref.length>30,'eyes are fitted from reference vertices');
 for(const k of ['african-male-young','asian-female-young','caucasian-male-young','head-square','mouth-upperlip-volume-incr','chin-width-incr','l-cheek-bones-incr','nose-flaring-incr'])assert.ok(D.targets[k],'target '+k);
 assert.ok(D.lipU.length>50&&D.lipL.length>50);});

test('Lot 8 · a face is human-sized, centred on the eye line and looks towards -z',()=>{const {head,eyes}=buildMHHead(D,mhShapeParams(0)),b=bbox(head),e=bbox(eyes);
 assert.ok(b.max.y-b.min.y>.22&&b.max.y-b.min.y<.34,'height with neck '+(b.max.y-b.min.y).toFixed(3));assert.ok(b.max.x-b.min.x>.14&&b.max.x-b.min.x<.19,'width '+(b.max.x-b.min.x).toFixed(3));
 const c=new T.Vector3();e.getCenter(c);assert.ok(Math.abs(c.y)<.004&&Math.abs(c.x)<.004,'eyes sit on the origin');
 const nose=head.attributes.position;let zmin=1e9,zmax=-1e9;for(let i=0;i<nose.count;i++){zmin=Math.min(zmin,nose.getZ(i));zmax=Math.max(zmax,nose.getZ(i));}assert.ok(zmin<-.08&&zmax>.08&&-zmin<zmax,'front is -z, back of the skull behind');
 for(const a of [head.attributes.position,eyes.attributes.position])for(let i=0;i<a.array.length;i++)assert.ok(Number.isFinite(a.array[i]));});

test('Lot 8 · the six face shapes are different faces and none breaks the mesh',()=>{const geos=MH_SHAPES.map((_,i)=>buildMHHead(D,mhShapeParams(i)).head);
 for(let i=0;i<geos.length;i++)for(let j=i+1;j<geos.length;j++){let d=0;const a=geos[i].attributes.position,b=geos[j].attributes.position;for(let k=0;k<a.count;k++)d=Math.max(d,Math.hypot(a.getX(k)-b.getX(k),a.getY(k)-b.getY(k),a.getZ(k)-b.getZ(k)));assert.ok(d>.004,`shape ${i} and ${j} differ by ${(d*1000).toFixed(1)} mm`);}
 for(const g of geos){const bb=bbox(g);assert.ok(bb.max.x-bb.min.x<.2&&bb.max.y-bb.min.y<.36);}
 assert.equal(mhShapeParams(7).race.join(),mhShapeParams(1).race.join(),'shape index wraps');for(let i=0;i<6;i++){const r=mhShapeParams(i).race;assert.ok(r[2]>.55&&Math.abs(r[0]+r[1]+r[2]-1)<1e-9,'a European-leaning blend under every shape');}});

test('Lot 8 · mouth presets close the lips and keep every target name valid',()=>{for(const k of Object.keys(MH_NEUTRAL_MODS))assert.ok(k.endsWith('!')&&D.targets[k.slice(0,-1)],'neutral '+k);
 for(const sh of MH_SHAPES)for(const k of Object.keys(sh.mods)){const n=k.endsWith('!')?k.slice(0,-1):null;assert.ok(n&&D.targets[n],'shape target '+k);}
 const w=morphWeights({race:[1,0,0],gender:1,mods:{'a-b!':.4}});assert.equal(w['african-male-young'],1);assert.equal(w['a-b'],.4);});

test('Lot 8 · one cut for all styles: bare lower down, full on top, a graded fade, a shaved head is only a shadow',()=>{
 for(const st of Object.keys(MH_HAIR)){const top=mhHair(st,0,.1,0),low=mhHair(st,.07,-.02,.0),front=mhHair(st,0,.02,-.07);assert.ok(top.d>.45,st+' covers the crown');assert.ok(low.d<.2,st+' sides are bare under the ears');assert.ok(front.d<.05,st+' no hair on the forehead');}
 assert.ok(mhHair('rase',0,.1,0).d<=.5&&mhHair('rase',0,.1,0).t<.001,'a shaved head');
 const a=mhHair('degrade',.068,.05,0).d,b=mhHair('degrade',.068,.065,0).d,c=mhHair('degrade',.068,.08,0).d;assert.ok(a<b&&b<c,'the fade is graded');assert.ok(mhHair('court',.068,.04,0).d>mhHair('degrade',.068,.04,0).d+.4,'the crop starts lower than the fade');assert.ok(mhHair('degrade',0,.1,0).t>.01&&mhHair('court',0,.1,0).t<.008,'fade keeps length on top, crop is short everywhere');});

test('Lot 8 · beards fade out, leave the lips and stay below the nose',()=>{const lm={ym:-.068,yn:-.047,yc:-.108};
 for(const kind of ['bouc','barbe3j','barbe']){let worst=0;for(let y=-.13;y<-.01;y+=.0015)for(let x=0;x<.07;x+=.0015){const d=mhBeard(kind,x,y,-.07,lm);worst=Math.max(worst,Math.abs(d-mhBeard(kind,x+.0015,y,-.07,lm)),Math.abs(d-mhBeard(kind,x,y+.0015,-.07,lm)));}assert.ok(worst<.5,kind+' edge step '+worst.toFixed(2));
  assert.equal(mhBeard(kind,0,.03,-.07,lm),0,'nothing on the forehead');assert.equal(mhBeard(kind,0,-.068,.06,lm),0,'nothing behind the jaw');}
 assert.ok(mhBeard('bouc',0,-.1,-.06,lm)>.5,'chin patch');assert.ok(mhBeard('bouc',.012,-.056,-.07,lm)>.4,'moustache');assert.ok(mhBeard('bouc',.05,-.08,-.03,lm)<.05,'the goatee leaves the cheeks bare');assert.ok(mhBeard('barbe',.05,-.08,-.03,lm)>.5,'the full beard covers them');});

test('Lot 8 · curls and afro are fine coils planted on the scalp, hair shell and smoothing helpers behave',()=>{const {head}=buildMHHead(D,mhShapeParams(0));
 const c=mhCurls(head,'boucles',0x28231e,true,3),a=mhCurls(head,'afro','#111111',true,3);assert.ok(c.attributes.position.count>8000&&a.attributes.position.count>8000,'many coils');
 assert.equal(mhCurls(head,'court','#111111',true),null);const bb=bbox(c);assert.ok(bb.min.y>.0,'curls stay on top');
 const lowCount=(()=>{const p=c.attributes.position;let k=0;for(let i=0;i<p.count;i++)if(p.getY(i)<.03)k++;return k;})();assert.ok(lowCount<c.attributes.position.count*.03,'none on the neck or the sides');
 assert.equal(hairShell(head,'crane'),null);const sh=hairShell(head,'degrade','#222222');assert.ok(sh.index.count>900&&sh.index.count<head.index.count*.3,'shell covers the scalp only');
 assert.equal(sh.attributes.normal.count,head.attributes.normal.count,'same normals as the skin');
 const cav=cavity(head);assert.equal(cav.length,head.attributes.position.count);assert.ok(Math.max(...cav)>.3&&Math.min(...cav)<-.1);
 const f=smoothField(head,new Float32Array(head.attributes.position.count).fill(1),2);assert.ok(Math.abs(f[10]-1)<1e-4);});

test('Lot 9 · curls take the chosen hair colour (no NaN, no black coils on a blond head) and cover the scalp densely',()=>{const {head}=buildMHHead(D,mhShapeParams(0));
 const mean=g=>{const c=g.attributes.color;let r=0,gg=0,b=0,n=c.count;for(let i=0;i<n;i++){assert.ok(Number.isFinite(c.getX(i))&&Number.isFinite(c.getY(i))&&Number.isFinite(c.getZ(i)));r+=c.getX(i);gg+=c.getY(i);b+=c.getZ(i);}return [r/n,gg/n,b/n];};
 const blond=mean(mhCurls(head,'boucles','#d6b560',true,5)),black=mean(mhCurls(head,'boucles','#111111',true,5)),white=mean(mhCurls(head,'afro','#ececec',true,5));
 assert.ok(blond[0]>.2&&blond[0]>blond[2]*1.5,'blond coils are blond '+blond.join());assert.ok(black[0]<.05,'black coils stay black');assert.ok(white[0]>.3&&Math.abs(white[0]-white[2])<.08,'white coils are neutral '+white.join());
 const g=mhCurls(head,'boucles','#d6b560',true,5);assert.ok(g.attributes.position.count>20000,'dense coverage '+g.attributes.position.count);});

test('Lot 9 · the cuts have different silhouettes: fade tall on top, crop low and short, slicked volume to the back',()=>{
 const top=(st,x,y,z)=>mhHair(st,x,y,z).t;assert.ok(top('degrade',0,.1,-.06)>top('court',0,.1,-.06)*2.2,'the fade is taller than the crop at the front');
 assert.ok(top('plaque',0,.1,.08)>top('plaque',0,.1,-.06)*1.8,'slicked hair carries its volume to the back');assert.ok(mhHair('court',.07,.045,0).d>.8&&mhHair('degrade',.07,.045,0).d<.1,'the crop reaches lower on the sides than the fade');
 assert.ok(MH_HAIR.plaque.rough<MH_HAIR.court.rough,'slicked hair is shinier');});

test('Lot 9 · young-adult neutral face: closed mouth settings and a leaner lower face are part of every shape',()=>{const p=mhShapeParams(3);for(const k of ['mouth-scale-horiz-incr!','mouth-cupidsbow-incr!','head-fat-decr!','chin-bones-incr!','l-cheek-inner-decr!','r-cheek-inner-decr!'])assert.ok(p.mods[k]>0,k);
 const a=buildMHHead(D,{race:[.34,.33,.33],gender:.9,mods:{}}).head,b=buildMHHead(D,mhShapeParams(0)).head;let diff=0;const pa=a.attributes.position,pb=b.attributes.position;for(let i=0;i<pa.count;i++)diff=Math.max(diff,Math.abs(pa.getZ(i)-pb.getZ(i)));assert.ok(diff>.002&&diff<.03,'the neutral settings reshape the face by a few millimetres '+diff);});

test('Lot 9c · the closing line between the lips is a very slight curve: level in the middle, corners a hair lower, ending at the corners',()=>{const lm={ym:-.07,xc:.021};
 const mid=mouthLine(lm,0),corner=mouthLine(lm,lm.xc),out=mouthLine(lm,lm.xc*2);assert.ok(corner<mid&&mid-corner<.0015,'a hair lower at the corners, not a smile or a frown '+(mid-corner));assert.ok(Math.abs(out-corner)<1e-9,'the curve stops at the corner and does not run on across the skin');
 const a=mouthLine(lm,.004),b=mouthLine(lm,.012);assert.ok(Math.abs(a-mid)<.0006&&b<a,'smooth from the middle to the corner');});

test('Lot 9d · lower-face proportions and mouth: the chin is no longer overlong, the lips sit near the profile line, the commissure is where the lips meet',()=>{
 for(const i of [0,1,2,3,4,5]){const {head}=buildMHHead(D,mhShapeParams(i)),lm=landmarks(head,D),pos=head.attributes.position;let chin=9;for(let k=0;k<pos.count;k++)if(pos.getZ(k)<-.04&&Math.abs(pos.getX(k))<.02&&pos.getY(k)<chin)chin=pos.getY(k);
  const sg=(lm.ym-chin)*1000;assert.ok(sg>37&&sg<56,'shape '+i+' mouth-to-chin '+sg.toFixed(1)+' mm');const cx=commissure(head,D);assert.ok(cx>.02&&cx<.03,'commissure '+cx);}});

test('Lot 9e · a shaved cut has no cap, the chin landmark is the real chin (not the collar), the lips are eased back',()=>{const {head}=buildMHHead(D,mhShapeParams(0)),lm=landmarks(head,D);assert.equal(hairShell(head,'rase'),null);assert.ok(hairShell(head,'degrade','#222222'));
 const d=(lm.ym-lm.yc)*1000;assert.ok(d>38&&d<62,'mouth to chin '+d.toFixed(1)+' mm');assert.ok(MH_LIP_BACK>.0003&&MH_LIP_BACK<.004);
 const b=mhBeard('barbe',0,lm.yc-.06,-.03,lm);assert.equal(b,0,'no stubble far down the neck');});

test('Lot 9j · the face sliders: zero changes nothing, each slider moves its targets both ways and only valid targets are used',()=>{const base=mhShapeParams(0).mods;assert.deepEqual(applyFace(base,{lipFull:0,chin:0}),base);assert.deepEqual(applyFace(base,null),base);
 const up=applyFace(base,{chin:1}),dn=applyFace(base,{chin:-1});assert.ok((up['chin-prominent-incr!']||0)>(base['chin-prominent-incr!']||0));assert.ok(!dn['chin-prominent-incr!']&&dn['chin-prominent-decr!']>0,'a negative value uses the decr target');
 for(const [k,,names] of FACE_SLIDERS)for(const v of [-1,1])for(const key of Object.keys(applyFace(base,{[k]:v})))assert.ok(D.targets[key.slice(0,-1)],'valid target '+key);
 const a=buildMHHead(D,mhShapeParams(0,{lipFull:1})).head.attributes.position,b=buildMHHead(D,mhShapeParams(0)).head.attributes.position;let d=0;for(let i=0;i<a.count;i++)d=Math.max(d,Math.abs(a.getZ(i)-b.getZ(i)));assert.ok(d>.001,'the lips move by '+(d*1000).toFixed(1)+' mm');});

test('V20 lot 9l · every face slider is saved, labelled in the locker and moves valid targets',async()=>{const {FACE_SLIDERS}=await import('../dist/mh.js'),{FACE_KEYS,FACE_DEFAULT}=await import('../dist/career.js'),fs=await import('node:fs'),head=JSON.parse(fs.readFileSync('dist/mh/head.json','utf8')),game=fs.readFileSync('dist/game.js','utf8');assert.deepEqual(FACE_SLIDERS.map(r=>r[0]).sort(),[...FACE_KEYS].sort());for(const [k,,names] of FACE_SLIDERS){assert.ok(k in FACE_DEFAULT);assert.ok(game.includes("['"+k+"','"),k+' has a label');for(const n of names)assert.ok(head.targets[n+'-incr']&&head.targets[n+'-decr'],n);}assert.ok(!/yaw\+=dt/.test(fs.readFileSync('dist/engine.js','utf8')),'the locker no longer turns by itself');});
