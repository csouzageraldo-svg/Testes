// Renderiza criativo.html em PNG 1080x1350 (feed 4:5).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await pg.goto('file://' + __dirname + '/criativo.html', { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: __dirname + '/criativo-black-week.png' });
  await b.close();
})();
