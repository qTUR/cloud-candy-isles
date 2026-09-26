# Cloud Candy Isles · جزر حلوى الغيم

A cozy one-finger 3D tycoon for the browser. Gather clouds, spin sweets and grow a candy kingdom across three floating sky islands. Arabic and English.

لعبة إدارة ثلاثية الأبعاد تُلعب بإصبع واحد: اجمع الغيوم، اصنع الحلويات، وابنِ مملكة حلوى على ثلاث جزر طائرة. بالعربي والإنجليزي.

**Play:** https://qtur.github.io/cloud-candy-isles/

## Build

```
npm install
node build.js
```

One source file (`src/game.src.html`) builds:

- `dist/artifact/` – single-page preview
- `dist/youtube/` + `dist/cloud-candy-isles-youtube.zip` – YouTube Playables bundle (local three.js and fonts, only the Playables SDK is external)
- `dist/pages/` – the GitHub Pages site (same bundle plus meta/og tags)

`node test/run.js youtube` runs a headless play-through with a mock `ytgame`; `node tools/covers.js` renders the cover art.

© qTUR
