import {overlayFlow} from './capabilities';
import { AndroidUISchema, Issue, UINode } from './schema';

export type Framework='compose'|'xml';
export type Impact='P0'|'P1'|'P2'|'P3';
export type Owner='designer-fix'|'designer-decision'|'developer'|'generator';
export type ReadinessState='READY FOR DEV REVIEW'|'NEEDS ATTENTION'|'CANNOT GENERATE RELIABLY';
export interface FindingGroup {
 id:string; level:Impact; owner:Owner; evidence:'confirmed'|'potential'|'unknown';
 title:string; what:string; why:string; next:string; blocksGeneration:boolean;
 layers:{id:string;name:string;path:string}[]; roots:string[]; diagnostics:Issue[];
 layerCount:number; occurrenceCount:number;
}
export interface FrameworkReadiness {
 framework:Framework; status:ReadinessState; designStatus:'READY FOR DEV REVIEW'|'NEEDS ATTENTION';
 headline:string; nextStep:string; groups:FindingGroup[]; primaryIds:string[]; optionalIds:string[];
 criticalDesignerCount:number; generationBlockerCount:number; criticalSource:'design'|'generator'|'both'|null;
 checks:string[];
}
export interface ReadinessReport {
 frameworks:Record<Framework,FrameworkReadiness>; diagnosticCount:number;
 audit:{index:number;compose:string;xml:string}[];
}
type Spec=Pick<FindingGroup,'id'|'level'|'owner'|'evidence'|'title'|'what'|'why'|'next'|'blocksGeneration'>;
const both:Framework[]=['compose','xml'];
const rank:Record<Impact,number>={P0:0,P1:1,P2:2,P3:3};
const spec=(id:string,level:Impact,owner:Owner,title:string,what:string,why:string,next:string,evidence:Spec['evidence']='confirmed',blocksGeneration=false):Spec=>({id,level,owner,title,what,why,next,evidence,blocksGeneration});
const designer=(g:Pick<FindingGroup,'owner'>)=>g.owner==='designer-fix'||g.owner==='designer-decision';
export const requiresAttention=(g:FindingGroup)=>designer(g)&&(g.level==='P0'||g.level==='P1'&&g.evidence==='confirmed');

/** Actual generator behavior, not hypothetical Android capability. No importance is inferred
 * from layer names, component names, screen identity, or missing business requirements. */
