import {base64,pngSize} from './assets';
export type ReferenceCapture =
 | {status:'captured';path:'reference/figma.png';base64:string;widthPx:number;heightPx:number;scale:1;capturedAt:string;bounds:{width:number;height:number};boundsPolicy:'absolute-bounds';contentsOnly:true}
 | {status:'unavailable';reason:string};
export async function captureReference(width:number,height:number,exporter:()=>Promise<Uint8Array>):Promise<ReferenceCapture>{
 try{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*height>16_000_000)throw new Error('Reference exceeds valid bounds or the 16-megapixel limit.');
  const bytes=await exporter();
  if(bytes.length>8_000_000)throw new Error('Reference exceeds the 8MB limit.');
  const size=pngSize(bytes);
  if(size.width*size.height>16_000_000||Math.abs(size.width-width)>1||Math.abs(size.height-height)>1)throw new Error('Reference PNG does not match the selection absolute bounds at 1×.');
  return {status:'captured',path:'reference/figma.png',base64:base64(bytes),widthPx:size.width,heightPx:size.height,scale:1,capturedAt:new Date().toISOString(),bounds:{width,height},boundsPolicy:'absolute-bounds',contentsOnly:true};
 }catch(e){return {status:'unavailable',reason:e instanceof Error?e.message:String(e)};}
}
