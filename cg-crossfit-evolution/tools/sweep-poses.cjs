// Uso: node tools/sweep-poses.cjs <pasta com index.html renomeado para cg-crossfit-evolution.html> <caminho do three.min.js 0.149>
// Requer Playwright. Aponta poses em que o corpo flutua ou atravessa o chão.
// Varredura automática: para cada exercício e 40 momentos do ciclo, mede quanto o quadril sobe em relação às poses-chave
// e se mãos/pés atravessam o chão. Aponta transições suspeitas.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const dir = process.argv[2], three = fs.readFileSync(process.argv[3]);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: three, contentType: 'text/javascript' }));
  await p.goto('file://' + dir + '/cg-crossfit-evolution.html#hoje'); await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    const res = [];
    for (const id of Object.keys(FIG)) {
      const fig = FIG[id];
      const keyHip = fig.frames.map((f) => skeleton(f, fig.anchor).hip[1]);
      const lo = Math.min(...keyHip), hi = Math.max(...keyHip);
      let worst = 0, at = 0;
      for (let i = 0; i < 40; i++) {
        const s = skeleton(poseAt(fig, i / 40), fig.anchor);
        const over = lo - s.hip[1] - (fig.frames.some((f) => f.lift) ? 30 : 0); // quadril acima do ponto mais alto das poses-chave
        if (over > worst) { worst = over; at = i / 40; }
      }
      // Pose deitada (tronco perto da horizontal) sem banco: o quadril precisa estar no chão.
      fig.frames.forEach((f, i) => {
        const t = ((f.torso % 360) + 360) % 360;
        if (fig.anchor === "ground" && !fig.props.length && (Math.abs(t - 90) < 25 || Math.abs(t - 270) < 25)) {
          const s = skeleton(f, fig.anchor), hipH = GROUND - s.hip[1], shoH = GROUND - s.sho[1];
          if (hipH > 16 && shoH > 16 && Math.abs(t - 270) < 25) res.push(`${id}: pose ${i + 1} deitada de costas com o corpo no ar (quadril a ${hipH.toFixed(0)})`);
        }
      });
      if (worst > 8) res.push(`${id}: quadril sobe ${worst.toFixed(0)} acima das poses-chave em ${(at * 100).toFixed(0)}% do ciclo`);
    }
    return res;
  });
  console.log(out.length ? out.join('\n') : 'nenhuma transição suspeita');
  await b.close();
})();
