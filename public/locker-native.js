'use strict';
// Render the custom choices with the shipped Unity card prefab, font and layout.
// Selection remains server-owned; native item IDs and save CSV stay compatible.
(() => {
 const RONALDO='ronaldo-2007',choices=new Map(),portraits=new Map(),savedLabels=new Map(),hiddenImages=new Map(),hiddenObjects=new Map();
 let n,owner,basePlayer=0,baseId=0,baseName='',ready=false,loading,menu=0,selectingUntil=0,lastError='',pressed,blocked=false,phase='';
 function errorText(error){if(typeof error!=='number')return String(error)+' ['+phase+']';let p=error;for(let i=0;i<3&&p;i++){const fields=n.fields(p);if(fields._message!==undefined)return n.className(p)+': '+n.text(n.ptr(p+fields._message))+' ['+phase+']';p=n.ptr(p)}return String(error)+' ['+phase+']'}
 const live=o=>o&&n.ptr(o+8),go=o=>n.call(28273,o),transform=o=>n.call(28272,o);
 const active=o=>live(o)&&n.call(28355,go(o)),component=(object,type)=>n.call(28324,object,n.type(type));
 const all=type=>n.array(n.call(28468,n.type(type+', Assembly-CSharp')));
 function samePlayer(player){return n.is(player,'Player')&&n.get(player,'Id')===baseId}
 function data(){const k=n.ptr(3397700),holder=n.ptr(n.ptr(k+92)+4),profile=n.get(holder,'ProfileData'),team=n.get(profile,'userTeam'),one=n.get(team,'playerOne');return {holder,profile,team,one,player:n.get(one,'player')}}
 function setText(label,text){if(live(label))n.call(30255,label,n.string(text))}
 function label(label,text,custom){if(!live(label))return;if(custom){if(!savedLabels.has(label)){n.pin(label);savedLabels.set(label,n.text(n.call(30254,label)))};setText(label,text)}else if(savedLabels.has(label)){if(n.text(n.call(30254,label))===text)setText(label,savedLabels.get(label));savedLabels.delete(label);n.release(label)}}
 function localPoint(parent,point,camera){return n.floats(point,p=>n.floats([0,0],out=>{if(!n.call(36964,parent,p,camera,out))throw Error('Locker projection unavailable');return Array.from(n.module.HEAPF32.subarray(out/4,out/4+2))}))}
 function position(choice,x,y,width,height){
  const canvas=document.getElementById('game'),camera=n.get(menu,'mainCamera'),parent=n.call(28648,choice.rect),factor=canvas.width/960;
  const center=localPoint(parent,[x*factor,(600-y)*canvas.height/600],camera),a=localPoint(parent,[0,0],camera),b=localPoint(parent,[width*factor,height*canvas.height/600],camera),pivot=n.readVec(28625,parent);
  n.setVec(28618,choice.rect,pivot);n.setVec(28620,choice.rect,pivot);n.setVec(28626,choice.rect,[.5,.5]);
  n.setVec(28624,choice.rect,[Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])]);n.setVec(28622,choice.rect,center);
 }
 function replaceImage(image,part,enabled){phase='replace '+part+' '+n.className(image)+' '+image;
  if(!live(image))return;
  let p=portraits.get(image);
  if(enabled){
   if(!p){
    phase='clone source '+image;const source=go(image),parent=n.call(28648,transform(image)),copy=n.pin(n.call(28458,source,parent,0)),old=component(copy,'UnityEngine.UI.Image, UnityEngine.UI');
    phase='destroy cloned Image '+old+' cls '+n.className(old);n.call(28454,copy,n.string('CustomPortrait-'+n.text(n.call(28453,image))));if(old)n.call(28466,old,0);n.call(28680,n.call(28350,copy),n.call(28681,transform(image))+1);
    phase='add RawImage';const raw=n.pin(n.call(28348,copy,n.type('UnityEngine.UI.RawImage, UnityEngine.UI')));
    n.call(30836,raw,0);p={raw,copy,enabled:n.call(28255,image)};n.pin(image);portraits.set(image,p);
   }
   phase='apply RawImage texture '+part;const art=window.dunkersCharacterNative.uiPart(part);n.call(31478,p.raw,art.texture);n.floats(art.uv,p=>n.call(31480,portraits.get(image).raw,p));
   n.call(28353,p.copy,1);n.call(28256,image,0);
  }else if(p){n.call(28353,p.copy,0);n.call(28256,image,!!n.call(30920,image)&&p.enabled)}
 }
 function face(controller,custom){if(!live(controller))return;
  phase='face components '+n.className(controller)+' '+controller;const images=n.array(n.call(28333,go(controller),n.type('UnityEngine.UI.Image, UnityEngine.UI'),1,1,1,0,0));
  
  if(!custom){for(const image of images)if(live(image)){if(portraits.has(image))replaceImage(image,'',false);if(hiddenImages.has(image)){n.call(28256,image,!!n.call(30920,image)&&hiddenImages.get(image));hiddenImages.delete(image);n.release(image)}}return}
  for(const [field,part]of [['spriteHead','head-neutral'],['spriteJersey','torso'],['spriteArm','arm-left']]){
   const sprite=n.get(controller,field);if(!sprite)continue;
   for(const image of images)if(live(image)&&n.call(30920,image)===sprite&&!/outline/i.test(n.text(n.call(28453,image))))replaceImage(image,part,custom);
  }
  for(const image of images){if(!live(image))continue;phase='hide overlays '+image;const name=n.text(n.call(28453,image)),sprite=n.call(30920,image);
   if(/headwear/i.test(name)||(/outline/i.test(name)&&sprite===n.get(controller,'spriteHeadOutline'))){
    if(custom){if(!hiddenImages.has(image)){n.pin(image);hiddenImages.set(image,n.call(28255,image))};n.call(28256,image,0)}else if(hiddenImages.has(image)){n.call(28256,image,hiddenImages.get(image));hiddenImages.delete(image);n.release(image)}
   }
  }
 }

 function decorate(card,custom,name){
  if(!live(card))return;
  face(n.get(card,'faceController'),custom);
  label(n.get(card,'playerNameLabel'),name,custom);
  const rating=n.get(card,'playerRatingLabel'),wrap=n.fields(rating).m_enableWordWrapping;if(custom&&wrap!==undefined)n.module.HEAPU8[rating+wrap]=0;
  label(rating,'100',custom);
 }
 function menuPanels(){const mini=all('MiniMenuController')[0];return mini?n.array(n.get(mini,'menuPanels')):[]}
 function alias(){const mini=all('MiniMenuController')[0];return mini?n.text(n.get(mini,'showingMenuAlias')):''}
 function shown(context){const value=alias().toLowerCase();return context==='locker'?value==='equipment':value==='teammenu'}

 function createChoice(parent,character,context){
  const object=n.pin(n.call(28458,n.get(menu,'playerCardPrefab'),parent,0)),card=n.pin(component(object,'PlayerItemCardController, Assembly-CSharp'));
  n.write(card+n.fields(card).item,basePlayer);
  for(const field of ['forceGrayscale','packCard','flashForUpgrade','dynamicCulling']){const at=n.fields(card)[field];if(at!==undefined)n.module.HEAPU8[card+at]=0}
  const training=n.fields(card).disableTrainingBar;if(training!==undefined)n.module.HEAPU8[card+training]=1;
  n.call(28353,object,1);n.call(12782,card);
  const drag=n.get(card,'dragCard');if(live(drag))n.call(28256,drag,0);
  const choice={object,card,rect:n.pin(transform(card)),character,context};choices.set(card,choice);
  if(context==='ballers')n.call(28678,choice.rect);
  return choice;
 }
 function refreshChoices(){
  for(const context of ['locker','ballers']){
   const parent=context==='locker'?transform(n.get(menu,'lockerMenu')):n.get(menu,'playerContainer');
   const visible=shown(context);for(const choice of choices.values())if(choice.context===context&&live(choice.object))n.call(28353,choice.object,+visible);if(!visible)continue;
   for(const character of [null,RONALDO]){
    let choice=[...choices.values()].find(c=>c.context===context&&c.character===character&&live(c.object));
    if(!choice)choice=createChoice(parent,character,context);
    if(context==='locker')position(choice,character?195:315,510,105,135);
    const rating=n.get(choice.card,'playerRatingLabel'),wrap=n.fields(rating).m_enableWordWrapping;if(wrap!==undefined)n.module.HEAPU8[rating+wrap]=0;
    const equipped=owner.selected===character;
    n.call(12783,choice.card,+equipped);decorate(choice.card,character===RONALDO,'RONALDO 07');
    // Keep the native lettering and place the state in its existing caption.
    setText(n.get(choice.card,'playerNameLabel'),character?'RONALDO 07':baseName);
    setText(n.get(choice.card,'playerHeightLabel'),equipped?'EQUIPPED':character?'F - SLIDE KICK':'DEFAULT');
   }
  }
 }
 function noWrap(label){if(live(label)){const offset=n.fields(label).m_enableWordWrapping;if(offset!==undefined)n.module.HEAPU8[label+offset]=0}}
 function hideObject(object,hidden){if(!live(object))return;if(hidden){if(!hiddenObjects.has(object)){n.pin(object);hiddenObjects.set(object,n.call(28354,object))}n.call(28353,object,0)}else if(hiddenObjects.has(object)){n.call(28353,object,hiddenObjects.get(object));hiddenObjects.delete(object);n.release(object)}}
 function stat100(bar){if(!live(bar))return;if(n.getFieldFloat(bar,'rating')!==100){n.call(12791,bar,100);n.setFieldFloat(bar,'rating',100)}const text=n.get(bar,'progressLabel');noWrap(text);setText(text,'100')}
 function updateStats(){
  const stat=n.get(menu,'teamStatController');if(!active(stat)||owner.selected!==RONALDO)return;
  for(const key of ['speed','vertical','handling','throwing'])stat100(n.get(stat,key));
  noWrap(n.get(stat,'teamRatingLabel'));n.call(12811,stat,100);
 }
 function detailCards(){
  for(const detail of all('PlayerDetailCardController')){
   const custom=owner.selected===RONALDO&&samePlayer(n.get(detail,'player'));decorate(detail,custom,'RONALDO 07');
   if(custom)for(const key of ['speed','jump','handling','throwing'])stat100(n.get(detail,key));
   for(const key of ['upgradeBtnLabel','purchaseBtnLabel']){const text=n.get(detail,key);if(live(text)){const button=n.call(28284,text,n.type('UnityEngine.UI.Button, UnityEngine.UI'),1);if(live(button))hideObject(go(button),custom)}}
  }
 }

 async function choose(choice){
  if(window.dunkersCharacters?.busy)return;
  selectingUntil=performance.now()+4000;
  try{
   await window.dunkersCharacters.select(choice.character);
   if(!samePlayer(data().player)){selectingUntil=performance.now()+4000;n.call(13137,menu,0,basePlayer,0)}else selectingUntil=performance.now()+250;
   const stat=n.get(menu,'teamStatController');if(live(stat))n.call(12809,stat);
   tick();
  }catch(error){lastError=String(error);setText(n.get(choice.card,'playerHeightLabel'),'TRY AGAIN')}
 }
 function hit(event){
  if(blocked||!ready||!owner||owner.id!==1||!live(menu)||event.target!==document.getElementById('game'))return null;
  if(!document.getElementById('online-panel')?.hidden)return null;
  const canvas=document.getElementById('game'),bounds=canvas.getBoundingClientRect(),point=[(event.clientX-bounds.left)*canvas.width/bounds.width,(bounds.bottom-event.clientY)*canvas.height/bounds.height],camera=n.get(menu,'mainCamera');
  if(n.call(13150,menu))return null;
  return [...choices.values()].find(c=>shown(c.context)&&live(c.object)&&n.call(28355,c.object)&&n.floats(point,p=>n.call(36961,c.rect,p,camera)))||null;
 }
 window.addEventListener('dunkers-match-state',event=>{blocked=event.detail.status!=='idle';if(blocked)pressed=null});
 window.addEventListener('pointerdown',event=>{const choice=hit(event);if(!choice)return;event.preventDefault();event.stopImmediatePropagation();pressed={choice,id:event.pointerId,x:event.clientX,y:event.clientY}},true);
 window.addEventListener('pointerup',event=>{if(!pressed||pressed.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();const down=pressed;pressed=null;if(hit(event)===down.choice&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<20)choose(down.choice)},true);
 window.addEventListener('pointercancel',()=>{pressed=null},true);
 function tick(){
  if(!ready)return;
  try{
   for(const [card,c]of choices)if(!live(c.object)){choices.delete(card);n.release(c.card);n.release(c.object);n.release(c.rect)}
   for(const [image,p]of portraits)if(!live(image)||!live(p.raw)){n.release(p.raw);n.release(p.copy);n.release(image);portraits.delete(image)}
   for(const label of savedLabels.keys())if(!live(label)){savedLabels.delete(label);n.release(label)}
   for(const image of hiddenImages.keys())if(!live(image)){hiddenImages.delete(image);n.release(image)}
   for(const object of hiddenObjects.keys())if(!live(object)){hiddenObjects.delete(object);n.release(object)}
   if(blocked)return;
   menu=all('EquipmentMenuController')[0]||0;if(!menu)return;
   refreshChoices();
   const current=data().player;
   if(!samePlayer(current)&&owner.selected===RONALDO&&performance.now()>selectingUntil&&!window.dunkersCharacters?.busy){selectingUntil=performance.now()+2000;window.dunkersCharacters.select(null).catch(error=>{lastError=String(error)})}
   for(const card of all('PlayerItemCardController'))if(!choices.has(card)){const custom=owner.selected===RONALDO&&samePlayer(n.get(card,'item'));decorate(card,custom,'RONALDO 07');const training=n.get(card,'trainingLevelController');if(live(training))hideObject(go(training),custom)}
   detailCards();
   updateStats();
  }catch(error){lastError=errorText(error);ready=false;console.error('Native locker:',lastError)}
 }
 async function setOwner(state){owner=state;if(state.id!==1)return;if(ready){if(state.selected!==RONALDO&&live(menu)){for(const view of n.array(n.get(menu,'teamViews')))if(live(view))n.call(12814,view);for(const card of all('PlayerItemCardController'))if(!choices.has(card))n.call(12782,card);const stat=n.get(menu,'teamStatController');if(live(stat))n.call(12809,stat);for(const detail of all('PlayerDetailCardController'))if(n.get(detail,'player')===basePlayer)n.call(12752,detail)}tick();return}if(loading)return loading;
  loading=(async()=>{n=await window.dunkersNativeRuntime.init();await window.dunkersCharacterNative.prepare();basePlayer=n.pin(data().player);baseId=n.get(basePlayer,'Id');baseName=[n.text(n.get(basePlayer,'FirstName')),n.text(n.get(basePlayer,'SecondName'))].filter((value,index,values)=>value&&values.indexOf(value)===index).join(' ').toUpperCase();ready=true;tick()})();return loading;
 }
 function open(){
  if(blocked||!ready||!live(menu))return;
  const target=menuPanels().map(p=>n.text(n.get(p,'alias'))).find(value=>value==='teammenu');
  if(target)window.unityGame.SendMessage('MainUI','ShowMenu',target);
 }

 window.dunkersLockerNative={setOwner,open,info:()=>({ready,baseId,baseName,menu,alias:ready?alias():'',detailOpen:live(menu)?n.call(13150,menu):false,error:lastError,cards:[...choices.values()].filter(c=>live(c.object)).map(c=>({card:c.card,context:c.context,character:c.character,rect:c.rect})),portraits:portraits.size})};
 setInterval(tick,150);
})();
