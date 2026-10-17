// DOM/message integration check, not a browser render or live Figma test.
import { readFile,writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {JSDOM}=await import(process.env.SHIM_JSDOM??'jsdom');
await build({stdin:{contents:"export {simpleComponent,fullScreen,assetReadinessScreen} from './tests/fixtures';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:'.test-build/ui-fixtures.mjs'});
const {simpleComponent,fullScreen,assetReadinessScreen}=await import('../.test-build/ui-fixtures.mjs');
const dom=new JSDOM(await readFile('dist/ui.html','utf8'),{runScripts:'outside-only',url:'https://shim.invalid/'}),w=dom.window;
const relay=new JSDOM('<!DOCTYPE html><p>Host relay</p>');
const posted=[],located=[],events={};let copied='',download,blob,sourceIsNull=false;
const lookup=id=>{let found;const visit=n=>{if(n.id===id)found=n;(n.children??[]).forEach(visit);};host.currentPage.selection.forEach(visit);return found;};
const host={showUI(){},currentPage:{selection:[simpleComponent()]},ui:{postMessage(m){w.dispatchEvent(new w.MessageEvent('message',{source:sourceIsNull?null:(process.env.SHIM_HOST_SOURCE==='relay'?relay.window:w),data:{pluginMessage:m}}));},onmessage:undefined},on:(event,fn)=>events[event]=fn,getNodeByIdAsync:async id=>lookup(id)??null,viewport:{scrollAndZoomIntoView:n=>located.push(n[0].id)}};
vm.runInNewContext(await readFile('dist/code.js','utf8'),{figma:host,__html__:'<html></html>'}); // Initial selection is deliberately dropped before UI listener.
w.postMessage=data=>{posted.push(data.pluginMessage);void host.ui.onmessage(data.pluginMessage);};
w.TextEncoder=TextEncoder;w.Blob=Blob;w.URL.createObjectURL=b=>{blob=b;return 'blob:shim';};w.URL.revokeObjectURL=()=>{};
w.HTMLAnchorElement.prototype.click=function(){download=this.download;};
Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
for(const script of w.document.querySelectorAll('script'))w.eval(script.textContent);
const el=id=>w.document.getElementById(id),tick=()=>new Promise(r=>setImmediate(r));
assert.equal(posted[0].type,'ready');assert.match(el('connection').textContent,/Figma connected/);assert.equal(el('analyze').disabled,false);assert.equal(el('selected').textContent,'Simple Component');
el('xml').click();assert.ok(el('xml').classList.contains('active'));el('compose').click();assert.ok(el('compose').classList.contains('active'));
el('analyze').click();await tick();assert.match(el('code').textContent,/fun SimpleComponent/);assert.equal(el('export').disabled,false);
const art=assetReadinessScreen(),image=art.children[art.children.length-1],png=new Uint8Array(await readFile('tests/fixtures/artwork.png'));image.parent={type:'FRAME',absoluteTransform:[[1,0,0],[0,1,0]]};image.absoluteBoundingBox={x:24,y:160,width:300,height:180};image.exportAsync=async settings=>{assert.equal(settings.format,'PNG');assert.equal(settings.constraint.value,2);return png;};
host.currentPage.selection=[art];events.selectionchange();el('analyze').click();await tick();assert.equal(el('status').textContent,'Ready for Dev Review');el('xml').click();const binary=[...el('files').options].find(o=>o.textContent.endsWith('.png'));assert.ok(binary);el('files').value=binary.value;el('files').dispatchEvent(new w.Event('change'));assert.match(el('code').textContent,/Binary artwork/);assert.equal(el('copy').disabled,true);el('export').click();await writeFile('.test-build/asset-ui-export.zip',Buffer.from(await blob.arrayBuffer()));el('compose').click();assert.equal(el('copy').disabled,false);
sourceIsNull=true;host.currentPage.selection=[fullScreen()];events.selectionchange();assert.equal(el('export').disabled,true);assert.equal(el('mode').value,'screen');
el('analyze').click();await tick();assert.match(el('overview').textContent,/23 nodes analyzed/);assert.match(el('status').textContent,/Cannot Generate Reliably/);assert.ok(w.document.querySelectorAll('#passed p').length>0);
el('xml').click();assert.match(el('code').textContent,/<ScrollView/);el('files').value='1';el('files').dispatchEvent(new w.Event('change'));assert.match(el('code').textContent,/<shape/);
el('copy').click();await tick();assert.equal(copied,el('code').textContent);
w.document.querySelector('#generation-list .locate-group').click();await tick();assert.equal(located.length,1);assert.ok(lookup(located[0]));
el('export').click();assert.equal(download,'shim-handoff.zip');await writeFile('.test-build/ui-export.zip',Buffer.from(await blob.arrayBuffer()));
const oldRequest=posted.findLast(m=>m.type==='analyze').requestId;
el('mode').value='component';el('mode').dispatchEvent(new w.Event('change'));assert.equal(el('export').disabled,true);
host.ui.postMessage({type:'result',requestId:oldRequest,result:{}});assert.equal(el('export').disabled,true); // Ignore stale result.
host.currentPage.selection=[{...simpleComponent(),width:NaN}];events.selectionchange();el('analyze').click();await tick();assert.equal(el('status').textContent,'Analysis failed');assert.equal(el('export').disabled,true);assert.match(el('message').textContent,/Invalid width/);
host.currentPage.selection=[];events.selectionchange();assert.equal(el('analyze').disabled,true);assert.equal(el('export').disabled,true);
console.log('UI DOM/message integration passed: startup handshake, A/C analysis, hierarchy overview, issue navigation, tabs/resources, copy, ZIP, mode reset, stale response rejection, and failed/empty selection.');
w.close();relay.window.close();
