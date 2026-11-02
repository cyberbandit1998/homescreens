// Behavior checks in a real browser, against the stand-in harness page.
//   node scripts/browser-check.mjs
// Needs `npm run build` and `npm run harness` first, and Playwright's Chromium.
// The browser runs in UTC on purpose (a stock Raspberry Pi), with a frozen clock of
// Monday 2 Nov 2026, 9:00 am in Chicago, so the household time zone is exercised.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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
const NOW = new Date('2026-11-02T15:00:00Z');
const browser = await chromium.launch();

let failures = 0;
const consoleErrors = [];

async function open(query = '', { w = 1040, h = 760, flowing = false } = {}) {
  const context = await browser.newContext({ viewport: { width: w + 32, height: h + 32 }, timezoneId: 'UTC', locale: 'en-US' });
  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/status of 500|Failed to load resource/.test(m.text()) && consoleErrors.push(m.text()));
  // Fixed time makes screenshots repeatable; `flowing` starts from the same moment but lets it advance.
  await (flowing ? page.clock.setSystemTime(NOW) : page.clock.setFixedTime(NOW));
  await page.goto(`${base}/?w=${w}&h=${h}&${query}`);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(350);
  return { page, context, calls: () => page.evaluate(() => window.__calls) };
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`✗ ${name}\n    ${String(err.message ?? err).split('\n').slice(0, 4).join('\n    ')}`);
  }
}

function eq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(cond, what) {
  if (!cond) throw new Error(what);
}
const title = (page) => page.locator('.fwc-title').innerText();
const normalize = (s) => s.replace(/[   ]/g, ' ');

// ── Navigation ───────────────────────────────────────────────────────────────
await check('week view: title, next, previous and Today', async () => {
  const { page, context } = await open();
  eq(normalize(await title(page)), 'Nov 1 – 7, 2026', 'initial title');
  await page.getByRole('button', { name: 'Next' }).click();
  eq(normalize(await title(page)), 'Nov 8 – 14, 2026', 'after next');
  ok((await page.getByRole('button', { name: 'Go to today' }).getAttribute('aria-disabled')) === 'false', 'Today is active away from today');
  await page.getByRole('button', { name: 'Go to today' }).click();
  eq(normalize(await title(page)), 'Nov 1 – 7, 2026', 'after Today');
  ok((await page.getByRole('button', { name: 'Go to today' }).getAttribute('aria-disabled')) === 'true', 'Today rests on today');
  await page.getByRole('button', { name: 'Previous' }).click();
  eq(normalize(await title(page)), 'Oct 25 – 31, 2026', 'after previous');
  await context.close();
});

await check('month view: pages to December, asks the hub for a new window, tapping a day opens it', async () => {
  const { page, context, calls } = await open('cfg.defaultView=month');
  eq(await title(page), 'November 2026', 'month title');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(300);
  eq(await title(page), 'December 2026', 'next month');
  const urls = new Set((await calls()).filter((c) => c.url.startsWith('/api/calendar')).map((c) => c.url));
  ok(urls.size >= 2, `a new calendar window was requested (saw ${urls.size})`);
  await page.getByRole('button', { name: 'Go to today' }).click();
  await page.waitForTimeout(300);
  // Aim at the tile's empty corner: event bars sit on top of its centre.
  await page.getByRole('button', { name: /^Thursday, November 5/ }).click({ position: { x: 6, y: 6 } });
  eq(await title(page), 'Thursday, November 5', 'day view title');
  await context.close();
});

await check('household time zone: a 9 am Chicago event shows at 9 am in a UTC browser', async () => {
  // Narrow columns use short times ("9a"); a wide module has room for the full "9:00 AM".
  const narrow = await open();
  const short = await narrow.page.getByRole('button', { name: /^Dentist: Leo/ }).first().innerText();
  ok(/9a – 10a/.test(short), `short form (got ${JSON.stringify(short)})`);
  await narrow.context.close();
  const wide = await open('', { w: 1700, h: 760 });
  const full = await wide.page.getByRole('button', { name: /^Dentist: Leo/ }).first().innerText();
  ok(/9:00\sAM\s–\s10:00\sAM/.test(full), `full form (got ${JSON.stringify(full)})`);
  await wide.context.close();
});

