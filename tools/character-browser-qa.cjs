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
  await guest.route('**/locker-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersLockerNative={setOwner:async()=>{},open(){},info:()=>({})}'}));
  await Promise.all([host.goto(base),guest.goto(base)]);await host.bringToFront();
  await host.waitForFunction(()=>window.unityGame,null,{timeout:120000});await host.waitForTimeout(12000);await host.mouse.click(375,385);
  await host.waitForFunction(()=>window.dunkersOnlineNative?.ready,null,{timeout:30000});
  async function shot(path){const cdp=await hc.newCDPSession(host),value=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path,Buffer.from(value.data,'base64'));await cdp.detach()}
  if(!guestOwner){
   await host.locator('#character-open').waitFor({state:'visible',timeout:30000});await host.mouse.click(480,280);await host.waitForFunction(()=>dunkersLockerNative.info().cards.some(c=>c.context==='locker'));await host.mouse.click(315,510);
   await host.waitForFunction(()=>dunkersCharacterNative.info().bindings===0);assert.equal((await(await hc.request.get(base+'/api/characters/state')).json()).selected,null);
   await host.mouse.click(195,510);await host.waitForFunction(()=>dunkersCharacterNative.info().bindings>20);await host.mouse.click(20,40);await host.waitForTimeout(1000);
   console.log('SELECTOR_PASS',await host.evaluate(()=>dunkersCharacterNative.info()));
  }else assert.equal(await host.locator('#character-open').isVisible(),false);
  await host.locator('#online-open').click();await host.locator('#online-create').click();await host.waitForFunction(()=>/^Room [A-F0-9]{6}/.test(document.getElementById('online-message').textContent));
  const code=(await host.locator('#online-message').textContent()).match(/Room ([A-F0-9]{6})/)[1];
  await guest.locator('#online-open').click();await guest.locator('#online-room').fill(code);await guest.locator('#online-room-form button').click();await host.bringToFront();console.log('MATCH_START',guestOwner?'guest owns Ronaldo':'host owns Ronaldo');
  try{await host.waitForFunction(()=>dunkersOnlineNative.info().state===2,null,{timeout:100000})}catch(error){console.log('DIAG',await host.evaluate(()=>({native:dunkersOnlineNative.info(),character:dunkersCharacterNative.info(),message:document.getElementById('online-message').textContent})));throw error}
  await guest.waitForFunction(()=>!document.getElementById('online-view').hidden&&document.getElementById('online-panel').hidden,null,{timeout:30000});
  await host.waitForTimeout(500);
  const live=await host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),stats=p=>['Speed','Jumping','Handling','Shooting'].map(k=>n.get(p,k));return {character:dunkersCharacterNative.info(),owner:stats(i[g?'enemy':'own'].pointer),normal:stats(i[g?'own':'enemy'].pointer)}},guestOwner);
  assert(live.character.bindings>=50);assert.equal(live.character.error,'');assert.deepEqual(live.owner,[100,100,100,100]);assert.notDeepEqual(live.normal,[100,100,100,100]);console.log('NATIVE_STATS_PASS',JSON.stringify(live));
  const pixels=await guest.evaluate(()=>{const p=document.getElementById('online-view').getContext('2d').getImageData(0,0,960,600).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n});assert(pixels>150000);console.log('REMOTE_FRAMES_PASS',pixels);
  await shot('/tmp/dunkers-ronaldo-'+(guestOwner?'guest':'host')+'-before.png');
  await host.evaluate(g=>{const n=dunkersNativeRuntime,i=dunkersOnlineNative.info(),a=n.get(i[g?'enemy':'own'].pointer,'thisRB2D'),b=n.get(i[g?'own':'enemy'].pointer,'thisRB2D'),p=n.readVec(36889,b);n.setVec(36891,a,[p[0]-1.5,p[1]])},guestOwner);
  const owner=guestOwner?guest:host;await owner.evaluate(()=>document.activeElement.blur());await owner.keyboard.press('f');await host.bringToFront();
  await host.waitForFunction(()=>dunkersCharacterNative.info().lastKick?.hit,null,{timeout:7000});
  const kick=await host.evaluate(()=>dunkersCharacterNative.info());assert.equal(kick.error,'');assert.equal(kick.lastKick.side,guestOwner?'guest':'host');assert(Math.abs(kick.lastKick.after[0])>=18);console.log('F_KICK_PASS',JSON.stringify(kick));
  await host.waitForTimeout(1100);assert.equal(await host.evaluate(g=>dunkersOnlineNative.info()[g?'own':'enemy'].canMove,guestOwner),1);
  for(const [width,height]of [[1920,1080],[2560,1080],[800,1200]]){await host.setViewportSize({width,height});const r=await host.evaluate(()=>{const c=document.getElementById('game'),r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,ratio:c.width/c.height}});assert.deepEqual(r,{x:0,y:0,w:width,h:height,ratio:1.6})}
  await host.setViewportSize({width:960,height:600});await guest.locator('#online-leave').click();await host.bringToFront();await host.waitForFunction(()=>!dunkersOnlineNative.info().gc,null,{timeout:30000});
  await host.waitForTimeout(1000);assert.equal((await(await hc.request.get(base+'/api/online/state')).json()).status,'idle');assert.equal((await host.evaluate(()=>dunkersCharacterNative.info())).error,'');assert.deepEqual(errors,[]);
  console.log('PASS native Ronaldo, selector, exclusive ownership, F contact, recovery, streamed match, viewport, leave');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true})}
})().catch(error=>{console.error(error);process.exit(1)});
