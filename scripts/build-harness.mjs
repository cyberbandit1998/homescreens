// Bundles the test harness (harness/main.tsx) into harness/out/. The plugin
// bundle itself comes from `npm run build`; this only builds the stand-in page.
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'harness', 'out');
await mkdir(out, { recursive: true });

await build({
  entryPoints: [join(root, 'harness', 'main.tsx')],
  outfile: join(out, 'harness.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
await copyFile(join(root, 'harness', 'index.html'), join(out, 'index.html'));
console.log('harness built:', out);