await check('an overnight event appears on both days it covers', async () => {
  const { page, context } = await open('', { w: 1700, h: 760 });
  const fri = await page.locator('section[aria-label="Friday, November 6"]').innerText();
  const sat = await page.locator('section[aria-label="Saturday, November 7"]').innerText();
  ok(/Sleepover/.test(fri) && /From 10:00/.test(fri.replace(/\s+/g, ' ')), 'Friday shows the start');
  ok(/Sleepover/.test(sat) && /Until 6:00/.test(sat.replace(/\s+/g, ' ')), 'Saturday shows the end');
  await context.close();
});

await check('day view: hour labels line up with the grid and with events', async () => {
  const { page, context } = await open('cfg.defaultView=day');
  const dentist = await page.getByRole('button', { name: /^Dentist: Leo/ }).boundingBox();
  const label = await page.locator('.fwc-hour', { hasText: /^9 AM$/ }).boundingBox();
  const line = await page.locator('.fwc-now').boundingBox();
  const labelMid = label.y + label.height / 2;
  ok(Math.abs(labelMid - dentist.y) < 4, `9 AM label (${labelMid.toFixed(1)}) sits at the 9:00 event top (${dentist.y.toFixed(1)})`);
  ok(Math.abs(line.y - dentist.y) < 4, `the now line (${line.y.toFixed(1)}) is at 9:00 too`);
  await context.close();
});

// ── Family filter ────────────────────────────────────────────────────────────
await check('family filter: choose a person, then go back to everyone', async () => {
  const { page, context } = await open();
  ok(await page.getByRole('button', { name: /^Dentist: Leo/ }).count() > 0, 'Leo event visible to start');
  await page.getByRole('button', { name: 'Mia', exact: true }).click();
  eq(await page.getByRole('button', { name: /^Dentist: Leo/ }).count(), 0, "Leo's event hidden when Mia is chosen");
  ok(await page.getByRole('button', { name: /^Soccer practice/ }).count() > 0, "Mia's event stays");
  ok(await page.getByRole('button', { name: /^Dinner at Grandma/ }).count() > 0, 'shared family events stay');
  eq(await page.getByRole('button', { name: 'Mia', exact: true }).getAttribute('aria-pressed'), 'true', 'chip is pressed');
  await page.getByRole('button', { name: 'Everyone' }).click();
  ok(await page.getByRole('button', { name: /^Dentist: Leo/ }).count() > 0, 'Leo event returns');
  await context.close();
});

