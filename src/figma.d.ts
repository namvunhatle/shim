// Narrow host contract: only APIs used by this plugin. Parser input remains structural.
interface HostSceneNode { readonly id:string; readonly name:string; readonly type:string; readonly width:number; readonly height:number;readonly absoluteRenderBounds?:{x:number;y:number;width:number;height:number}|null;readonly absoluteBoundingBox?:{x:number;y:number;width:number;height:number}|null;readonly parent?:{type?:string;absoluteTransform?:number[][]}|null;exportAsync?(settings:{format:'PNG';constraint:{type:'SCALE';value:number};contentsOnly:boolean;useAbsoluteBounds:boolean;colorProfile:'SRGB'}):Promise<Uint8Array> }
declare const __html__:string;
declare const figma:{
 showUI(html:string,options:{width:number;height:number;themeColors:boolean}):void;
 readonly currentPage:{readonly selection:readonly HostSceneNode[]};
 ui:{postMessage(message:unknown):void;onmessage:(message:unknown)=>void|Promise<void>};
 on(event:'selectionchange'|'documentchange',callback:()=>void):void;
 getNodeByIdAsync(id:string):Promise<HostSceneNode|null>;
 viewport:{scrollAndZoomIntoView(nodes:readonly HostSceneNode[]):void};
};
