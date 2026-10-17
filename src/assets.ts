import {absolute} from './capabilities';
import {AndroidUISchema,UINode,walk} from './schema';
export type AssetBounds={x:number;y:number;width:number;height:number};
export type AssetExport={bytes:Uint8Array;bounds?:AssetBounds};
export type AssetExporter=(id:string)=>Promise<Uint8Array|AssetExport>;
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes:Uint8Array){let out='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2];out+=alphabet[a>>2]+alphabet[((a&3)<<4)|((b??0)>>4)]+(i+1<bytes.length?alphabet[((b&15)<<2)|((c??0)>>6)]:'=')+(i+2<bytes.length?alphabet[c&63]:'=');}return out;}
export function pngSize(bytes:Uint8Array){
 if(bytes.length<33||![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw new Error('Figma did not return a PNG image.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=v.getUint32(16),height=v.getUint32(20);if(!width||!height)throw new Error('PNG has empty bounds.');
 let offset=8,hasData=false,ended=false;
 while(offset+12<=bytes.length){const length=v.getUint32(offset),end=offset+length+12;if(end>bytes.length)throw new Error('PNG data is truncated.');const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));let crc=0xffffffff;for(let i=offset+4;i<end-4;i++){crc^=bytes[i];for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}if(((crc^0xffffffff)>>>0)!==v.getUint32(end-4))throw new Error('PNG checksum failed.');if(type==='IDAT'&&length)hasData=true;offset=end;if(type==='IEND'){ended=length===0;break;}}
 if(!hasData||!ended||offset!==bytes.length)throw new Error('PNG data is incomplete.');return {width,height};
}
/** Export only leaf artwork; never flatten text, nested components or whole screens.
 * Context-dependent masks/blending/transforms remain explicit limitations. */
export async function collectAssets(schema:AndroidUISchema,exporter:AssetExporter){
 const parents=new Map<string,UINode>(),candidates:UINode[]=[];walk(schema.root,(n,p)=>{if(p)parents.set(n.id,p);if(!n.children.length&&n.sourceType!=='TEXT'&&(n.image||['VECTOR','BOOLEAN_OPERATION','STAR','POLYGON','LINE'].includes(n.sourceType)||['rectangle','ellipse','container'].includes(n.kind)&&n.limitations.some(l=>/^(Only one solid|Visual effects|Layer opacity|Mixed corner|Corner smoothing|Only uniform inside|Partial ellipse)/.test(l))))candidates.push(n);});
 let bytesUsed=0,serial=0;
 for(const n of candidates){
  if(n.width<=0||n.height<=0)continue;
  if(n.limitations.some(l=>/Masks|Blend mode/.test(l))){n.limitations.push('Artwork export requires manual handling of masks or blending.');continue;}
  try{
   if(n.width*n.height*4>16_000_000)throw new Error('Artwork exceeds the 16-megapixel export limit at 2×.');
   const exported=await exporter(n.id),bytes='bytes'in exported?exported.bytes:exported,bounds='bytes'in exported?exported.bounds:undefined,size=pngSize(bytes);
   if(n.limitations.some(l=>/Rotation|Flipped/.test(l))&&!bounds)throw new Error('Transformed artwork requires verified parent-relative export bounds.');
   const parent=parents.get(n.id),inFlow=parent&&parent.layout!=='NONE'&&!absolute(n);
   if(inFlow&&n.limitations.some(l=>/Rotation|Flipped/.test(l)))throw new Error('Transformed artwork inside layout flow requires manual layout verification.');
   const target=bounds??n;
   if(![target.width,target.height,target.x,target.y].every(Number.isFinite)||target.width<=0||target.height<=0)throw new Error('Native artwork bounds are invalid.');
   if(size.width*size.height>16_000_000)throw new Error('Rendered artwork exceeds the 16-megapixel export limit.');
   if(bytes.length>8_000_000||bytesUsed+bytes.length>32_000_000)throw new Error('Artwork exceeds the export package size limit (8MB per asset / 32MB total).');
   // Bounds validation prevents a shadow-expanded/cropped bitmap from being stretched into
   // a different rectangle. 1px tolerance accommodates Figma's fractional pixel rounding.
   if(Math.abs(size.width-target.width*2)>1||Math.abs(size.height-target.height*2)>1)throw new Error(`PNG bounds ${size.width}×${size.height} do not match the 2× layer bounds.`);
   bytesUsed+=bytes.length;
   const outset=bounds&&inFlow&&(Math.abs(bounds.x-n.x)>.01||Math.abs(bounds.y-n.y)>.01||Math.abs(bounds.width-n.width)>.01||Math.abs(bounds.height-n.height)>.01)?{x:bounds.x-n.x,y:bounds.y-n.y,width:bounds.width,height:bounds.height}:undefined;
   if(bounds){n.sourceProperties.rasterizedOriginalBounds={x:n.x,y:n.y,width:n.width,height:n.height};if(!inFlow)Object.assign(n,bounds);}
   n.asset={outset,resource:`dr_artwork_${++serial}`,base64:base64(bytes),widthPx:size.width,heightPx:size.height,scale:2};
   n.kind='image';n.layout='NONE';n.padding=[0,0,0,0];
   n.sourceProperties.rasterizedSizing={horizontal:n.sizingX,vertical:n.sizingY};
   if(n.sizingX==='HUG')n.sizingX='FIXED';if(n.sizingY==='HUG')n.sizingY='FIXED';
   // Appearance is already baked into the bitmap; applying these again doubles it.
   n.fill=undefined;n.border=undefined;n.radius=0;
   n.limitations=n.limitations.filter(l=>!/^(Image asset|Layer type|Visual effects|Layer opacity|Rotation|Flipped|Only one solid|Mixed fill|Invalid fill|Mixed corner|Corner smoothing|Only uniform inside|Partial ellipse)/.test(l));
  }catch(error){n.limitations.push(`Artwork export failed: ${error instanceof Error?error.message:String(error)}`);}
 }
}