// ── Event sheet ──────────────────────────────────────────────────────────────
await check('event sheet: opens with details, closes on Escape and returns focus', async () => {
  const { page, context } = await open();
  const trigger = page.getByRole('button', { name: /^Dentist: Leo/ }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Dentist: Leo' });
  await dialog.waitFor();
  const text = await dialog.innerText();
  ok(/Smile Pediatric Dentistry/.test(text), 'shows the location');
  ok(/Bring the insurance card\.\s*\n?\s*Appointment is a 6 month check-up & cleaning\./.test(text), 'shows the description as plain text');
  ok(/Leo/.test(text), 'names whose event it is');
  eq(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close', 'focus moved into the sheet');
  await page.keyboard.press('Escape');
  eq(await page.getByRole('dialog').count(), 0, 'sheet closed');
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Dentist: Leo')), 'focus returned to the event');
  await context.close();
});

await check('event sheet: tapping outside closes it', async () => {
  const { page, context } = await open();
  await page.getByRole('button', { name: /^Dentist: Leo/ }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.locator('.fwc-scrim').click({ position: { x: 20, y: 20 } });
  eq(await page.getByRole('dialog').count(), 0, 'sheet closed');
  await context.close();
});

// ── Chores ───────────────────────────────────────────────────────────────────
await check('chores: tap to tick shows instantly, saves the right thing, and un-ticks', async () => {
  const { page, context, calls } = await open();
  await page.getByRole('tab', { name: 'Chores' }).click();
  await page.getByRole('checkbox', { name: /Practice violin/ }).waitFor();
  ok(/2 of 4 done/.test(await page.locator('section[aria-label="Mia"]').innerText()), 'Mia starts 2 of 4');
  const box = page.getByRole('checkbox', { name: /Practice violin/ });
  await box.click();
  eq(await box.getAttribute('aria-checked'), 'true', 'ticked straight away');
  await page.waitForTimeout(400);
  const posts = (await calls()).filter((c) => c.method === 'POST');
  eq(posts.length, 1, 'one save');
  eq(JSON.stringify(posts[0].body), JSON.stringify({ choreId: 'c3', memberId: 'mia', date: '2026-11-02', direction: 'complete' }), 'save body');
  ok(/3 of 4 done/.test(await page.locator('section[aria-label="Mia"]').innerText()), 'progress updated');
  await page.getByRole('checkbox', { name: /Practice violin/ }).click();
  await page.waitForTimeout(400);
  const last = (await calls()).filter((c) => c.method === 'POST').pop();
  eq(last.body.direction, 'uncomplete', 'second tap un-ticks');
  await context.close();
});

await check('chores: a failed save reverts the tick and says so', async () => {
  const { page, context } = await open('postfail=1');
  await page.getByRole('tab', { name: 'Chores' }).click();
  const box = page.getByRole('checkbox', { name: /Practice violin/ });
  await box.click();
  await page.getByRole('alert').waitFor();
  eq(await page.getByRole('alert').innerText(), "Couldn't save that. Please try again.", 'message');
  eq(await page.getByRole('checkbox', { name: /Practice violin/ }).getAttribute('aria-checked'), 'false', 'reverted');
  await context.close();
});

await check('chores: read-only mode has nothing to tap', async () => {
  const { page, context } = await open('cfg.choresTappable=false');
  await page.getByRole('tab', { name: 'Chores' }).click();
  await page.getByRole('checkbox', { name: 'Practice violin' }).waitFor();
  eq(await page.locator('button[role="checkbox"]').count(), 0, 'no tappable chores');
  await context.close();
});

await check('chores tab can be switched off', async () => {
  const { page, context } = await open('cfg.showChores=false');
  eq(await page.getByRole('tab', { name: 'Chores' }).count(), 0, 'no Chores tab');
  await context.close();
});

// ── Wall behavior and states ─────────────────────────────────────────────────
await check('after a quiet spell the wall returns to today and the starting view', async () => {
  const { page, context } = await open('cfg.returnToTodaySeconds=1', { flowing: true });
  await page.getByRole('tab', { name: 'Month' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  eq(await title(page), 'December 2026', 'moved away');
  await page.waitForFunction(() => /Nov/.test(document.querySelector('.fwc-title')?.textContent ?? ''), null, { timeout: 15000 });
  eq(normalize(await title(page)), 'Nov 1 – 7, 2026', 'back on this week');
  await context.close();
});

await check('no calendar yet: a friendly card, and the hub is never asked for events', async () => {
  const { page, context, calls } = await open('setup=1');
  ok(await page.getByText('Connect a calendar').isVisible(), 'setup card shown');
  eq((await calls()).filter((c) => c.url.startsWith('/api/calendar')).length, 0, 'no calendar requests');
  await context.close();
});

await check('hub unreachable: says so plainly instead of showing an empty week', async () => {
  const { page, context } = await open('fail=1');
  await page.getByText(/Can.t reach your calendar/).waitFor();
  eq(await page.getByText('Nothing planned').count(), 0, 'no false "nothing planned"');
  await context.close();
});

await check('a calendar that stops updating is flagged in words', async () => {
  const { page, context } = await open('sourcebad=1');
  await page.getByText(/Not updating: Mia/).waitFor();
  await context.close();
});

await check('a failing calendar known only by its id gets its name from its events', async () => {
  const { page, context } = await open('sourcebad=2');
  await page.getByText("Not updating: Mia's calendar").waitFor();
  await context.close();
});

await check('a failing calendar nobody can name never shows a raw id', async () => {
  const { page, context } = await open('sourcebad=3');
  await page.getByText(/A calendar isn.t updating/).waitFor();
  const text = await page.locator('.fwc').innerText();
  ok(!text.includes('1d1a1e606c47'), 'no hash shown');
  ok(text.includes('Could not reach the link'), "the hub's own reason is shown");
  await context.close();
});

await check('other languages and a 24-hour clock', async () => {
  const { page, context } = await open('locale=de-DE&tf=24h&cfg.defaultView=schedule');
  const text = await page.locator('.fwc').innerText();
  ok(/15:30/.test(text), '24-hour time');
  ok(/Mo\.?,?\s/.test(text) || /Montag|Mo\./.test(text) || /Nov/.test(text), 'German date format');
  await context.close();
});

// ── Accessibility (axe, WCAG 2.x A and AA) ───────────────────────────────────
const axeScenarios = [
  ['week', 'cfg.defaultView=week'],
  ['day', 'cfg.defaultView=day'],
  ['month', 'cfg.defaultView=month'],
  ['schedule', 'cfg.defaultView=schedule'],
  ['week (dark)', 'bg=dark'],
  ['month (dark)', 'bg=dark&cfg.defaultView=month'],
  ['narrow week', 'cfg.defaultView=week'],
];
for (const [name, query] of axeScenarios) {
  await check(`accessibility (axe): ${name}`, async () => {
    const narrow = name.startsWith('narrow');
    const { page, context } = await open(query, narrow ? { w: 560, h: 900 } : {});
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(() =>
      window.axe.run(document.querySelector('.fwc'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }),
    );
    const bad = result.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0].failureSummary?.split('\n')[1] ?? ''}`);
    ok(bad.length === 0, bad.join('\n    '));
    await context.close();
  });
}

await check('accessibility (axe): chores and the event sheet', async () => {
  const { page, context } = await open();
  // Reduced motion also tests that path, and keeps axe from measuring the sheet mid-fade.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addScriptTag({ path: axePath });
  const run = () => page.evaluate(() => window.axe.run(document.querySelector('.fwc'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
  await page.getByRole('button', { name: /^Dentist: Leo/ }).first().click();
  await page.getByRole('dialog').waitFor();
  let r = await run();
  ok(r.violations.length === 0, 'event sheet: ' + r.violations.map((v) => v.id).join(', '));
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Chores' }).click();
  await page.getByRole('checkbox', { name: /Practice violin/ }).waitFor();
  r = await run();
  ok(r.violations.length === 0, 'chores: ' + r.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`).join(', '));
  await context.close();

  const ro = await open('cfg.choresTappable=false');
  await ro.page.emulateMedia({ reducedMotion: 'reduce' });
  await ro.page.addScriptTag({ path: axePath });
  await ro.page.getByRole('tab', { name: 'Chores' }).click();
  await ro.page.getByRole('checkbox', { name: 'Practice violin' }).waitFor();
  r = await ro.page.evaluate(() => window.axe.run(document.querySelector('.fwc'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
  ok(r.violations.length === 0, 'read-only chores: ' + r.violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 80)}`).join(', '));
  await ro.context.close();
});

await check('no script errors in any scenario', async () => {
  ok(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
});

await browser.close();
server.close();
console.log(failures === 0 ? '\nAll browser checks passed.' : `\n${failures} browser check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
