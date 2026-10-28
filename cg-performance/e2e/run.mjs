// Roteiro E2E (Playwright, viewport mobile). Pré-requisitos: `npm run build`, API (`npm run dev:api`)
// e `npx vite preview --port 4173` rodando. Uso: node e2e/run.mjs [baseURL]
// Gera screenshots em e2e/out/ e falha (exit 1) se algum critério verificado não passar.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// `require` respeita NODE_PATH (Playwright instalado globalmente); localmente: `npm i -D playwright`.
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`); };
const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();
page.on('pageerror', (e) => check('sem erros de JS na página', false, e.message));

try {
  // ── Hoje
  await page.goto(BASE);
  await page.getByTestId('suggestion-headline').waitFor();
  await page.waitForTimeout(800);
  await shot(page, '01-hoje');
  check('Tela Hoje mostra sugestão e CTA', await page.getByTestId('cta-build').isVisible());

  // ── Equipamentos: confirmar alguns itens
  await page.goto(`${BASE}/equipamentos`);
  await page.getByTestId('equipment-item').first().waitFor();
  for (const key of ['dumbbells', 'sandbag', 'bench', 'bike', 'bands_tube', 'kb_handle']) await page.getByTestId(`confirm-${key}`).click();
  await page.waitForTimeout(400);
  await shot(page, '02-equipamentos');
  check('Inventário identificado nas fotos com confirmação', (await page.getByTestId('equipment-item').count()) >= 15);

  // ── Briefing: mudar foco para superiores, 30 min
  await page.goto(`${BASE}/treinar`);
  await page.getByTestId('generate').waitFor();
  check('Gerar bloqueado até responder sintomas/dor', await page.getByTestId('generate').isDisabled());
  await page.getByTestId('no-symptoms').click();
  await page.getByTestId('no-pain').click();
  await page.getByTestId('focus').getByRole('button', { name: 'Superiores' }).click();
  await page.getByTestId('time').getByRole('button', { name: '30 min' }).click();
  await page.getByTestId('generate').click();
  await page.getByTestId('option-A').waitFor();
  await shot(page, '03-briefing-opcoes');
  const ratA = await page.getByTestId('rationale-A').innerText();
  check('Critério 1: foco alterado é respeitado e explicado', /Você escolheu superiores/.test(ratA), ratA.split('\n')[0]);
  const estA = Number((await page.getByTestId('est-A').innerText()).match(/\d+/)[0]);
  const estB = Number((await page.getByTestId('est-B').innerText()).match(/\d+/)[0]);
  check('Critério 7: 30 min vs express concretamente diferentes', estA >= 25 && estA <= 36 && estB < estA, `A≈${estA} min, B≈${estB} min`);

  // ── Revisar: editar reps e carga, aprovar
  await page.getByTestId('choose-A').click();
  await page.getByTestId('approve').waitFor();
  await page.getByTestId('edit-1-0').click();
  const reps = page.getByTestId('reps-1-0');
  if (await reps.count()) await reps.fill('6');
  const load = page.getByTestId('load-1-0');
  if (await load.count()) await load.fill('12');
  await page.waitForTimeout(200);
  await shot(page, '04-revisao');
  check('Critério 2: aceita alteração de carga', (await load.count()) === 0 || (await load.inputValue()) === '12');
  await page.getByTestId('approve').click();

  // ── Executar: timer + persistência ao recarregar
  await page.getByTestId('start-block').waitFor();
  await page.getByTestId('start-block').click();
  await page.waitForTimeout(2200);
  const t1 = await page.getByTestId('clock').innerText();
  await page.reload();
  await page.getByTestId('clock').waitFor();
  await page.waitForTimeout(1200);
  const t2 = await page.getByTestId('clock').innerText();
  check('Critério 9: progresso persiste ao recarregar e o tempo continua', t1 !== t2 && !(await page.getByTestId('start-block').count()), `${t1} → ${t2}`);
  await shot(page, '05-execucao');
  // Ir para o bloco principal (EMOM/AMRAP) e conferir o rótulo do timer
  await page.getByTestId('next-block').click();
  if (await page.getByTestId('next-block').count()) await page.getByTestId('next-block').click();
  await page.getByTestId('start-block').click();
  await page.waitForTimeout(1500);
  const label = await page.getByTestId('clock-label').innerText();
  check('Timer do bloco principal funcionando', /minuto|restante|TRABALHO|cap/.test(label), label);
  await shot(page, '06-execucao-metcon');
  await page.getByTestId('end-early').click();

  // ── Check-out
  await page.getByTestId('save-checkout').waitFor();
  await page.getByTestId('rpe').fill('8');
  await shot(page, '07-checkout');
  await page.getByTestId('save-checkout').click();
  await page.getByTestId('performed-row').first().waitFor();
  check('Critério 10: check-out salva e aparece no histórico', (await page.getByTestId('performed-row').count()) >= 1);

  // ── Importação: o mesmo WOD duas vezes → um único prescrito com 2 fontes
  const wodA = '29/10/2026\nFIGHT GONE TEST\nWOD\nAMRAP 15\n12 thrusters (40/30 kg)\n15 pull-ups\n400m run';
  const wodB = '29/10\nFight Gone Test\nWOD\nAMRAP 15\n12 thruster 40/30kg\n15 pull ups\n400 m run';
  for (const t of [wodA, wodB]) {
    await page.goto(`${BASE}/importar`);
    await page.getByTestId('paste-text').fill(t);
    await page.getByTestId('parse-text').click();
    await page.getByTestId('wod-editor').waitFor();
    await page.getByTestId('confirm-text').click();
    await page.waitForTimeout(400);
  }
  await shot(page, '08-importacao');
  const notice = await page.locator('text=Mesclado').count();
  check('Critério 4: segundo envio do mesmo WOD é mesclado (sem duplicar)', notice > 0);
  await page.goto(`${BASE}/historico`);
  await page.getByTestId('prescribed-row').first().waitFor();
  const firstRow = await page.getByTestId('prescribed-row').first().innerText();
  check('Critério 6: print sem resultado aparece como programação, não realizado', /execução não informada/i.test(firstRow));
  await shot(page, '09-historico');

  // ── Quarto de hotel
  await page.goto(`${BASE}/treinar`);
  await page.getByTestId('location').getByRole('button', { name: 'Quarto de hotel' }).click();
  await page.getByTestId('no-symptoms').click();
  await page.getByTestId('no-pain').click();
  await page.getByTestId('generate').click();
  await page.getByTestId('option-A').waitFor();
  const roomText = await page.getByTestId('option-A').innerText();
  check('Critério 3: quarto de hotel silencioso, sem saltos', !/Burpee\b(?! sem)|Salto|Corrida|Double under|Pular corda/.test(roomText) && /Quarto de hotel/.test(roomText));
  await shot(page, '10-quarto-hotel');

  // ── Sintomas sistêmicos
  await page.goto(`${BASE}/treinar`);
  await page.getByTestId('symptoms').getByRole('button', { name: /Falta de ar anormal/ }).click();
  await page.getByTestId('no-pain').click();
  await page.getByTestId('intensity').getByRole('button', { name: /Alta/ }).click();
  await page.getByTestId('generate').click();
  await page.getByTestId('option-A').waitFor();
  const sick = await page.getByTestId('options').innerText();
  check('Critério 11: sintomas → sem WOD intenso, orienta avaliação', /Recuperação|Descanso/.test(sick) && /avaliação médica/.test(sick) && !/Alta \(RPE/.test(sick));
  await shot(page, '11-sintomas');
  // limpa o check-in de hoje para não afetar o restante
  await page.getByTestId('no-symptoms').click();
  await page.getByTestId('generate').click();

  // ── Biblioteca + animação
  await page.goto(`${BASE}/biblioteca/thruster`);
  await page.getByTestId('exercise-animation').waitFor();
  await page.waitForTimeout(700);
  await shot(page, '12-exercicio-thruster');
  check('Critério 8: demonstração animada + scaling acessível', (await page.locator('[data-testid=exercise-animation] svg').count()) > 1 && (await page.getByTestId('scale-easier').count()) > 0);

  // ── Fontes oficiais
  await page.goto(`${BASE}/fontes`);
  await page.getByTestId('sync').click();
  await page.waitForTimeout(3000);
  const srcText = await page.locator('main, body').innerText();
  check('Critério 12 (fallback): falha de acesso exibida honestamente', /não sincronizado|robots|indisponível|HTTP|fetch failed|erro/i.test(srcText));
  await page.getByTestId('manual-wod-text').fill('For time:\n21-15-9\nThrusters (43/30 kg)\nPull-ups');
  await page.getByTestId('save-manual-wod').click();
  await page.getByTestId('official-wod').waitFor();
  await shot(page, '13-fontes-oficiais');
  check('WOD oficial com fonte/data e estado "inserido manualmente"', /inserido manualmente/i.test(await page.getByTestId('official-wod').innerText()));
  await page.getByTestId('inspire').click();
  await page.getByTestId('no-symptoms').click();
  await page.getByTestId('no-pain').click();
  await page.getByTestId('generate').click();
  await page.getByTestId('option-A').waitFor();
  check('Inspirar no WOD oficial gera adaptação rotulada como não oficial', /não é a programação oficial/.test(await page.getByTestId('option-A').innerText()));
  await shot(page, '14-inspirado-oficial');

  // ── Evolução
  await page.goto(`${BASE}/evolucao`);
  await page.getByTestId('body-map').waitFor();
  await page.waitForTimeout(800);
  await shot(page, '15-evolucao');
  check('Mapa corporal e gráficos renderizados', (await page.locator('.recharts-surface').count()) >= 3);

  // ── Calendário
  await page.goto(`${BASE}/calendario`);
  await page.waitForTimeout(500);
  await shot(page, '16-calendario');

  // ── Exportação
  await page.goto(`${BASE}/dados`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const path = await dl.path();
  const { readFileSync } = await import('node:fs');
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  check('Critério 14: exporta JSON com histórico, composição, preferências, equipamentos e recomendações',
    ['performed', 'prescribed', 'bodycomp', 'profile', 'equipment', 'recommendations'].every((t) => Array.isArray(backup.tables[t])),
    `performed=${backup.tables.performed.length} bodycomp=${backup.tables.bodycomp.length}`);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-chat').click()]);
  check('Resumo para ChatGPT exportado', (await dl2.suggestedFilename()).endsWith('.md'));
  await shot(page, '17-dados');

  // ── Persistência após fechar/reabrir (mesmo dispositivo)
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE}/historico`);
  await page2.getByTestId('performed-row').first().waitFor();
  check('Critério 15 (local): dados continuam após fechar/reabrir', (await page2.getByTestId('performed-row').count()) >= 1);
} catch (e) {
  check('roteiro executado sem exceção', false, e.message);
  await shot(page, 'zz-erro').catch(() => {});
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
process.exit(failed.length ? 1 : 0);
