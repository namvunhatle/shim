export type SelectionMode = 'screen'|'component';
export type Issue = { ruleId?:string; severity:'blocker'|'warning'|'confirmation'|'info'; nodeId:string; layer:string; explanation:string; impact:string; fix:string };
export type PassedCheck = { nodeId:string; layer:string; check:string };
export type Color = { r:number; g:number; b:number; a:number };
export interface UINode {
  id:string; name:string; sourceType:string; kind:'container'|'text'|'rectangle'|'ellipse'|'image'|'unsupported';
  width:number; height:number; x:number; y:number;
  sizingX:'FIXED'|'HUG'|'FILL'; sizingY:'FIXED'|'HUG'|'FILL';
  layout:'VERTICAL'|'HORIZONTAL'|'NONE'; padding:[number,number,number,number]; gap:number;
  main:string; cross:string; selfAlign?:'MIN'|'CENTER'|'MAX'; fill?:Color; radius:number; border?:{color:Color;width:number};
  text?:{value:string;size:number;weight:number;family:string;italic:boolean;color?:Color;lineHeight?:number;letterSpacing:number;align:string;verticalAlign:string;resize:string};
  rawText?:string; children:UINode[]; limitations:string[]; clipsContent?:boolean;
  component?:{key?:string;description?:string;instance:boolean;properties?:Record<string,unknown>;variants?:Record<string,string>};
  constraints?:{horizontal:string;vertical:string};
  scroll:'NONE'|'VERTICAL'|'HORIZONTAL'|'BOTH'; scrollSupported:boolean; fixedWhenScrolling:boolean;
  paints:unknown[]; effects:unknown[]; sourceProperties:Record<string,unknown>; interactions:{trigger:string;actions:string[]}[];
  asset?:{resource:string;base64:string;widthPx:number;heightPx:number;scale:2;outset?:{x:number;y:number;width:number;height:number}};
  image?:{hash?:string;scaleMode?:string}; styleRefs:Record<string,string>;
}
export interface AndroidUISchema { version:2; mode:SelectionMode; root:UINode; assumptions:string[] }
export interface OutputFile { path:string; content:string; encoding?:'base64' }
export const hex = (c:Color) => [c.a,c.r,c.g,c.b].map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('').toUpperCase();
export const number = (n:number) => {if(!Number.isFinite(n))throw new Error('Cannot generate a non-finite dimension.');return String(Math.round(n*100)/100);};
export const walk = (n:UINode, fn:(n:UINode,parent?:UINode)=>void,p?:UINode):void => {fn(n,p);n.children.forEach(c=>walk(c,fn,n));};
export function overview(schema:AndroidUISchema){let total=0,supported=0,artwork=0;const byType:Record<string,number>={};walk(schema.root,n=>{total++;if(n.asset)artwork++;if(n.kind!=='unsupported'&&!n.limitations.length)supported++;byType[n.sourceType]=(byType[n.sourceType]??0)+1;});return {total,supported,artwork,unsupported:total-supported,byType};}
