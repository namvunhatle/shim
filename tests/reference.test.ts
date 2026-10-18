import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import vm from 'node:vm';
import {captureReference} from '../src/reference';
import {pngSize} from '../src/assets';
import {handoffFiles} from '../src/handoff';
import {analyzeWithAssets} from '../src/pipeline';
import {pricingCard} from './fixtures';
import {zip} from '../src/zip';
const png=new Uint8Array(readFileSync('tests/fixtures/artwork.png')),size=pngSize(png);
test('native reference is packaged as PNG, metadata excludes bytes, verification stays honest',async()=>{
 const card=pricingCard();const result=await analyzeWithAssets([card],{},async()=>png,async()=>png,size);
 assert.equal(result.reference?.status,'captured');
 const files=handoffFiles(result),reference=files.find(f=>f.path==='reference/figma.png')!;
 assert.deepEqual(Buffer.from(reference.content,'base64'),Buffer.from(png));assert.equal(reference.encoding,'base64');
 const manifest=JSON.parse(files.find(f=>f.path==='handoff-manifest.json')!.content);
 assert.equal(manifest.reference.widthPx,size.width);assert.equal(manifest.reference.scale,1);assert.ok(manifest.reference.capturedAt);assert.equal(manifest.reference.base64,undefined);
 assert.ok(manifest.files.includes('reference/figma.png'));assert.equal(result.verification.visualFidelity,'Not rendered or compared');
 // ZIP uses the decoded PNG bytes, not a base64 text file.
 const archive=Buffer.from(zip(files));assert.ok(archive.includes(Buffer.from(png)));
});
test('reference failures remain explicit while generated output remains available',async()=>{
 for(const exporter of [async()=>{throw new Error('Host refused export');},async()=>new Uint8Array([1,2]),async()=>png]){
  const result=await analyzeWithAssets([pricingCard()],{},async()=>png,exporter,{width:size.width+10,height:size.height});
  assert.equal(result.reference?.status,'unavailable');assert.ok(result.compose.length);
  const files=handoffFiles(result);assert.ok(!files.some(f=>f.path==='reference/figma.png'));assert.match(files.find(f=>f.path==='HANDOFF.md')!.content,/Unavailable:/);
 }
 let called=false;const ref=await captureReference(20_000,20_000,async()=>{called=true;return png;});assert.equal(ref.status,'unavailable');assert.equal(called,false);
});
test('design mutation during reference capture invalidates the whole snapshot',async()=>{
 const card=pricingCard();await assert.rejects(()=>analyzeWithAssets([card],{},async()=>png,async()=>{card.children[0].characters='Changed';return png;},size),/Design changed during artwork export or reference capture/);
});
test('Figma host captures selected root at 1x absolute bounds separately from artwork',async()=>{
 const bundled=await build({entryPoints:['src/main.ts'],bundle:true,write:false,target:'es2017'});
 const card:any=pricingCard(),settings:any[]=[];card.absoluteBoundingBox={x:0,y:0,...size};card.exportAsync=async(s:any)=>{settings.push(s);return png;};
 const messages:any[]=[];const host={showUI(){},currentPage:{selection:[card]},ui:{postMessage:(m:any)=>messages.push(m),onmessage:undefined as any},on(){}};
 vm.runInNewContext(bundled.outputFiles[0].text,{figma:host,__html__:''});
 await host.ui.onmessage({type:'analyze',selectionId:card.id,requestId:3});
 assert.equal(messages[messages.length-1].type,'result');assert.equal(messages[messages.length-1].result.reference.status,'captured');
 assert.equal(settings[0].constraint.value,1);assert.equal(settings[0].useAbsoluteBounds,true);assert.equal(settings[0].contentsOnly,true);
});
