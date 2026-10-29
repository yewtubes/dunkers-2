'use strict';
// Bind custom art to actual SpriteRenderers; keep native joints and animation.
(() => {
 let n,manifest,atlas,texture,shader,block,mainID,tintID,tint,ready=false,loading,owner,match,internal=false,lastError='',lastSeq=0,lastKick=null;
 const bindings=new Map(),materials=new Map(),protectedMaterials=new Set(),stats=new Map(),hooks=new Set(),paths=new Map();
 let dash,stun,phase='';
 const errorText=e=>{if(typeof e!=='number'||!n)return String(e)+' ['+phase+']';let p=e;for(let i=0;i<3;i++){const f=n.fields(p);if(f._message!==undefined)return n.className(p)+': '+n.text(n.ptr(p+f._message))+' ['+phase+']';p=n.ptr(p);if(!p)break}return 'Native exception '+e+' ['+phase+']'};
 // Unity scene cleanup ignores JS-held references: preserve native assets too.
 const retain=o=>{n.call(28472,o,32);return o};
 const isLive=o=>o&&n.ptr(o+8),name=o=>n.text(n.call(28453,o));
 const rootURL=()=>new URL('custom/ronaldo-2007/',location.href);
 function expression(sprite){const value=name(sprite).toLowerCase();for(const key of ['happy','angry','shocked','smug','blink'])if(value.includes(key))return key;return 'neutral'}
 function image(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Character sprite missing: '+url));i.src=url})}
 async function prepare(){
  if(ready)return;if(loading)return loading;
  loading=(async()=>{
   n=await dunkersNativeRuntime.init();manifest=await (await fetch(new URL('character.json',rootURL()))).json();
   const parts=await Promise.all(Object.entries(manifest.parts).map(async([key,p])=>({key,p,image:await image(new URL(p.file,rootURL()))})));
   for(const part of parts.filter(p=>!p.key.startsWith('head-')))parts.push({...part,key:'outline-'+part.key,outline:true});
   parts.sort((a,b)=>b.p.height-a.p.height);
   const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1280;const ctx=canvas.getContext('2d');atlas=new Map();let x=4,y=4,row=0;
   for(const part of parts){const {width:w,height:h}=part.p;if(x+w+4>canvas.width){x=4;y+=row+8;row=0}if(y+h+4>canvas.height)throw Error('Custom sprite atlas overflow');
    ctx.drawImage(part.image,x,y);if(part.outline||part.key.endsWith('-mask')){ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#242429';ctx.fillRect(x,y,w,h);ctx.restore()}
    atlas.set(part.key,{x,y,w,h});x+=w+8;row=Math.max(row,h);
   }
   texture=retain(n.create('UnityEngine.Texture2D, UnityEngine.CoreModule',27590,canvas.width,canvas.height,4,0));
   const pixels=n.call(2429,n.type('UnityEngine.Color32, UnityEngine.CoreModule'),canvas.width*canvas.height),handle=n.call(5491,pixels),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,stride=canvas.width*4;
   for(let row=0;row<canvas.height;row++)n.module.HEAPU8.set(rgba.subarray(row*stride,(row+1)*stride),pixels+16+(canvas.height-1-row)*stride);
   n.call(27607,texture,pixels);n.call(27598,texture,0,1);n.call(5498,handle);
   // This retained shader honors atlas UV transforms and renders both sides.
   // Unlit/Transparent culled flipped heads and the entire away-side player.
   shader=retain(n.pin(n.call(27346,n.string('Legacy Shaders/Particles/Alpha Blended'))));if(!shader||!isLive(shader))throw Error('Required native shader unavailable');
   tintID=n.call(27348,n.string('_TintColor'));tint=n.call(27282)===1 ? 0.735356983 : 0.5;
   block=n.create('UnityEngine.MaterialPropertyBlock, UnityEngine.CoreModule',27296);mainID=n.call(27348,n.string('_MainTex'));n.call(27304,block,mainID,texture);
   const sample=n.create('UnityEngine.Material, UnityEngine.CoreModule',27360,shader);n.call(27364,sample,shader);
   ready=true;installHooks();tick();
  })().catch(error=>{lastError=errorText(error);loading=null;throw error});
  return loading;
 }
 function pathOf(renderer){if(paths.has(renderer))return paths.get(renderer);let t=n.call(28272,renderer),names=[];for(let i=0;t&&isLive(t)&&i<12;i++){names.unshift(name(t));t=n.call(28648,t)}const path=names.join('/');paths.set(renderer,path);return path}
 function resolve(controller,field){const fieldOffset=n.fields(controller)[field];if(fieldOffset===undefined)return [];const value=n.ptr(controller+fieldOffset);if(!value)return [];
  if(n.is(value,'SpriteRenderer'))return [value];
  if(n.is(value,'GameObject')&&!isLive(value))return [];
  if(n.is(value,'GameObject'))return n.array(n.get(controller,'spriteRenderers')).filter(r=>isLive(r)&&name(r)===name(value));
  if(!['String','String[]','SpriteRenderer[]'].includes(n.className(value)))return [];
  const values=n.is(value,'String')?[value]:n.array(value);if(values.some(p=>n.is(p,'SpriteRenderer')))return values.filter(p=>n.is(p,'SpriteRenderer'));
  const requested=values.map(p=>n.text(p)),all=n.array(n.get(controller,'spriteRenderers'));return all.filter(r=>isLive(r)&&requested.some(p=>p&&(pathOf(r)===p||pathOf(r).endsWith('/'+p))));
 }
 function material(sprite,part){phase+=' '+part+' '+name(sprite);const key=sprite+':'+part;if(materials.has(key))return materials.get(key);const target=atlas.get(part);if(!target)return 0;
  const uv=n.call(28740,sprite),count=n.ptr(uv+12);if(count<4||count>200)throw Error('Invalid native sprite UVs');const values=n.module.HEAPF32.subarray((uv+16)/4,(uv+16)/4+count*2),us=[],vs=[];
  for(let i=0;i<values.length;i+=2){us.push(values[i]);vs.push(values[i+1])}const u=Math.min(...us),v=Math.min(...vs),du=Math.max(...us)-u,dv=Math.max(...vs)-v;if(du<=0||dv<=0)throw Error('Empty sprite UV range');
  // Packed sprites trim transparent margins. Sample the corresponding region
  // of the full-size custom part while retaining the native geometry/pivot.
  const rect=n.readVec(28746,sprite,4),pivot=n.readVec(28748,sprite),ppu=n.call(28732,sprite),vertices=n.call(28738,sprite),vc=n.ptr(vertices+12),points=n.module.HEAPF32.subarray((vertices+16)/4,(vertices+16)/4+vc*2);
  const xs=[],ys=[];for(let i=0;i<points.length;i+=2){xs.push(points[i]);ys.push(points[i+1])}
  const left=(Math.min(...xs)*ppu+pivot[0])/rect[2],bottom=(Math.min(...ys)*ppu+pivot[1])/rect[3],width=(Math.max(...xs)-Math.min(...xs))*ppu/rect[2],height=(Math.max(...ys)-Math.min(...ys))*ppu/rect[3];
  const mat=retain(n.create('UnityEngine.Material, UnityEngine.CoreModule',27360,shader)),sx=(target.w*width/2048)/du,sy=(target.h*height/1280)/dv,ox=(target.x+target.w*left)/2048-u*sx,oy=(1280-target.y-target.h+target.h*bottom)/1280-v*sy;
  // The legacy particle shader multiplies its sRGB tint by two. Keep
  // that factor neutral in both gamma and linear-color player builds.
  n.floats([tint,tint,tint,.5],p=>n.call(27420,mat,tintID,p));
  n.call(27406,mat,n.string('_MainTex'),texture);n.floats([sx,sy],p=>n.call(27417,mat,n.string('_MainTex'),p));n.floats([ox,oy],p=>n.call(27415,mat,n.string('_MainTex'),p));materials.set(key,mat);protectedMaterials.add(mat);return mat;
 }
 function repaint(renderer,sprite){const b=bindings.get(renderer);if(!b||!isLive(renderer))return;
  internal=true;try{
   if(b.role==='hide'){n.call(27323,renderer,0);return}
   if(!sprite)sprite=n.call(28712,renderer);
   // Native head-flip/impact animation can temporarily clear or disable the
   // source face. Keep the last real face mesh for the modular custom head.
   if(b.role==='head'||b.role==='head-mask'){
    const size=sprite&&n.is(sprite,'Sprite')?n.readVec(28746,sprite,4):null;
    if(size&&size[2]>=32&&size[3]>=32){if(b.lastSprite!==sprite){n.release(b.lastSprite);b.lastSprite=n.pin(sprite)}}
    else if(b.lastSprite){sprite=b.lastSprite;n.call(28713,renderer,sprite)}
    if(sprite&&b.role==='head')n.call(27323,renderer,1);
   }
   if(!sprite)return;
   let part=b.role;if(part==='head')part='head-'+expression(sprite);if(part==='head-mask')part='head-'+expression(sprite)+'-mask';
   if(part.startsWith('hand-')){const closed=name(sprite).toLowerCase().includes('closed');part=(closed?'hand-closed-':'hand-')+(part.endsWith('front')?'front':'back')}
   if(b.outline)part='outline-'+part;
   const mat=material(sprite,part);if(!mat)return;b.material=mat;n.call(27343,renderer,mat);n.call(27318,renderer,block);n.floats([1,1,1,1],p=>n.call(28720,renderer,p));
  }finally{internal=false}
 }
 function installHooks(){
  const hook=(address,fn)=>{if(hooks.has(address))return;if(n.hook(address,2,fn))hooks.add(address)};
  hook(4214652,(original,r,s)=>{original(r,s);if(!internal&&bindings.has(r))try{repaint(r,s)}catch(e){lastError=errorText(e)}});
  hook(4214668,(original,r,color)=>{if(!internal&&bindings.has(r))n.floats([1,1,1,1],p=>original(r,p));else original(r,color)});
  hook(4216524,(original,r,m)=>{const b=bindings.get(r);original(r,!internal&&b?.material?b.material:m)});
  hook(4216532,(original,r,b)=>{original(r,!internal&&bindings.has(r)&&bindings.get(r).role!=='hide'?block:b)});
  hook(4216552,(original,r,enabled)=>{const b=bindings.get(r);original(r,!internal&&b?.role==='hide'?0:!internal&&b?.lastSprite&&b.role==='head'?1:enabled)});
  hook(4216668,(original,mat,s)=>original(mat,protectedMaterials.has(mat)?shader:s));
 }
 function bind(renderer,role,outline=false){if(!isLive(renderer))return;const existing=bindings.get(renderer);if(existing){existing.role=role;existing.outline=outline;repaint(renderer);return}
  const savedBlock=n.create('UnityEngine.MaterialPropertyBlock, UnityEngine.CoreModule',27296);n.call(27320,renderer,savedBlock);
  const b={role,outline,original:n.pin(n.call(27342,renderer)),enabled:n.call(27322,renderer),color:n.readVec(28719,renderer,4),savedBlock};bindings.set(renderer,b);repaint(renderer);
 }
 function unbind(renderer){const b=bindings.get(renderer);if(!b)return;bindings.delete(renderer);n.release(b.lastSprite);if(!isLive(renderer)){n.call(27298,b.savedBlock);n.release(b.savedBlock);n.release(b.original);return}internal=true;try{n.call(27343,renderer,b.original);n.call(27318,renderer,b.savedBlock);n.call(27323,renderer,b.enabled);n.floats(b.color,p=>n.call(28720,renderer,p));n.call(27298,b.savedBlock);n.release(b.savedBlock);n.release(b.original)}finally{internal=false}}
 function paint(controller){const mapped=new Set();const group=(field,role,outline=false)=>{phase=field;for(const r of resolve(controller,field)){mapped.add(r);const side=pathOf(r).toLowerCase().includes('right')?'right':'left';bind(r,role.replace('$side',side),outline)}};
  group('faceRenderers','head');group('faceOutlineRenderers','head-mask');
  group('jerseyBaseRenderers','torso');group('jerseyBaseOutlineRenderers','torso',true);
  group('pantsPelvisRenderers','hips');group('pantsPelvisOutlineRenderers','hips',true);
  group('pantsShortsRenderers','shorts-$side');group('pantsShortsOutlineRenderers','shorts-$side',true);
  group('legRenderers','leg-$side');group('pantsLegOutlineRenderers','leg-$side',true);
  group('bootBaseRenderers','boot-$side');group('bootOutlineRenderers','boot-$side',true);
  group('armLeftGameplayRenderers','arm-left');group('armLeftRenderers','arm-left');group('armRightRenderers','arm-right');group('armLeftOutlineRenderers','arm-left',true);group('armRightOutlineRenderers','arm-right',true);
  group('frontHand','hand-front');group('backHand','hand-back');group('frontHandOutline','hand-front',true);group('backHandOutline','hand-back',true);
  for(const field of Object.keys(n.fields(controller))){if(!/(Renderers|jerseyDunkersLogo)$/.test(field)||['spriteRenderers','allOutlines'].includes(field))continue;for(const r of resolve(controller,field))if(!mapped.has(r)){bind(r,'hide');mapped.add(r)}}
  return mapped;
 }
 function holder(){const type=n.ptr(3397700),h=n.ptr(n.ptr(type+92)+4);return n.is(h,'MainGameDataHolder')?h:0}
 function ownMenuPlayer(){const h=holder();if(!h)return 0;const profile=n.get(h,'ProfileData'),team=n.get(profile,'userTeam'),one=n.get(team,'playerOne');return n.get(one,'player')}
 function motorSide(side){const info=window.dunkersOnlineNative?.info();return side==='host'?info?.own?.pointer:info?.enemy?.pointer}
 function boost(motor){if(!motor||!n.is(motor,'PlayerMotor')||!isLive(motor))return;const f=n.fields(motor);
  if(!stats.has(motor)){stats.set(motor,Object.fromEntries(['Speed','Jumping','Handling','Shooting'].map(k=>[k,n.get(motor,k)])));for(const k of ['Speed','Jumping','Handling','Shooting'])n.setFieldInt(motor,k,100);n.call(12348,motor);n.call(12351,motor);}
  for(const k of ['Speed','Jumping','Handling','Shooting'])n.setFieldInt(motor,k,100);if(f.maxSpeed!==undefined)n.setFieldFloat(motor,'maxSpeed',dash?.motor===motor?40:18);
 }
 function tick(){if(!ready)return;try{installHooks();const wanted=new Set();
   if(match?.role==='host'){
    for(const [side,p]of [['host',match.own],['guest',match.opponent]])if(p?.id===1&&p.character==='ronaldo-2007'){
     const motor=motorSide(side);if(motor&&n.is(motor,'PlayerMotor')&&isLive(motor)){boost(motor);const controller=n.get(motor,'playerCharacterSpriteController');if(n.is(controller,'PlayerCharacterSpriteController'))for(const r of paint(controller))wanted.add(r);}
    }
   }else if(!match&&owner?.id===1&&owner.selected==='ronaldo-2007'){
    const player=ownMenuPlayer(),controllers=n.array(n.call(28468,n.type('PlayerCharacterSpriteController, Assembly-CSharp')));
    for(const c of controllers)if(n.get(c,'player')===player)for(const r of paint(c))wanted.add(r);
   }
   for(const r of bindings.keys())if(!isLive(r)||!wanted.has(r))unbind(r);
   updateKick();
  }catch(error){lastError=errorText(error);console.error('Custom character:',lastError)}
 }
 function rb(motor){return n.get(motor,'thisRB2D')}
 function liveMotor(m){return m&&n.is(m,'PlayerMotor')&&isLive(m)}
 function kick(event){if(!ready||!match||match.role!=='host'||event.matchId!==match.matchId||event.seq<=lastSeq||event.kind!=='slide-kick')return false;
  const player=event.side==='host'?match.own:match.opponent;if(player?.id!==1||player.character!=='ronaldo-2007')return false;
  const motor=motorSide(event.side),other=motorSide(event.side==='host'?'guest':'host');if(!liveMotor(motor)||window.dunkersOnlineNative.info().state!==2)return false;
  lastSeq=event.seq;const body=rb(motor),from=n.readVec(36889,body),to=liveMotor(other)?n.readVec(36889,rb(other)):null,direction=to?Math.sign(to[0]-from[0])||1:(n.module.HEAPU8[motor+n.fields(motor).facingLeft]?-1:1);
  dash={motor,other,body,direction,until:performance.now()+450,hit:false,start:from,originalRotation:n.call(36866,body)};lastKick={seq:event.seq,side:event.side,hit:false,start:from};updateKick();return true;
 }
 function updateKick(){const time=performance.now();if(stun&&time>=stun.until){if(liveMotor(stun.motor)&&window.dunkersOnlineNative.info().state===2)n.call(12352,stun.motor,1);stun=null}
  if(!dash)return;if(!liveMotor(dash.motor)||time>=dash.until){if(liveMotor(dash.motor))n.call(36869,dash.body,dash.originalRotation);dash=null;return}
  const d=dash,current=n.readVec(36892,d.body);n.setVec(36893,d.body,[d.direction*28,Math.min(current[1],-1)]);n.call(36869,d.body,d.direction*65);
  if(!d.hit&&liveMotor(d.other)){const a=n.readVec(36889,d.body),b=n.readVec(36889,rb(d.other));if(Math.abs(a[0]-b[0])<2.2&&Math.abs(a[1]-b[1])<2.5){
    d.hit=true;lastKick.hit=true;lastKick.victim=d.other;lastKick.before=n.readVec(36892,rb(d.other));
    const f=n.fields(d.other);if(n.module.HEAPU8[d.other+f.hasBall]){n.call(12368,d.other);n.call(12369,d.other)}
    n.call(12381,d.other);n.call(12352,d.other,0);n.floats([d.direction*24,8],p=>n.call(36894,rb(d.other),p,1));n.setVec(36893,rb(d.other),[d.direction*18,10]);stun={motor:d.other,until:time+850};lastKick.after=n.readVec(36892,rb(d.other));
   }}
 }
 async function setOwner(state){owner=state;if(state.id===1&&state.selected==='ronaldo-2007')await prepare();tick()}
 async function setMatch(value){match=value;lastSeq=0;lastKick=null;if(value?.role==='host'&&[value.own,value.opponent].some(p=>p?.id===1&&p.character==='ronaldo-2007'))await prepare();tick()}
 function clearMatch(){match=null;dash=null;if(stun&&liveMotor(stun.motor))n.call(12352,stun.motor,1);stun=null;for(const r of [...bindings.keys()])unbind(r);stats.clear();paths.clear();tick()}
 window.dunkersCharacterNative={prepare,setOwner,setMatch,clearMatch,kick,
  uiPart(part){const p=atlas.get(part);if(!p)throw Error('Unknown character part: '+part);return {texture,uv:[p.x/2048,(1280-p.y-p.h)/1280,p.w/2048,p.h/1280]}},
  info:()=>({ready,bindings:bindings.size,materials:materials.size,error:lastError,lastKick,dashing:!!dash,boosted:[...stats.keys()]})};
 setInterval(tick,80);setInterval(()=>{if(ready)updateKick()},16);
})();
