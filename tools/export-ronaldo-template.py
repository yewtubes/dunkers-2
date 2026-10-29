#!/usr/bin/env python3
"""Export the native masks used by the Ronaldo art pack; requires UnityPy."""
import argparse, hashlib, json, struct
from pathlib import Path
import UnityPy
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--data',type=Path,default=root/'public/Build/193748c60075be5c59dd80c8ec174c65.data');args=p.parse_args()
blob=args.data.read_bytes()
if hashlib.sha256(blob).hexdigest()!='c1423afdcfcb7a11b0106723daf4fe1fd032ca93610eaa54ed8aea6ad3152f99':raise SystemExit('Requires the pinned Dunkers v4.5 data file.')
pos=len(b'UnityWebData1.0\0');end=struct.unpack_from('<I',blob,pos)[0];pos+=4;bundle=None
while pos<end:
 start,size,n=struct.unpack_from('<III',blob,pos);pos+=12;name=blob[pos:pos+n].decode();pos+=n
 if name.endswith('data.unity3d'):bundle=blob[start:start+size]
if bundle is None:raise SystemExit('Unity bundle not found')
E=UnityPy.load(bundle);out=root/'public/custom/ronaldo-2007';(out/'base').mkdir(parents=True,exist_ok=True)
requests={('sharedassets1.assets',283):'torso',('resources.assets',894):'pelvis',('resources.assets',961):'shorts',('sharedassets0.assets',698):'arm',('resources.assets',1185):'leg',('resources.assets',902):'hand-back',('resources.assets',908):'hand-front',('resources.assets',1869):'boot',('resources.assets',1062):'hand-closed-front',('resources.assets',1247):'hand-closed-back'}
meta={}
for obj in E.objects:
 name=requests.get((obj.assets_file.name,obj.path_id))
 if not name:continue
 s=obj.read();s.image.save(out/'base'/(name+'.png'))
 meta[name]={'sourceFile':obj.assets_file.name,'sourcePathId':obj.path_id,'sourceSprite':s.m_Name,'file':'base/'+name+'.png','size':[s.m_Rect.width,s.m_Rect.height],'pivot':[s.m_Pivot.x,s.m_Pivot.y],'pixelsPerUnit':s.m_PixelsToUnits}
if len(meta)!=len(requests):raise SystemExit('One or more pinned sprites were not found')
(out/'native-template.json').write_text(json.dumps(meta,indent=2)+'\n');print('Exported',len(meta),'native template masks')
