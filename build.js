// Build: one source -> artifact preview, YouTube zip, GitHub Pages site
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = __dirname, SRC = fs.readFileSync(path.join(ROOT, 'src/game.src.html'), 'utf8');
const DIST = path.join(ROOT, 'dist');
const rm = p => fs.rmSync(p, { recursive: true, force: true });
const mk = p => fs.mkdirSync(p, { recursive: true });
rm(DIST); mk(DIST);

const SDK = '<script src="https://www.youtube.com/game_api/v1"></script>';
const FONT_FILES = [
  ['arabic', 600], ['latin', 600], ['arabic', 800], ['latin', 800]
];
const RANGES = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};
const localFonts = '<style>' + FONT_FILES.map(([s, w]) =>
  `@font-face{font-family:'Baloo Bhaijaan 2';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/baloo-bhaijaan-2-${s}-${w}.woff2) format('woff2');unicode-range:${RANGES[s]}}`).join('') + '</style>';
const googleFonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+Bhaijaan+2:wght@600;800&display=swap">';

function variant({ sdk, three, fonts, meta }) {
  return SRC.replace('<!--@SDK-->', sdk).replace('<!--@THREE-->', three).replace('<!--@FONTS-->', fonts).replace('<!--@META-->', meta);
}
function writeYT(dir, meta) {
  mk(path.join(dir, 'fonts'));
  fs.writeFileSync(path.join(dir, 'index.html'), variant({ sdk: SDK, three: '<script src="three.min.js"></script>', fonts: localFonts, meta }));
  fs.copyFileSync(path.join(ROOT, 'node_modules/three/build/three.min.js'), path.join(dir, 'three.min.js'));
  for (const [s, w] of FONT_FILES) fs.copyFileSync(path.join(ROOT, `node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-${s}-${w}-normal.woff2`), path.join(dir, `fonts/baloo-bhaijaan-2-${s}-${w}.woff2`));
}

// 1) Artifact preview (page body fragment; skeleton is added by the host)
{
  const full = variant({ sdk: '', three: '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', fonts: googleFonts, meta: '' });
  const head = full.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = full.match(/<body>([\s\S]*?)<\/body>/)[1];
  mk(path.join(DIST, 'artifact'));
  fs.writeFileSync(path.join(DIST, 'artifact/cloud-candy-isles.html'), head.trim() + '\n' + body.trim() + '\n');
  // local test copy of the preview (full doc, same externals)
  fs.writeFileSync(path.join(DIST, 'artifact/test.html'), full);
}
// 2) YouTube Playables bundle
writeYT(path.join(DIST, 'youtube'), '');
execSync('cd dist/youtube && zip -qr -X ../cloud-candy-isles-youtube.zip index.html three.min.js fonts', { cwd: ROOT });
// 3) GitHub Pages site (same bundle + meta/og)
const PAGES_URL = process.env.PAGES_URL || 'https://qtur.github.io/cloud-candy-isles/';
const meta = [
  '<meta name="description" content="Gather clouds, spin sweets and build a candy kingdom in the sky. A cozy one-finger tycoon game in Arabic and English.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:title" content="Cloud Candy Isles | جزر حلوى الغيم">',
  '<meta property="og:description" content="Gather clouds, spin sweets and build a candy kingdom in the sky.">',
  `<meta property="og:url" content="${PAGES_URL}">`,
  `<meta property="og:image" content="${PAGES_URL}og.png">`,
  '<meta property="og:image:width" content="1920"><meta property="og:image:height" content="1080">',
  '<meta name="twitter:card" content="summary_large_image">',
  `<meta name="twitter:image" content="${PAGES_URL}og.png">`,
  '<meta name="theme-color" content="#8FD0FF">'
].join('\n');
writeYT(path.join(DIST, 'pages'), meta);
const og = path.join(ROOT, 'covers/cover-16x9-en.png');
if (fs.existsSync(og)) fs.copyFileSync(og, path.join(DIST, 'pages/og.png'));
fs.writeFileSync(path.join(DIST, 'pages/.nojekyll'), '');
console.log('built', fs.statSync(path.join(DIST, 'cloud-candy-isles-youtube.zip')).size, 'bytes zip');
