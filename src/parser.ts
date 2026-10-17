import { AndroidUISchema, Color, SelectionMode, UINode } from './schema';
// Read properties directly: Figma nodes expose prototype getters, not plain JSON fields.
export type DesignNode = { id:string; name:string; type:string; [key:string]:any };
export const ROOT_TYPES=['FRAME','COMPONENT','INSTANCE','GROUP'];
const snapshot=(value:unknown):any=>value===undefined?undefined:JSON.parse(JSON.stringify(value,(_k,v)=>typeof v==='symbol'?'MIXED':v));
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function parseSelection(nodes:readonly DesignNode[],options:{mode?:SelectionMode}={}):AndroidUISchema {
  if(nodes.length!==1 || !ROOT_TYPES.includes(nodes[0].type))throw new Error('Select exactly one Frame, Component, Instance, or Group.');
  const mode=options.mode??(nodes[0].type==='FRAME'?'screen':'component');
  let count=0;const ids=new Set<string>();
  function parse(n:DesignNode,depth:number,parent?:DesignNode):UINode {
    if(++count>10000 || depth>100)throw new Error(`Selection exceeds the safety limit (10,000 visible layers / 100 levels) at ${n.name} (${n.id}).`);
    if(ids.has(n.id))throw new Error(`Repeated layer ID ${n.id}; hierarchy is invalid.`);ids.add(n.id);
    const limitations:string[]=[];
    const metric=(key:string,defaultValue?:number):number=>{const value=n[key];if(value===undefined&&defaultValue!==undefined)return defaultValue;if(!finite(value))throw new Error(`Invalid ${key} on layer “${n.name}” (${n.id}); expected a finite number.`);return value;};
    const width=metric('width'),height=metric('height');if(width<0||height<0)throw new Error(`Negative bounds on layer ${n.name} (${n.id}).`);
    function paint(value:unknown,label:string):Color|undefined {
      if(value===undefined)return;
      if(!Array.isArray(value)){limitations.push(`Mixed ${label} are unsupported.`);return;}
      const visible=value.filter(p=>p.visible!==false);
      if(label==='fill'&&visible.length===1&&visible[0].type==='IMAGE')return;
      if(!visible.length)return;
      if(visible.length!==1 || visible[0].type!=='SOLID'){limitations.push(`Only one solid ${label} is supported; ${visible.map(p=>p.type).join(', ')} requires manual implementation.`);return;}
      const p=visible[0];if(!p.color||![p.color.r,p.color.g,p.color.b,p.opacity??1].every(finite)){limitations.push(`Invalid ${label} color; no color is fabricated.`);return;}
      return {...p.color,a:p.opacity??1};
    }
    const visiblePaints=Array.isArray(n.fills)?n.fills.filter((p:any)=>p.visible!==false):[];
    const imagePaint=visiblePaints.find((p:any)=>p.type==='IMAGE');
    let kind:UINode['kind']=n.type==='TEXT'?'text':n.type==='RECTANGLE'?'rectangle':n.type==='ELLIPSE'?'ellipse':[...ROOT_TYPES,'SLOT'].includes(n.type)?'container':'unsupported';
    if(imagePaint&&n.type!=='TEXT'&&!(n.children?.length))kind='image';
    if(kind==='unsupported')limitations.push(`Layer type ${n.type} is unsupported; a bounds-preserving placeholder is exported.`);
    const fill=paint(n.fills,'fill'),stroke=paint(n.strokes,'stroke');
    if(imagePaint)limitations.push('Image asset is not extracted. A labeled placeholder drawable is generated; replace it with the source asset and verify crop/scale.');
    if(n.effects?.some((e:any)=>e.visible!==false))limitations.push(`Visual effects (${n.effects.filter((e:any)=>e.visible!==false).map((e:any)=>e.type).join(', ')}) are unsupported and omitted.`);
    if(n.opacity!==undefined&&n.opacity!==1)limitations.push('Layer opacity is unsupported and omitted.');
    if(n.rotation)limitations.push('Rotation is unsupported and omitted.');
    if(n.relativeTransform && (n.relativeTransform[0][0]<0||n.relativeTransform[1][1]<0))limitations.push('Flipped transforms require manual implementation.');
    if(n.blendMode&&!['NORMAL','PASS_THROUGH'].includes(n.blendMode))limitations.push('Blend mode is unsupported and omitted.');
    if(n.isMask)limitations.push('Masks are unsupported.');
    if(n.layoutPositioning==='ABSOLUTE'&&parent?.layoutMode&&parent.layoutMode!=='NONE')limitations.push('Absolute children inside Auto Layout are unsupported; positions require manual implementation.');
    if(n.layoutWrap==='WRAP')limitations.push('Wrapping Auto Layout is unsupported.');
    if(n.itemReverseZIndex)limitations.push('Reversed sibling stacking order is unsupported.');
    if(n.itemSpacing<0)limitations.push('Negative item spacing is unsupported.');
    if(n.minWidth!=null||n.maxWidth!=null||n.minHeight!=null||n.maxHeight!=null)limitations.push('Min/max sizing constraints are unsupported.');
    if(n.layoutMode&&!['NONE','VERTICAL','HORIZONTAL'].includes(n.layoutMode))limitations.push(`Layout mode ${n.layoutMode} is unsupported; children retain their measured coordinates.`);
    let radius=typeof n.cornerRadius==='number'?n.cornerRadius:0;
    if(typeof n.cornerRadius==='symbol')limitations.push('Mixed corner radii are unsupported.');
    if(n.cornerSmoothing)limitations.push('Corner smoothing is unsupported.');
    if(n.arcData && (n.arcData.innerRadius!==0 || Math.abs(n.arcData.endingAngle-n.arcData.startingAngle-2*Math.PI)>.001))limitations.push('Partial ellipse / arc geometry is unsupported.');
    if(stroke&&(typeof n.strokeWeight!=='number'||n.strokeAlign!=='INSIDE'||n.dashPattern?.length))limitations.push('Only uniform inside solid borders are supported; this border is omitted.');
    if(n.primaryAxisAlignItems&&!['MIN','CENTER','MAX','SPACE_BETWEEN'].includes(n.primaryAxisAlignItems))limitations.push(`Main-axis alignment ${n.primaryAxisAlignItems} is unsupported.`);
    if(n.counterAxisAlignItems&&!['MIN','CENTER','MAX','BASELINE'].includes(n.counterAxisAlignItems))limitations.push(`Cross-axis alignment ${n.counterAxisAlignItems} is unsupported.`);
    const sizing=(axis:'Horizontal'|'Vertical')=>{
      const explicit=n['layoutSizing'+axis];if(['FIXED','HUG','FILL'].includes(explicit))return explicit as UINode['sizingX'];
      if(explicit!==undefined)limitations.push(`Unknown ${axis.toLowerCase()} sizing ${String(explicit)}; measured bounds are used.`);
      const main=(parent?.layoutMode==='HORIZONTAL'&&axis==='Horizontal')||(parent?.layoutMode==='VERTICAL'&&axis==='Vertical');
      if(main&&n.layoutGrow===1 || !main&&parent?.layoutMode&&parent.layoutMode!=='NONE'&&n.layoutAlign==='STRETCH')return 'FILL';
      if(n.layoutMode&&n.layoutMode!=='NONE'){
       const ownMain=(n.layoutMode==='HORIZONTAL'&&axis==='Horizontal')||(n.layoutMode==='VERTICAL'&&axis==='Vertical');
       if(n[ownMain?'primaryAxisSizingMode':'counterAxisSizingMode']==='AUTO')return 'HUG';
      }
      if(n.type==='TEXT'&&(n.textAutoResize==='WIDTH_AND_HEIGHT'||axis==='Vertical'&&n.textAutoResize==='HEIGHT'))return 'HUG';
      return 'FIXED';
    };
    const scroll=['VERTICAL','HORIZONTAL','BOTH'].includes(n.overflowDirection)?n.overflowDirection:'NONE';
    if(n.overflowDirection!==undefined&&!['NONE','VERTICAL','HORIZONTAL','BOTH'].includes(n.overflowDirection))limitations.push(`Unknown overflow direction ${String(n.overflowDirection)}; scrolling is not inferred.`);
    const u:UINode={id:n.id,name:n.name,sourceType:n.type,kind,width,height,x:metric('x',0),y:metric('y',0),sizingX:sizing('Horizontal'),sizingY:sizing('Vertical'),layout:['VERTICAL','HORIZONTAL'].includes(n.layoutMode)?n.layoutMode:'NONE',padding:[metric('paddingTop',0),metric('paddingRight',0),metric('paddingBottom',0),metric('paddingLeft',0)],gap:Math.max(0,metric('itemSpacing',0)),main:n.primaryAxisAlignItems??'MIN',cross:n.counterAxisAlignItems??'MIN',selfAlign:['MIN','CENTER','MAX'].includes(n.layoutAlign)?n.layoutAlign:undefined,fill,radius,border:stroke&&typeof n.strokeWeight==='number'&&n.strokeAlign==='INSIDE'&&!n.dashPattern?.length?{color:stroke,width:n.strokeWeight}:undefined,children:[],limitations,clipsContent:n.clipsContent===true,scroll,scrollSupported:false,fixedWhenScrolling:n.isFixed===true||n.scrollBehavior==='FIXED'||n.scrollBehavior==='STICKY_SCROLLS',paints:snapshot(visiblePaints),effects:snapshot((n.effects??[]).filter((e:any)=>e.visible!==false)),interactions:(n.reactions??[]).map((r:any)=>({trigger:r.trigger?.type??'UNSPECIFIED',actions:(r.actions??(r.action?[r.action]:[])).map((a:any)=>a.type)})),constraints:n.constraints?snapshot(n.constraints):undefined,styleRefs:{},sourceProperties:{}};
    for(const key of ['minWidth','maxWidth','minHeight','maxHeight','opacity','rotation','relativeTransform','layoutPositioning','topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius','strokes','strokeWeight','strokeAlign','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','boundVariables','reactions'])if(n[key]!==undefined)u.sourceProperties[key]=snapshot(n[key]);
    for(const key of ['fillStyleId','strokeStyleId','effectStyleId','textStyleId'])if(typeof n[key]==='string'&&n[key])u.styleRefs[key]=n[key];
    if(imagePaint)u.image={hash:imagePaint.imageHash??undefined,scaleMode:imagePaint.scaleMode};
    if(['COMPONENT','INSTANCE'].includes(n.type))u.component={key:n.type==='COMPONENT'?n.key:undefined,description:n.description,instance:n.type==='INSTANCE',properties:snapshot(n.componentProperties),variants:snapshot(n.variantProperties)};
    if(n.type==='TEXT'){
      u.rawText=typeof n.characters==='string'?n.characters:undefined;
      const font=n.fontName&&typeof n.fontName==='object'?n.fontName:undefined;
      const mixed=['fontSize','fontName','fontWeight','lineHeight','letterSpacing','textDecoration','textCase'].some(k=>typeof n[k]==='symbol');
      if(mixed)limitations.push('Mixed text styles are unsupported; split into uniformly styled text layers.');
      if(n.textDecoration&&n.textDecoration!=='NONE')limitations.push('Text decoration is unsupported.');
      if(n.textCase&&n.textCase!=='ORIGINAL')limitations.push('Text case transformation is unsupported; use final characters.');
      if(n.paragraphSpacing||n.paragraphIndent||n.listSpacing)limitations.push('Paragraph indentation / spacing or lists require manual implementation.');
      if(n.textTruncation==='ENDING'||n.textAutoResize==='TRUNCATE')limitations.push('Text truncation is unsupported.');
      if(n.leadingTrim&&n.leadingTrim!=='NONE')limitations.push('Text leading trim requires Android metric review.');
      const illegalText=typeof n.characters==='string'&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(n.characters);
      if(illegalText)limitations.push('Text contains control characters that cannot be represented in Android XML resources; a placeholder is generated.');
      if(n.hyperlink)limitations.push('Text hyperlinks require manual implementation.');
      if(n.openTypeFeatures&&Object.keys(n.openTypeFeatures).length)limitations.push('Custom OpenType features are unsupported.');
      if(font?.variationSettings&&Object.keys(font.variationSettings).length)limitations.push('Variable font axes require Android font mapping.');
      if(!mixed&&!illegalText&&finite(n.fontSize)&&n.fontSize>0&&finite(n.fontWeight)&&Number.isInteger(n.fontWeight)&&n.fontWeight>=1&&n.fontWeight<=1000&&font?.family&&typeof n.characters==='string'){
       u.text={value:n.characters,size:n.fontSize,weight:n.fontWeight,family:font.family,italic:/italic/i.test(font.style??''),color:fill,lineHeight:n.lineHeight?.unit==='PIXELS'?n.lineHeight.value:n.lineHeight?.unit==='PERCENT'?n.fontSize*n.lineHeight.value/100:undefined,letterSpacing:n.letterSpacing?.unit==='PIXELS'?n.letterSpacing.value:n.letterSpacing?.unit==='PERCENT'?n.fontSize*n.letterSpacing.value/100:0,align:n.textAlignHorizontal??'LEFT',verticalAlign:n.textAlignVertical??'TOP',resize:n.textAutoResize??'NONE'};
       if(!finite(u.text.letterSpacing)||(u.text.lineHeight!==undefined&&!finite(u.text.lineHeight))){limitations.push('Invalid text metrics; text is exported as a placeholder.');u.text=undefined;}
      }
      if(!u.text){u.kind='unsupported';u.fill=undefined;u.sizingX=u.sizingX==='FILL'?'FILL':'FIXED';u.sizingY='FIXED';if(!mixed)limitations.push('Incomplete typography: specify font size, weight, family and characters; no typography is fabricated.');}
    }
    u.children=(n.children??[]).filter((c:DesignNode)=>c.visible!==false).map((c:DesignNode)=>parse(c,depth+1,n));
    if(u.constraints && parent?.layoutMode!=='VERTICAL'&&parent?.layoutMode!=='HORIZONTAL' && (u.constraints.horizontal!=='MIN'||u.constraints.vertical!=='MIN'))limitations.push('Responsive constraints require manual implementation; current coordinates are preserved.');
    return u;
  }
  const root=parse(nodes[0],0);
  const markScroll=(n:UINode,scrollAncestors:UINode[])=>{
   n.scrollSupported=n.scroll!=='NONE'&&n.scroll!=='BOTH'&&n.layout===n.scroll&&!n.children.some(c=>c.fixedWhenScrolling||(n.scroll==='VERTICAL'?c.sizingY:c.sizingX)==='FILL')&&!scrollAncestors.some(a=>a.scroll===n.scroll)&& (n===root&&mode==='screen'||(n.scroll==='VERTICAL'?n.sizingY:n.sizingX)!=='HUG');
   if(n.scroll!=='NONE'&&!n.scrollSupported)n.limitations.push('Scroll configuration is unsupported: requires a bounded matching Auto Layout axis, no fixed children / main-axis Fill, and no nested same-axis scrolling.');
   n.children.forEach(c=>markScroll(c,n.scrollSupported?[...scrollAncestors,n]:scrollAncestors));
  };markScroll(root,[]);
  return {version:2,mode,root,assumptions:['Figma px map to Android dp; text px map to sp at default font scale.','Fonts require developer-provided Android font resources; platform fallback is generated.','Auto Layout horizontal alignment and padding map to logical start/end; fixed-position coordinates remain physical. Confirm RTL requirements.','Not build verified. Generated code has not been verified for this selection on Android.',...(mode==='screen'?['Screen root fills the host viewport; child dimensions retain Figma sizing intent. Insets need confirmation.']:[])]};
}
