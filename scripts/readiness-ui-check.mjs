// Built host + UI integration; JSDOM is supplied externally, not a plugin dependency.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const {JSDOM}=await import(process.env.SHIM_JSDOM??'jsdom');
await build({stdin:{contents:"export * from './tests/fixtures';",resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:'.test-build/readiness-fixture.mjs'});
const fixture=await import('../.test-build/readiness-fixture.mjs');
const dom=new JSDOM(await readFile('dist/ui.html','utf8'),{runScripts:'outside-only'}),w=dom.window;
const zooms=[],events={};let archive;
const host={showUI(){},currentPage:{selection:[]},ui:{postMessage:m=>w.dispatchEvent(new w.MessageEvent('message',{data:{pluginMessage:m}})),onmessage:undefined},on:(name,fn)=>events[name]=fn,getNodeByIdAsync:async id=>{let found;const visit=n=>{if(n.id===id)found=n;n.children?.forEach(visit);};host.currentPage.selection.forEach(visit);return found??null;},viewport:{scrollAndZoomIntoView:nodes=>zooms.push(nodes.map(n=>n.id))}};
vm.runInNewContext(await readFile('dist/code.js','utf8'),{figma:host,__html__:''});
w.postMessage=data=>{void host.ui.onmessage(data.pluginMessage);};w.TextEncoder=TextEncoder;w.Blob=Blob;w.URL.createObjectURL=b=>{archive=b;return 'blob:readiness';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
for(const script of w.document.querySelectorAll('script'))w.eval(script.textContent);
const tick=()=>new Promise(r=>setTimeout(r,5)),el=id=>w.document.getElementById(id);
async function analyze(n){host.currentPage.selection=[n];events.selectionchange();el('analyze').click();await tick();}
await analyze(fixture.validReadinessScreen());assert.equal(el('status').textContent,'Ready for Dev Review');assert.equal(el('issues').children.length,0);assert.equal(el('technical-report').open,false);assert.ok(el('positive-checks').children.length);
await analyze(fixture.minorReadinessScreen());assert.equal(el('status').textContent,'Ready for Dev Review');assert.equal(el('recommended').open,false);assert.equal(el('issues').children.length,0);assert.match(el('recommended-title').textContent,/optional improvements/);
await analyze(fixture.criticalDesignScreen());assert.equal(el('status').textContent,'Needs Attention');assert.match(el('readiness-counts').textContent,/critical: 1/);assert.equal(el('issues').children[0].dataset.owner,'designer-fix');el('review-next').click();await tick();assert.equal(el('issues').querySelector('details').open,true);
await analyze(fixture.assetReadinessScreen());assert.equal(el('status').textContent,'Cannot Generate Reliably');assert.equal(el('issues').children.length,0);assert.match(el('design-verdict').textContent,/Ready for Dev Review.*generator limitation/);assert.match(el('generation-alert').textContent,/1 critical generation limitation/);assert.equal(el('generation-limits').open,false);el('generation-alert').querySelector('button').click();assert.equal(el('generation-limits').open,true);
await analyze(fixture.frameworkReadinessScreen(true));assert.equal(el('status').textContent,'Ready for Dev Review');el('readiness-xml').click();assert.equal(el('status').textContent,'Ready for Dev Review');assert.equal(el('xml').classList.contains('active'),true);assert.match(el('code').textContent,/<FrameLayout/);el('compose').click();assert.equal(el('status').textContent,'Ready for Dev Review');assert.equal(el('readiness-compose').getAttribute('aria-pressed'),'true');
// Five distinct, evidence-backed actions exercise top-three disclosure.
const many=fixture.validReadinessScreen();const text=()=>structuredClone(fixture.pricingCard().children[0]);
const zero=text();Object.assign(zero,{id:'zero',width:0,layoutSizingVertical:'FIXED',textAutoResize:'NONE'});
const lines=text();Object.assign(lines,{id:'lines',characters:'one\ntwo',height:20,lineHeight:{unit:'PIXELS',value:24},layoutSizingVertical:'FIXED',textAutoResize:'NONE'});
const contrast=text();Object.assign(contrast,{id:'contrast',fills:[{type:'SOLID',color:{r:.95,g:.95,b:.95}}]});
const ambiguous=text();Object.assign(ambiguous,{id:'ambiguous',layoutSizingVertical:'FILL'});
const tap={id:'tap',name:'Declared trigger',type:'FRAME',width:80,height:50,reactions:[{trigger:{type:'ON_CLICK'},actions:[]}]};
many.type='COMPONENT';many.children=[zero,lines,contrast,ambiguous,tap];many.children.forEach((n,i)=>n.y=i*100);many.layoutSizingVertical='HUG';
await analyze(many);assert.equal(el('issues').children.length,5);assert.equal(el('issues').querySelectorAll('.finding-card:not([hidden])').length,3);assert.match(el('summary').textContent,/5 things to address/);assert.match(el('readiness-counts').textContent,/critical: 1/);assert.doesNotMatch(el('readiness-counts').textContent,/to address/);assert.equal(el('issues').children[0].dataset.level,'P0');el('show-all').click();assert.equal(el('issues').querySelectorAll('.finding-card:not([hidden])').length,5);
const selected=fixture.simpleComponent();selected.children=Array.from({length:130},(_,i)=>({id:'clip-'+i,name:'Clipped '+i,type:'FRAME',x:0,y:0,width:100,height:100,clipsContent:true}));
await analyze(selected);assert.equal(el('status').textContent,'Ready for Dev Review');assert.equal(el('issues').children.length,0);assert.equal(el('developer-notes').open,false);
const group=el('finding-clipping-context');assert.match(group.textContent,/130 layers/);assert.equal(group.dataset.level,'P3');assert.equal(group.querySelectorAll('.layer-button').length,0);
group.querySelector('.action-detail').open=true;await tick();assert.equal(group.querySelectorAll('.layer-button').length,130);
const search=group.querySelector('input');search.value='Clipped 129';search.dispatchEvent(new w.Event('input'));assert.equal(group.querySelectorAll('.layer-button:not([hidden])').length,1);
group.querySelector('.locate-group').click();await tick();assert.equal(zooms.at(-1).length,130);assert.equal(host.currentPage.selection[0],selected);assert.equal(el('export').disabled,false);group.querySelectorAll('.layer-button')[129].click();await tick();assert.equal(JSON.stringify(zooms.at(-1)),JSON.stringify(['clip-129']));
group.querySelector('.technical-link').click();await tick();assert.equal(el('raw-diagnostics').querySelectorAll('.diagnostic').length,130);el('technical-report').querySelector('.restore-diagnostics').click();assert.equal(el('raw-diagnostics').querySelectorAll('.diagnostic').length,131);
el('export').click();await writeFile('.test-build/readiness-export.zip',Buffer.from(await archive.arrayBuffer()));
console.log('Critical-first UI passed: ready/minor/critical/asset states; framework/code tab sync; top 3 of 5 actions; generation blockers visible; 130 searchable/locatable layers; complete diagnostic restore and ZIP export.');w.close();
