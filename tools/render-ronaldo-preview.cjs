const fs=require('node:fs'),path=require('node:path');
const {createCanvas,loadImage}=require('@napi-rs/canvas');

const root=path.resolve(__dirname,'../public/custom/ronaldo-2007');
(async()=>{
 const renderer=await import('../public/custom/ronaldo-2007/renderer.js');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'character.json'))),pose=JSON.parse(fs.readFileSync(path.join(root,'sources/native-rest-pose.json'))),images={};
 for(const [name,part]of Object.entries(manifest.parts))images[name]=await loadImage(path.join(root,part.file));
 const canvas=createCanvas(900,1500),ctx=canvas.getContext('2d');renderer.draw(ctx,images,manifest,pose,'neutral');
 fs.writeFileSync(path.join(root,'preview.png'),canvas.toBuffer('image/png'));
 const sheet=createCanvas(1200,850),s=sheet.getContext('2d');s.fillStyle='#0077bd';s.fillRect(0,0,1200,850);
 const selected=['head-neutral','head-happy','head-angry','head-shocked','head-smug','head-blink','torso','hips','arm-left','arm-right','shorts-left','shorts-right','leg-left','leg-right','boot-left','boot-right','hand-front','hand-back','hand-closed-front','hand-closed-back'];
 s.textAlign='center';s.font='16px sans-serif';s.fillStyle='white';
 for(let i=0;i<selected.length;i++){const name=selected[i],im=images[name],x=i%5*240,y=Math.floor(i/5)*210,scale=Math.min(165/im.width,165/im.height);s.drawImage(im,x+120-im.width*scale/2,y+12,im.width*scale,im.height*scale);s.fillText(name,x+120,y+198)}
 fs.writeFileSync(path.join(root,'parts-preview.png'),sheet.toBuffer('image/png'));console.log('Rendered transparent character and separated parts sheet.');
})().catch(e=>{console.error(e);process.exit(1)});
