import { analyzeWithAssets } from './pipeline';
import {pngSize} from './assets';
async function exportArtwork(id:string){
 const node=await figma.getNodeByIdAsync(id);
 if(!node?.exportAsync)throw new Error('Layer cannot be exported by this host.');
 const bytes=await node.exportAsync({format:'PNG',constraint:{type:'SCALE',value:2},contentsOnly:true,useAbsoluteBounds:false,colorProfile:'SRGB'});
 const t=node.parent?.type==='PAGE'?[[1,0,0],[0,1,0]]:node.parent?.absoluteTransform;
 const identity=t&&Math.abs(t[0][0]-1)<.0001&&Math.abs(t[0][1])<.0001&&Math.abs(t[1][0])<.0001&&Math.abs(t[1][1]-1)<.0001;
 if(!identity)throw new Error('Artwork parent transform requires manual implementation.');
 const size=pngSize(bytes);
 const box=[node.absoluteRenderBounds,node.absoluteBoundingBox].find(b=>b&&Math.abs(b.width*2-size.width)<=1&&Math.abs(b.height*2-size.height)<=1);
 if(!box)throw new Error('Native rendered bounds do not match exported PNG bounds.');
 return {bytes,bounds:{x:box.x-t[0][2],y:box.y-t[1][2],width:box.width,height:box.height}};
}
figma.showUI(__html__,{width:620,height:760,themeColors:true});
const selection=()=>figma.ui.postMessage({type:'selection',hostVersion:'0.5.0',nodes:figma.currentPage.selection.map(n=>({id:n.id,name:n.name,type:n.type,width:n.width,height:n.height}))});
figma.on('selectionchange',selection);
figma.ui.onmessage=async(msg:unknown)=>{
 if(!msg||typeof msg!=='object'||!('type'in msg))return;
 try{
  if(msg.type==='ready')selection();
  if(msg.type==='analyze'){
   if('selectionId'in msg&&figma.currentPage.selection[0]?.id!==msg.selectionId)throw new Error('Selection changed. Analyze the current selection again.');
   const mode='mode'in msg&&(msg.mode==='screen'||msg.mode==='component')?msg.mode:undefined;
   const selected=figma.currentPage.selection;
   const root=selected[0],bounds=root?.absoluteBoundingBox??root;
   const referenceExporter=async()=>{
    if(!root?.exportAsync)throw new Error('Reference export is unavailable in this host.');
    return root.exportAsync({format:'PNG',constraint:{type:'SCALE',value:1},contentsOnly:true,useAbsoluteBounds:true,colorProfile:'SRGB'});
   };
   const result=await analyzeWithAssets(selected,{mode},exportArtwork,referenceExporter,bounds);if(figma.currentPage.selection[0]?.id!==selected[0]?.id)throw new Error('Selection changed during artwork export. Analyze again.');figma.ui.postMessage({type:'result',result,requestId:'requestId'in msg?msg.requestId:undefined});
  }
  if(msg.type==='locate-many'&&'ids'in msg&&Array.isArray(msg.ids)){
   const ids=Array.from(new Set(msg.ids.filter((id):id is string=>typeof id==='string')));
   if(!ids.length||ids.length>10000)throw new Error('Choose between 1 and 10,000 affected layers.');
   const nodes=await Promise.all(ids.map(id=>figma.getNodeByIdAsync(id)));
   if(nodes.some(n=>!n||n.type==='DOCUMENT'||n.type==='PAGE'))throw new Error('Some affected layers no longer exist. Analyze again to refresh the report.');
   figma.viewport.scrollAndZoomIntoView(nodes as HostSceneNode[]);
  }
  if(msg.type==='locate'&&'id'in msg&&typeof msg.id==='string'){
   const node=await figma.getNodeByIdAsync(msg.id);
   if(node && node.type!=='DOCUMENT'&&node.type!=='PAGE'){figma.viewport.scrollAndZoomIntoView([node]);}else throw new Error('Layer no longer exists. Analyze again.');
  }
 }catch(error){figma.ui.postMessage({type:'error',message:error instanceof Error?error.message:String(error),operation:msg.type,requestId:'requestId'in msg?msg.requestId:undefined});}
};
selection();
