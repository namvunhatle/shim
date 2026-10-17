import {test} from 'node:test';
import {existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {analyze,analyzeWithAssets,analyzeSchema} from '../src/pipeline';
import {zip} from '../src/zip';
import {base64} from '../src/assets';
import {pricingCard,assetReadinessScreen} from './fixtures';
function png(width:number,height:number){
 const crc=(bytes:Buffer)=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(tag:string,data:Buffer)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(tag,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;};
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.alloc(height*(width*4+1),0))),chunk('IEND',Buffer.alloc(0))]);
}
export function overlayCard(){const n=pricingCard();n.layoutSizingVertical='FIXED';n.children=[{id:'back',name:'Behind flow',type:'RECTANGLE',width:320,height:220,x:0,y:0,layoutPositioning:'ABSOLUTE',fills:[{type:'SOLID',color:{r:1,g:0,b:0}}]},...n.children,{id:'badge',name:'Badge',type:'RECTANGLE',width:20,height:20,x:280,y:8,layoutPositioning:'ABSOLUTE',fills:[{type:'SOLID',color:{r:0,g:1,b:0}}]}];return n;}
function verifyXML(out:ReturnType<typeof analyze>){const p=spawnSync('python3',['scripts/verify-xml.py'],{input:JSON.stringify({files:out.xml,schema:out.schema}),encoding:'utf8'});assert.equal(p.status,0,p.stderr||p.stdout);}
test('overlays keep background/flow/badge drawing order without entering Row/Column',()=>{
 const out=analyze([overlayCard()]),kt=out.compose[0].content,xml=out.xml[0].content;
 assert.ok(!out.issues.some(i=>i.explanation.startsWith('Absolute children')));assert.match(kt,/Box\(modifier/);assert.match(kt,/Column\(modifier = Modifier.fillMaxWidth\(\).fillMaxHeight\(\).padding/);assert.ok(kt.indexOf('Figma node back')<kt.indexOf('Figma node title'));assert.ok(kt.indexOf('Figma node badge')>kt.indexOf('Figma node description'));assert.match(kt,/absoluteOffset\(x = 280.dp, y = 8.dp\)/);assert.equal((kt.match(/\.weight\(/g)??[]).length,0);
 assert.match(xml,/<FrameLayout/);assert.match(xml,/<LinearLayout/);assert.match(xml,/dr_6_x/);verifyXML(out);
});
test('interleaved flow blocks remain explicit limitations rather than silently reordering siblings',()=>{
 const n=overlayCard(),badge=n.children.pop();n.children.splice(2,0,badge);const out=analyze([n]);assert.ok(out.issues.some(i=>i.explanation.startsWith('Absolute children')));assert.equal(out.readiness.frameworks.compose.status,'CANNOT GENERATE RELIABLY');
});
test('PNG artwork is packaged once as real binary resources referenced by both generators',async()=>{
 const n=assetReadinessScreen(),bytes=png(600,360),ids:string[]=[];const out=await analyzeWithAssets([n],{},async id=>{ids.push(id);return bytes;});
 assert.deepEqual(ids,['source-artwork']);const asset=out.schema.root.children[out.schema.root.children.length-1]!.asset!;assert.equal(asset.base64,base64(bytes));assert.equal(asset.widthPx,600);assert.match(out.compose[0].content,/R.drawable.dr_artwork_1/);assert.match(out.xml[0].content,/@drawable\/dr_artwork_1/);assert.ok(!out.xml.some(f=>f.path.includes('placeholder')));assert.equal(out.readiness.frameworks.compose.status,'READY FOR DEV REVIEW');assert.equal(out.verification.status,'Not build verified');verifyXML(out);
 const packed=zip([...out.compose,...out.xml]);const result=spawnSync('python3',['-c',"import sys,io,zipfile;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));assert z.testzip() is None;b=z.read('res/drawable-nodpi/dr_artwork_1.png');assert b[:8]==bytes([137,80,78,71,13,10,26,10]);print(len(b))"],{input:packed,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.equal(Number(result.stdout),bytes.length);
});
test('rasterized leaf artwork bakes appearance exactly once, while text and hierarchy remain native',async()=>{
 const n=assetReadinessScreen();const image=n.children.at(-1)!;image.opacity=.5;image.effects=[{type:'DROP_SHADOW',visible:true,radius:2}];image.cornerRadius=12;const out=await analyzeWithAssets([n],{},async()=>png(600,360));assert.ok(out.schema.root.children[0].text);assert.equal(out.schema.root.children.length,4);assert.equal(out.schema.root.children[out.schema.root.children.length-1]!.fill,undefined);assert.equal(out.schema.root.children[out.schema.root.children.length-1]!.radius,0);assert.ok(!out.issues.some(i=>i.nodeId==='source-artwork'&&/omitted|not extracted/.test(i.explanation)));
});
test('failed or mismatched artwork export retains content and its critical limitation',async()=>{
 for(const exporter of [async()=>{throw new Error('Native export denied');},async()=>png(2,2),async()=>new Uint8Array([1,2,3])]){const out=await analyzeWithAssets([assetReadinessScreen()],{},exporter);assert.equal(out.readiness.frameworks.xml.status,'CANNOT GENERATE RELIABLY');assert.ok(out.issues.some(i=>i.explanation.startsWith('Artwork export failed:')));assert.ok(out.compose[0].content.includes('image_placeholder'));assert.equal(out.overview.total,5);}
});
test('containers with image fills and children are not flattened into screenshots',async()=>{
 const n=pricingCard();n.fills=[{type:'IMAGE',imageHash:'container-image'}];let calls=0;const out=await analyzeWithAssets([n],{},async()=>{calls++;return png(640,440);});assert.equal(calls,0);assert.equal(out.schema.root.children.length,3);assert.equal(out.readiness.frameworks.compose.status,'CANNOT GENERATE RELIABLY');
});
test('re-analyzing a normalized schema reconciles legacy overlay diagnostics with current generation',()=>{
 const out=analyze([overlayCard()]);out.schema.root.children[0].limitations.push('Absolute children inside Auto Layout are unsupported; positions require manual implementation.');const fresh=analyzeSchema(out.schema);assert.ok(!fresh.issues.some(i=>i.explanation.startsWith('Absolute children')));
});
test('Slot nodes remain native containers with their visible text and hierarchy',()=>{
 const n=pricingCard();n.children=[{...pricingCard(),id:'slot',name:'Content slot',type:'SLOT'}];const out=analyze([n]);assert.equal(out.schema.root.children[0].kind,'container');assert.ok(!out.issues.some(i=>i.explanation.includes('Layer type SLOT')));assert.equal(out.overview.total,5);verifyXML(out);
});
test('transformed artwork needs native export bounds; verified bounds retain baked positioning',async()=>{
 const n=assetReadinessScreen();n.layoutMode='NONE';n.children[n.children.length-1].rotation=90;
 const noBounds=await analyzeWithAssets([n],{},async()=>png(360,600));assert.equal(noBounds.schema.root.children[3].asset,undefined);assert.equal(noBounds.readiness.frameworks.compose.status,'CANNOT GENERATE RELIABLY');
 const out=await analyzeWithAssets([n],{},async()=>({bytes:png(360,600),bounds:{x:10,y:20,width:180,height:300}}));assert.ok(out.schema.root.children[3].asset);assert.equal(out.schema.root.children[3].width,180);assert.equal(out.schema.root.children[3].x,10);assert.ok(!out.issues.some(i=>i.explanation.includes('Rotation')));
});
test('edits while exporting invalidate the snapshot instead of mixing old text with new assets',async()=>{
 const n=assetReadinessScreen();await assert.rejects(()=>analyzeWithAssets([n],{},async()=>{n.children[0].characters='Edited during export';return png(600,360);}),/Design changed during artwork export/);
});
test('fixed-position anchors preserve end, center and stretch intent instead of freezing every coordinate',()=>{
 const n=overlayCard();n.children[0].constraints={horizontal:'STRETCH',vertical:'STRETCH'};n.children[n.children.length-1].constraints={horizontal:'MAX',vertical:'CENTER'};
 const out=analyze([n]);assert.match(out.compose[0].content,/BoxWithConstraints/);assert.match(out.compose[0].content,/maxWidth - 40.dp/);assert.match(out.compose[0].content,/width\(\(maxWidth - 0.dp\).coerceAtLeast\(0.dp\)\)/);assert.match(out.xml[0].content,/layout_gravity="center_vertical\|right"/);assert.match(out.xml[0].content,/android:translationY=/);assert.ok(!out.issues.some(i=>i.explanation.startsWith('Responsive constraints')));verifyXML(out);
});
test('screen viewport bounds support anchors even when the source root uses Hug',()=>{
 const n=overlayCard();n.type='FRAME';n.layoutSizingVertical='HUG';n.children[n.children.length-1].constraints={horizontal:'MAX',vertical:'MAX'};const out=analyze([n]);assert.match(out.compose[0].content,/maxHeight - 212.dp/);assert.ok(!out.issues.some(i=>i.explanation.startsWith('Responsive constraints')));
});
test('Hug raster assets retain Figma logical bounds across Android screen densities',async()=>{
 const n=assetReadinessScreen();Object.assign(n.children[3],{layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG'});const out=await analyzeWithAssets([n],{},async()=>png(600,360));const art=out.schema.root.children[3];assert.equal(art.sizingX,'FIXED');assert.equal(art.sizingY,'FIXED');assert.match(out.compose[0].content,/width\(300.dp\)/);assert.match(out.xml.find(f=>f.path.endsWith('dimens.xml'))!.content,/>300dp</);
});
test('PNG corruption stays a visible export failure instead of producing an apparently supported asset',async()=>{
 const corrupt=png(600,360);corrupt[corrupt.length-1]^=1;const out=await analyzeWithAssets([assetReadinessScreen()],{},async()=>corrupt);assert.equal(out.schema.root.children[3].asset,undefined);assert.ok(out.issues.some(i=>i.explanation.includes('PNG checksum failed')));
});
test('leaf frame padding is baked into the artwork and never applied a second time',async()=>{
 const n=assetReadinessScreen();Object.assign(n.children[3],{type:'FRAME',layoutMode:'VERTICAL',paddingLeft:20,paddingTop:20});const out=await analyzeWithAssets([n],{},async()=>png(600,360));assert.deepEqual(out.schema.root.children[3].padding,[0,0,0,0]);assert.equal(out.schema.root.children[3].layout,'NONE');
});
test('the live Halloween handoff regenerates byte-for-byte, with every node and PNG resource accounted for',{skip:!existsSync('verification/halloween-v0.5.0.zip')&&'private capture not included in the public repo'},()=>{
 const capture=spawnSync('python3',['-c',"import zipfile,json,hashlib;z=zipfile.ZipFile('verification/halloween-v0.5.0.zip');assert z.testzip() is None;print(json.dumps({'schema':json.loads(z.read('android-ui-schema.json')),'hashes':{n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.endswith('.kt') or n.startswith('res/')}}))"],{encoding:'utf8',maxBuffer:64_000_000});assert.equal(capture.status,0,capture.stderr);const captured=JSON.parse(capture.stdout),out=analyzeSchema(captured.schema);let count=0;const visit=(n:any)=>{count++;n.children.forEach(visit);};visit(captured.schema.root);assert.equal(out.overview.total,count);verifyXML(out);
 const files=[...out.compose,...out.xml];assert.equal(files.length,Object.keys(captured.hashes).length);
 for(const file of files){const actual=createHash('sha256').update(file.encoding==='base64'?Buffer.from(file.content,'base64'):file.content).digest('hex');assert.equal(actual,captured.hashes[file.path],file.path);}
});
test('unsupported visual styles on leaf shapes can be baked without flattening their surrounding layout',async()=>{
 const n=assetReadinessScreen();n.children[3].fills=[{type:'GRADIENT_LINEAR',gradientStops:[{position:0,color:{r:0,g:0,b:1,a:1}},{position:1,color:{r:1,g:0,b:0,a:1}}]}];const out=await analyzeWithAssets([n],{},async()=>png(600,360));assert.ok(out.schema.root.children[3].asset);assert.ok(!out.issues.some(i=>i.explanation.includes('GRADIENT_LINEAR')));assert.equal(out.schema.root.children.length,4);assert.ok(out.schema.root.children[0].text);
});
test('baked visual outsets never enlarge the layout slot or push neighboring content',async()=>{
 const out=await analyzeWithAssets([assetReadinessScreen()],{},async()=>({bytes:png(640,400),bounds:{x:4,y:140,width:320,height:200}}));const art=out.schema.root.children[3];assert.equal(art.width,300);assert.equal(art.height,180);assert.equal(art.x,24);assert.equal(art.asset!.outset!.x,-20);assert.match(out.compose[0].content,/requiredSize\(width = \(maxWidth \+ 20.dp/);assert.match(out.xml[0].content,/<FrameLayout/);verifyXML(out);
});
test('saved schemas from earlier raster exports recover their original flow slots',async()=>{
 const out=await analyzeWithAssets([assetReadinessScreen()],{},async()=>({bytes:png(640,400),bounds:{x:4,y:140,width:320,height:200}}));const art=out.schema.root.children[3],bytes=art.asset!.base64;delete art.asset!.outset;Object.assign(art,{x:4,y:140,width:320,height:200});const fresh=analyzeSchema(out.schema);assert.equal(fresh.schema.root.children[3].width,300);assert.equal(fresh.schema.root.children[3].asset!.outset!.x,-20);assert.equal(fresh.schema.root.children[3].asset!.base64,bytes);verifyXML(fresh);
});
test('technical diagnostics reflect implemented clipping and never describe exported artwork as a placeholder',async()=>{
 const n=assetReadinessScreen();n.clipsContent=true;const out=await analyzeWithAssets([n],{},async()=>png(600,360));assert.ok(out.issues.some(i=>i.ruleId==='content-clipping'&&i.severity==='info'));assert.ok(!out.issues.some(i=>i.ruleId==='content-clipping'&&i.explanation.includes('not generated')));assert.ok(!out.issues.some(i=>i.ruleId==='image-description'&&i.impact.includes('placeholder')));
});
