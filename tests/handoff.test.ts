import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeSchema} from '../src/pipeline';
import {handoffFiles} from '../src/handoff';
test('export contract includes traceable tasks, complete inventory and honest verification',()=>{
 const result=analyzeSchema(JSON.parse(readFileSync('examples/a-simple/android-ui-schema.json','utf8')));
 const files=handoffFiles(result),get=(p:string)=>files.find(f=>f.path===p)!.content;
 assert.equal(new Set(files.map(f=>f.path)).size,files.length);
 assert.deepEqual(JSON.parse(get('handoff-manifest.json')).files.sort(),files.map(f=>f.path).sort());
 assert.equal(JSON.parse(get('readiness.json')).verification.status,'Not build verified');
 const tasks=JSON.parse(get('handoff-tasks.json'));
 assert.deepEqual(tasks.compose.map((t:{id:string})=>t.id),result.readiness.frameworks.compose.groups.map(g=>g.id));
 assert.match(get('HANDOFF.md'),/not agent instructions/);
});
