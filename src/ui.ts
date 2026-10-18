import { Analysis } from './pipeline';
import { SelectionMode } from './schema';
import { renderReadiness, clearReadiness } from './readiness-ui';
import { zip } from './zip';
import { handoffFiles } from './handoff';
const el=(id:string)=>document.getElementById(id)!;
const button=(id:string)=>el(id) as HTMLButtonElement;
const files=el('files') as HTMLSelectElement,mode=el('mode') as HTMLSelectElement;
let connected=false;
let connectionTimer:ReturnType<typeof setTimeout>|undefined;
let result:Analysis|undefined,tab:'compose'|'xml'='compose',selectionId:string|undefined,requestId=0,validSelection=false;
const send=(message:unknown)=>parent.postMessage({pluginMessage:message},'*');
function clear(){result=undefined;['copy','export'].forEach(id=>button(id).disabled=true);files.disabled=true;files.replaceChildren(new Option('No generated files'));el('code').textContent='// Analyze the current selection.';clearReadiness();el('overview').textContent='No analysis yet.';}
function show(){['readiness-compose','readiness-xml'].forEach(id=>{el(id).classList.toggle('active',id==='readiness-'+tab);el(id).setAttribute('aria-pressed',String(id==='readiness-'+tab));});['compose','xml'].forEach(id=>el(id).classList.toggle('active',id===tab));if(!result){el('code').textContent=`// ${tab==='compose'?'Jetpack Compose':'Android XML'} — select a layer and analyze to generate code.`;return;}renderReadiness(result,ids=>send(ids.length===1?{type:'locate',id:ids[0]}:{type:'locate-many',ids}),tab);const output=result[tab];files.replaceChildren(...output.map((f,i)=>new Option(f.path,String(i))));files.disabled=false;previewFile();['compose','xml'].forEach(id=>el(id).classList.toggle('active',id===tab));}
button('analyze').onclick=()=>{clear();requestId++;button('analyze').disabled=true;el('message').textContent='Analyzing complete visible hierarchy…';el('status').textContent='Analyzing…';el('summary').textContent='Traversing visible layers…';send({type:'analyze',mode:mode.value as SelectionMode,selectionId,requestId});};
mode.onchange=()=>{requestId++;clear();button('analyze').disabled=!validSelection;el('status').textContent='Awaiting analysis';el('summary').textContent='Selection mode changed. Analyze again.';};
function previewFile(){if(!result)return;const file=result[tab][Number(files.value)];el('code').textContent=file.encoding==='base64'?`// Binary artwork: ${file.path}\n// Included in Export Files. PNG bytes are not editable code.`:file.content;button('copy').disabled=file.encoding==='base64';}
files.onchange=previewFile;
for(const id of ['compose','xml'] as const){const change=()=>{tab=id;show();};button(id).onclick=change;button('readiness-'+id).onclick=change;}
button('copy').onclick=async()=>{
 const text=el('code').textContent??'';
 try{await navigator.clipboard.writeText(text);el('message').textContent='Code copied.';}catch{
  const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();el('message').textContent=ok?'Code copied.':'Copy unavailable. Select the code and copy manually.';
 }
};
button('export').onclick=()=>{
 if(!result)return;
 const payload=zip(handoffFiles(result));
 const url=URL.createObjectURL(new Blob([payload as BlobPart],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='shim-handoff.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);el('message').textContent='Exported both implementations, artwork, resources, schema and readiness report.';
};
window.onmessage=(event:MessageEvent)=>{
 // Figma guarantees the pluginMessage envelope, not a particular event.source identity.
 // Desktop/web relay windows can differ from parent; validate the message instead.
 const m=event.data?.pluginMessage;if(!m||typeof m!=='object')return;
 if(m.type==='selection'&&Array.isArray(m.nodes)){
  connected=true;if(connectionTimer)clearTimeout(connectionTimer);el('connection').textContent='Figma connected · '+(m.hostVersion??'older host');
  requestId++;clear();validSelection=m.nodes.length===1&&['FRAME','COMPONENT','INSTANCE','GROUP'].includes(m.nodes[0].type);selectionId=validSelection?m.nodes[0].id:undefined;button('analyze').disabled=!validSelection;mode.disabled=!validSelection;
  if(validSelection)mode.value=m.nodes[0].type==='FRAME'?'screen':'component';
  el('selected').textContent=validSelection?m.nodes[0].name:'Select one Frame, Component, Instance, or Group';el('dimensions').textContent=validSelection?`${m.nodes[0].type} · ${Math.round(m.nodes[0].width)} × ${Math.round(m.nodes[0].height)} px`:'Select a full screen or an individual component.';el('status').textContent='Awaiting analysis';el('summary').textContent='Analyze to check Android implementation readiness.';el('message').textContent='';
 }
 if(m.type==='error'){
  if(m.requestId!==undefined&&m.requestId!==requestId)return;
  if(m.operation==='analyze'){clear();el('status').textContent='Analysis failed';el('summary').textContent='Resolve the reported error and analyze again.';}el('message').textContent=m.message;button('analyze').disabled=!validSelection;
 }
 if(m.type==='result'){
  if(m.requestId!==requestId)return;
  result=m.result;button('analyze').disabled=!validSelection;
  el('overview').textContent=`${result!.schema.mode==='screen'?'Full screen':'Individual component'} · ${result!.overview.total} nodes analyzed${result!.overview.artwork?` · ${result!.overview.artwork} artwork files included`:''}`;
  show();['copy','export'].forEach(id=>button(id).disabled=false);el('message').textContent=result!.reference?.status==='captured'?'Package includes a Figma reference PNG for comparison. Android output is not visually verified.':'Package available. Figma reference unavailable: '+(result!.reference?.status==='unavailable'?result!.reference.reason:'not captured');
 }
};
function refreshSelection(){
 connected=false;el('connection').textContent='UI ready · Connecting to Figma…';
 if(connectionTimer)clearTimeout(connectionTimer);
 connectionTimer=setTimeout(()=>{if(!connected){el('connection').textContent='No response from Figma';el('message').textContent='The UI is running but the Figma host has not replied. Click Refresh selection, or close and reopen the development plugin from this project manifest.';}},3000);
 send({type:'ready'});
}
button('refresh').onclick=refreshSelection;
// Listener is installed before requesting host state.
refreshSelection();
