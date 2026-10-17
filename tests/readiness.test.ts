import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import vm from 'node:vm';
import {analyze} from '../src/pipeline';
import {buildReadiness,requiresAttention} from '../src/readiness';
import {AndroidUISchema,Issue} from '../src/schema';
import {generateCompose} from '../src/compose';
import {generateXML} from '../src/xml';
import {validate} from '../src/validator';
import {simpleComponent,fullScreen,pricingCard,validReadinessScreen,minorReadinessScreen,criticalDesignScreen,assetReadinessScreen,frameworkReadinessScreen} from './fixtures';
const state=(n:ReturnType<typeof analyze>,framework:'compose'|'xml'='compose')=>n.readiness.frameworks[framework];

test('a valid screen is Ready for Dev Review despite normal font/inset implementation notes',()=>{
 const out=analyze([validReadinessScreen()]);for(const f of ['compose','xml'] as const){const r=state(out,f);assert.equal(r.status,'READY FOR DEV REVIEW');assert.equal(r.primaryIds.length,0);assert.equal(r.generationBlockerCount,0);assert.ok(r.groups.some(g=>g.id==='font-resources'&&g.owner==='developer'));assert.ok(!r.checks.includes('Typography mapped'));}
});
test('minor warnings and speculative text scaling do not prevent handoff',()=>{
 const out=analyze([minorReadinessScreen()]);assert.equal(state(out).status,'READY FOR DEV REVIEW');assert.ok(state(out).optionalIds.includes('text-room'));assert.ok(state(out).optionalIds.includes('small-text'));assert.equal(state(out).primaryIds.length,0);
});
test('zero-size nonempty text is a confirmed critical designer action',()=>{
 const r=state(analyze([criticalDesignScreen()]));assert.equal(r.status,'NEEDS ATTENTION');assert.equal(r.criticalDesignerCount,1);const g=r.groups.find(g=>g.id==='unusable-bounds')!;assert.equal(g.level,'P0');assert.equal(g.owner,'designer-fix');assert.equal(g.evidence,'confirmed');assert.ok(requiresAttention(g));
});
test('unrepresented source artwork blocks generation while leaving design handoff responsibility separate',()=>{
 const out=analyze([assetReadinessScreen()]);for(const f of ['compose','xml'] as const){const r=state(out,f);assert.equal(r.status,'CANNOT GENERATE RELIABLY');assert.equal(r.designStatus,'READY FOR DEV REVIEW');assert.equal(r.primaryIds.length,0);assert.equal(r.criticalSource,'generator');assert.equal(r.groups.find(g=>g.id==='missing-artwork')!.owner,'generator');}
 assert.match(out.compose[0].content,/image_placeholder/);assert.ok(out.xml.some(f=>f.path.includes('image_placeholder')));
});
test('design actions remain explicit when critical generator limitations coexist',()=>{
 const n=assetReadinessScreen();Object.assign(n.children[0],{width:0,layoutSizingVertical:'FIXED',textAutoResize:'NONE'});
 const r=state(analyze([n]));assert.equal(r.status,'CANNOT GENERATE RELIABLY');assert.equal(r.designStatus,'NEEDS ATTENTION');assert.equal(r.criticalDesignerCount,1);assert.ok(r.primaryIds.includes('unusable-bounds'));assert.match(r.headline,/design action needs attention/);
});
test('declared clipping and visible overflow are now generated consistently for each framework',()=>{
 for(const clips of [true,false]){const out=analyze([frameworkReadinessScreen(clips)]);for(const f of ['compose','xml'] as const){assert.equal(state(out,f).status,'READY FOR DEV REVIEW');assert.ok(!state(out,f).groups.some(g=>['clipping-output','xml-default-clipping'].includes(g.id)));}assert.equal(out.compose[0].content.includes('.clip('),clips);assert.match(out.xml[0].content,new RegExp('android:clipChildren="'+clips+'"'));}
});
test('130 inert clipping flags are informational context, never 130 designer tasks',()=>{
 const card=simpleComponent();card.children=Array.from({length:130},(_,i)=>({id:'clip-'+i,name:'Frame '+i,type:'FRAME',x:0,y:0,width:100,height:100,clipsContent:true}));const out=analyze([card]);const r=state(out);assert.equal(r.status,'READY FOR DEV REVIEW');assert.equal(r.primaryIds.length,0);const grouped=r.groups.find(g=>g.id==='clipping-context')!;assert.equal(grouped.level,'P3');assert.equal(grouped.layerCount,130);assert.equal(grouped.diagnostics.length,130);assert.equal(out.readiness.audit.length,out.issues.length);
});
test('ordinary static nesting, component variants, variables and styles do not become missing decisions',()=>{
 const n=validReadinessScreen();n.layoutMode='NONE';n.clipsContent=true;n.children[0].componentProperties={};n.boundVariables={fills:[{type:'VARIABLE_ALIAS',id:'style'}]};n.fillStyleId='style';const r=state(analyze([n]));assert.equal(r.status,'READY FOR DEV REVIEW');assert.equal(r.primaryIds.length,0);assert.ok(r.groups.filter(g=>['system-insets','theme-notes','layout-notes'].includes(g.id)).every(g=>g.level==='P3'&&g.owner==='developer'));
});
test('declared navigation is developer work; an actual empty tap trigger needs a decision',()=>{
 const n=validReadinessScreen();n.reactions=[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:'next'}]}];assert.equal(state(analyze([n])).primaryIds.length,0);n.reactions[0].actions=[];const r=state(analyze([n]));assert.equal(r.status,'NEEDS ATTENTION');assert.ok(r.primaryIds.includes('undefined-action'));assert.equal(r.groups.find(g=>g.id==='undefined-action')!.owner,'designer-decision');
});
test('missing component alternatives are never inferred from a single selected variant',()=>{
 const n=pricingCard();n.variantProperties={State:'Selected'};const out=analyze([n]);assert.equal(state(out).primaryIds.length,0);assert.ok(!state(out).groups.some(g=>/unselected.*unclear|missing.*state/i.test(g.what)));
});
test('actual text lines exceeding a specified fixed height are important, unlike generic fixed dimensions',()=>{
 const n=validReadinessScreen();Object.assign(n.children[0],{characters:'Line one\nLine two',height:20,lineHeight:{unit:'PIXELS',value:24},layoutSizingVertical:'FIXED',textAutoResize:'NONE'});const r=state(analyze([n]));assert.equal(r.status,'NEEDS ATTENTION');assert.ok(r.primaryIds.includes('text-room'));assert.match(r.groups.find(g=>g.id==='text-room')!.what,/2 text lines at 24px.*20px/);
});
test('supported scroll contains off-screen content without per-descendant crop tasks',()=>{
 const n=fullScreen();const out=analyze([n]),scroll=out.schema.root.children.find(n=>n.id==='scroll')!;assert.equal(scroll.scrollSupported,true);const r=state(out);const crop=r.groups.find(g=>g.id==='cropped-content');assert.ok(!crop||crop.layers.every(l=>!l.path.includes('Scrollable content')));
});
test('unknown detector rules and generic generator details do not manufacture a critical designer task',()=>{
 const out=analyze([simpleComponent()]);const i:Issue={severity:'blocker',nodeId:out.schema.root.id,layer:'Card',explanation:'Unclassified property',impact:'Raw impact',fix:'Raw fix'};const report=buildReadiness(out.schema,[i]);assert.equal(report.frameworks.compose.status,'READY FOR DEV REVIEW');assert.equal(report.frameworks.compose.primaryIds.length,0);assert.equal(report.diagnosticCount,1);assert.equal(report.audit.length,1);
});
test('raw rule counts remain available while every primary action has confirmed designer-owned impact',()=>{
 const out=analyze([fullScreen()]);assert.deepEqual(['blocker','warning','confirmation','info'].map(s=>out.issues.filter(i=>i.severity===s).length),[4,1,18,1]);for(const f of ['compose','xml'] as const){const r=state(out,f);for(const id of r.primaryIds){const g=r.groups.find(g=>g.id===id)!;assert.ok(g.owner==='designer-fix'||g.owner==='designer-decision');assert.ok(g.level==='P0'||g.level==='P1'&&g.evidence==='confirmed');}}
});
test('Halloween regression uses the captured tree with generic rules, preserving diagnostics while verifying intentional generator upgrades',{skip:!existsSync('tests/fixtures/halloween-paywall.json')&&'private capture not included in the public repo'},()=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/halloween-paywall.json','utf8')) as {schema:AndroidUISchema;issues:Issue[];provenance:{nodeCount:number;generatedSha256:Record<string,string>}};
 const issues=validate(fixture.schema),report=buildReadiness(fixture.schema,issues);assert.equal(issues.length,fixture.issues.length);assert.equal(report.audit.length,issues.length);
 const genericAgain=buildReadiness({...fixture.schema,root:{...fixture.schema.root,name:'Renamed generic screen'}},issues);for(const f of ['compose','xml'] as const){assert.equal(genericAgain.frameworks[f].status,report.frameworks[f].status);assert.deepEqual(genericAgain.frameworks[f].primaryIds,report.frameworks[f].primaryIds);for(const id of report.frameworks[f].primaryIds)assert.ok(requiresAttention(report.frameworks[f].groups.find(g=>g.id===id)!));}
 const outputs=[...generateCompose(fixture.schema),...generateXML(fixture.schema)];for(const path of Object.keys(fixture.provenance.generatedSha256))assert.ok(outputs.some(f=>f.path===path),path);for(const file of outputs){const previous=fixture.provenance.generatedSha256[file.path];if(previous&&!file.path.endsWith('.kt')&&!file.path.includes('/layout/')&&!file.path.endsWith('dimens.xml'))assert.equal(createHash('sha256').update(file.content).digest('hex'),previous,file.path);}
 // Every raw detector occurrence has an explicit impact audit for each framework.
 assert.ok(report.audit.every(a=>a.compose.length&&a.xml.length));assert.ok(!('score'in report));
});
test('grouping never downgrades confirmed evidence when a potential occurrence appears first',()=>{
 const out=analyze([validReadinessScreen()]);const [first,second]=out.schema.root.children;
 first.sourceProperties.opacity=.5;second.y=300;
 const issue=(n:typeof first):Issue=>({ruleId:'text-contrast',severity:'warning',nodeId:n.id,layer:n.name,explanation:'Measured low contrast',impact:'Hard to read',fix:'Adjust colors'});
 const r=buildReadiness(out.schema,[issue(first),issue(second)]).frameworks.compose;
 assert.ok(r.primaryIds.includes('text-contrast'));assert.equal(r.groups.find(g=>g.id==='text-contrast')!.layerCount,2);assert.equal(r.groups.find(g=>g.id==='text-contrast')!.evidence,'confirmed');
});
test('locate-many retains the selected screen and reports stale references rather than silently dropping them',async()=>{
 const bundled=await build({entryPoints:['src/main.ts'],bundle:true,write:false,target:'es2017'}),selected=fullScreen(),messages:any[]=[],zooms:any[]=[];
 const host={showUI(){},currentPage:{selection:[selected]},ui:{postMessage:(m:any)=>messages.push(m),onmessage:undefined as any},on(){},getNodeByIdAsync:async(id:string)=>id==='deleted'?null:{id,type:'FRAME'},viewport:{scrollAndZoomIntoView:(nodes:any[])=>zooms.push(nodes.map(n=>n.id))}};
 vm.runInNewContext(bundled.outputFiles[0].text,{figma:host,__html__:''});await host.ui.onmessage({type:'locate-many',ids:['a','b','a']});assert.equal(JSON.stringify(zooms),JSON.stringify([['a','b']]));assert.equal(host.currentPage.selection[0],selected);await host.ui.onmessage({type:'locate-many',ids:['a','deleted']});assert.equal(messages[messages.length-1].type,'error');assert.equal(zooms.length,1);
});