export function buildReadiness(schema:AndroidUISchema,issues:readonly Issue[]):ReadinessReport {
 const nodes=new Map<string,UINode>(),parents=new Map<string,UINode>(),paths=new Map<string,string>(),ordered:UINode[]=[];
 const index=(n:UINode,p?:UINode)=>{nodes.set(n.id,n);if(p)parents.set(n.id,p);paths.set(n.id,p?paths.get(p.id)+' / '+n.name:n.name);ordered.push(n);n.children.forEach(c=>index(c,n));};index(schema.root);
 const hasContent=new Map<string,boolean>();
 const content=(n:UINode):boolean=>{if(hasContent.has(n.id))return hasContent.get(n.id)!;const yes=!!(n.text?.value.trim()||n.rawText?.trim()||n.interactions.length||n.children.some(content));hasContent.set(n.id,yes);return yes;};content(schema.root);
 const maps={compose:new Map<string,FindingGroup>(),xml:new Map<string,FindingGroup>()};
 const references=new Map<string,Set<string>>();
 const audit=issues.map((_i,index)=>({index,compose:'P3 · technical observation',xml:'P3 · technical observation'}));
 function add(targets:Framework[],s:Spec,affected:UINode[],root:UINode,diagnostic?:Issue,rawIndex?:number){
  for(const framework of targets){
   let g=maps[framework].get(s.id);
   if(!g){g={...s,layers:[],roots:[],diagnostics:[],layerCount:0,occurrenceCount:0};maps[framework].set(s.id,g);references.set(framework+':'+s.id,new Set());}
   if(rank[s.level]<rank[g.level]||(s.level===g.level&&s.evidence==='confirmed'&&g.evidence!=='confirmed')){g.level=s.level;g.evidence=s.evidence;g.title=s.title;g.what=s.what;g.why=s.why;g.next=s.next;}
   g.blocksGeneration ||= s.blocksGeneration;
   if(!g.roots.includes(root.id))g.roots.push(root.id);
   const seen=references.get(framework+':'+s.id)!;
   for(const n of affected)if(!seen.has(n.id)){seen.add(n.id);g.layers.push({id:n.id,name:n.name,path:paths.get(n.id)!});}
   if(diagnostic&&!g.diagnostics.includes(diagnostic))g.diagnostics.push(diagnostic);
   g.layerCount=g.layers.length;g.occurrenceCount=g.diagnostics.length;
   if(rawIndex!==undefined)audit[rawIndex][framework]=`${s.level} · ${s.owner} · ${s.id}`;
  }
 }
 const note=(id:string,title:string,what:string,next:string)=>spec(id,'P3','developer',title,what,'This is a normal implementation responsibility, not an established design defect.',next);
 const ancestor=(n:UINode,predicate:(p:UINode)=>boolean)=>{let p=parents.get(n.id);while(p){if(predicate(p))return p;p=parents.get(p.id);}return undefined;};
 const offsetTo=(n:UINode,p:UINode)=>{let x=0,y=0,current=n;while(current!==p){x+=current.x;y+=current.y;const up=parents.get(current.id);if(!up)break;current=up;}return {x,y};};
 const outside=(n:UINode,p:UINode)=>{const {x,y}=offsetTo(n,p);return x<-.5||y<-.5||x+n.width>p.width+.5||y+n.height>p.height+.5;};
 const whollyOutside=(n:UINode,p:UINode)=>{const {x,y}=offsetTo(n,p);return x>=p.width||y>=p.height||x+n.width<=0||y+n.height<=0;};
 // Resolve observations at the boundary that actually controls visibility. A supported scroll
 // viewport already accounts for off-screen content; decorative overflow is not a design task.
 function boundary(n:UINode){let p=parents.get(n.id);while(p){if(p.scroll!=='NONE')return undefined;if(p.clipsContent&&outside(n,p))return p;p=parents.get(p.id);}return undefined;}
 const contextRoot=(n:UINode)=>ancestor(n,p=>p.sourceType==='GROUP'||!!p.component)??n;

 for(let i=0;i<issues.length;i++){
  const issue=issues[i],n=nodes.get(issue.nodeId);if(!n)continue;const p=parents.get(n.id),rule=issue.ruleId;
  const emit=(s:Spec,targets:Framework[]=both,root=n,affected=[n])=>add(targets,s,affected,root,issue,i);
  if((n.width===0||n.height===0)&&((rule==='fixed-text'&&!!n.text?.value.trim())||rule==='touch-target')){
   emit(spec('unusable-bounds','P0','designer-fix','Give content a visible size',`“${n.name}” has zero ${n.width===0?'width':'height'}.`,'Its specified bounds cannot display text or provide a usable tap area.','Set a non-zero visible size for the affected content, then analyze again.'));continue;
  }
  switch(rule){
   case 'fixed-text': {
    const t=n.text!;const explicitLines=t.value.split('\n').length;
    const measuredOverflow=t.lineHeight!==undefined&&explicitLines*t.lineHeight>n.height+.5;
    emit(spec('text-room',measuredOverflow?'P1':'P2','designer-fix',measuredOverflow?'Text exceeds its fixed height':'Try longer wording in fixed text boxes',measuredOverflow?`“${n.name}” specifies ${explicitLines} text lines at ${t.lineHeight}px spacing inside ${n.height}px of height.`:`“${n.name}” uses a fixed-height text box.`,'Longer wording or a larger reading size can cut off text.',measuredOverflow?'Increase this text box height or use auto-height so the specified lines fit.':'Optionally try longer wording or larger text in these boxes; keep fixed sizing if that is intentional.',measuredOverflow?'confirmed':'potential'));break;
   }
   case 'text-contrast': {
    const covered=p?.children.some(s=>s!==n&&(s.fill||s.image)&&s.x<n.x+n.width&&s.x+s.width>n.x&&s.y<n.y+n.height&&s.y+s.height>n.y);
    const uncertain=covered||!!ancestor(n,a=>a.sourceProperties.opacity!==undefined&&a.sourceProperties.opacity!==1)||n.sourceProperties.opacity!==undefined&&n.sourceProperties.opacity!==1;
    emit(spec('text-contrast','P1','designer-fix','Improve text contrast',`The specified text and background colors on “${n.name}” have low contrast.`,'The words may be difficult to read.',uncertain?'Review the text against its actual artwork before changing the colors.':'Adjust these text or background colors until they meet the contrast target shown in technical details.',uncertain?'potential':'confirmed'));break;
   }
   case 'small-text':case 'line-height':
    emit(spec(rule,'P2','designer-fix',rule==='small-text'?'Review the smallest text':'Review tight line spacing',rule==='small-text'?`“${n.name}” uses ${n.text?.size}px text.`:`“${n.name}” has line spacing smaller than its text size.`,'Some readers may find the text harder to read.','Optionally check the text at the intended reading size before changing it.','potential'));break;
   case 'fill-hug':
    if(content(n)&&p)emit(spec('size-relationship','P1','designer-decision','Choose which layer sets the size',`“${n.name}” fills the same direction in which “${p.name}” sizes itself from its children.`,'A developer needs an independent size boundary to reproduce that resizing relationship.','Specify whether the parent sets the available space or the child determines the content size.'),both,p);else emit(note('layout-notes','Layout details for the developer','Measured positions and sizing are retained.','Match the intended size relationship when implementing this section.'));break;
   case 'prototype-action': {
    const rawReactions=(n.sourceProperties.reactions??[]) as {actions?:{type:string;destinationId?:string}[];action?:{type:string;destinationId?:string}}[];
    const missing=n.interactions.some(r=>['ON_CLICK','ON_PRESS','ON_TAP'].includes(r.trigger)&&!r.actions.length)||rawReactions.some(r=>(r.actions??(r.action?[r.action]:[])).some(a=>a.type==='NODE'&&!a.destinationId));
    if(missing)emit(spec('undefined-action','P1','designer-decision','Choose an outcome for this tap',`“${n.name}” has a tap trigger with no action.`,'The developer cannot infer what tapping it should do.','Specify the destination or outcome for this trigger, or remove the trigger if it is not intended.'));
    else emit(note('interaction-notes','Implement the specified interactions','Prototype actions are recorded in the technical report.','Wire the declared actions to the app; no business logic is generated.'));break;
   }
   case 'touch-target':emit(spec('tap-area','P1','developer','Provide a comfortable tap area',`“${n.name}” has a declared tap target measuring ${n.width} × ${n.height}px.`,'The visible control can keep its appearance while the app provides a larger hit area.','Provide at least a 48 × 48dp hit area without forcing a change to the artwork.'));break;
   case 'font-mapping':emit(spec('font-resources','P2','developer','Map the specified fonts','The design specifies font families and weights; generated text uses the platform fallback.','Fallback fonts can change text wrapping and spacing.','Add the specified licensed fonts or agree a replacement before checking visual fidelity.'));break;
   case 'screen-insets':emit(note('system-insets','Handle system bars and the keyboard','The selection does not establish a runtime system-bar or keyboard policy.','Apply the app’s inset policy and test the screen on a device. No inset sizes have been guessed.'));break;
   case 'component-states':emit(note('component-notes','Use the observed component variants','The current component and variant values are recorded; required alternatives were not inspected.','Implement states required by the feature. No missing state is asserted from a single instance.'));break;
   case 'style-mapping':case 'variable-mapping':emit(note('theme-notes','Connect styles to the app theme','Resolved colors and other supported values are available.','Map shared styles and variable modes to the app’s existing theme when relevant.'));break;
   case 'image-description':emit(note('accessibility-notes','Describe meaningful images','The role of these images is unknown; decorative and meaningful images are not inferred from names.','Confirm image semantics when implementing accessibility.'));break;
   case 'static-layout':case 'screen-static-layout':case 'fill-static':case 'content-overflow':
    emit(note('layout-notes','Review layout on the supported device sizes','The report retains exact coordinates and measured bounds.','Use the declared layout and review resizing in the host app. Fixed positions and decorative overflow are not automatically design errors.'));break;
   case 'content-clipping': {
    emit(note('clipping-context','Clipping context','The declared content boundary is mapped in both implementations.','Keep the intended boundary; verify rounded edges during Android visual review.'));break;
   }
   case 'supported-scroll':emit(note('scroll-notes','Explicit scrolling is mapped','This bounded layout has a supported prototype scroll direction.','Verify gestures and scroll extent in the app.'));break;
   case 'text-color':
    emit(spec('text-color','P2','developer','Match the intended text color','No explicit supported text color is available for these text layers.','The generated output inherits the app theme.','Use the original design when choosing the app’s text color.'));break;
   case 'pinned-content':emit(spec('scroll-generation','P0','generator','Pinned content would scroll incorrectly',`“${n.name}” has fixed or sticky scroll behavior that is not generated.`,'The exported layout would move content that the design keeps pinned.','Implement this scrolling behavior manually. Keep the intended design.','confirmed',true));break;
   case 'text-alignment':case 'text-vertical-alignment':case 'baseline-alignment':
    emit(spec('text-placement','P1','generator','Text placement needs manual matching','The generator does not reproduce this text alignment.','Text placement may differ in the generated version.','Match the original text placement when integrating the generated code.'));break;
   case 'generator-property': {
    const text=issue.explanation;
    if(/Image asset|Layer type/.test(text)){
     if(n.width===0||n.height===0){emit(note('empty-artwork','Empty artwork bounds','The unsupported artwork has no visible area in this snapshot.','Retain this diagnostic for the developer; no visible content loss is asserted.'));break;}
     emit(spec('missing-artwork','P0','generator','Visible artwork is replaced by placeholders','Source artwork is absent from the generated package.','The generated screen cannot faithfully reproduce these visible layers. Their decorative or essential role is not guessed.','Supply the original assets and replace the placeholders in code. No design change is required.','confirmed',true),both,contextRoot(n));break;
    }
    if(/Mixed text|Incomplete typography|Invalid text metrics|control characters/.test(text)&&!n.text){
     emit(spec('missing-text','P0','generator','Text content is replaced by a placeholder',`The generator cannot represent the text on “${n.name}”.`,'The generated screen would be missing the original text, even if the Figma styling is valid.','Implement the original text and styling manually or extend the generator’s text support.','confirmed',true));break;
    }
    if(/Absolute children inside Auto Layout/.test(text)&&p){
     if(overlayFlow(p)){audit[i].compose=audit[i].xml='covered · overlay separated from layout flow';break;}
     const material=content(p)&&n.width>0&&n.height>0;
     emit(spec('absolute-flow',material?'P0':'P1','generator','Overlaid layers would enter the content flow',`The generator inserts overlaid children into the normal layout of “${p.name}”.`,'This changes positioning and can push the rest of the screen away from its designed layout.','Keep the design. Implement the overlays in a separate layer rather than using this generated layout unchanged.','confirmed',material),both,p,[p,n]);break;
    }
    if(/Scroll configuration|Wrapping Auto Layout/.test(text)){
     const material=content(n);
     emit(spec('layout-generation',material?'P0':'P1','generator','Required layout behavior is not generated','The design specifies layout or scroll behavior that the current generator cannot reproduce.','The exported structure can behave materially differently from this design.','Implement this layout behavior manually before using the generated screen.','confirmed',material),both,n);break;
    }
    if(/Layout mode|Reversed sibling|Negative item spacing/.test(text)){emit(spec('layout-fidelity','P1','generator','Some layout details need manual matching','The generator simplifies this layout detail.','The current positions or stacking may differ from the design.','Review and match the source layout in code.'));break;}
    if(/Responsive constraints|LAYER_BLUR|BACKGROUND_BLUR|Partial ellipse|Main-axis alignment|Cross-axis alignment|Min\/max sizing/.test(text)){
     emit(spec('appearance-behavior','P1','generator','Some appearance or sizing needs manual matching','This blur, geometry, alignment, or sizing behavior is not reproduced.','The generated appearance or resizing can differ from the original.','Match the affected property in code using the source values in technical details.'));break;
    }
    if(/Visual effects|corner|radii|border|stroke|smoothing/.test(text)){
     emit(spec('visual-details','P3','generator','Visual finishing details need manual matching','Some effects, corners, or border styles are simplified.','These finishing differences do not establish a critical design problem.','Match these original details during visual review.'));break;
    }
    if(/solid fill|Mixed fill|Invalid fill|opacity|Rotation|Flipped|Blend|Masks/.test(text)){
     emit(spec('visual-fidelity','P1','generator','Some visual appearance needs manual matching','Some fills, transparency, transforms, or masks are not reproduced.','The generated appearance can differ substantially from the design.','Match these properties in code before reviewing visual fidelity.'));break;
    }
    emit(spec('generator-details','P3','generator','Additional generator details','Some design properties require manual implementation.','The original details are retained in the technical report.','Review these details when integrating the generated code.'));break;
   }
   default:emit(note('other-notes','Additional technical observations','Unclassified observations remain available without asserting a design defect.','Review the original technical details if relevant to implementation.'));
  }
 }
 // Potential crop risks are evaluated at the controlling boundary, not on every decorative
 // descendant. A supported scroll ancestor handles content outside the current viewport.
 for(const n of ordered){
  if(!(n.text?.value.trim()||n.interactions.length))continue;
  const b=boundary(n);if(!b||!b.clipsContent)continue;
  const ancestorSame=ancestor(n,a=>a!==b&&outside(a,b));
  add(both,spec('cropped-content','P1','designer-decision','Confirm whether this content should be cropped',`Text or a declared control extends outside “${b.name}”, which clips its children.`,'Part of this content may be unreachable unless the crop is intentional.','Locate the content and confirm whether it should remain cropped, move inside the frame, or be reachable by scrolling.','potential'),[n],ancestorSame??b);
 }
 const evaluate=(framework:Framework):FrameworkReadiness=>{
  const groups=Array.from(maps[framework].values()).sort((a,b)=>rank[a.level]-rank[b.level]||Number(designer(b))-Number(designer(a))||a.id.localeCompare(b.id));
  // Only a root cause is shown, with every descendant reference retained in the same topic.
  for(const g of groups)g.roots=g.roots.filter(id=>!g.roots.some(other=>other!==id&&!!ancestor(nodes.get(id)!,p=>p.id===other)));
  const primary=groups.filter(requiresAttention),optional=groups.filter(g=>designer(g)&&!requiresAttention(g)&&g.level!=='P3');
  const critical=groups.filter(g=>g.level==='P0'&&g.blocksGeneration),criticalDesigner=primary.filter(g=>g.level==='P0');
  const criticalDesign=critical.some(designer),criticalGenerator=critical.some(g=>g.owner==='generator');
  const status:ReadinessState=critical.length?'CANNOT GENERATE RELIABLY':primary.length?'NEEDS ATTENTION':'READY FOR DEV REVIEW';
  const count=primary.length;
  const headline=criticalGenerator?(count?`${count} design ${count===1?'action needs':'actions need'} attention. The generated output also needs manual implementation.`:'Your design can be reviewed, but this generated output needs manual implementation.'):criticalDesign?'A required design decision prevents reliable generation.':count?`${count} ${count===1?'thing':'things'} to address before handoff.`:'No confirmed critical or important designer-owned issues found.';
  const essential=ordered.filter(n=>n.sourceType==='TEXT'||n.kind==='image'||n.kind==='unsupported');
  const checks:string[]=[];
  if(!groups.some(g=>['absolute-flow','layout-generation','size-relationship'].includes(g.id)&&rank[g.level]<=1))checks.push('Basic layout structure mapped');
  if(ordered.some(n=>n.sourceType==='TEXT')&&ordered.filter(n=>n.sourceType==='TEXT').every(n=>!!n.text))checks.push('Text content represented');
  if(essential.length&&!groups.some(g=>g.id==='missing-artwork'||g.id==='missing-text'))checks.push('Visible content represented');
  return {framework,status,designStatus:primary.length?'NEEDS ATTENTION':'READY FOR DEV REVIEW',headline,nextStep:primary[0]?.next??(critical.length?'Review the generation blockers with your developer; do not use this output unchanged.':'Share the design for developer review. Optional improvements do not block handoff.'),groups,primaryIds:primary.map(g=>g.id),optionalIds:optional.map(g=>g.id),criticalDesignerCount:criticalDesigner.length,generationBlockerCount:critical.length,criticalSource:criticalDesign&&criticalGenerator?'both':criticalDesign?'design':criticalGenerator?'generator':null,checks};
 };
 return {frameworks:{compose:evaluate('compose'),xml:evaluate('xml')},diagnosticCount:issues.length,audit};
}
