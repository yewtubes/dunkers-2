// Asset preview renderer. The source matrices are an exported native UI rest pose.
// This does not replace or emulate the game's gameplay/physics renderer.

 const aliases = {Jersey:'torso',Pelvis:'hips',RightArm:'arm-right',LeftArm:'arm-left',RightLeg:'leg-right',LeftLeg:'leg-left',RightLegShorts:'shorts-right',LeftLegShorts:'shorts-left',Face:'head-neutral'};
 function layers(manifest, pose, expression='neutral') {
  return pose.flatMap(node=>{
   let part=aliases[node.name];
   if(node.name==='Hand')part=node.sortOrder===11?'hand-front':'hand-back';
   if(node.name==='Boot')part=node.sortOrder===18?'boot-right':'boot-left';
   if(!part)return [];
   if(node.name==='Face')part='head-'+expression;
   const matrix=node.matrix.map(row=>row.slice());
   // The active game applies per-player BodyTypeSettings after loading. This
   // compact-head setting is explicit preview configuration, not a new pivot.
   if(node.name==='Face'){for(let r=0;r<2;r++)for(let c=0;c<2;c++)matrix[r][c]*=.7;matrix[1][3]+=50;}
   // The inspector's unconfigured arm stretch is corrected for a neutral
   // assembly preview. Gameplay uses the native body settings and joints.
   if(node.name==='RightArm'||node.name==='LeftArm'){for(let r=0;r<2;r++)for(let c=0;c<2;c++)matrix[r][c]*=.55;}
   if(node.name==='Hand'){
    const arm=pose.find(n=>n.name===(node.sortOrder===11?'RightArm':'LeftArm')).matrix;
    for(let r=0;r<2;r++)matrix[r][3]=arm[r][3]+(matrix[r][3]-arm[r][3])*.55;
   }
   return [{part,matrix,order:node.sortOrder,meta:manifest.parts[part]}];
  }).sort((a,b)=>a.order-b.order);
 }
 function draw(ctx, images, manifest, pose, expression='neutral', options={}) {
  const width=ctx.canvas.width,height=ctx.canvas.height,scale=Math.min(width/900,height/1500),ox=width*.5,oy=height*.94;
  ctx.clearRect(0,0,width,height);
  for(const layer of layers(manifest,pose,expression)){
   const p=layer.meta,m=layer.matrix,ppu=p.pixelsPerUnit,w=p.width,h=p.height,px=p.pivot[0]*w,py=(1-p.pivot[1])*h;
   ctx.save();ctx.setTransform(scale*m[0][0]/ppu,-scale*m[1][0]/ppu,-scale*m[0][1]/ppu,scale*m[1][1]/ppu,
    ox+scale*(m[0][3]-m[0][0]*px/ppu+m[0][1]*py/ppu),oy-scale*(m[1][3]-m[1][0]*px/ppu+m[1][1]*py/ppu));
   // Native gameplay adds a separate outline from the part alpha. Keep it out
   // of diffuse PNGs, so the engine can choose its own outline width/color.
   const image=images[layer.part];
   if(options.outline!==false){ctx.shadowColor='#28282b';ctx.shadowBlur=0;for(const [x,y] of [[-1,0],[1,0],[0,-1],[0,1]]){ctx.shadowOffsetX=x;ctx.shadowOffsetY=y;ctx.drawImage(image,0,0,w,h);}ctx.shadowColor='transparent';ctx.shadowOffsetX=ctx.shadowOffsetY=0;}
   ctx.drawImage(image,0,0,w,h);ctx.restore();
  }
 }
export { draw, layers };
