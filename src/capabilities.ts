import {AndroidUISchema,UINode,walk} from './schema';
export const absolute=(n:UINode)=>n.sourceProperties.layoutPositioning==='ABSOLUTE';
/** One contiguous flow block can be kept as a real Row/Column between overlay siblings.
 * Interleaved flow blocks or scroll overlays require a different layout algorithm. */
export function overlayFlow(n:UINode){
 const flow=n.children.map((c,i)=>absolute(c)?-1:i).filter(i=>i>=0);
 return n.layout!=='NONE'&&n.scroll==='NONE'&&n.children.some(absolute)&&
  (!flow.length||flow[flow.length-1]-flow[0]+1===flow.length)&&
  !n.limitations.some(l=>/Reversed sibling/.test(l));
}
export function reconcileCapabilities(schema:AndroidUISchema){
 schema.root.sourceProperties.androidHostViewport=schema.mode==='screen';
 walk(schema.root,(n,p)=>{
  // Older captured schemas used the bitmap's ink bounds as the flow size. Recover the
  // original layout slot while keeping the same native PNG and its verified ink bounds.
  if(n.asset&&!n.asset.outset&&p&&p.layout!=='NONE'&&!absolute(n)){
   const original=n.sourceProperties.rasterizedOriginalBounds as {x:number;y:number;width:number;height:number}|undefined;
   if(original&&[original.x,original.y,original.width,original.height].every(Number.isFinite)&&original.width>0&&original.height>0&&
    (Math.abs(n.x-original.x)>.01||Math.abs(n.y-original.y)>.01||Math.abs(n.width-original.width)>.01||Math.abs(n.height-original.height)>.01)){
    n.asset.outset={x:n.x-original.x,y:n.y-original.y,width:n.width,height:n.height};Object.assign(n,original);
   }
  }
  if(n.sourceType==='SLOT'){n.kind='container';n.limitations=n.limitations.filter(l=>!l.startsWith('Layer type SLOT '));}
  if(p&&(p.layout==='NONE'||absolute(n)&&overlayFlow(p))){
   if(supportsConstraints(p,n))n.limitations=n.limitations.filter(l=>!l.startsWith('Responsive constraints require manual'));
   else if(n.constraints&&!n.limitations.some(l=>l.startsWith('Responsive constraints')))n.limitations.push('Responsive constraints require manual implementation; current coordinates are preserved.');
  }
  if(p&&overlayFlow(p))n.limitations=n.limitations.filter(l=>!l.startsWith('Absolute children inside Auto Layout'));
 });
}
export function supportsConstraints(parent:UINode,child:UINode){
 return (['horizontal','vertical'] as const).every((axis,i)=>{const value=child.constraints?.[axis]??'MIN';return value==='MIN'||['MAX','CENTER','STRETCH'].includes(value)&&(parent.sourceProperties.androidHostViewport===true||(i===0?parent.sizingX:parent.sizingY)!=='HUG');});
}
export function anchoredBox(n:UINode){return (n.layout==='NONE'||overlayFlow(n))&&n.children.some(c=>(n.layout==='NONE'||absolute(c))&&supportsConstraints(n,c)&&[c.constraints?.horizontal,c.constraints?.vertical].some(v=>v&&v!=='MIN'));}
