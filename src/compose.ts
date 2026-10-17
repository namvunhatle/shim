import { AndroidUISchema, OutputFile, UINode, hex, number as num, walk } from './schema';
import {absolute,overlayFlow,anchoredBox,supportsConstraints} from './capabilities';
export const identifier=(s:string)=>{const name=s.replace(/[^a-zA-Z0-9]+/g,' ').trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');return /^[A-Za-z]/.test(name)?name:'Component'+name;};
const literal=(s:string)=>'"'+Array.from(s).map(c=>c==='\\'?'\\\\':c==='"'?'\\"':c==='$'?'\\$':c==='\n'?'\\n':c==='\r'?'\\r':c==='\t'?'\\t':(c.charCodeAt(0)<32||c==='\u2028'||c==='\u2029')?'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'):c).join('')+'"';
export function generateCompose(schema:AndroidUISchema):OutputFile[]{
 const name=identifier(schema.root.name)+(schema.mode==='screen'&&!/Screen$/.test(identifier(schema.root.name))?'Screen':'');
 const nodeNumbers=new Map<string,number>(),components=new Map<string,string>();let serial=0;
 walk(schema.root,(n,p)=>{nodeNumbers.set(n.id,++serial);if(p&&n.component)components.set(n.id,identifier(n.name)+'Part'+serial);});
 function render(n:UINode,depth:number,parent?:UINode,index=0,definition=false):string{
  const overlay=overlayFlow(n);
  const pad='    '.repeat(depth),lines:string[]=[`${'    '.repeat(depth)}// Figma node ${n.id.replace(/[\r\n\u2028\u2029]/g,' ')}: ${n.name.replace(/[\r\n\u2028\u2029]/g,' ')}`];
  n.limitations.forEach(l=>lines.push(`${pad}// TODO: ${l.replace(/[\r\n]/g,' ')}`));
  let mods=['Modifier'];if(!parent)mods=['modifier'];
  if(!definition){
  if(parent&&parent.layout!=='NONE'&&n.selfAlign){const vertical=parent.layout==='VERTICAL';const align=({MIN:vertical?'Start':'Top',CENTER:vertical?'CenterHorizontally':'CenterVertically',MAX:vertical?'End':'Bottom'} as const)[n.selfAlign];mods.push(`align(Alignment.${align})`);}
  if(parent?.layout==='NONE'){
   const offset=(axis:'horizontal'|'vertical',position:number,size:number)=>{const mode=supportsConstraints(parent,n)?n.constraints?.[axis]:'MIN',max=axis==='horizontal'?'maxWidth':'maxHeight';return mode==='MAX'?`${max} - ${num(size-position)}.dp`:mode==='CENTER'?`${max} / 2 + ${num(position-size/2)}.dp`:`${num(position)}.dp`;};
   mods.push(`absoluteOffset(x = ${offset('horizontal',n.x,parent.width)}, y = ${offset('vertical',n.y,parent.height)})`);
  }
  if(!parent&&schema.mode==='screen')mods.push('fillMaxSize()');
  else for(const [axis,mode,value] of [['Width',n.sizingX,n.width],['Height',n.sizingY,n.height]] as const){
   const main=parent && ((axis==='Width'&&parent.layout==='HORIZONTAL')||(axis==='Height'&&parent.layout==='VERTICAL'));
   if(parent?.layout==='NONE'&&supportsConstraints(parent,n)&&n.constraints?.[axis==='Width'?'horizontal':'vertical']==='STRETCH'){mods.push(`${axis.toLowerCase()}((max${axis} - ${num((axis==='Width'?parent.width:parent.height)-value)}.dp).coerceAtLeast(0.dp))`);continue;}
   mods.push(mode==='FIXED'?`${axis.toLowerCase()}(${num(value)}.dp)`:mode==='FILL'?(main?'weight(1f)':`fillMax${axis}()`):`wrapContent${axis}()`);
  }
  const shape=n.kind==='ellipse'?'GenericShape { size, _ -> addOval(Rect(0f, 0f, size.width, size.height)) }':`RoundedCornerShape(${num(n.radius)}.dp)`;
  if(n.clipsContent&&!n.scrollSupported&&!n.asset)mods.push(`clip(${shape})`);
  if(n.kind==='unsupported')mods.push('background(Color(0x1AFF0000))'); // Clearly marked placeholder, not a design color.
  if(n.sourceType!=='TEXT' && n.fill)mods.push(`background(Color(0x${hex(n.fill)}), ${shape})`);
  if(n.border)mods.push(`border(${num(n.border.width)}.dp, Color(0x${hex(n.border.color)}), ${shape})`);
  if(n.padding.some(Boolean)&&n.layout!=='NONE'&&!overlay){const [t,r,b,l]=n.padding;mods.push(`padding(start = ${num(l)}.dp, top = ${num(t)}.dp, end = ${num(r)}.dp, bottom = ${num(b)}.dp)`);}
  if(n.scrollSupported)mods.push(n.scroll==='VERTICAL'?'verticalScroll(rememberScrollState())':'horizontalScroll(rememberScrollState())');
  }
  const modifier=mods.join('\n'+pad+'        .');
  if(parent&&components.has(n.id)&&!definition){lines.push(`${pad}${components.get(n.id)}(modifier = ${modifier})`);return lines.join('\n');}
  if(n.rawText!==undefined&&!n.text)lines.push(`${pad}// TODO: Original text ${literal(n.rawText)} requires supported typography.`);
  if(n.interactions.length)lines.push(`${pad}// TODO: Confirm and implement prototype interaction semantics; no event handler is invented.`);
  if(n.asset?.outset){
   const o=n.asset.outset;
   lines.push(`${pad}BoxWithConstraints(modifier = ${modifier}) {`,`${pad}    Image(`,`${pad}        painter = painterResource(R.drawable.${n.asset.resource}),`,`${pad}        contentDescription = null, // Confirm image semantics`,`${pad}        contentScale = ContentScale.FillBounds,`,`${pad}        modifier = Modifier.absoluteOffset(x = ${num(o.x)}.dp, y = ${num(o.y)}.dp)`,`${pad}            .wrapContentSize(Alignment.TopStart, unbounded = true)`,`${pad}            .requiredSize(width = (maxWidth + ${num(o.width-n.width)}.dp).coerceAtLeast(0.dp), height = (maxHeight + ${num(o.height-n.height)}.dp).coerceAtLeast(0.dp))`,`${pad}    )`,`${pad}}`);return lines.join('\n');
  }
  if(n.kind==='image'){
   lines.push(n.asset?`${pad}// Source artwork exported at 2×. Confirm image accessibility semantics.`:`${pad}// TODO: Replace placeholder asset and confirm contentDescription / crop.`,`${pad}Image(\n${pad}    painter = painterResource(R.drawable.${n.asset?.resource??`dr_${nodeNumbers.get(n.id)}_image_placeholder`}),\n${pad}    contentDescription = null, // Needs confirmation: decorative or meaningful image\n${pad}    contentScale = ContentScale.FillBounds, // Bitmap already contains the Figma crop/appearance\n${pad}    modifier = ${modifier}\n${pad})`);return lines.join('\n');
  }
  if(n.text){const t=n.text;lines.push(`${pad}// TODO: Map font ${t.family.replace(/[\r\n]/g,' ')} to an Android font resource.`);lines.push(`${pad}Text(\n${pad}    text = ${literal(t.value)},\n${pad}    modifier = ${modifier},\n${pad}    fontSize = ${num(t.size)}.sp,\n${pad}    fontWeight = FontWeight(${t.weight}),\n${pad}    fontStyle = FontStyle.${t.italic?'Italic':'Normal'},\n${pad}    letterSpacing = ${num(t.letterSpacing)}.sp,${t.lineHeight!==undefined?'\n'+pad+'    lineHeight = '+num(t.lineHeight)+'.sp,':''}\n${pad}    textAlign = TextAlign.${({LEFT:'Left',RIGHT:'Right',CENTER:'Center'} as Record<string,string>)[t.align]??'Left'}${t.color?',\n'+pad+'    color = Color(0x'+hex(t.color)+')':''}\n${pad})`);return lines.join('\n');}
  const tag=n.layout==='VERTICAL'?'Column':n.layout==='HORIZONTAL'?'Row':anchoredBox(n)?'BoxWithConstraints':'Box';
  let extra='';
  if(tag==='Column'||tag==='Row'){
   const vertical=tag==='Column';const a=({MIN:vertical?'Top':'Start',MAX:vertical?'Bottom':'End',CENTER:vertical?'CenterVertically':'CenterHorizontally',SPACE_BETWEEN:'SpaceBetween'} as Record<string,string>)[n.main]??(vertical?'Top':'Start');
   extra=`,\n${pad}    ${vertical?'vertical':'horizontal'}Arrangement = Arrangement.${n.main==='SPACE_BETWEEN'?'SpaceBetween':`spacedBy(${num(n.gap)}.dp, Alignment.${a})`},\n${pad}    ${vertical?'horizontal':'vertical'}Alignment = Alignment.${({MIN:vertical?'Start':'Top',CENTER:vertical?'CenterHorizontally':'CenterVertically',MAX:vertical?'End':'Bottom'} as Record<string,string>)[n.cross]??(vertical?'Start':'Top')}`;
  }
  if(overlay){
   lines.push(`${pad}${anchoredBox(n)?'BoxWithConstraints':'Box'}(modifier = ${modifier}) {`);
   const flow=n.children.filter(c=>!absolute(c)),first=n.children.findIndex(c=>!absolute(c));
   const flowMods=['Modifier'];
   if(n.sizingX!=='HUG'||n===schema.root&&schema.mode==='screen')flowMods.push('fillMaxWidth()');
   if(n.sizingY!=='HUG'||n===schema.root&&schema.mode==='screen')flowMods.push('fillMaxHeight()');
   if(n.padding.some(Boolean)){const [t,r,b,l]=n.padding;flowMods.push(`padding(start = ${num(l)}.dp, top = ${num(t)}.dp, end = ${num(r)}.dp, bottom = ${num(b)}.dp)`);}
   for(let i=0;i<n.children.length;i++){
    const c=n.children[i];
    if(absolute(c))lines.push(render(c,depth+1,{...n,layout:'NONE'}));
    else if(i===first){lines.push(`${pad}    ${tag}(modifier = ${flowMods.join('.')} ${extra}) {`);flow.forEach((child,j)=>lines.push(render(child,depth+2,n,j)));lines.push(`${pad}    }`);}
   }
   lines.push(`${pad}}`);return lines.join('\n');
  }
  lines.push(`${pad}${tag}(\n${pad}    modifier = ${modifier}${extra}\n${pad}) {`);
  n.children.forEach((c,i)=>lines.push(render(c,depth+1,n,i)));lines.push(`${pad}}`);return lines.join('\n');
 }
 return [{path:`${name}.kt`,content:`// Generated by Shim. Not build verified. Android build verification has NOT been run.\n// Host integration: update package / R namespace to match your app.\npackage shim.generated\n\n// Figma px → dp; text px → sp. Review TODOs and readiness report.\nimport androidx.compose.foundation.Image\nimport androidx.compose.foundation.rememberScrollState\nimport androidx.compose.foundation.verticalScroll\nimport androidx.compose.foundation.horizontalScroll\nimport androidx.compose.ui.res.painterResource\nimport androidx.compose.ui.layout.ContentScale\nimport androidx.compose.foundation.background\nimport androidx.compose.foundation.border\nimport androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.shape.RoundedCornerShape\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\nimport androidx.compose.ui.Alignment\nimport androidx.compose.ui.Modifier\nimport androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.draw.clip\nimport androidx.compose.foundation.shape.GenericShape\nimport androidx.compose.ui.geometry.Rect\nimport androidx.compose.ui.text.font.FontStyle\nimport androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.text.style.TextAlign\nimport androidx.compose.ui.unit.dp\nimport androidx.compose.ui.unit.sp\n\n@Composable\nfun ${name}(modifier: Modifier = Modifier) {\n${render(schema.root,1)}\n}\n${Array.from(components.entries()).map(([id,part])=>{let node:UINode|undefined;walk(schema.root,n=>{if(n.id===id)node=n;});return `\n@Composable\nprivate fun ${part}(modifier: Modifier = Modifier) {\n${render(node!,1,undefined,0,true)}\n}\n`;}).join('')}`}];
}
