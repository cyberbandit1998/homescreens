// Screenshots of the plugin in a real browser, using the stand-in harness page.
//   node scripts/shots.mjs <outDir> [name-filter]
// Needs `npm run build` and `npm run harness` first, and Playwright's Chromium.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || join(root, 'harness', 'out', 'shots');
const only = process.argv[3];

const files = {
  '/': ['harness/out/index.html', 'text/html'],
  '/harness.js': ['harness/out/harness.js', 'text/javascript'],
  '/bundle.js': ['dist/bundle.js', 'text/javascript'],
  '/manifest.json': ['manifest.json', 'application/json'],
};
const server = createServer(async (req, res) => {
  const entry = files[new URL(req.url, 'http://x').pathname];
  if (!entry) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': entry[1] }).end(await readFile(join(root, entry[0])));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// A frozen "now": Monday 2 Nov 2026, 9:00 am in Chicago. The browser runs in UTC
// on purpose, like a stock Raspberry Pi, so the household time zone is exercised.
const NOW = new Date('2026-11-02T15:00:00Z');

const scenarios = [
  { name: 'week-light', q: 'view=week' },
  { name: 'week-landscape-15in', q: 'fontSize=22', w: 1856, h: 1000 },
  { name: 'day', q: 'cfg.defaultView=day' },
  { name: 'month', q: 'cfg.defaultView=month' },
  { name: 'schedule', q: 'cfg.defaultView=schedule' },
  { name: 'chores', click: 'tab:Chores' },
  { name: 'week-dark', q: 'bg=dark' },
  { name: 'week-portrait-wall', q: '', w: 1040, h: 1500 },
  { name: 'week-narrow-stack', q: '', w: 560, h: 900 },
  { name: 'month-narrow', q: 'cfg.defaultView=month', w: 560, h: 800 },
  { name: 'event-sheet', click: 'text:Dentist: Leo', after: 300 },
  { name: 'filtered-mia', click: 'chip:Mia' },
  { name: 'setup', q: 'setup=1' },
  { name: 'unreachable', q: 'fail=1' },
  { name: 'monday-24h', q: 'cfg.startDay=monday&tf=24h' },
];

const browser = await chromium.launch();
await mkdir(outDir, { recursive: true });

for (const s of scenarios) {
  if (only && !s.name.includes(only)) continue;
  const w = s.w ?? 1040;
  const h = s.h ?? 760;
  const context = await browser.newContext({ viewport: { width: w + 32, height: h + 32 }, timezoneId: 'UTC', locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.clock.setFixedTime(NOW);
  await page.goto(`${base}/?w=${w}&h=${h}&${s.q ?? ''}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(500);
  if (s.click) {
    // Split on the FIRST colon only: labels such as "Dentist: Leo" contain one.
    const at = s.click.indexOf(':');
    const kind = s.click.slice(0, at);
    const label = s.click.slice(at + 1);
    const target =
      kind === 'tab' ? page.getByRole('tab', { name: label }) :
      kind === 'chip' ? page.getByRole('button', { name: label, exact: true }) :
      page.getByText(label, { exact: true }).first();
    await target.click();
    await page.waitForTimeout(s.after ?? 500);
  }
  await page.screenshot({ path: join(outDir, `${s.name}.png`) });
  console.log(errors.length ? `✗ ${s.name}  ${errors.join(' | ')}` : `✓ ${s.name}`);
  await context.close();
}
await browser.close();
server.close();
