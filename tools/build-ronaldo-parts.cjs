// Rebuild deterministic native-size parts from a generated expression atlas.
// npm install --no-save @napi-rs/canvas; node tools/build-ronaldo-parts.cjs /path/to/heads.png
const fs = require('node:fs'), path = require('node:path');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const root = path.resolve(__dirname, '../public/custom/ronaldo-2007');
const native = JSON.parse(fs.readFileSync(path.join(root, 'native-template.json')));
const colors = { skin: '#edaa75', shirt: '#c71930', gold: '#d8bf84', shorts: '#f5f3eb', socks: '#27272a', boots: '#d82930' };
const parts = {}, images = {};
function save(name, canvas, source, role, extra = {}) {
 const file = 'parts/' + name + '.png'; fs.mkdirSync(path.join(root, 'parts'), { recursive: true });
 fs.writeFileSync(path.join(root, file), canvas.toBuffer('image/png'));
 parts[name] = { file, role, width: canvas.width, height: canvas.height, pivot: source?.pivot || [0.5,0.5], pixelsPerUnit: source?.pixelsPerUnit || 100, sourceSprite: source?.sourceSprite, ...extra };
 images[name] = canvas; return canvas;
}
async function body(name, base, color, paint) {
 const item = native[base], image = await loadImage(path.join(root, item.file));
 const c = createCanvas(image.width, image.height), ctx = c.getContext('2d');
 ctx.drawImage(image,0,0); ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0,0,c.width,c.height);
 ctx.globalCompositeOperation = 'source-over'; if (paint) await paint(ctx,c);
 ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(image,0,0); ctx.globalCompositeOperation = 'source-over';
 return save(name,c,item,base);
}
function swoosh(ctx,x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-2,15,4,17,10,14);ctx.lineTo(33,0);ctx.lineTo(10,10);ctx.bezierCurveTo(4,13,1,12,0,7);ctx.fill();ctx.restore()}
(async()=>{
 const sheet = await loadImage(process.argv[2]);
 if (sheet.width !== 1536 || sheet.height !== 1024) throw Error('Expected the 3x2 expression atlas at 1536x1024.');
 const expressions = ['neutral','happy','angry','shocked','smug','blink'];
 for(let i=0;i<6;i++){
  const cell=createCanvas(512,512), cc=cell.getContext('2d');cc.drawImage(sheet,-(i%3)*512,-Math.floor(i/3)*512);
  const pixels=cc.getImageData(0,0,512,512).data;let x0=512,y0=512,x1=0,y1=0;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(pixels[(y*512+x)*4+3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1)}
  const c=createCanvas(300,300), ctx=c.getContext('2d'), scale=Math.min(208/(x1-x0),260/(y1-y0));
  const w=(x1-x0)*scale,h=(y1-y0)*scale;
  ctx.drawImage(cell,x0,y0,x1-x0,y1-y0,150-w/2,20,w,h);
  save('head-'+expressions[i],c,null,'face',{ expression:expressions[i], pivot:[0.5,0.5],pixelsPerUnit:100 });
  const mask=createCanvas(300,300),mc=mask.getContext('2d');mc.drawImage(c,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle='#fff';mc.fillRect(0,0,300,300);
  save('head-'+expressions[i]+'-mask',mask,null,'face-outline',{ expression:expressions[i], pivot:[0.5,0.5],pixelsPerUnit:100 });
 }
 const crest=await loadImage(path.join(root,'sources/manchester-united-crest.svg'));
 await body('torso','torso',colors.shirt,ctx=>{
  ctx.fillStyle=colors.skin;ctx.beginPath();ctx.moveTo(56,0);ctx.lineTo(75,23);ctx.lineTo(94,0);ctx.fill();
  ctx.strokeStyle='#f7f5ef';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(53,2);ctx.lineTo(75,28);ctx.lineTo(97,2);ctx.stroke();
  ctx.strokeStyle=colors.gold;ctx.lineWidth=1.3;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(75+side*25,11);ctx.lineTo(75+side*51,24);ctx.lineTo(75+side*65,39);ctx.stroke()}
  swoosh(ctx,31,43,.65);
  ctx.fillStyle='#eee8d5';ctx.beginPath();ctx.moveTo(97,35);ctx.lineTo(111,35);ctx.lineTo(119,40);ctx.lineTo(115,61);ctx.lineTo(104,67);ctx.lineTo(92,61);ctx.lineTo(89,40);ctx.closePath();ctx.fill();ctx.drawImage(crest,92,37,24,25);
  ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.strokeRect(31,78,88,32);ctx.fillStyle='#fff';ctx.font='30px serif';ctx.textAlign='center';ctx.fillText('AIG',75,103);
 });
 await body('hips','pelvis',colors.shorts);
 for(const side of ['left','right']){
  await body('arm-'+side,'arm',colors.shirt,(ctx,c)=>{ctx.fillStyle='#f8f5ec';ctx.fillRect(0,c.height-32,c.width,10)});
  await body('shorts-'+side,'shorts',colors.shorts,ctx=>{ctx.strokeStyle='#24252a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(51,15);ctx.lineTo(57,57);ctx.stroke();if(side==='right'){ctx.fillStyle='#24252a';ctx.font='bold 22px sans-serif';ctx.fillText('7',73,55)}});
  await body('leg-'+side,'leg',colors.skin,(ctx,c)=>{ctx.fillStyle=colors.socks;ctx.fillRect(0,57,c.width,c.height);ctx.fillStyle='#f7f5ef';ctx.fillRect(0,58,c.width,3);ctx.fillRect(0,65,c.width,3)});
  await body('boot-'+side,'boot',colors.boots,(ctx,c)=>{ctx.fillStyle='#f7f5ef';ctx.fillRect(0,c.height-32,c.width,13);swoosh(ctx,82,69,1.55)});
 }
 for(const [name,base] of [['hand-front','hand-front'],['hand-back','hand-back'],['hand-closed-front','hand-closed-front'],['hand-closed-back','hand-closed-back']]) await body(name,base,colors.skin);
 const manifest={id:'ronaldo-2007',displayName:'Cristiano Ronaldo — 2007',version:1,status:'asset-pack',nativeBuild:'Dunkers 2 v4.5, Unity 2022.3.39f1',description:'Modular character artwork; not registered as a selectable native roster entry.',kit:'Manchester United 2006–07 home, white V-neck and gold piping',colors,expressions,parts};
 fs.writeFileSync(path.join(root,'character.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Built',Object.keys(parts).length,'separate native-size PNG parts.');
})().catch(e=>{console.error(e);process.exit(1)});
