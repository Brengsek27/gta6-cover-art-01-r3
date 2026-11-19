import { cpSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const source = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

for (const directory of ['app', 'screenshots']) {
  const sourcePath = realpathSync(join(source, directory));
  const destination = resolve(output, directory);
  const distance = relative(sourcePath, destination);
  if (distance === '' || (!distance.startsWith(`..${sep}`) && distance !== '..' && !distance.startsWith(sep))) {
    throw new Error(`Output must not replace or nest inside source ${directory}/`);
  }
}
buildDossier(source, caps);

mkdirSync(output, { recursive: true });
for (const directory of ['app', 'screenshots']) {
  const destination = join(output, directory);
  if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
  cpSync(join(source, directory), destination, { recursive: true });
}

const dossier = buildDossier(output, caps);
writeFileSync(join(output, 'dossier.json'), dossier);
console.log(`Neon Coast Studio packaged in ${output}`);
