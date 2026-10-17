import { build } from 'esbuild';
import { mkdir, writeFile, rm } from 'node:fs/promises';
await build({stdin:{contents:"export { analyze } from './src/pipeline'; export { pricingCard, simpleComponent, nestedComponent, fullScreen } from './tests/fixtures'; export { zip } from './src/zip';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-build/example.mjs'});
const {analyze,pricingCard,simpleComponent,nestedComponent,fullScreen,zip}=await import('../.test-build/example.mjs');
for(const [folder,fixture] of [['pricing-card',pricingCard],['a-simple',simpleComponent],['b-nested',nestedComponent],['c-screen',fullScreen]]){
 await rm(`examples/${folder}`,{recursive:true,force:true});
 const input=fixture(),result=analyze([input]);
 for(const file of [...result.compose,...result.xml,{path:'readiness.json',content:JSON.stringify({overview:result.overview,assumptions:result.schema.assumptions,issues:result.issues,handoff:result.readiness,passed:result.passed,verification:result.verification},null,2)},{path:'android-ui-schema.json',content:JSON.stringify(result.schema,null,2)},{path:'figma-fixture.json',content:JSON.stringify(input,null,2)}]){
  const path=`examples/${folder}/${file.path}`;await mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await writeFile(path,file.content);
 }
 if(folder==='pricing-card')await writeFile('.test-build/pricing-card.zip',zip([...result.compose,...result.xml]));
}
