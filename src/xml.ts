import { AndroidUISchema, OutputFile, UINode, hex, number as num } from './schema';
import {absolute,overlayFlow,supportsConstraints} from './capabilities';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const androidString=(s:string)=>escape(s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t'));
export function generateXML(schema:AndroidUISchema):OutputFile[]{
 const files:OutputFile[]=[],colors:string[]=[],dimens:string[]=[],strings:string[]=[];let serial=0;
 function render(n:UINode,depth:number,p?:UINode,index=0):string{
  const overlay=overlayFlow(n);
  const id=`dr_${++serial}`,pad='    '.repeat(depth);const attrs:Record<string,string>={};
  const dim=(key:string,v:number)=>{const resource=`${id}_${key}`;dimens.push(`    <dimen name="${resource}">${num(v)}dp</dimen>`);return `@dimen/${resource}`;};
  const color=(key:string,c:NonNullable<UINode['fill']>)=>{const resource=`${id}_${key}`;colors.push(`    <color name="${resource}">#${hex(c)}</color>`);return `@color/${resource}`;};
  const tag=n.asset?.outset?'FrameLayout':n.kind==='image'?'ImageView':n.text?'TextView':n.layout==='NONE'?'FrameLayout':'LinearLayout';
  if(n.children.length){attrs['android:clipChildren']=String(n.clipsContent===true);attrs['android:clipToPadding']='false';}
  if(n.clipsContent&&n.radius>0)attrs['android:clipToOutline']='true';
  if(!p)attrs['xmlns:android']='http://schemas.android.com/apk/res/android';
  attrs['android:id']=`@+id/${id}`;
  if(!p&&schema.mode==='screen'){attrs['android:layout_width']='match_parent';attrs['android:layout_height']='match_parent';}
  else for(const [axis,mode,value] of [['width',n.sizingX,n.width],['height',n.sizingY,n.height]] as const){
   const main=p&&((axis==='width'&&p.layout==='HORIZONTAL')||(axis==='height'&&p.layout==='VERTICAL'));
   attrs[`android:layout_${axis}`]=mode==='FIXED'?dim(axis,value):mode==='HUG'?'wrap_content':main?'0dp':'match_parent';
   if(mode==='FILL'&&main)attrs['android:layout_weight']='1';
  }
  if(p?.layout==='NONE'){attrs['android:layout_marginLeft']=dim('x',n.x);attrs['android:layout_marginTop']=dim('y',n.y);attrs['android:layout_gravity']='top|left';}
  else if(p && index>0 && p.main!=='SPACE_BETWEEN')attrs[`android:layout_margin${p.layout==='VERTICAL'?'Top':'Start'}`]=dim('gap',p.gap);
  if(p?.layout==='NONE'&&supportsConstraints(p,n)){
   const gravity=['top','left'];
   for(const [axis,value,parentSize,size,position] of [['horizontal',n.constraints?.horizontal,p.width,n.width,n.x],['vertical',n.constraints?.vertical,p.height,n.height,n.y]] as const){
    const horizontal=axis==='horizontal',start=horizontal?'Left':'Top',end=horizontal?'Right':'Bottom',which=horizontal?'width':'height';
    if(value==='MAX'){delete attrs[`android:layout_margin${start}`];attrs[`android:layout_margin${end}`]=dim(axis+'_end',parentSize-position-size);gravity[horizontal?1:0]=horizontal?'right':'bottom';}
    if(value==='CENTER'){delete attrs[`android:layout_margin${start}`];attrs[horizontal?'android:translationX':'android:translationY']=dim(axis+'_center',position-(parentSize-size)/2);gravity[horizontal?1:0]=horizontal?'center_horizontal':'center_vertical';}
    if(value==='STRETCH'){attrs[`android:layout_${which}`]='match_parent';attrs[`android:layout_margin${end}`]=dim(axis+'_end',parentSize-position-size);}
   }
   attrs['android:layout_gravity']=gravity.join('|');
  }
  if(p&&p.layout!=='NONE'&&n.selfAlign)attrs['android:layout_gravity']=({MIN:p.layout==='VERTICAL'?'start':'top',CENTER:p.layout==='VERTICAL'?'center_horizontal':'center_vertical',MAX:p.layout==='VERTICAL'?'end':'bottom'} as const)[n.selfAlign];
  if(n.layout!=='NONE'){
   attrs['android:orientation']=n.layout==='VERTICAL'?'vertical':'horizontal';
   attrs['android:gravity']=n.layout==='VERTICAL'?`${({MIN:'top',CENTER:'center_vertical',MAX:'bottom',SPACE_BETWEEN:'top'} as any)[n.main]??'top'}|${({MIN:'start',CENTER:'center_horizontal',MAX:'end'} as any)[n.cross]??'start'}`:`${({MIN:'start',CENTER:'center_horizontal',MAX:'end',SPACE_BETWEEN:'left'} as any)[n.main]??'start'}|${({MIN:'top',CENTER:'center_vertical',MAX:'bottom'} as any)[n.cross]??'top'}`;
   ['Top','End','Bottom','Start'].forEach((side,i)=>{if(n.padding[i])attrs[`android:padding${side}`]=dim('padding_'+side.toLowerCase(),n.padding[i]);});
  }
  if((n.fill&&n.sourceType!=='TEXT')||n.border||n.clipsContent&&n.radius>0){
   const drawable=`${id}_background`;attrs['android:background']=`@drawable/${drawable}`;
   files.push({path:`res/drawable/${drawable}.xml`,content:`<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="${n.kind==='ellipse'?'oval':'rectangle'}">\n${n.fill&&n.sourceType!=='TEXT'?`    <solid android:color="${color('background',n.fill)}" />\n`:''}    <corners android:radius="${dim('radius',n.radius)}" />\n${n.border?`    <stroke android:width="${dim('stroke',n.border.width)}" android:color="${color('border',n.border.color)}" />\n`:''}</shape>\n`});
  }
  if(n.asset){
   files.push({path:`res/drawable-nodpi/${n.asset.resource}.png`,content:n.asset.base64,encoding:'base64'});if(!n.asset.outset){attrs['android:src']=`@drawable/${n.asset.resource}`;attrs['android:scaleType']='fitXY';}
  }else if(n.kind==='image'||n.kind==='unsupported'){
   const placeholder=`${id}_image_placeholder`;
   files.push({path:`res/drawable/${placeholder}.xml`,content:`<!-- TODO: Placeholder only. Replace with the specified Figma asset / unsupported content. -->\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#1AFF0000" /><stroke android:width="1dp" android:color="#FFB3261E" /></shape>\n`});
   if(n.kind==='image'){attrs['android:src']=`@drawable/${placeholder}`;attrs['android:scaleType']='fitCenter';}
   else attrs['android:background']=`@drawable/${placeholder}`;
  }
  if(n.text){const t=n.text;strings.push(`    <string name="${id}_text" formatted="false">"${androidString(t.value)}"</string>`);attrs['android:text']=`@string/${id}_text`;attrs['android:textSize']=`${num(t.size)}sp`;attrs['android:includeFontPadding']='false';attrs['android:fontFamily']='sans-serif';attrs['android:textFontWeight']=String(t.weight);attrs['android:textStyle']=t.italic?'italic':'normal';attrs['android:letterSpacing']=String(t.letterSpacing/t.size);if(t.lineHeight!==undefined)attrs['android:lineHeight']=`${num(t.lineHeight)}sp`;attrs['android:gravity']=({LEFT:'left|top',RIGHT:'right|top',CENTER:'center_horizontal|top'} as any)[t.align]??'left|top';if(t.color)attrs['android:textColor']=color('text',t.color);}
  const comments=[`Figma node ${n.id}: ${n.name}`,...(n.rawText!==undefined&&!n.text?[`TODO: Original text ${n.rawText} requires supported typography.`]:[]),...(n.asset?['Source artwork exported at 2×; confirm image accessibility semantics.']:n.image?['TODO: Replace image placeholder; confirm contentDescription and crop.']:[]),...(n.interactions.length?['TODO: Confirm and implement prototype interaction semantics.']:[]),...n.limitations.map(l=>'TODO: '+l),...(n.text?[`TODO: Map font ${n.text.family} to an Android font resource.`]:[])].map(s=>`${pad}<!-- ${escape(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).replace(/--/g,'—')} -->\n`).join('');
  const commentText=comments;
  if(n.scrollSupported){
   const scrollTag=n.scroll==='VERTICAL'?'ScrollView':'HorizontalScrollView';
   const innerOrientation=n.scroll==='VERTICAL'?'vertical':'horizontal',gravity=attrs['android:gravity'];
   delete attrs['android:orientation'];delete attrs['android:gravity'];attrs['android:fillViewport']='true';
   const outer=`${pad}<${scrollTag}\n`+Object.entries(attrs).map(([k,v])=>`${pad}    ${k}="${escape(v)}"`).join('\n')+'>';
   const inner=`${pad}    <LinearLayout android:layout_width="${n.scroll==='VERTICAL'?'match_parent':'wrap_content'}" android:layout_height="${n.scroll==='VERTICAL'?'wrap_content':'match_parent'}" android:orientation="${innerOrientation}" android:gravity="${gravity}">`;
   const children=n.children.map((c,i)=>(i>0&&n.main==='SPACE_BETWEEN'?`${pad}        <Space android:layout_width="0dp" android:layout_height="0dp" android:layout_weight="1" />\n`:'')+render(c,depth+2,n,i)).join('\n');
   return commentText+outer+'\n'+inner+'\n'+children+`\n${pad}    </LinearLayout>\n${pad}</${scrollTag}>`;
  }
  if(overlay){
   const flowAttrs:Record<string,string>={'android:layout_width':n.sizingX==='HUG'?'wrap_content':'match_parent','android:layout_height':n.sizingY==='HUG'?'wrap_content':'match_parent'};
   if(!p&&schema.mode==='screen'){flowAttrs['android:layout_width']='match_parent';flowAttrs['android:layout_height']='match_parent';}
   for(const key of Object.keys(attrs))if(key==='android:orientation'||key==='android:gravity'||key.startsWith('android:padding')){flowAttrs[key]=attrs[key];delete attrs[key];}
   flowAttrs['android:clipChildren']='false';flowAttrs['android:clipToPadding']='false';
   const first=n.children.findIndex(c=>!absolute(c)),flow=n.children.filter(c=>!absolute(c)),children:string[]=[];
   for(let i=0;i<n.children.length;i++){
    const c=n.children[i];
    if(absolute(c))children.push(render(c,depth+1,{...n,layout:'NONE'}));
    else if(i===first){
     const body=flow.map((child,j)=>(j>0&&n.main==='SPACE_BETWEEN'&&!flow.some(c=>n.layout==='VERTICAL'?c.sizingY==='FILL':c.sizingX==='FILL')?`${pad}        <Space android:layout_width="0dp" android:layout_height="0dp" android:layout_weight="1" />\n`:'')+render(child,depth+2,n,j)).join('\n');
     children.push(`${pad}    <LinearLayout\n`+Object.entries(flowAttrs).map(([k,v])=>`${pad}        ${k}="${escape(v)}"`).join('\n')+`>\n${body}\n${pad}    </LinearLayout>`);
    }
   }
   return comments+`${pad}<FrameLayout\n`+Object.entries(attrs).map(([k,v])=>`${pad}    ${k}="${escape(v)}"`).join('\n')+`>\n${children.join('\n')}\n${pad}</FrameLayout>`;
  }
  const opening=`${pad}<${tag}\n`+Object.entries(attrs).map(([k,v])=>`${pad}    ${k}="${escape(v)}"`).join('\n');
  if(n.asset?.outset){
   const o=n.asset.outset;
   return comments+opening+` android:clipChildren="false" android:clipToPadding="false">\n${pad}    <ImageView android:layout_width="match_parent" android:layout_height="match_parent" android:layout_gravity="top|left" android:layout_marginLeft="${dim('art_x',o.x)}" android:layout_marginTop="${dim('art_y',o.y)}" android:layout_marginRight="${dim('art_right',n.width-o.x-o.width)}" android:layout_marginBottom="${dim('art_bottom',n.height-o.y-o.height)}" android:src="@drawable/${n.asset.resource}" android:scaleType="fitXY" />\n${pad}</FrameLayout>`;
  }
  if(!n.children.length)return comments+opening+' />';
  const children=n.children.map((c,i)=>{
   const spacer=i>0&&n.main==='SPACE_BETWEEN'&&n.layout!=='NONE'&&!n.children.some(child=>n.layout==='VERTICAL'?child.sizingY==='FILL':child.sizingX==='FILL')?`${pad}    <Space android:layout_width="${n.layout==='HORIZONTAL'?'0dp':'0dp'}" android:layout_height="0dp" android:layout_weight="1" />\n`:'';
   return spacer+render(c,depth+1,n,i);
  }).join('\n');
  return comments+opening+`>\n${children}\n${pad}</${tag}>`;
 }
 const layout=render(schema.root,0);
 files.unshift({path:`res/layout/shim_${schema.mode}.xml`,content:'<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated draft; Android build verification has NOT been run. Requires API 28+. -->\n'+layout+'\n'});
 files.push({path:'res/values/colors.xml',content:`<resources>\n${colors.join('\n')}\n</resources>\n`},{path:'res/values/dimens.xml',content:`<resources>\n${dimens.join('\n')}\n</resources>\n`},{path:'res/values/strings.xml',content:`<resources>\n${strings.join('\n')}\n</resources>\n`});return files;
}
