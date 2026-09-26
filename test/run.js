// Headless test: YouTube build with mock ytgame + artifact build
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test/out'); fs.mkdirSync(OUT, { recursive: true });

const MOCK = `
window.__ytlog=[]; var _save=null; function log(n,a){ window.__ytlog.push(n+(a!==undefined?':'+a:'')); }
window.ytgame={IN_PLAYABLES_ENV:true,SDK_VERSION:'mock',
 game:{firstFrameReady(){log('firstFrameReady')},gameReady(){log('gameReady')},saveData(s){log('saveData',s.length);_save=s;window.__saved=s;return Promise.resolve()},loadData(){log('loadData');return Promise.resolve(window.__preload||'')}},
 system:{getLanguage(){log('getLanguage');return Promise.resolve(window.__ytlang||'ar-SA')},isAudioEnabled(){log('isAudioEnabled');return true},
   onAudioEnabledChange(cb){window.__audioCb=cb;return()=>{}},onPause(cb){window.__pauseCb=cb;return()=>{}},onResume(cb){window.__resumeCb=cb;return()=>{}}},
 ads:{requestInterstitialAd(){log('interstitial');return Promise.resolve()},requestRewardedAd(id){log('rewarded',id);return Promise.resolve(true)}},
 engagement:{sendScore(s){log('score',s.value);return Promise.resolve()}},health:{logError(){log('err')},logWarning(){}}};`;

