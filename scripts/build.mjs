import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({entryPoints:['src/main.ts'],bundle:true,outfile:'dist/code.js',target:'es2017'});
const ui = await build({entryPoints:['src/ui.ts'],bundle:true,write:false,target:'es2020'});
await writeFile('dist/ui.html',(await readFile('src/ui.html','utf8')).replace('/* UI_SCRIPT */',()=>ui.outputFiles[0].text));
