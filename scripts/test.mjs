import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const entries=(await readdir('tests')).filter(f=>f.endsWith('.test.ts')).map(f=>'tests/'+f);
await build({entryPoints:entries,bundle:true,packages:'external',platform:'node',format:'esm',outdir:'.test-build',outExtension:{'.js':'.mjs'}});
const result=spawnSync(process.execPath,['--test',...entries.map(f=>f.replace('tests/','.test-build/').replace('.ts','.mjs'))],{stdio:'inherit'});
process.exitCode=result.status??1;
