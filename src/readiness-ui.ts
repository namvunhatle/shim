import type { Analysis } from './pipeline';
import type { Framework, FindingGroup } from './readiness';
import type { Issue } from './schema';
const el=(id:string)=>document.getElementById(id)!;
function element<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text?:string){const n=document.createElement(tag);n.className=className;if(text!==undefined)n.textContent=text;return n;}
function disclosure(label:string,className=''){const n=element('details',className);n.append(element('summary','',label));return n;}
function diagnostics(issues:readonly Issue[]){const list=element('div','diagnostics-list');for(const i of issues){const a=element('article','diagnostic');a.append(element('strong','',i.layer),element('code','',`${i.ruleId??'legacy'} · ${i.nodeId} · detector: ${i.severity}`),element('p','',i.explanation),element('p','',i.impact),element('p','',i.fix));list.append(a);}return list;}
function layers(group:FindingGroup,locate:(ids:string[])=>void){
 const block=element('div','affected-layers');const buttons=group.layers.map(l=>{const b=element('button','layer-button');b.append(element('span','',l.name),element('small','',l.path));b.title=`Locate ${l.path} (${l.id})`;b.onclick=()=>locate([l.id]);block.append(b);return {b,text:(l.path+' '+l.id).toLowerCase()};});
 const wrapper=element('div');if(buttons.length>8){const search=element('input','layer-search');search.placeholder='Find an affected layer…';search.setAttribute('aria-label','Find an affected layer');search.oninput=()=>buttons.forEach(({b,text})=>b.hidden=!text.includes(search.value.toLowerCase()));wrapper.append(search);}wrapper.append(block);return wrapper;
}
function card(g:FindingGroup,locate:(ids:string[])=>void,technicalTarget:HTMLElement){
 const a=element('article','finding-card');a.id='finding-'+g.id;a.dataset.groupId=g.id;a.dataset.owner=g.owner;a.dataset.level=g.level;
 const heading=element('div','finding-heading');heading.append(element('strong','finding-title',g.title),element('span','layer-count',`${g.layerCount} ${g.layerCount===1?'layer':'layers'}`));a.append(heading,element('p','finding-what',g.what),element('p','finding-why',g.why));
 const actions=element('div','finding-actions'),jump=element('button','locate-group','↗ Locate in Figma');jump.onclick=()=>locate(g.layers.map(l=>l.id));actions.append(jump);a.append(actions);
 const how=disclosure(g.owner==='generator'||g.owner==='developer'?'Implementation guidance':'How to fix','action-detail');let loaded=false;
 how.ontoggle=()=>{if(how.open&&!loaded){loaded=true;how.append(element('p','resolution',g.next),layers(g,locate));}};a.append(how);
 const technical=element('button','technical-link','Technical details');technical.onclick=()=>{const report=el('technical-report') as HTMLDetailsElement;report.open=true;technicalTarget.replaceChildren(element('p','',`${g.level} · ${g.owner} · ${g.evidence} · ${g.id}`),element('p','',`Root causes: ${g.roots.join(', ')}. References: ${g.layerCount} layers.`),diagnostics(g.diagnostics));technicalTarget.scrollIntoView?.({block:'nearest'});};actions.append(technical);return a;
}
// One leaf per action, thickest and orange for blockers: the readiness verdict as a feeler gauge.
function gauge(groups:readonly FindingGroup[]){const g=el('gauge');groups.slice(0,5).forEach((group,i)=>{const hot=group.level==='P0',leaf=element('div','leaf'+(hot?' hot':group.level==='P1'?' mid':''));leaf.style.width=(hot?100:group.level==="P1"?80:60)-i*4+"%";leaf.style.setProperty('--i',String(i));leaf.append(element('span','',group.title));g.append(leaf);});}
const label=(status:string)=>status==='READY FOR DEV REVIEW'?'Ready for Dev Review':status==='NEEDS ATTENTION'?'Needs Attention':'Cannot Generate Reliably';
export function clearReadiness(){
 for(const id of ['issues','passed','raw-diagnostics','positive-checks','generation-alert','optional-list','developer-list','generation-list','gauge'])el(id).replaceChildren();
 for(const id of ['readiness-counts','next-step','design-verdict'])el(id).textContent='';
 el('review-next').hidden=true;el('show-all').hidden=true;el('readiness-summary').removeAttribute('data-status');
 for(const id of ['technical-report','recommended','developer-notes','generation-limits'])(el(id) as HTMLDetailsElement).open=false;
 el('technical-count').textContent='Technical details';(el('technical-report') as HTMLDetailsElement).ontoggle=null;el('technical-report').querySelector('.restore-diagnostics')?.remove();for(const id of ['recommended','developer-notes','generation-limits'])el(id).hidden=true;
}
export function renderReadiness(analysis:Analysis,locate:(ids:string[])=>void,framework:Framework='compose'){
 clearReadiness();const report=analysis.readiness.frameworks[framework];
 for(const f of ['compose','xml'] as const){const b=el('readiness-'+f);b.classList.toggle('active',f===framework);b.setAttribute('aria-pressed',String(f===framework));b.title=label(analysis.readiness.frameworks[f].status);}
 el('status').textContent=label(report.status);el('readiness-summary').dataset.status=report.status;
 el('summary').textContent=report.headline;
 el('design-verdict').textContent=report.status==='CANNOT GENERATE RELIABLY'?`Design handoff: ${label(report.designStatus)}. ${report.designStatus==='NEEDS ATTENTION'?'Resolve the design actions below; generation gaps require developer work.':report.criticalSource==='design'?'A design decision needs resolving.':report.criticalSource==='both'?'Design decisions and generator gaps both apply.':'This is a generator limitation, not a request to redesign.'}`:'';
 const primary=report.primaryIds.map(id=>report.groups.find(g=>g.id===id)!);
 const optional=report.optionalIds.map(id=>report.groups.find(g=>g.id===id)!);
 el('readiness-counts').textContent=primary.length?`${primary.length} ${primary.length===1?'thing':'things'} to address before handoff${report.criticalDesignerCount?` · ${report.criticalDesignerCount} critical`:''}`:'No required design changes found by these checks.';
 el('next-step').textContent=report.nextStep;
 gauge(primary.length?primary:report.groups.filter(g=>g.level==="P0"));
 for(const check of report.checks)el('positive-checks').append(element('li','',`✓ ${check}`));
 const target=el('raw-diagnostics');
 const allDiagnostics=()=>{target.replaceChildren(element('p','','Original detector observations are retained below. Readiness is determined by the impact evaluation, not these legacy severities.'),diagnostics(analysis.issues));for(const item of analysis.readiness.audit)target.append(element('code','audit-line',`#${item.index+1} · ${framework}: ${item[framework]}`));};
 const restore=element('button','','Show all original observations');restore.onclick=allDiagnostics;el('technical-report').querySelector('.restore-diagnostics')?.remove();restore.classList.add('restore-diagnostics');el('technical-report').append(restore);
 const critical=report.groups.filter(g=>g.level==='P0'&&g.blocksGeneration);
 if(critical.length){const alert=element('div','generation-warning');alert.append(element('strong','',`${critical.length} critical ${report.criticalSource==='design'?'generation decision':'generation limitation'}${critical.length===1?'':'s'}`),element('p','',critical.map(g=>g.title).join(' · ')));const view=element('button','','Review generation blockers');view.onclick=()=>{const section=el('generation-limits') as HTMLDetailsElement;section.open=true;section.scrollIntoView?.({block:'nearest'});};alert.append(view);el('generation-alert').append(alert);}
 const cards=primary.map(g=>card(g,locate,target));cards.forEach((c,i)=>{c.hidden=i>=3;el('issues').append(c);});
 const showAll=el('show-all') as HTMLButtonElement;showAll.hidden=cards.length<=3;const hiddenCritical=primary.slice(3).filter(g=>g.level==='P0').length;
 showAll.textContent=`Show all ${cards.length} actions${hiddenCritical?` (${hiddenCritical} more critical)`:''}`;
 showAll.onclick=()=>{cards.forEach(c=>c.hidden=false);showAll.hidden=true;};
 (el('recommended') as HTMLDetailsElement).hidden=!optional.length;el('recommended-title').textContent=`${optional.length} optional ${optional.length===1?'improvement':'improvements'}`;
 optional.forEach(g=>el('optional-list').append(card(g,locate,target)));
 const dev=report.groups.filter(g=>g.owner==='developer');(el('developer-notes') as HTMLDetailsElement).hidden=!dev.length;el('developer-title').textContent='Developer notes';dev.forEach(g=>el('developer-list').append(card(g,locate,target)));
 // Include every P0 generation risk, including a design-owned generation ambiguity if present.
 const generation=report.groups.filter(g=>g.owner==='generator'||g.blocksGeneration);(el('generation-limits') as HTMLDetailsElement).hidden=!generation.length;el('generation-title').textContent=`Generation limitations${critical.length?` · ${critical.length} critical`:''}`;generation.forEach(g=>el('generation-list').append(card(g,locate,target)));
 const review=el('review-next') as HTMLButtonElement;review.hidden=!primary.length;review.textContent='Start with the first action';review.onclick=()=>{const first=cards[0];first.scrollIntoView?.({block:'nearest'});const how=first.querySelector('details')!;how.open=true;how.querySelector('summary')?.focus();};
 el('technical-count').textContent=`Technical details · ${analysis.issues.length} original observations`;
 for(const check of analysis.passed)el('passed').append(element('p','',`✓ ${check.layer}: ${check.check}`));
 const technical=el('technical-report') as HTMLDetailsElement;technical.ontoggle=()=>{if(technical.open&&!target.childNodes.length){allDiagnostics();}};
}
