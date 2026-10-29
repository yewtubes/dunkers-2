const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const {createGameServer}=await import('../server.mjs'),guestOwner=process.argv.includes('--guest-owner');
 const dataDir=fs.mkdtempSync('/tmp/dunkers-character-qa-'),server=createGameServer({dataDir,log(){}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/tmp/dunkers-browser/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,800']});
 try{
  const hc=await browser.newContext({viewport:{width:960,height:600}}),gc=await browser.newContext({viewport:{width:1280,height:720}});
  async function seed(ctx,name,id){await ctx.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'0'}});const f=Array(30).fill('0');Object.assign(f,{0:name,1:'1',3:'1500',4:'50',20:'',21:'',22:'8',23:'249',24:'1',29:''});await ctx.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'2',userIDPOST:String(id),eventDataPOST:f.join(',')+'§30:1:1|,1:,2:,3:,23456,28282,5,6,,,,0:0:0:0:0:0:0:0:0:0,1,1§30,-1,-1,23456,28282,5,6,0,5,0,5,0,5,1'}})}
  if(guestOwner){await seed(gc,'GuestRonaldo',1);await seed(hc,'HostBaller',2)}else{await seed(hc,'RonaldoOwner',1);await seed(gc,'FriendBaller',2)}
  const host=await hc.newPage(),guest=await gc.newPage(),errors=[];
  for(const [label,page]of [['host',host],['guest',guest]]){page.on('pageerror',e=>{errors.push(label+': '+e.message);console.log('PAGEERROR',label,e.message)});page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Pointer_stringify'))console.log('ERROR',label,m.text())})}
  // A remote guest consumes real host frames. Its unused Unity menu is stubbed
  // so software-GPU QA runs one native renderer; transport and controls are real.
  await guest.route('**/Build/*loader.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createUnityInstance=async()=>({Module:{}})'}));
  await guest.route('**/online-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersOnlineNative={ready:true,input(){},stop:async()=>{}}'}));
  await guest.route('**/character-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersCharacterNative={setOwner:async()=>{},setMatch:async()=>{},clearMatch(){},kick(){},info:()=>({})}'}));
  await guest.route('**/locker-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersLockerNative={available:async()=>true,setOwner:async()=>{},open(){},info:()=>({})}'}));
  await Promise.all([host.goto(base),guest.goto(base)]);await host.bringToFront();
  await host.waitForFunction(()=>window.unityGame,null,{timeout:120000});await host.waitForTimeout(12000);await host.mouse.click(375,385);
  await host.waitForFunction(()=>window.dunkersOnlineNative?.ready,null,{timeout:30000});
  async function shot(path){const cdp=await hc.newCDPSession(host),value=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path,Buffer.from(value.data,'base64'));await cdp.detach()}
  if(!guestOwner){
   await host.waitForFunction(()=>dunkersLockerNative.info().ready);await host.evaluate(()=>unityGame.SendMessage('MainUI','ShowMenu','equipment'));await host.waitForFunction(()=>dunkersLockerNative.info().cards.some(c=>c.context==='locker'));await host.mouse.click(315,510);
   await host.waitForFunction(()=>dunkersCharacterNative.info().bindings===0);assert.equal((await(await hc.request.get(base+'/api/characters/state')).json()).selected,null);
   await host.mouse.click(195,510);await host.waitForFunction(()=>dunkersCharacterNative.info().bindings>20);await host.mouse.click(20,40);await host.waitForTimeout(1000);
   console.log('SELECTOR_PASS',await host.evaluate(()=>dunkersCharacterNative.info()));
  }else assert.equal(await host.locator('#character-ui').count(),0);
  await Promise.all([host.waitForFunction(()=>dunkersOnline.info().connected),guest.waitForFunction(()=>dunkersOnline.info().connected)]);
  await host.evaluate(()=>unityGame.SendMessage('MainUI','ShowMenu','gamemodemenu'));await host.waitForFunction(()=>dunkersOnline.info().state.status==='waiting');
  await guest.evaluate(()=>window.dispatchEvent(new Event('dunkers-play')));await host.bringToFront();console.log('MATCH_START',guestOwner?'guest owns Ronaldo':'host owns Ronaldo');
  try{await host.waitForFunction(()=>dunkersOnlineNative.info().state===2,null,{timeout:100000})}catch(error){console.log('DIAG',await host.evaluate(()=>({native:dunkersOnlineNative.info(),character:dunkersCharacterNative.info(),online:dunkersOnline.info()})));throw error}
  await guest.waitForFunction(()=>!document.getElementById('online-view').hidden&&document.getElementById('loading-screen').hidden,null,{timeout:30000});
  await host.waitForTimeout(500);
  const live=await host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),stats=p=>['Speed','Jumping','Handling','Shooting'].map(k=>n.get(p,k));return {character:dunkersCharacterNative.info(),owner:stats(i[g?'enemy':'own'].pointer),normal:stats(i[g?'own':'enemy'].pointer)}},guestOwner);
  assert(live.character.bindings>=50);assert.equal(live.character.error,'');assert.deepEqual(live.owner,[100,100,100,100]);assert.notDeepEqual(live.normal,[100,100,100,100]);console.log('NATIVE_STATS_PASS',JSON.stringify(live));
  const pixels=await guest.evaluate(()=>{const p=document.getElementById('online-view').getContext('2d').getImageData(0,0,960,600).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n});assert(pixels>150000);console.log('REMOTE_FRAMES_PASS',pixels);
  const kitPixels=await guest.evaluate(()=>{const source=document.getElementById('online-view'),c=document.createElement('canvas');c.width=960;c.height=600;const ctx=c.getContext('2d');ctx.drawImage(source,0,0,960,600);const p=ctx.getImageData(192,300,576,204).data;let count=0;for(let i=0;i<p.length;i+=4)if(p[i]>140&&p[i+1]<80&&p[i+2]>20&&p[i+2]<105)count++;return count});console.log('TWO_SIDED_KIT_PIXELS',kitPixels);assert(kitPixels>75,'Custom kit must render from both facing directions');
  await shot('/tmp/dunkers-ronaldo-'+(guestOwner?'guest':'host')+'-before.png');
  async function faces(){return host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),c=n.get(i[g?'enemy':'own'].pointer,'playerCharacterSpriteController');return n.array(n.get(c,'spriteRenderers')).filter(r=>r&&n.ptr(r+8)&&/face/i.test(n.text(n.call(28453,r)))).map(r=>({r,name:n.text(n.call(28453,r)),enabled:n.call(27322,r),sprite:n.call(28712,r)?n.text(n.call(28453,n.call(28712,r))):'',mat:n.call(27342,r)}))},guestOwner)}
  assert((await faces()).some(face=>face.name==='Face'&&face.enabled&&face.sprite));
  const owner=guestOwner?guest:host;
  // Arrange both complete native ragdolls at contact distance when the actual
  // authenticated F request is sent, keeping limbs and joints together.
  await owner.route('**/api/online/ability',async route=>{await host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),a=i[g?'enemy':'own'].pointer,b=i[g?'own':'enemy'].pointer,type=n.type('UnityEngine.Rigidbody2D, UnityEngine.Physics2DModule'),point=n.readVec(36889,n.get(b,'thisRB2D'));
   for(const [motor,x]of [[b,point[0]],[a,point[0]-1]]){const origin=n.readVec(36889,n.get(motor,'thisRB2D')),bodies=n.array(n.call(28333,n.call(28273,motor),type,1,1,1,0,0));if(bodies.length<2)throw Error('Expected a complete native ragdoll');for(const rb of bodies){const p=n.readVec(36889,rb);n.setVec(36890,rb,[p[0]+x-origin[0],p[1]+point[1]-origin[1]]);n.setVec(36893,rb,[0,0])}}
  },guestOwner);await route.continue()});
  await owner.evaluate(()=>document.activeElement.blur());await owner.keyboard.press('f');await host.bringToFront();
  assert((await faces()).some(face=>face.name==='Face'&&face.enabled&&face.sprite));await shot('/tmp/dunkers-tackle-'+(guestOwner?'guest':'host')+'-during.png');
  try{await host.waitForFunction(()=>dunkersCharacterNative.info().lastKick?.hit,null,{timeout:7000})}catch(error){console.log('KICK_DIAG',await host.evaluate(()=>({native:dunkersOnlineNative.info(),character:dunkersCharacterNative.info()})),await guest.evaluate(()=>({online:dunkersOnline.info(),character:{id:dunkersCharacters.state?.id,selected:dunkersCharacters.state?.selected}})));throw error}
  const kick=await host.evaluate(()=>dunkersCharacterNative.info());assert.equal(kick.error,'');assert.equal(kick.lastKick.side,guestOwner?'guest':'host');assert(Math.abs(kick.lastKick.after[0])>=18);console.log('F_KICK_PASS',JSON.stringify(kick));
  const head=await host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),c=n.get(i[g?'enemy':'own'].pointer,'playerCharacterSpriteController'),r=n.array(n.get(c,'spriteRenderers')).find(r=>r&&n.ptr(r+8)&&n.text(n.call(28453,r))==='Face'),sprite=n.call(28712,r);n.call(28713,r,0);n.call(27323,r,0);return {enabled:n.call(27322,r),restored:n.call(28712,r)===sprite}},guestOwner);assert.deepEqual(head,{enabled:1,restored:true});console.log('HEAD_RECOVERY_PASS',head);
  await host.waitForTimeout(1500);
  for(let repeat=0;repeat<2;repeat++){
   await host.waitForFunction(()=>dunkersOnlineNative.info().state===2,null,{timeout:15000});const before=await host.evaluate(()=>dunkersCharacterNative.info().lastKick.seq);await owner.keyboard.press('f');await host.bringToFront();await host.waitForFunction(seq=>dunkersCharacterNative.info().lastKick?.seq>seq,before,{timeout:5000});await host.waitForTimeout(500);assert((await faces()).some(face=>face.name==='Face'&&face.enabled&&face.sprite));await host.waitForTimeout(1000);
  }
  console.log('PASS head remains visible over repeated slide kicks');
  await host.waitForTimeout(1100);assert.equal(await host.evaluate(g=>dunkersOnlineNative.info()[g?'own':'enemy'].canMove,guestOwner),1);
  for(const [width,height]of [[1920,1080],[2560,1080],[800,1200]]){await host.setViewportSize({width,height});const r=await host.evaluate(()=>{const c=document.getElementById('game'),r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,ratio:c.width/c.height}});assert.deepEqual(r,{x:0,y:0,w:width,h:height,ratio:1.6})}
  await host.setViewportSize({width:960,height:600});await guest.keyboard.press('Escape');await host.bringToFront();await host.waitForFunction(()=>!dunkersOnlineNative.info().gc,null,{timeout:30000});
  await host.waitForTimeout(1000);assert.equal((await(await hc.request.get(base+'/api/online/state')).json()).status,'idle');assert.equal((await host.evaluate(()=>dunkersCharacterNative.info())).error,'');assert.deepEqual(errors,[]);assert.equal(await host.locator('button,input,dialog,#character-ui,#online-ui').count(),0);assert.equal(await guest.locator('button,input,dialog,#character-ui,#online-ui').count(),0);
  console.log('PASS native Ronaldo, selector, exclusive ownership, F contact, recovery, streamed match, viewport, leave');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true})}
})().catch(error=>{console.error(error);process.exit(1)});