function serve(dir, port) {
  return new Promise(r => { const s = http.createServer((q, res) => { let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' }[ext] || 'application/octet-stream' }); res.end(d); }); }).listen(port, () => r(s)); });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function hold(page, key, ms) { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); }
async function walkTo(page, x, z, tol = 0.45, maxMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const p = await page.evaluate(() => { const p = __game.player().pos; return [p.x, p.z]; });
    const dx = x - p[0], dz = z - p[1];
    if (Math.hypot(dx, dz) < tol) { await page.evaluate(() => { for (const k in __game.keys) __game.keys[k] = false; }); return true; }
    await page.evaluate(([dx, dz]) => { const k = __game.keys; k['arrowleft'] = dx < -0.2; k['arrowright'] = dx > 0.2; k['arrowup'] = dz < -0.2; k['arrowdown'] = dz > 0.2; }, [dx, dz]);
    await sleep(60);
  }
  await page.evaluate(() => { for (const k in __game.keys) __game.keys[k] = false; });
  return false;
}

(async () => {
  const which = process.argv[2] || 'youtube';
  const srv = await serve(path.join(ROOT, 'dist'), 8765);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const external = [];
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost:8765')) return route.continue();
    external.push(u);
    if (u.startsWith('https://www.youtube.com/game_api/v1')) return route.fulfill({ contentType: 'text/javascript', body: MOCK });
    if (u.includes('three.min.js')) return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(ROOT, 'node_modules/three/build/three.min.js')) });
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort();
  });
  await page.addInitScript(() => { window.__TEST__ = true; window.__DTMAX = 0.12; });
  const url = which === 'youtube' ? 'http://localhost:8765/youtube/index.html' : 'http://localhost:8765/artifact/test.html';
  await page.goto(url);
  await page.waitForSelector('#start:not([hidden])', { timeout: 20000 });
  await sleep(800);
  await page.screenshot({ path: `${OUT}/${which}-01-start.png` });
  const r = {};
  r.lang = await page.evaluate(() => document.documentElement.lang + '/' + document.documentElement.dir);
  await page.click('#btnPlay',{force:true});
  await sleep(600);
  await page.screenshot({ path: `${OUT}/${which}-02-play.png` });
  // tutorial run
  const g = (fn, a) => page.evaluate(fn, a);
  const tp = await g(() => { const t = __game.tiles().spinner; return [t.pos.x, t.pos.z]; });
  await walkTo(page, tp[0], tp[1]); await sleep(1800);
  r.spinner = await g(() => !!__game.S.unlocked.spinner);
  await walkTo(page, -8, 4, 0.4); await sleep(300); await walkTo(page, -9.2, 4.6, 0.3); await sleep(300); await walkTo(page, -7, 3.3, 0.3); await sleep(300); await walkTo(page, -8.4, 2.6, 0.3); await sleep(300);
  r.carry = await g(() => __game.player().stack.slice());
  await page.screenshot({ path: `${OUT}/${which}-03-gather.png` });
  const ip = await g(() => { const m = __game.machines().spinner; return [m.inPos.x, m.inPos.z]; });
  await walkTo(page, ip[0], ip[1], 0.3); await sleep(1500);
  const op = await g(() => { const m = __game.machines().spinner; return [m.outPos.x, m.outPos.z]; });
  await sleep(3500);
  await walkTo(page, op[0], op[1], 0.3); await sleep(1200);
  r.carry2 = await g(() => __game.player().stack.slice());
  const sp = await g(() => { const s = __game.stalls().stall1; return [s.sellPos.x, s.sellPos.z]; });
  await walkTo(page, sp[0], sp[1], 0.3); await sleep(4000);
  r.tut = await g(() => __game.S.tut); r.coins = await g(() => __game.S.coins); r.sold = await g(() => JSON.stringify(__game.S.stats.sold));
  await page.screenshot({ path: `${OUT}/${which}-04-sell.png` });
  await sleep(8000);
  r.tutAfter = await g(() => __game.S.tut);
  // progress: give coins, unlock everything to zone 2
  await g(() => { __game.addCoins(5e6); ['cloudB','workshop','press','hb1','courier1','fountain','cloudC','lamps','hb1b','gate1','rainA','kettle','stall2','rainB','flossm','hb2','courier2','freight2','arch','flowers','gate2','crystalA','lanternm','stall3','crystalB','cometm','hb3','courier3','freight3','telescope','stargarden','observatory'].forEach(id => __game.unlock(id)); });
  await sleep(4000);
  await page.screenshot({ path: `${OUT}/${which}-05-all.png` });
  // walk over the bridge into zone 1
  await walkTo(page, 0, -12, 0.5); await walkTo(page, 0, -30, 0.6, 15000);
  r.zone1pos = await g(() => { const p = __game.player().pos; return [p.x.toFixed(1), p.z.toFixed(1)]; });
  await page.screenshot({ path: `${OUT}/${which}-06-zone1.png` });
  await walkTo(page, 0, -60, 0.6, 15000); await sleep(1500);
  await page.screenshot({ path: `${OUT}/${which}-07-zone2.png` });
  // bots working: let the sim run
  await sleep(15000);
  r.bots = await g(() => __game.bots().map(b => b.id + ':' + b.state).join(','));
  r.machines = await g(() => Object.values(__game.machines()).map(m => m.id + ':' + JSON.stringify(m.inBuf) + '/' + m.out).join(' '));
  r.shelves = await g(() => Object.values(__game.stalls()).map(s => s.id + ':' + JSON.stringify(s.shelf) + ' q' + s.queue.length).join(' '));
  // workshop
  const wp = await g(() => { const d = __game.S; return null; });
  await walkTo(page, 0, -12, 0.6, 20000); await walkTo(page, 5, -7.8, 0.4, 8000); await sleep(600);
  r.sheet = await g(() => !document.getElementById('sheet').hidden);
  await page.screenshot({ path: `${OUT}/${which}-08-workshop.png` });
  await page.click('#sheet .buy:not([disabled])',{force:true}); await sleep(300);
  r.ups = await g(() => JSON.stringify(__game.S.up));
  // language switch
  await walkTo(page, 2, -3, 0.6);
  await page.click('#btnLang',{force:true}); await sleep(600);
  r.lang2 = await g(() => document.documentElement.lang + '/' + document.documentElement.dir);
  await page.screenshot({ path: `${OUT}/${which}-09-lang.png` });
  // rewarded ad
  await page.click('#btnBoost',{force:true}); await sleep(which === 'youtube' ? 600 : 1500);
  if (which !== 'youtube') { await page.screenshot({ path: `${OUT}/${which}-10-fakead.png` }); await sleep(3000); }
  r.boost = await g(() => __game.S.boostLeft);
  // pause / resume / audio
  if (which === 'youtube') {
    await g(() => { window.__audioCb(false); }); await sleep(200);
    r.muteIcon = await g(() => document.getElementById('btnMute').getAttribute('aria-pressed'));
    await g(() => { window.__audioCb(true); window.__pauseCb(); }); await sleep(300);
    const t1 = await g(() => __game.S.boostLeft); await sleep(1000); const t2 = await g(() => __game.S.boostLeft);
    r.pausedHolds = t1 === t2; await g(() => window.__resumeCb()); await sleep(500);
    r.resumed = (await g(() => __game.S.boostLeft)) < t2;
  }
  // interstitial rate limit
  r.inter1 = await g(() => { const before = (window.__ytlog || []).filter(x => x === 'interstitial').length; __game.maybeInterstitial(); return before; });
  await g(() => __game.writeSave());
  r.ytlog = await g(() => (window.__ytlog || []).filter(x => !x.startsWith('saveData')).join(' | '));
  r.saves = await g(() => (window.__ytlog || []).filter(x => x.startsWith('saveData')).length);
  r.external = [...new Set(external)];
  r.errors = errors;
  console.log(JSON.stringify(r, null, 1));
  // reload with saved data to verify load
  if (which === 'youtube') {
    const saved = await g(() => window.__saved);
    const p2 = await ctx.newPage(); p2.on('pageerror', e => errors.push('p2: ' + e.message));
    await p2.route('**/*', route => { const u = route.request().url(); if (u.startsWith('http://localhost')) return route.continue(); if (u.startsWith('https://www.youtube.com/game_api/v1')) return route.fulfill({ contentType: 'text/javascript', body: MOCK }); return route.abort(); });
    await p2.addInitScript(s => { window.__TEST__ = true; window.__preload = s; }, saved);
    await p2.goto(url); await p2.waitForSelector('#start:not([hidden])');
    console.log('reload:', await p2.evaluate(() => [__game.S.coins, Object.keys(__game.S.unlocked).length, document.documentElement.lang, Object.keys(__game.machines()).length]));
    console.log('errors2', errors.slice(r.errors.length));
  }
  await browser.close(); srv.close();
})();
