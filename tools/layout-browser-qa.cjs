const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
const {createGameServer}=await import('../server.mjs');const dataDir=fs.mkdtempSync('/tmp/dunkers-layout-');const server=createGameServer({dataDir,log(){}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,args:['--no-sandbox','--window-size=1280,720']});
try{
for(const dpr of [1,2]){
const ctx=await browser.newContext({deviceScaleFactor:dpr,viewport:{width:1280,height:720}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/Build/*loader.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createUnityInstance=(c,o,p)=>{p(.6);return new Promise(()=>{})}'}));await page.goto(base);await page.waitForTimeout(1600);
assert.equal(await page.title(),'');assert.equal(await page.locator('#loading-screen img').count(),1);assert.equal(await page.locator('#loading-screen').innerText(),'');assert.equal(await page.locator('#loading-screen').getAttribute('aria-valuenow'),'60');
if(dpr===1){const cdp=await ctx.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/dunkers-console-loader.png',Buffer.from(shot.data,'base64'))}
for(const [width,height] of [[1920,1080],[2560,1080],[800,1200],[1366,768]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(60);const sizes=await page.evaluate(()=>['game','loading-screen'].map(id=>{const c=document.getElementById(id),r=c.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,ratio:c.width/c.height}}));
 for(const s of sizes){assert.equal(s.x,0);assert.equal(s.y,0);assert.equal(s.w,width);assert.equal(s.h,height);if(s.id==='game')assert.equal(s.ratio,1.6)}
}
await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>dunkersLoader.finish());assert.equal(await page.locator('#loading-screen').isHidden(),true);
for(const element of ['game','document','temporary']){
 await page.evaluate(which=>{const c=document.getElementById('game');let target=c;if(which==='document')target=document.documentElement;if(which==='temporary'){target=document.createElement('div');target.id='unity-temporary';c.parentNode.append(target);target.append(c)}const b=document.createElement('button');b.id='enter-fullscreen';b.textContent='Fullscreen';b.style='position:fixed;top:10px;left:10px;z-index:100';b.onclick=()=>target.requestFullscreen();document.body.append(b)},element);
 await page.locator('#enter-fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.waitForTimeout(80);
 const b=await page.evaluate(()=>{const r=document.getElementById('game').getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,iw:innerWidth,ih:innerHeight}});assert.equal(b.w,b.iw);assert.equal(b.h,b.ih);assert.equal(b.x,0);assert.equal(b.y,0);
 await page.evaluate(()=>document.exitFullscreen());await page.evaluate(()=>document.getElementById('enter-fullscreen').remove());
}
assert.deepEqual(errors,[]);await ctx.close();console.log('PASS icon-only loader, viewport and three fullscreen roots, DPR',dpr);
}
const ctx=await browser.newContext({reducedMotion:'reduce'});const p=await ctx.newPage();await p.route('**/Build/*loader.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createUnityInstance=()=>new Promise(()=>{})'}));await p.goto(base);assert.equal(await p.locator('.console-rail').evaluate(e=>getComputedStyle(e).animationName),'none');await p.evaluate(()=>dunkersLoader.finish());assert.equal(await p.locator('#loading-screen').isHidden(),true);console.log('PASS reduced motion');

// Reproduce two friends pressing Play while the first HTTP response is slow.
const clients=[];
for(let id=1;id<=2;id++){
 const c=await browser.newContext();await c.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'0'}});
 const fields=Array(30).fill('0');fields[0]='QueuePlayer'+id;fields[1]='1';fields[22]='8';
 await c.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'2',userIDPOST:String(id),eventDataPOST:fields.join(',')}});
 const p=await c.newPage();
 await p.route('**/Build/*loader.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createUnityInstance=async()=>({Module:{}})'}));
 await p.route('**/online-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersOnlineNative={ready:true,input(){},start:async()=>{const delay=window.startDelay||0;await new Promise(r=>setTimeout(r,delay));if(delay)throw new Error(\"Cancelled old start\")},stop:async()=>{},info:()=>({gc:1})}'}));
 if(id===1)await p.route('**/api/online/join',async r=>{const response=await r.fetch();await new Promise(resolve=>setTimeout(resolve,1000));await r.fulfill({response})});
 await p.goto(base);await p.locator('#online-open').click();clients.push({p,c});
}
await clients[0].p.locator('#online-play').click();
await clients[0].p.waitForFunction(()=>document.getElementById('online-title').textContent==='FINDING A PLAYER');
await clients[1].p.locator('#online-play').click();
for(const {p} of clients)await p.waitForFunction(()=>!document.getElementById('online-match').hidden);
await new Promise(resolve=>setTimeout(resolve,1300));
for(const {p,c} of clients){assert.equal(await p.locator('#online-match').isHidden(),false);assert.equal((await (await c.request.get(base+'/api/online/state')).json()).status,'matched')}
await clients[0].p.locator('#online-leave').click();for(const {p} of clients)await p.waitForFunction(()=>document.getElementById('online-match').hidden);
// An old, cancelled native startup cannot terminate a newer match.
await clients[0].p.evaluate(()=>window.startDelay=1800);
for(const {p} of clients)await p.locator('#online-play').click();
await clients[1].p.waitForFunction(()=>!document.getElementById('online-match').hidden);
await clients[1].p.locator('#online-cancel').click();
for(const {p} of clients)await p.waitForFunction(()=>document.getElementById('online-title').textContent==='PLAY ONLINE');
await clients[0].p.evaluate(()=>window.startDelay=0);
for(const {p} of clients)await p.locator('#online-play').click();
for(const {p} of clients)await p.waitForFunction(()=>!document.getElementById('online-match').hidden);
await new Promise(resolve=>setTimeout(resolve,2200));
for(const {p,c} of clients){assert.equal(await p.locator('#online-match').isHidden(),false);assert.equal((await (await c.request.get(base+'/api/online/state')).json()).status,'matched')}
await clients[0].p.locator('#online-leave').click();
console.log('PASS simultaneous Play with delayed HTTP, SSE cancellation and stale native startup');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true})}
})().catch(e=>{console.error(e);process.exit(1)});
