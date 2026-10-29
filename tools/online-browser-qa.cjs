const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
 const {createGameServer}=await import('../server.mjs');const dataDir=fs.mkdtempSync('/tmp/dunkers-online-e2e-');
 const server=createGameServer({dataDir,log(){}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE || undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1920,1080']});
 try {
 async function seed(ctx,name,id){await ctx.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'0'}});const f=Array(30).fill('0');Object.assign(f,{0:name,1:'1',3:'1500',4:'50',20:'',21:'',22:'7',23:'249',24:'1',29:''});await ctx.request.post(base+'/backend/SetEventData.php',{form:{eventIDPOST:'2',userIDPOST:String(id),eventDataPOST:f.join(',')+'§30:1:1|,1:,2:,3:,23456,28282,5,6,,,,0:0:0:0:0:0:0:0:0:0,1,1§30,-1,-1,23456,28282,5,6,0,5,0,5,0,5,1'}})}
 const hc=await browser.newContext({viewport:{width:960,height:600}}),gc=await browser.newContext({viewport:{width:1280,height:720}});
 await seed(hc,'HostBaller',1);await seed(gc,'FriendBaller',2);
 const host=await hc.newPage(),guest=await gc.newPage();
 for(const [n,p] of [['host',host],['guest',guest]]){p.on('response',r=>{if(r.status()>=400)console.log('HTTP',n,r.status(),r.url())});p.on('pageerror',e=>console.log('PAGEERROR',n,e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Pointer_stringify'))console.log('ERROR',n,m.text())})}
 // A guest displays actual streamed host frames. Its unused local Unity menu is
 // stubbed in QA to avoid running two WebGL renderers on the software GPU.
 await guest.route('**/Build/*loader.js',r=>r.fulfill({contentType:'text/javascript',body:'window.createUnityInstance=async()=>({Module:{}})'}));
 await guest.route('**/online-native.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.dunkersOnlineNative={ready:true,input(){},stop:async()=>{}}'}));
 await Promise.all([host.goto(base),guest.goto(base)]);
 await host.waitForFunction(()=>window.unityGame,null,{timeout:120000});await host.waitForTimeout(12000);await host.mouse.click(375,385);await host.waitForFunction(()=>window.dunkersOnlineNative?.ready,null,{timeout:30000});
 await host.locator('#online-open').click();await host.locator('#online-create').click();
 await host.waitForFunction(()=>/^Room [A-F0-9]{6}/.test(document.getElementById('online-message').textContent));const room=await host.locator('#online-message').textContent();const code=room.match(/Room ([A-F0-9]{6})/)[1];console.log('ROOM',code);
 await guest.locator('#online-open').click();await guest.locator('#online-room').fill(code);await guest.locator('#online-room-form button').click();
 try { await host.waitForFunction(()=>dunkersOnlineNative.info().state===2,null,{timeout:60000}); } catch(e) { console.log('HOST_DIAG',JSON.stringify(await host.evaluate(()=>({info:dunkersOnlineNative.info(),text:document.getElementById('online-message').textContent})))); console.log('GUEST_DIAG',await guest.locator('#online-message').textContent()); const diag=await (await hc.request.get(base+'/api/online/state')).json();delete diag.csrf;console.log('SERVER_DIAG',diag); throw e; }
 await guest.waitForFunction(()=>!document.getElementById('online-view').hidden&&document.getElementById('online-panel').hidden,null,{timeout:30000});
 await host.waitForTimeout(3000);console.log('NATIVE',JSON.stringify(await host.evaluate(()=>dunkersOnlineNative.info())));
 const pixels=await guest.evaluate(()=>{const p=document.getElementById('online-view').getContext('2d').getImageData(0,0,960,600).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n});assert(pixels>150000,'Guest must see rendered native court pixels');console.log('GUEST_PIXELS',pixels);
 await guest.keyboard.down('ArrowLeft');await host.waitForFunction(()=>dunkersOnlineNative.info().enemy?.forward===1,null,{timeout:5000});
 const held=await host.evaluate(()=>dunkersOnlineNative.info());assert.equal(held.own.forward,0);assert.notEqual(held.own.pointer,held.enemy.pointer);console.log('REMOTE_HELD',JSON.stringify(held));
 await guest.keyboard.up('ArrowLeft');await host.waitForFunction(()=>dunkersOnlineNative.info().enemy?.forward===0,null,{timeout:5000});console.log('REMOTE_RELEASED');
 await host.keyboard.down('ArrowRight');await host.waitForTimeout(500);console.log('HOST_HELD',JSON.stringify(await host.evaluate(()=>dunkersOnlineNative.info())));await host.keyboard.up('ArrowRight');
 const cdp=await gc.newCDPSession(guest);const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/dunkers-guest-court.png',Buffer.from(shot.data,'base64'));
 // The visible game must fill the viewport while retaining Unity's exact 8:5 buffer.
 for(const [width,height] of [[1920,1080],[2560,1080],[800,1200]]){await host.setViewportSize({width,height});const bounds=await host.evaluate(()=>{const c=document.getElementById('game'),r=c.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,ratio:c.width/c.height}});assert.equal(bounds.w,width);assert.equal(bounds.h,height);assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.ratio,1.6)}
 await guest.locator('#online-leave').click();await host.waitForFunction(()=>document.getElementById('online-opponent').textContent&&document.getElementById('online-match').hidden,null,{timeout:10000});await host.waitForFunction(()=>!dunkersOnlineNative.info().gc,null,{timeout:15000});
 await host.waitForTimeout(1500); assert.equal((await (await hc.request.get(base+'/api/online/state')).json()).status,'idle');
 // The original native Play route must enter our human-first queue too.
 await host.evaluate(()=>unityGame.SendMessage('MainUI','ShowMenu','gamemodemenu'));
 await host.waitForFunction(()=>document.getElementById('online-title').textContent==='FINDING A PLAYER',null,{timeout:10000});
 try{await host.waitForFunction(()=>dunkersOnlineNative.info().mode==='cpu'&&dunkersOnlineNative.info().state===2,null,{timeout:60000});}catch(e){console.log('CPU_DIAG',JSON.stringify(await host.evaluate(()=>({info:dunkersOnlineNative.info(),text:document.getElementById('online-message').textContent,title:document.getElementById('online-title').textContent}))));throw e;}
 await host.waitForFunction(()=>dunkersOnlineNative.info().cpuTicks>30,null,{timeout:10000});
 assert.equal((await (await hc.request.get(base+'/api/online/state')).json()).opponent.isBot,true);
 console.log('CPU_FALLBACK',JSON.stringify(await host.evaluate(()=>dunkersOnlineNative.info())));
 await host.locator('#online-leave').click();
 console.log('PASS shared native match, separate accounts, independent controls, viewport fill, leave, native Play, CPU fallback');
 } finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dataDir,{recursive:true})}
})().catch(e=>{console.error(e);process.exit(1)});
