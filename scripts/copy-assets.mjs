import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
const target = path.join(root, 'dist', 'renderer');

await mkdir(target, { recursive: true });

for (const file of ['index.html', 'styles.css', 'package.json']) {
  await copyFile(path.join(source, file), path.join(target, file));
}
