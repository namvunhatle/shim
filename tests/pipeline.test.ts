import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricingCard } from './fixtures';
import { analyze } from '../src/pipeline';
import { parseSelection } from '../src/parser';
import { zip } from '../src/zip';

test('pricing card passes through schema to consistent Compose/XML',()=>{
 const out=analyze([pricingCard()]);assert.equal(out.schema.root.children.length,3);assert.equal(out.issues.filter(i=>i.severity==='blocker').length,0);
 const kt=out.compose[0].content,xml=out.xml.find(f=>f.path.includes('/layout/'))!.content;
 assert.match(kt,/fun PricingCard/);assert.match(kt,/Column\(/);assert.match(kt,/spacedBy\(12.dp/);assert.match(kt,/\\\$12 \/ month/);assert.match(kt,/RoundedCornerShape\(16.dp\)/);
 assert.match(xml,/<LinearLayout/);assert.equal((xml.match(/<TextView/g)??[]).length,3);assert.match(xml,/layout_width="match_parent"/);assert.match(out.xml.find(f=>f.path.includes('dimens'))!.content,/>12dp</);assert.match(out.xml.find(f=>f.path.includes('strings'))!.content,/\$12 \/ month/);
 assert.ok(out.xml.some(f=>f.path.startsWith('res/drawable/')));assert.ok(out.issues.some(i=>i.explanation.includes('Font')));
});
test('selection rejects multi-select, unsupported roots and empty selection',()=>{for(const input of [[],[pricingCard(),pricingCard()],[{...pricingCard(),type:'RECTANGLE'}]])assert.throws(()=>parseSelection(input),/exactly one/);});
test('non-auto layout preserves positions without blocker merely for layout choice',()=>{
 const card=pricingCard();card.layoutMode='NONE';card.layoutSizingVertical='FIXED';card.children.forEach((n:any,i:number)=>{n.layoutSizingHorizontal='FIXED';n.layoutSizingVertical='FIXED';n.x=24;n.y=24+i*50;});
 const out=analyze([card]);assert.equal(out.issues.filter(i=>i.severity==='blocker').length,0);assert.match(out.compose[0].content,/absoluteOffset\(x = 24.dp, y = 74.dp\)/);assert.match(out.xml[0].content,/<FrameLayout/);assert.ok(out.issues.some(i=>i.explanation.includes('responsive')));
});
test('unsupported paints, effects, mixed text and absolute children are explicit blockers',()=>{
 const card=pricingCard();card.fills=[{type:'GRADIENT_LINEAR'}];card.effects=[{visible:true,type:'DROP_SHADOW'}];card.children[0].fontSize=Symbol('mixed');card.children[1].layoutPositioning='ABSOLUTE';
 const out=analyze([card]);for(const word of ['solid','effects','Mixed text','Absolute'])assert.ok(out.issues.some(i=>i.severity==='blocker'&&i.explanation.includes(word)),word);assert.match(out.compose[0].content,/TODO: Only one solid/);
});
test('escaping preserves literal Kotlin and Android string content',()=>{
 const card=pricingCard();card.children[0].characters='  "Pro" & <value>\n$9\\path\'s @home %1$s  ';
 const out=analyze([card]);assert.match(out.compose[0].content,/\\\$9/);assert.match(out.compose[0].content,/\\n/);const strings=out.xml.find(f=>f.path.endsWith('strings.xml'))!.content;assert.match(strings,/&amp;/);assert.match(strings,/&lt;value&gt;/);assert.match(strings,/formatted="false"/);assert.match(strings,/\\&apos;/);
});
test('fixed text bounds and low contrast warn; hidden layers are excluded',()=>{
 const card=pricingCard();card.children[0].textAutoResize='NONE';card.children[0].fills=[{type:'SOLID',color:{r:.9,g:.9,b:.9}}];card.children[1].visible=false;const out=analyze([card]);assert.equal(out.schema.root.children.length,2);assert.ok(out.issues.some(i=>i.explanation.includes('Fixed text')));assert.ok(out.issues.some(i=>i.explanation.includes('contrast')));
});
test('fill children use weights on the main axis in both outputs',()=>{
 const card=pricingCard();card.layoutMode='HORIZONTAL';card.layoutSizingVertical='FIXED';const out=analyze([card]);assert.match(out.compose[0].content,/weight\(1f\)/);assert.match(out.xml[0].content,/layout_weight="1"/);assert.match(out.xml[0].content,/layout_width="0dp"/);
});
test('ZIP has matching local/central entries and Unicode payload',()=>{
 const bytes=zip([{path:'Title.kt',content:'€ pricing'}]);const view=new DataView(bytes.buffer);assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50);assert.equal(view.getUint16(bytes.length-14,true),1);assert.ok(new TextDecoder().decode(bytes).includes('€ pricing'));
});
test('nested row and centered arrangements use the correct Compose alignment axis',()=>{
 const card=pricingCard();card.primaryAxisAlignItems='CENTER';const row={...pricingCard(),id:'row',name:'Details',type:'FRAME',layoutMode:'HORIZONTAL',layoutSizingHorizontal:'FILL',layoutSizingVertical:'HUG',primaryAxisAlignItems:'CENTER'};card.children=[row];const out=analyze([card]);assert.match(out.compose[0].content,/spacedBy\(12.dp, Alignment.CenterVertically\)/);assert.match(out.compose[0].content,/spacedBy\(12.dp, Alignment.CenterHorizontally\)/);assert.match(out.xml[0].content,/orientation="horizontal"/);
});
test('Hug text in fixed-position frames remains supported',()=>{
 const card=pricingCard();card.layoutMode='NONE';card.layoutSizingVertical='FIXED';card.children.forEach((n:any)=>n.layoutSizingHorizontal='FIXED');const out=analyze([card]);assert.equal(out.issues.filter(i=>i.severity==='blocker').length,0);
});
test('space-between uses spacer weights only when children do not consume main-axis space',()=>{
 const card=pricingCard();card.primaryAxisAlignItems='SPACE_BETWEEN';card.layoutSizingVertical='FIXED';let out=analyze([card]);assert.equal((out.xml[0].content.match(/<Space /g)??[]).length,2);card.children[0].layoutSizingVertical='FILL';out=analyze([card]);assert.doesNotMatch(out.xml[0].content,/<Space /);
});
test('selection traversal rejects excessive depth',()=>{
 const card=pricingCard();let parent=card;for(let i=0;i<102;i++){const child={...pricingCard(),id:String(i),children:[]};parent.children=[child];parent=child;}assert.throws(()=>parseSelection([card]),/safety limit/);
});
test('clipping on a valid card is reported without automatically blocking it',()=>{
 const card=pricingCard();card.clipsContent=true;const out=analyze([card]);assert.equal(out.issues.filter(i=>i.severity==='blocker').length,0);assert.ok(out.issues.some(i=>i.explanation.includes('clipping')));
});
