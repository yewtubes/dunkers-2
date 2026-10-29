#!/usr/bin/env python3
"""Reproduce method/table bindings from the hash-pinned IL2CPP build."""
from pathlib import Path
import json,re,struct
root=Path(__file__).resolve().parents[1]
w=(root/'public/Build/78187090b012beed2d50f0f0f2623bf2.wasm').read_bytes()
def leb(b,i):
 n=s=0
 while True:
  v=b[i];i+=1;n|=(v&127)<<s;s+=7
  if not v&128:return n,i
sections=[];i=8
while i<len(w):
 k=w[i];size,j=leb(w,i+1);sections.append((k,w[j:j+size]));i=j+size
mem=bytearray(32*1024*1024);table={}
for k,b in sections:
 if k not in [9,11]:continue
 count,i=leb(b,0)
 for _ in range(count):
  flags,i=leb(b,i)
  if flags!=0:raise ValueError(('flags',k,flags))
  assert b[i]==65;i+=1;off,i=leb(b,i);assert b[i]==11;i+=1
  n,i=leb(b,i)
  if k==11:mem[off:off+n]=b[i:i+n];i+=n
  else:
   for j in range(n):fn,i=leb(b,i);table[off+j]=fn
u=lambda off:struct.unpack_from('<I',mem,off)[0]
m=(root/'source-recovery/global-metadata.dat').read_bytes();h=struct.unpack_from('<64I',m)
def txt(index):
 start=h[6]+index;return m[start:m.index(0,start)].decode()
images=[]
for i in range(h[42],h[42]+h[43],40):
 r=struct.unpack_from('<10i',m,i);images.append({'name':txt(r[0]),'typeStart':r[2],'typeCount':r[3]})
modules={}
for image in images:
 name=image['name'];s=mem.find(name.encode()+b'\0')
 if s<0:continue
 start=0
 while True:
  a=mem.find(struct.pack('<I',s),start)
  if a<0:break
  start=a+1
  if a%4:continue
  count=u(a+4);ptr=u(a+8)
  if 1<count<20000 and 4096<ptr<len(mem)-count*4 and all(u(ptr+j*4) in table or u(ptr+j*4)==0 for j in range(min(count,20))):modules[name]=ptr;break
wanted={2107,2429,4928,5491,5498,5511,12348,12351,12352,12368,12369,12381,12382,27296,27298,27304,27318,27320,27322,27323,27342,27343,27346,27348,27360,27364,27406,27415,27417,27590,27598,27607,28272,28453,28468,28472,28648,28712,28713,28719,28720,28732,28738,28740,28746,28748,36866,36867,36889,36891,36892,36893,36894}
wanted.update({28333,28350,30920,28680,28681,28354,28284,12752,28454,13143,12814,13153})
wanted.update({28678, 12809, 12811, 28324, 28458, 30254, 30255, 28466, 28348, 28353, 28355, 28618, 28620, 28622, 28624, 28625, 13138, 28626, 13150, 28255, 28256, 36961, 36964, 12782, 12783, 28273, 30836, 31478, 12791, 31480})
T=json.loads((root/'source-recovery/metadata-types.json').read_text());out={}
for tid,t in enumerate(T):
 methods=[method for method in t['methods'] if method['index'] in wanted]
 if not methods:continue
 image=next(im for im in images if im['typeStart']<=tid<im['typeStart']+im['typeCount'])
 ptr=modules[image['name']]
 for method in methods:
  idx=method['index'];row=struct.unpack_from('<7i4H',m,h[12]+idx*36);rid=row[6]&0xffffff;slot=u(ptr+(rid-1)*4)
  pars=[txt(struct.unpack_from('<3i',m,h[22]+(row[4]+n)*12)[0]) for n in range(row[10])]
  out[str(idx)]={'type':t['namespace']+'.'+t['name'],'name':method['name'],'index':idx,'params':pars,'slot':slot,'function':table.get(slot),'image':image['name']}
assert {int(k) for k in out}==wanted
(root/'public/native-runtime-map.json').write_text(json.dumps(out,indent=2)+'\n')
print('Mapped',len(out),'retained methods')
