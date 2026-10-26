// L'en-tête de l'accueil ne doit plus porter un numéro de version écrit en dur (il affichait « VERSION 19 » depuis le lot 19).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync(new URL('../../dist/index.html',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../../dist/game.js',import.meta.url),'utf8');
test('l\'en-tête de l\'accueil n\'a pas de numéro de version figé et suit BUILD',()=>{
 assert.ok(!/VERSION\s*\d+/i.test(html.match(/<header>.*?<\/header>/s)[0]),'numéro de version écrit en dur dans l\'en-tête');
 assert.ok(game.includes("$('topBuild').textContent='CARRIÈRE JOUEUR · '+BUILD.toUpperCase()"),'l\'en-tête doit afficher BUILD');
});
