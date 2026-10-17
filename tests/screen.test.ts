import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { analyze } from '../src/pipeline';
import { DesignNode, parseSelection } from '../src/parser';
import { UINode, walk } from '../src/schema';
import { simpleComponent, nestedComponent, fullScreen, pricingCard } from './fixtures';

function pairs(n:DesignNode|UINode,parent?:string):string[]{return [`${n.id}|${parent??''}`,...(n.children??[]).filter((c:DesignNode|UINode)=>!('visible'in c)||c.visible!==false).flatMap((c:DesignNode|UINode)=>pairs(c,n.id))];}
function kotlinStructure(code:string){
 const stack:string[]=[];let state='code';
 for(let i=0;i<code.length;i++){const c=code[i],next=code[i+1];
  if(state==='line'){if(c==='\n')state='code';continue;}
  if(state==='string'){if(c==='\\'){i++;continue;}if(c==='"')state='code';continue;}
  if(state==='block'){if(c==='*'&&next==='/'){i++;state='code';}continue;}
  if(c==='/'&&next==='/'){state='line';i++;continue;}if(c==='/'&&next==='*'){state='block';i++;continue;}if(c==='"'){state='string';continue;}
  if('({['.includes(c))stack.push(c);if(')}]'.includes(c))assert.equal(stack.pop(),'({['[')}]'.indexOf(c)]);
 }assert.equal(stack.length,0);assert.ok(['code','line'].includes(state));assert.doesNotMatch(code,/\b(NaN|Infinity|undefined)\b/);
}
for(const [name,fixture] of [['A / simple',simpleComponent],['B / nested',nestedComponent],['C / screen',fullScreen]] as const){
 test(`${name}: every visible node and parent relationship survives parsing and both generators`,()=>{
  const input=fixture(),out=analyze([input]);assert.deepEqual(pairs(out.schema.root),pairs(input));assert.equal(out.overview.total,pairs(input).length);assert.equal(out.overview.supported+out.overview.unsupported,out.overview.total);
  const ids=new Set(pairs(input).map(p=>p.split('|')[0]));for(const issue of out.issues){assert.ok(ids.has(issue.nodeId));assert.ok(issue.impact.length>0);assert.ok(issue.fix.length>0);}
  assert.ok(out.passed.length>0);assert.equal(out.verification.status,'Not build verified');
  kotlinStructure(out.compose[0].content);walk(out.schema.root,n=>assert.ok(out.compose[0].content.includes(`// Figma node ${n.id}:`),n.id));
  const xml=spawnSync('python3',['scripts/verify-xml.py'],{input:JSON.stringify({schema:out.schema,files:out.xml}),encoding:'utf8'});assert.equal(xml.status,0,xml.stderr||xml.error?.message);
  if(name!=='C / screen')assert.equal(out.issues.filter(i=>i.severity==='blocker').length,0);
 });
}
test('screen maps explicit scroll, instances, groups, images; unsupported visuals are not lost',()=>{
 const out=analyze([fullScreen()]);const nodes:UINode[]=[];walk(out.schema.root,n=>nodes.push(n));
 assert.equal(nodes.find(n=>n.id==='scroll')!.scrollSupported,true);assert.equal(nodes.find(n=>n.id==='header/icon')!.kind,'container');assert.equal(nodes.find(n=>n.id==='button')!.component?.instance,true);
 const hero=nodes.find(n=>n.id==='hero')!;assert.equal(hero.kind,'image');assert.equal(hero.image?.hash,'fixture-image-hash');
 assert.match(out.compose[0].content,/verticalScroll\(rememberScrollState\(\)\)/);assert.match(out.xml[0].content,/<ScrollView/);assert.match(out.xml[0].content,/<ImageView/);assert.match(out.compose[0].content,/private fun PlanCardPart/);assert.match(out.compose[0].content,/fillMaxSize\(\)/);
 for(const [id,property] of [['hero','Image asset'],['header/vector','VECTOR'],['two/card','effects'],['footer','GRADIENT_LINEAR']])assert.ok(out.issues.some(i=>i.nodeId===id&&i.severity==='blocker'&&i.explanation.includes(property)),id);
 assert.ok(out.issues.some(i=>i.nodeId==='button'&&i.explanation.includes('target')));assert.ok(out.issues.some(i=>i.severity==='confirmation'&&i.explanation.includes('WindowInsets')));
 assert.ok(out.xml.some(f=>f.path.includes('image_placeholder')));assert.equal((nodes.find(n=>n.id==='footer')!.paints[0] as any).gradientStops.length,2);
});
test('inference is conservative: no scroll, click handler, missing state or touch-target finding from names',()=>{
 const card=pricingCard();card.name='Scrollable Button Disabled';card.width=32;card.height=32;const out=analyze([card]);assert.doesNotMatch(out.compose[0].content,/\.verticalScroll\(|\.clickable\(/);assert.equal(out.issues.filter(i=>i.explanation.includes('target')).length,0);assert.ok(!out.issues.some(i=>/missing (pressed|disabled|hover)/i.test(i.explanation)));assert.ok(!out.issues.some(i=>i.explanation.includes('WindowInsets')));
});
test('invalid geometry errors identify the real layer, rather than inventing bounds',()=>{
 const card=pricingCard();card.children[0].width=NaN;assert.throws(()=>parseSelection([card]),/Invalid width.*Title.*title/);
});
test('getter-backed live-style nodes parse without relying on object enumeration',()=>{
 const source=simpleComponent();const node=Object.create(Object.fromEntries(Object.entries(source).map(([k,v])=>[k,v])));assert.equal(Object.keys(node).length,0);assert.equal(analyze([node]).schema.root.children[0].text?.value,'Hello Android');
});
test('instance/group roots work, explicit component mode preserves fixed frame bounds',()=>{
 const instance={...simpleComponent(),type:'INSTANCE'};assert.equal(analyze([instance]).schema.root.kind,'container');const group={...nestedComponent(),type:'GROUP',layoutMode:'NONE'};assert.equal(analyze([group]).schema.root.sourceType,'GROUP');const frame={...simpleComponent(),type:'FRAME'};assert.match(analyze([frame],{mode:'component'}).compose[0].content,/width\(320.dp\)/);assert.match(analyze([frame]).compose[0].content,/fillMaxSize/);
});
test('unsupported scroll, responsive constraints, and overflow are explicitly reported',()=>{
 const screen=fullScreen();screen.children[1].overflowDirection='BOTH';const out=analyze([screen]);assert.ok(out.issues.some(i=>i.nodeId==='scroll'&&i.severity==='blocker'&&i.explanation.includes('Scroll')));assert.doesNotMatch(out.compose[0].content,/\.verticalScroll\(/);
 const card=pricingCard();card.layoutMode='NONE';card.children[0].constraints={horizontal:'SCALE',vertical:'MIN'};card.children[0].x=400;const report=analyze([card]);assert.ok(report.issues.some(i=>i.explanation.includes('Responsive constraints')));assert.ok(report.issues.some(i=>i.explanation.includes('outside')));
});
test('ellipse backgrounds use an actual oval path rather than a capsule',()=>{
 const out=analyze([fullScreen()]);assert.match(out.compose[0].content,/addOval\(Rect\(0f, 0f, size.width, size.height\)\)/);assert.ok(out.xml.some(f=>f.content.includes('android:shape="oval"')));
});
