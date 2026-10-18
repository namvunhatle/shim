// Regenerate a saved native capture with current code, preserving its captured artwork.
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const [input,output]=process.argv.slice(2);if(!input||!output)throw new Error('Usage: node scripts/refresh-handoff.mjs capture.zip output.zip');
const unpack=spawnSync('python3',['-c',"import zipfile,json,sys,hashlib,base64;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(json.dumps({'schema':json.loads(z.read('android-ui-schema.json')),'reference':json.loads(z.read('handoff-manifest.json')).get('reference') if 'handoff-manifest.json' in z.namelist() else None,'referenceBase64':base64.b64encode(z.read('reference/figma.png')).decode() if 'reference/figma.png' in z.namelist() else None,'sourceArchiveSha256':hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest()}))",input],{encoding:'utf8',maxBuffer:64_000_000});if(unpack.status!==0)throw new Error(unpack.stderr);
await build({stdin:{contents:"export {analyzeSchema} from './src/pipeline';export {zip} from './src/zip';export {handoffFiles} from './src/handoff';export {captureReference} from './src/reference';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-build/refresh.mjs'});
const {analyzeSchema,zip,handoffFiles,captureReference}=await import('../.test-build/refresh.mjs'),capture=JSON.parse(unpack.stdout),result=analyzeSchema(capture.schema);
if(capture.reference?.status==='captured'){
 const metadata=capture.reference;
 const reference=await captureReference(metadata.bounds?.width,metadata.bounds?.height,async()=>Buffer.from(capture.referenceBase64??'','base64'));
 if(reference.status==='captured')reference.capturedAt=metadata.capturedAt;
 result.reference=reference;
}else if(capture.reference?.status==='unavailable')result.reference=capture.reference;
const provenance={source:'Saved native Figma capture, regenerated with current generator; no new source artwork was invented.',sourceArchiveSha256:capture.sourceArchiveSha256,generatorVersion:JSON.parse(await readFile('package.json','utf8')).version};
const files=handoffFiles(result);
const report=files.find(f=>f.path==='readiness.json');report.content=JSON.stringify({...JSON.parse(report.content),provenance},null,2);
await writeFile(output,zip(files));
console.log(JSON.stringify({output,artwork:result.overview.artwork,sourceArchiveSha256:provenance.sourceArchiveSha256,statuses:Object.fromEntries(Object.entries(result.readiness.frameworks).map(([k,v])=>[k,v.status]))},null,2));
