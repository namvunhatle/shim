// Execute dist/ui.html as HTML, including inline scripts: do not bypass browser parsing with eval.
const { JSDOM, VirtualConsole } = await import(process.env.SHIM_JSDOM??'jsdom');
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=await readFile('dist/ui.html','utf8'),main=await readFile('dist/code.js','utf8');
const relay=new JSDOM('<!DOCTYPE html><p>Host relay</p>');
for(const scenario of ['relay','no-host','script-error']){
 let ui;const sent=[],timers=[],errors=[];
 const host={showUI(){},currentPage:{selection:[{id:'screen',name:'Live-style selected screen',type:'FRAME',width:390,height:844}]},ui:{postMessage(m){if(ui)ui.dispatchEvent(new ui.MessageEvent('message',{source:relay.window,data:{pluginMessage:m}}));},onmessage:undefined},on(){}};
 vm.runInNewContext(main,{figma:host,__html__:html});
 const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(scenario==='script-error'?html.replace('<script>"use strict";','<script>throw new Error("synthetic UI boot failure");'):html,{runScripts:'dangerously',virtualConsole:console,beforeParse(w){
  ui=w;w.TextEncoder=TextEncoder;w.setTimeout=fn=>{timers.push(fn);return timers.length;};w.clearTimeout=()=>{};
  w.postMessage=data=>{sent.push(data.pluginMessage);if(scenario==='relay')void host.ui.onmessage(data.pluginMessage);};
 }});
 const el=id=>ui.document.getElementById(id);
 if(scenario==='relay'){
  assert.match(el('connection').textContent,/Figma connected · 0.5.0/);assert.equal(el('selected').textContent,'Live-style selected screen');assert.equal(el('analyze').disabled,false);assert.equal(errors.length,0);
 }else if(scenario==='no-host'){
  timers.forEach(fn=>fn());assert.equal(el('connection').textContent,'No response from Figma');assert.match(el('message').textContent,/host has not replied/);el('xml').click();assert.ok(el('xml').classList.contains('active'));el('refresh').click();assert.equal(sent.length,2);assert.equal(errors.length,0);
 }else{
  assert.equal(el('connection').textContent,'UI startup/runtime error');assert.match(el('message').textContent,/synthetic UI boot failure/);assert.equal(errors.length,1);
 }
 dom.window.close();
}
relay.window.close();
console.log('Built HTML boot checks passed: relay selection enables Analyze, missing host is visible/retryable, and script failures show their exact error.');
