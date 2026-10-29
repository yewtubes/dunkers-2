import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameServer } from '../server.mjs';

test('Ronaldo ownership comes from the session and selection survives saves/restarts', async () => {
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'dunkers-characters-'));let server,base;
 async function start(){server=createGameServer({dataDir,log(){}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port}
 async function stop(){server.closeAllConnections();await new Promise(r=>server.close(r))}
 const state=cookie=>fetch(base+'/api/characters/state',{headers:{cookie}}).then(r=>r.json());
 const select=(cookie,csrf,character)=>fetch(base+'/api/characters/select',{method:'POST',headers:{cookie,'Content-Type':'application/json','X-Character-CSRF':csrf},body:JSON.stringify({character,userId:1})});
 await start();try{
  const login=()=>fetch(base+'/backend/SetEventData.php',{method:'POST',body:new URLSearchParams({eventIDPOST:0})});
  const cookie=(await login()).headers.get('set-cookie').split(';')[0],other=(await login()).headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/characters/state')).status,401);
  let a=await state(cookie),b=await state(other);assert.equal(a.id,1);assert.equal(a.selected,'ronaldo-2007');assert.equal(a.characters.length,1);assert.equal(b.selected,null);assert.deepEqual(b.characters,[]);
  assert.equal((await select(other,b.csrf,'ronaldo-2007')).status,403);
  assert.equal((await select(cookie,'bad','ronaldo-2007')).status,403);
  assert.equal((await select(cookie,a.csrf,'missing')).status,400);
  assert.equal((await select(cookie,a.csrf,null)).status,200);
  await stop();await start();a=await state(cookie);assert.equal(a.selected,null);
  assert.equal((await select(cookie,a.csrf,'ronaldo-2007')).status,200);
  await stop();await start();assert.equal((await state(cookie)).selected,'ronaldo-2007');
 }finally{await stop();fs.rmSync(dataDir,{recursive:true})}
});
