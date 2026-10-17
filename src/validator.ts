import { AndroidUISchema, Issue, PassedCheck, walk } from './schema';
export function validate(schema:AndroidUISchema):Issue[]{
 const issues:Issue[]=[];
 walk(schema.root,(n,p)=>{
  const add=(ruleId:string,severity:Issue['severity'],explanation:string,fix:string,impact:string)=>issues.push({ruleId,severity,nodeId:n.id,layer:n.name,explanation,impact,fix});
  n.limitations.forEach(l=>add('generator-property','blocker',l,'Implement this property manually or simplify the Figma specification.','Both generated implementations contain a partial representation / placeholder for this property.'));
  if(n.text){
   if(n.text.resize==='NONE'||n.sizingY==='FIXED')add('fixed-text','warning','Fixed text bounds may clip translated content or larger Android font scales.','Use auto-height / Hug height and test long strings and font scaling.','Text may become unreadable under Android font scaling or localization.');
   add('font-mapping','confirmation',`Font “${n.text.family}” needs Android mapping; generated code uses the platform font.`,'Supply a licensed font resource and map its weight/style in both implementations.','Font metrics and line wrapping can differ. Needs confirmation.');
   if(!n.text.color)add('text-color','confirmation','No supported explicit text color is available.','Confirm a theme color or specify a solid text fill.','Generated text inherits the Android theme color; visual equivalence is unknown.');
   if(n.text.size<12)add('small-text','warning','Text is smaller than 12sp under the default unit mapping.','Review readability at Android font scaling settings.','Small text can be difficult to read.');
   if(!['LEFT','RIGHT','CENTER'].includes(n.text.align))add('text-alignment','blocker',`Text alignment ${n.text.align} is unsupported.`,'Use left, center, or right alignment, or implement alignment manually.','The generated fallback alignment does not reproduce the design.');
   if(n.text.verticalAlign!=='TOP')add('text-vertical-alignment','blocker',`Text vertical alignment ${n.text.verticalAlign} requires manual implementation.`,'Map fixed text box vertical alignment explicitly in Android.','Default Android text placement can differ within fixed bounds.');
   const bg=p?.fill,fg=n.text.color;
   if(bg&&fg&&bg.a===1&&fg.a===1){
    const lum=(c:typeof bg)=>[c.r,c.g,c.b].map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
    const a=lum(bg),b=lum(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),threshold=n.text.size>=24||(n.text.size>=18.67&&n.text.weight>=700)?3:4.5;
    if(ratio<threshold)add('text-contrast','warning',`Text contrast against its immediate solid parent is ${ratio.toFixed(2)}:1.`,`Review text/background colors; target at least ${threshold}:1 for this text size.`,'Text contrast may not meet accessibility requirements. This check does not account for overlapping siblings.');
   }
   if(n.text.lineHeight!==undefined&&n.text.lineHeight<n.text.size)add('line-height','warning','Specified line height is smaller than font size.','Verify glyph clipping and line overlap with the mapped Android font.','Android font metrics may clip or overlap text.');
  }
  if(n.layout==='NONE'&&n.children.length)add('static-layout','confirmation','Fixed-position layout preserves current coordinates; responsive behavior is unspecified.','Document resize behavior or add Auto Layout if this layout should adapt.','Resizing this container may cause overlap. Needs confirmation.');
  if(n.cross==='BASELINE')add('baseline-alignment','blocker','Baseline alignment is unsupported.','Implement baseline alignment manually.','Generated start alignment does not preserve baseline alignment.');
  if(p?.layout==='NONE'&&(n.sizingX==='FILL'||n.sizingY==='FILL'))add('fill-static','blocker','Fill sizing in a fixed-position parent is ambiguous for this exporter.','Use explicit dimensions or a supported Auto Layout parent.','Both outputs lack a defined flexible measurement policy.');
  if(p&&p.layout!=='NONE'&&!(p===schema.root&&schema.mode==='screen')&&((p.layout==='HORIZONTAL'&&n.sizingX==='FILL'&&p.sizingX==='HUG')||(p.layout==='VERTICAL'&&n.sizingY==='FILL'&&p.sizingY==='HUG')))add('fill-hug','blocker','Fill sizing depends on a Hug parent on the same axis.','Give the parent a bounded size or change the child sizing.','Compose weights and XML measurement cannot resolve this dependency reliably.');
  // Coordinates are actual measured Figma bounds. Never infer scroll from layer names or size alone.
  const overflow=n.children.filter(c=>c.x<-.5||c.y<-.5||c.x+c.width>n.width+.5||c.y+c.height>n.height+.5);
  if(overflow.length){
   const crossOverflow=overflow.some(c=>n.scroll==='VERTICAL'?(c.x<-.5||c.x+c.width>n.width+.5):n.scroll==='HORIZONTAL'?(c.y<-.5||c.y+c.height>n.height+.5):true);
   if(!n.scrollSupported||crossOverflow)add('content-overflow','warning',`${overflow.length} visible child bounds extend outside this container${n.clipsContent?' with clipping enabled':''}.`,'Confirm whether overflow is intentional, clipped, or should scroll; specify prototype overflow behavior if scrolling is required.','Content may be clipped or unreachable on Android. Scrolling is not invented.');
  }
  if(n.clipsContent&&!n.scrollSupported)add('content-clipping','info','Content clipping maps to both Android outputs.','Verify the intended boundary and rounded edges during Android visual review.','Declared clipping is mapped; pixel fidelity has not been rendered or compared.');
  if(n.fixedWhenScrolling)add('pinned-content','blocker','Fixed / sticky scrolling behavior is not generated.','Implement pinned content separately in both Android layouts.','Scrolling behavior would differ if this node moved with content.');
  if(n.scrollSupported)add('supported-scroll','info',`Explicit ${n.scroll.toLowerCase()} prototype scrolling maps to Android scroll containers.`,'Verify scroll extent and gestures in the Android app.','Scroll direction is mapped; gesture parity has not been rendered or verified.');
  for(const reaction of n.interactions){
   if(['ON_CLICK','ON_PRESS','ON_TAP'].includes(reaction.trigger)&&(n.width<48||n.height<48))add('touch-target','warning',`Prototype ${reaction.trigger} target is ${n.width} × ${n.height}dp under the unit mapping.`,'Provide at least a 48 × 48dp hit area or document an expanded Android touch target.','The declared interactive target may be difficult to activate.');
   add('prototype-action','confirmation',`Prototype trigger ${reaction.trigger} declares ${reaction.actions.join(', ')||'no action specification'}.`,'Confirm runtime action, semantics, enabled state, and event ownership with the developer.','Prototype behavior is documented but no click handler or business logic is generated. Needs confirmation.');
  }
  if(n.component)add('component-states','confirmation',`Component${n.component.instance?' instance':''} metadata is available${n.component.variants?`; current variants: ${Object.entries(n.component.variants).map(([k,v])=>`${k}=${v}`).join(', ')}`:''}; required state coverage is unknown.`,'Confirm which Android states are required; provide those designs if applicable.','No missing state is asserted from names or a single variant. Needs confirmation.');
  if(n.image)add('image-description','confirmation','Image semantics are unspecified.','Confirm whether this image is decorative; otherwise provide an Android content description.','Generated image has no spoken description until its accessibility role is defined in the app. Needs confirmation.');
  if(n.sourceProperties.boundVariables&&Object.keys(n.sourceProperties.boundVariables as object).length)add('variable-mapping','confirmation','Figma variables are bound to this layer.','Map variable aliases to Android theme tokens and mode overrides.','Only resolved values are generated; runtime theme modes are not inferred.');
  if(Object.keys(n.styleRefs).length)add('style-mapping','confirmation',`Figma style references: ${Object.keys(n.styleRefs).join(', ')}.`,'Map these styles to Android theme / resource tokens.','Resolved literal values are exported; design-token linkage is not generated.');
 });
 if(schema.mode==='screen'){
  const root=schema.root;
  issues.push({ruleId:'screen-insets',severity:'confirmation',nodeId:root.id,layer:root.name,explanation:'WindowInsets / safe-area policy cannot be determined from the selected Figma screen.',impact:'System bars, cutouts, and keyboard insets may overlap content. Needs confirmation.',fix:'Specify edge-to-edge behavior and apply WindowInsets in the host Android screen.'});
  if(root.layout==='NONE')issues.push({ruleId:'screen-static-layout',severity:'warning',nodeId:root.id,layer:root.name,explanation:`Screen uses a fixed-position layout measured at ${root.width} × ${root.height}px.`,impact:'The generated root fills the host viewport while child coordinates remain fixed; other viewport sizes can overflow.',fix:'Confirm supported viewport sizes and responsive constraints; no responsive behavior is inferred.'});
 }
 return issues;
}
export function passedChecks(schema:AndroidUISchema):PassedCheck[]{
 const result:PassedCheck[]=[];
 walk(schema.root,n=>{
  const add=(check:string)=>result.push({nodeId:n.id,layer:n.name,check});
  if(n.kind!=='unsupported'&&!n.limitations.length)add('Layer structure and basic visual properties map to both generators.');
  if(n.text)add('Uniform font size, weight, family, and finite text metrics were parsed.');
  if(n.border)add('Uniform inside solid border maps to both generators.');
  if(n.scrollSupported)add('Explicit scroll direction has a supported bounded Auto Layout configuration.');
 });return result;
}
