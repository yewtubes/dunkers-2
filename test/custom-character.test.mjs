import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../public/custom/ronaldo-2007/',import.meta.url));
// Decode the built 8-bit RGBA PNGs without adding a production dependency.
function png(file){
 const data=fs.readFileSync(file);assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=data.readUInt32BE(16),height=data.readUInt32BE(20);assert.equal(data[24],8);assert.equal(data[25],6);
 const chunks=[];for(let pos=8;pos<data.length;){const size=data.readUInt32BE(pos),type=data.toString('ascii',pos+4,pos+8);if(type==='IDAT')chunks.push(data.subarray(pos+8,pos+8+size));pos+=12+size;}
 const encoded=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);let at=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
 for(let y=0;y<height;y++){const filter=encoded[at++];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;const prediction=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];assert.notEqual(prediction,undefined);pixels[i]=(encoded[at++]+prediction)&255;}}
 return {width,height,pixels};
}
test('Ronaldo pack has complete, visible modular parts with native pivots and matching outlines',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'character.json')));
 assert.equal(Object.keys(manifest.parts).length,26);assert.equal(manifest.status,'asset-pack');
 for(const [name,part]of Object.entries(manifest.parts)){
  const image=png(path.join(root,part.file));assert.equal(image.width,part.width,name);assert.equal(image.height,part.height,name);
  assert(part.pivot.every(v=>v>=0&&v<=1),name);assert(part.pixelsPerUnit>0,name);
  let visible=0,transparent=0;for(let i=3;i<image.pixels.length;i+=4){if(image.pixels[i]>128)visible++;if(image.pixels[i]===0)transparent++;}
  assert(visible>200,`${name} must not be an empty/contour-only packed alias`);assert(transparent>200,`${name} must have real transparency`);
 }
 for(const expression of manifest.expressions){
  const face=png(path.join(root,manifest.parts['head-'+expression].file)),mask=png(path.join(root,manifest.parts['head-'+expression+'-mask'].file));
  assert.equal(face.width,300);assert.equal(face.height,300);
  for(let i=3;i<face.pixels.length;i+=4)assert(Math.abs(face.pixels[i]-mask.pixels[i])<=1,`${expression} outline alpha mismatch`);
 }
 assert(Math.abs(manifest.parts['arm-left'].pivot[0]-.67)<1e-5);assert(Math.abs(manifest.parts['arm-left'].pivot[1]-.9)<1e-5);
 assert(Math.abs(manifest.parts['leg-left'].pivot[1]-.75)<1e-5);
});
