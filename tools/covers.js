// Renders cover art from an in-game scene, then adds titles (ar / en / none)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'covers');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [
  { key: '16x9', w: 1920, h: 1080, cam: { px: 7.5, py: 11.5, pz: 13.5, lx: -0.5, lz: -3.2, fov: 42 } },
  { key: '1x1', w: 1280, h: 1280, cam: { px: 6.5, py: 15, pz: 15, lx: -0.5, lz: -4.5, fov: 46 } },
  { key: '9x16', w: 1080, h: 1920, cam: { px: 5, py: 21, pz: 16, lx: -0.5, lz: -6.5, fov: 52 } }
];
const only = process.argv[2];
function serve(dir, port) {
  return new Promise(r => { const s = http.createServer((q, res) => { let f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' }[ext] || 'application/octet-stream' }); res.end(d); }); }).listen(port, () => r(s)); });
}
(async () => {
  const srv = await serve(ROOT, 8766);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const sz of SIZES) {
    if (only && only !== sz.key) continue;
    const page = await browser.newPage({ viewport: { width: sz.w, height: sz.h } });
    page.on('pageerror', e => console.log('ERR', e.message));
    await page.route('**/*', r => r.request().url().startsWith('http://localhost') ? r.continue() : r.abort());
    await page.addInitScript(c => { window.__COVER__ = c; }, { w: sz.w, h: sz.h, cam: sz.cam, lang: 'en' });
    await page.goto('http://localhost:8766/dist/youtube/index.html');
    await page.waitForFunction(() => window.__COVER_READY__ === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    await (await page.$('#c')).screenshot({ path: path.join(OUT, `raw-${sz.key}.png`) });
    await page.close();
    for (const lang of ['none', 'ar', 'en']) {
      const p = await browser.newPage({ viewport: { width: sz.w, height: sz.h } });
      const portrait = sz.h > sz.w, square = sz.h === sz.w;
      const size = portrait ? 190 : square ? 170 : 150;
      const t = lang === 'ar' ? ['جزر', 'حلوى الغيم'] : ['Cloud Candy', 'Isles'];
      const html = `<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
@font-face{font-family:B;font-weight:800;src:url(/dist/youtube/fonts/baloo-bhaijaan-2-latin-800.woff2)}
@font-face{font-family:B;font-weight:800;src:url(/dist/youtube/fonts/baloo-bhaijaan-2-arabic-800.woff2);unicode-range:U+0600-06FF,U+FB50-FDFF,U+FE70-FEFC}
html,body{margin:0;width:${sz.w}px;height:${sz.h}px;overflow:hidden}
body{background:url(/covers/raw-${sz.key}.png) center/cover;font-family:B}
h1{position:absolute;left:0;right:0;top:${portrait ? 150 : square ? 70 : 46}px;margin:0;text-align:center;font-weight:800;font-size:${size}px;line-height:${lang === 'ar' ? 1.05 : 0.9};color:#fff;
-webkit-text-stroke:${Math.round(size * 0.13)}px #3B2A5A;paint-order:stroke fill;text-shadow:0 ${Math.round(size * 0.09)}px 0 #3B2A5A}
h1 span{display:block}h1 span+span{color:#FF5FA2}
</style></head><body>${lang === 'none' ? '' : `<h1><span>${t[0]}</span><span>${t[1]}</span></h1>`}</body></html>`;
      fs.writeFileSync(path.join(OUT, '_tmp.html'), html);
      await p.goto('http://localhost:8766/covers/_tmp.html');
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, `cover-${sz.key}-${lang}.png`) });
      await p.close();
    }
    console.log('done', sz.key);
  }
  fs.rmSync(path.join(OUT, '_tmp.html'), { force: true });
  await browser.close(); srv.close();
})();
