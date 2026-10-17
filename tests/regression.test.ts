import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { analyze } from '../src/pipeline';
import { pricingCard } from './fixtures';

test('mixed font size with percentage metrics never throws or fabricates typography',()=>{
 const card=pricingCard();card.children[0].fontSize=Symbol('mixed');card.children[0].lineHeight={unit:'PERCENT',value:120};card.children[0].letterSpacing={unit:'PERCENT',value:2};
 const out=analyze([card]);assert.ok(out.issues.some(i=>i.nodeId==='title'&&i.severity==='blocker'));assert.equal(out.schema.root.children[0].text,undefined);assert.equal((out.compose[0].content.match(/\bText\(/g)??[]).length,2);assert.doesNotMatch(out.compose[0].content,/NaN|undefined/);
});
test('UI ready handshake resends current selection after the iframe has loaded',async()=>{
 const bundled=await build({entryPoints:['src/main.ts'],bundle:true,write:false,target:'es2017'});
 const messages:any[]=[];const host={showUI(){},currentPage:{selection:[pricingCard()]},ui:{postMessage:(m:any)=>messages.push(m),onmessage:undefined as any},on(event:string){if(event==='documentchange')throw new Error('Dynamic-page mode requires loading all pages for documentchange.');}};
 vm.runInNewContext(bundled.outputFiles[0].text,{figma:host,__html__:'<html></html>'});messages.length=0;
 await host.ui.onmessage({type:'ready'});assert.equal(messages[0]?.type,'selection');
 await host.ui.onmessage({type:'analyze'});assert.equal(messages[messages.length-1].type,'result');
});
test('missing typography stays explicit and preserves the original text without default font values',()=>{
 const card=pricingCard();delete card.children[0].fontWeight;const out=analyze([card]);assert.equal(out.schema.root.children[0].rawText,'Pro plan');assert.equal(out.schema.root.children[0].text,undefined);assert.ok(out.issues.some(i=>i.nodeId==='title'&&i.explanation.includes('Incomplete typography')));
});
test('per-child alignment maps to the same cross axis in Compose and XML',()=>{
 const card=pricingCard();card.children[0].layoutAlign='CENTER';card.children[0].layoutSizingHorizontal='FIXED';const out=analyze([card]);assert.match(out.compose[0].content,/align\(Alignment.CenterHorizontally\)/);assert.match(out.xml[0].content,/layout_gravity="center_horizontal"/);
});
test('control characters do not produce malformed XML or invalid Kotlin string escapes',()=>{
 const card=pricingCard();card.children[0].characters='Bad\ftext';const out=analyze([card]);assert.ok(out.issues.some(i=>i.nodeId==='title'&&i.explanation.includes('control characters')));assert.doesNotMatch(out.xml.map(f=>f.content).join(''),/\u000c/);
});
test('Hug component root with main-axis Fill is still flagged as ambiguous',()=>{
 const card=pricingCard();card.children[0].layoutSizingVertical='FILL';assert.ok(analyze([card]).issues.some(i=>i.nodeId==='title'&&i.explanation.includes('Hug parent')));
});
