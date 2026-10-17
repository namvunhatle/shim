import { DesignNode } from '../src/parser';
const solid=(r:number,g:number,b:number)=>[{type:'SOLID',color:{r,g,b},opacity:1}];
export function pricingCard():DesignNode{
 const text=(id:string,name:string,value:string,size:number,weight:number):DesignNode=>({id,name,type:'TEXT',width:272,height:30,x:24,y:24,layoutSizingHorizontal:'FILL',layoutSizingVertical:'HUG',characters:value,fontSize:size,fontWeight:weight,fontName:{family:'Inter',style:weight===700?'Bold':'Regular'},fills:solid(.1,.12,.16),textAutoResize:'HEIGHT',textAlignHorizontal:'LEFT',textDecoration:'NONE',textCase:'ORIGINAL',lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PIXELS',value:0}});
 return {id:'card',name:'Pricing Card',type:'COMPONENT',key:'pricing-card',description:'Simple pricing card',width:320,height:220,layoutMode:'VERTICAL',layoutSizingHorizontal:'FIXED',layoutSizingVertical:'HUG',paddingTop:24,paddingRight:24,paddingBottom:24,paddingLeft:24,itemSpacing:12,primaryAxisAlignItems:'MIN',counterAxisAlignItems:'MIN',cornerRadius:16,fills:solid(1,1,1),children:[text('title','Title','Pro plan',20,700),text('price','Price','$12 / month',32,700),text('description','Supporting description','Everything you need to get started.',14,400)]};
}

export function simpleComponent():DesignNode{
 const card=pricingCard();card.name='Simple Component';card.children=card.children.slice(0,1);card.children[0].characters='Hello Android';return card;
}
function rekey(n:DesignNode,prefix:string):DesignNode{
 return {...n,id:prefix+'/'+n.id,children:n.children?.map((c:DesignNode)=>rekey(c,prefix))};
}
export function nestedComponent():DesignNode{
 const parent=pricingCard();parent.id='nested';parent.name='Nested Component';parent.width=360;parent.height=420;parent.children=[{...rekey(pricingCard(),'inner'),type:'INSTANCE',name:'Plan Instance',width:312,x:24,y:24,layoutSizingHorizontal:'FILL',variantProperties:{Plan:'Pro'}}];return parent;
}
export function fullScreen():DesignNode{
 const label=(prefix:string,value:string,size=16)=>{const n=rekey(pricingCard().children[0],prefix);n.characters=value;n.fontSize=size;n.fontWeight=400;n.width=358;n.height=24;n.x=0;n.y=0;return n;};
 const frame=(id:string,name:string,children:DesignNode[],height:number):DesignNode=>({id,name,type:'FRAME',width:390,height,x:0,y:0,layoutMode:'VERTICAL',layoutSizingHorizontal:'FILL',layoutSizingVertical:'FIXED',itemSpacing:16,children});
 const title=label('header','Explore plans',20);title.layoutSizingHorizontal='FIXED';title.width=280;
 const icon:DesignNode={id:'header/icon',name:'Icon group',type:'GROUP',width:24,height:24,x:0,y:0,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',children:[{id:'header/icon/background',name:'Oval background',type:'ELLIPSE',width:24,height:20,x:0,y:2,fills:solid(.9,.9,.95)},{id:'header/vector',name:'Complex logo vector',type:'VECTOR',width:24,height:24,x:0,y:0,fills:solid(.2,.3,.4)}]};
 const header=frame('header','Header',[icon,title],56);header.layoutMode='HORIZONTAL';header.counterAxisAlignItems='CENTER';header.itemSpacing=12;
 const image:DesignNode={id:'hero',name:'Hero image',type:'RECTANGLE',width:358,height:180,x:16,y:16,layoutSizingHorizontal:'FILL',layoutSizingVertical:'FIXED',fills:[{type:'IMAGE',imageHash:'fixture-image-hash',scaleMode:'FILL'}],cornerRadius:12};
 const card1={...rekey(pricingCard(),'one'),type:'INSTANCE',name:'Plan Card',x:0,y:76,width:358,layoutSizingHorizontal:'FILL',variantProperties:{Plan:'Pro'}};
 const card2:DesignNode={...rekey(pricingCard(),'two'),name:'Annual Card',x:0,y:312,width:358,layoutSizingHorizontal:'FILL',effects:[{type:'DROP_SHADOW',visible:true,radius:8,offset:{x:0,y:4},color:{r:0,g:0,b:0,a:.12}}]};
 card2.children[1].characters='$99 / year';
 const section=frame('content','Content section',[label('section/title','Choose your plan',24),label('section/description','All plans include the essentials.'),card1,card2],560);section.width=358;section.x=16;section.y=212;section.layoutSizingVertical='HUG';
 const button=frame('button','Continue button',[label('button/label','Continue')],40);button.type='INSTANCE';button.width=358;button.x=16;button.y=788;button.primaryAxisAlignItems='CENTER';button.counterAxisAlignItems='CENTER';button.fills=solid(.1,.3,.8);button.variantProperties={State:'Default'};button.reactions=[{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:'checkout'}]}];button.children[0].fills=solid(1,1,1);button.children[0].width=120;button.children[0].layoutSizingHorizontal='FIXED';
 const scroll=frame('scroll','Scrollable content',[image,section,button],740);scroll.x=0;scroll.y=56;scroll.layoutSizingVertical='FILL';scroll.paddingLeft=16;scroll.paddingRight=16;scroll.paddingTop=16;scroll.paddingBottom=16;scroll.overflowDirection='VERTICAL';scroll.clipsContent=true;
 const footer=frame('footer','Footer',[label('footer/label','Terms apply',12)],48);footer.y=796;footer.fills=[{type:'GRADIENT_LINEAR',gradientStops:[{position:0,color:{r:1,g:1,b:1,a:1}},{position:1,color:{r:.9,g:.9,b:1,a:1}}],gradientTransform:[[1,0,0],[0,1,0]]}];
 const screen=frame('screen','Plans Screen',[header,scroll,footer],844);screen.width=390;screen.itemSpacing=0;screen.layoutSizingHorizontal='FIXED';screen.fills=solid(1,1,1);return screen;
}

// Critical-first readiness fixtures use ordinary node data, not screen-specific policy flags.
export function validReadinessScreen():DesignNode{
 const n=pricingCard();n.type='FRAME';n.id='valid-screen';n.name='Basic Screen';n.width=360;n.height=800;return n;
}
export function minorReadinessScreen():DesignNode{
 const n=validReadinessScreen();n.children[0].layoutSizingVertical='FIXED';n.children[0].textAutoResize='NONE';n.children[0].fontSize=10;return n;
}
export function criticalDesignScreen():DesignNode{
 const n=validReadinessScreen();n.children[0].width=0;n.children[0].layoutSizingHorizontal='FIXED';n.children[0].layoutSizingVertical='FIXED';n.children[0].textAutoResize='NONE';return n;
}
export function assetReadinessScreen():DesignNode{
 const n=validReadinessScreen();n.children.push({id:'source-artwork',name:'Image',type:'RECTANGLE',width:300,height:180,x:24,y:160,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',fills:[{type:'IMAGE',imageHash:'original-image',scaleMode:'FILL'}]});return n;
}
export function frameworkReadinessScreen(clips=true):DesignNode{
 const n=validReadinessScreen();n.layoutMode='NONE';n.width=100;n.height=100;n.clipsContent=clips;n.children=n.children.slice(0,1);const text=n.children[0];text.width=80;text.height=24;text.x=120;text.y=20;text.layoutSizingHorizontal='FIXED';text.layoutSizingVertical='FIXED';text.textAutoResize='NONE';return n;
}

export function implementationScreen():DesignNode{
 const n=validReadinessScreen();n.name='Implementation Proof';n.clipsContent=true;n.layoutSizingVertical='FIXED';
 const image={id:'proof-image',name:'Source artwork',type:'RECTANGLE',width:276,height:156,x:24,y:180,layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',fills:[{type:'IMAGE',imageHash:'proof-artwork',scaleMode:'FILL'}]};
 n.children=[{constraints:{horizontal:'STRETCH',vertical:'STRETCH'},id:'proof-bg',name:'Background overlay',type:'RECTANGLE',width:360,height:800,x:0,y:0,layoutPositioning:'ABSOLUTE',fills:[{type:'SOLID',color:{r:.94,g:.96,b:1}}]},...n.children,image,{constraints:{horizontal:'MAX',vertical:'MIN'},id:'proof-badge',name:'Top overlay',type:'RECTANGLE',width:20,height:20,x:316,y:8,layoutPositioning:'ABSOLUTE',fills:[{type:'SOLID',color:{r:.2,g:.6,b:.3}}]}];return n;
}
