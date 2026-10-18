import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,writeFile,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
test('stdio handshake, tool discovery, source lookup, and filesystem boundary',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'shim-mcp-'));
 try{
  await cp('examples/a-simple',join(temp,'handoff'),{recursive:true});
  await writeFile(join(temp,'secret.txt'),'PRIVATE');
  await symlink(join(temp,'secret.txt'),join(temp,'handoff','escape.txt'));
  const child=spawn(process.execPath,[resolve('mcp/server.mjs'),join(temp,'handoff')]);
  let output='',errors='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>errors+=d);
  const source=JSON.parse(await readFile('examples/a-simple/android-ui-schema.json','utf8'));
  const requests=[['initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}],['tools/list',{}],['tools/call',{name:'shim_summary'}],['tools/call',{name:'shim_find_layers',arguments:{query:source.root.id}}],['tools/call',{name:'shim_read_file',arguments:{path:'../secret.txt'}}],['tools/call',{name:'shim_read_file',arguments:{path:'escape.txt'}}],['tools/call',{name:'shim_read_file',arguments:{path:'readiness.json'}}]];
  requests.forEach(([method,params],i)=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:i,method,params})+'\n'));child.stdin.end();
  const code=await new Promise((yes,no)=>{child.on('error',no);child.on('close',yes);});
  assert.equal(code,0,errors);const replies=output.trim().split('\n').map(JSON.parse);
  assert.equal(replies.length,requests.length);assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[1].result.tools.length,3);
  assert.ok(JSON.parse(replies[2].result.content[0].text).frameworks.compose);
  assert.ok(JSON.parse(replies[3].result.content[0].text).matches.length);
  assert.equal(replies[4].result.isError,true);assert.equal(replies[5].result.isError,true);assert.ok(!replies[6].result.isError);
 }finally{await rm(temp,{recursive:true,force:true});}
});
