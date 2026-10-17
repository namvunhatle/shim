import { OutputFile } from './schema';
// Uncompressed ZIP (UTF-8 names), no runtime dependency.
export function zip(files:OutputFile[]):Uint8Array{
 const encoder=new TextEncoder(),parts:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 const crc=(data:Uint8Array)=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const file of files){const name=encoder.encode(file.path),data=file.encoding==='base64'?Uint8Array.from(atob(file.content),c=>c.charCodeAt(0)):encoder.encode(file.content),sum=crc(data);
  const h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);h.set(name,30);
  const c=new Uint8Array(46+name.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,sum,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);c.set(name,46);central.push(c);parts.push(h,data);offset+=h.length+data.length;
 }
 const size=central.reduce((s,p)=>s+p.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+22);let pos=0;for(const p of [...parts,...central,end]){result.set(p,pos);pos+=p.length;}return result;
}
