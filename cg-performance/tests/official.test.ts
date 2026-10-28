import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/seed/private', () => ({ privateSeed: { profile: undefined, bodyCompCsv: undefined, equipmentPhotos: [], wodPrints: [] } }));

import { parseOfficialWod, parseSchedule, robotsAllows, dateFromYYMMDD } from '../server/officialAdapters';
import { db } from '../src/db/db';
import { ensureSeeded, upsertOfficialEvent, upsertOfficialWod, wipeAll } from '../src/db/repo';

// Fixtures SINTÉTICAS (estrutura inventada para teste). A estrutura real do site não pôde ser
// inspecionada daqui: o ambiente de desenvolvimento bloqueia crossfit.com. Ver OFFICIAL_SOURCES.md.
const NEXT_HTML = `<html><head><title>Wednesday 261028 | CrossFit</title></head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { wod: {
  title: 'Wednesday 261028', publishingDate: '2026-10-28T00:00:00Z',
  wodContent: '<p>For time:</p><p>21-15-9 reps of:</p><p>Thrusters</p><p>Pull-ups</p><p>Post time to comments.</p>' } } } })}</script></body></html>`;

const TEXT_HTML = `<html><head><meta property="og:title" content="Thursday 261029"></head><body><nav>Menu Shop Games</nav>
<article><h1>Thursday 261029</h1><p>5 rounds for time of:</p><p>400-meter run</p><p>15 overhead squats</p><p>Rest as needed.</p></article></body></html>`;

const SCHEDULE_HTML = `<html><body><h1>2027 CrossFit Open</h1>
<p>Registration opens: Jan. 15, 2027</p>
<p>Open Workout 27.1 announcement: Feb. 26, 2027</p>
<p>Quarterfinals: April 1 - 4</p>
<p>Shop merchandise now</p></body></html>`;

describe('robots.txt', () => {
  const robots = 'User-agent: *\nDisallow: /admin\nDisallow: /search*\nAllow: /workout/\n\nUser-agent: BadBot\nDisallow: /';
  it('respeita Disallow/Allow', () => {
    expect(robotsAllows(robots, '/workout/')).toBe(true);
    expect(robotsAllows(robots, '/admin/x')).toBe(false);
    expect(robotsAllows(robots, '/search?q=1')).toBe(false);
    expect(robotsAllows(robots, '/open/schedule')).toBe(true);
  });
});

describe('parser de WOD oficial', () => {
  it('lê __NEXT_DATA__ com data', () => {
    const p = parseOfficialWod(NEXT_HTML, 'https://www.crossfit.com/workout/')!;
    expect(p.method).toBe('next_data');
    expect(p.publication_date).toBe('2026-10-28');
    expect(p.text).toMatch(/Thrusters/);
  });
  it('cai para texto visível e usa a data AAMMDD do título', () => {
    const p = parseOfficialWod(TEXT_HTML, 'https://www.crossfit.com/workout/')!;
    expect(p.method).toBe('html_text');
    expect(p.publication_date).toBe('2026-10-29');
    expect(p.text).toMatch(/400-meter run/);
    expect(p.text).not.toMatch(/Shop/);
  });
  it('retorna null quando não há WOD (nunca inventa)', () => {
    expect(parseOfficialWod('<html><body>Login required</body></html>', 'x')).toBeNull();
    expect(dateFromYYMMDD('Day 999999')).toBeNull();
  });
});

describe('parser de calendário', () => {
  it('extrai eventos com datas; sem ano explícito fica "unverified"', () => {
    const ev = parseSchedule(SCHEDULE_HTML, 'https://games.crossfit.com/open/schedule');
    const ann = ev.find((e) => /27\.1/.test(e.name))!;
    expect(ann.start_date).toBe('2027-02-26');
    expect(ann.status).toBe('confirmed');
    const qf = ev.find((e) => /Quarterfinals/i.test(e.name))!;
    expect(qf.start_date).toBe('2027-04-01');
    expect(qf.end_date).toBe('2027-04-04');
    expect(qf.status).toBe('unverified');
    expect(ev.some((e) => /Shop/.test(e.name))).toBe(false);
  });
});

describe('sincronização no app (critérios 12/13 e §7 aceite 3–4)', () => {
  beforeEach(async () => { await wipeAll(); await ensureSeeded(); });
  it('nova publicação igual não duplica; alteração preserva snapshot anterior', async () => {
    const base = { publication_date: '2026-10-28', title: 'Wednesday 261028', text: 'For time: 21-15-9 thrusters, pull-ups', source_url: 'https://www.crossfit.com/workout/', verification: 'synced' as const };
    expect((await upsertOfficialWod(base)).status).toBe('created');
    expect((await upsertOfficialWod(base)).status).toBe('unchanged');
    const r = await upsertOfficialWod({ ...base, text: 'For time: 21-15-9 thrusters (43/30 kg), pull-ups' });
    expect(r.status).toBe('updated');
    expect(await db.officialWods.count()).toBe(1);
    expect(r.wod.history).toHaveLength(1);
    expect(r.wod.version).toBe(2);
  });
  it('mudança de data de evento vira "changed" com histórico', async () => {
    const ev = { canonical_id: 'open:qf:2027', name: 'Quarterfinals', kind: 'quarterfinals', start_date: '2027-04-01', end_date: '2027-04-04', timezone: 'PT', status: 'confirmed' as const, source_url: 'https://games.crossfit.com/open/schedule' };
    expect(await upsertOfficialEvent(ev)).toBe('created');
    expect(await upsertOfficialEvent({ ...ev, start_date: '2027-04-08', end_date: '2027-04-11' })).toBe('updated');
    const stored = (await db.officialEvents.toArray())[0];
    expect(stored.status).toBe('changed');
    expect(stored.history[0].start_date).toBe('2027-04-01');
  });
});
