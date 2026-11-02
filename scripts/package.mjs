// Builds the installable plugin: release/plugin.tar.gz (+ .sha256).
//
// Home Screens extracts a plugin tarball with `tar -xzf --strip-components=1`,
// so every file must sit inside ONE top-level folder. It then needs
// manifest.json and dist/bundle.js. This script builds that layout, then
// proves it the way the host will read it: extract it the same way, validate
// the manifest's hard requirements, and run the bundle in a bare context to
// confirm it exports a component.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const folder = manifest.id;
const out = join(root, 'release');

execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
const stage = join(out, '.stage', folder);
mkdirSync(join(stage, 'dist'), { recursive: true });
cpSync(join(root, 'manifest.json'), join(stage, 'manifest.json'));
cpSync(join(root, 'dist', 'bundle.js'), join(stage, 'dist', 'bundle.js'));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
writeFileSync(
  join(stage, 'README.txt'),
  `${manifest.name} ${manifest.version}\nA plugin for Home Screens. Install it from the editor: Plugins > Install from URL, or copy this folder to data/plugins/${folder}/ on the hub.\nSource and docs: https://github.com/cyberbandit1998/homescreens\n`,
);

// Reproducible archive: sorted names, fixed owner and time, no gzip timestamp.
const tarball = join(out, 'plugin.tar.gz');
const tarArgs = ['--sort=name', '--owner=0', '--group=0', '--numeric-owner', '--mtime=2026-01-01 00:00:00 UTC', '-cf', '-', '-C', join(out, '.stage'), folder];
const tar = execFileSync('tar', tarArgs, { maxBuffer: 64 * 1024 * 1024 });
const gz = execFileSync('gzip', ['-n', '-9'], { input: tar, maxBuffer: 64 * 1024 * 1024 });
writeFileSync(tarball, gz);
rmSync(join(out, '.stage'), { recursive: true, force: true });

const sha = createHash('sha256').update(gz).digest('hex');
writeFileSync(`${tarball}.sha256`, `${sha}  plugin.tar.gz\n`);

// ── Verify it the way the host will read it ──────────────────────────────────
const probe = mkdtempSync(join(tmpdir(), 'fwc-verify-'));
try {
  execFileSync('tar', ['-xzf', tarball, '-C', probe, '--strip-components=1']);
  for (const f of ['manifest.json', 'dist/bundle.js']) {
    if (!existsSync(join(probe, f))) throw new Error(`tarball is missing ${f} after --strip-components=1`);
  }
  const m = JSON.parse(readFileSync(join(probe, 'manifest.json'), 'utf8'));
  if (!/^[A-Za-z0-9_-]+$/.test(m.id)) throw new Error(`bad id ${m.id}`);
  for (const k of ['name', 'version', 'moduleType', 'category']) {
    if (typeof m[k] !== 'string' || !m[k]) throw new Error(`manifest.${k} must be a non-empty string`);
  }

  // Run the bundle like the host's inline <script>: React as a global, exports on window.__HS_PLUGIN__.
  const sandbox = { window: {}, React: { createElement() {}, useState() {} }, document: {}, navigator: { language: 'en-US' } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(probe, 'dist', 'bundle.js'), 'utf8'), sandbox, { filename: 'bundle.js' });
  const exported = sandbox.__HS_PLUGIN__ ?? sandbox.window.__HS_PLUGIN__;
  const component = exported?.[m.exports?.component ?? 'default'];
  if (typeof component !== 'function') throw new Error('bundle did not export a component function');

  console.log(`\nPackaged ${tarball}`);
  console.log(`  ${m.name} ${m.version}  (${(gz.length / 1024).toFixed(1)} KB)`);
  console.log(`  sha256 ${sha}`);
  console.log('  verified: extracts with --strip-components=1, manifest valid, bundle exports a component');
} finally {
  rmSync(probe, { recursive: true, force: true });
}
