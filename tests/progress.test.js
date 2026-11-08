import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyProgress,clearProgress,evaluate,validateProgress,updateCourseStatus,activeCourses} from '../frontend/progress.js';

const catalog=JSON.parse(readFileSync(new URL('../frontend/data/catalog.json',import.meta.url),'utf8'));
const activity=(rule_id,quantity,extra={})=>({id:crypto.randomUUID(),rule_id,title:'Experiência',quantity,variant:'',organizer:false,date:'',evidence:'',...extra});

test('reset clears every course, project choice and activity while preserving the name',()=>{
 const original={...emptyProgress(),name:'Ana',statuses:{'core-01':'completed','opt-4106':'planned','ciencia-1':'in_progress','tecnologia-2':'completed'},activities:[activity('activity-3',2)]};
 const cleared=validateProgress(clearProgress(original),catalog);
 assert.deepEqual(cleared,{schema_version:2,name:'Ana',statuses:{},activities:[]});
 const result=evaluate(catalog,cleared);
 assert.equal(result.total,0);assert.equal(result.percent,0);assert.equal(result.completed,0);assert.equal(result.in_progress,0);
 assert.equal(original.statuses['tecnologia-2'],'completed');
 assert.equal(original.activities.length,1);
});

test('curriculum accounts for all 3,090 hours for every project combination',()=>{
 for(const first of ['tecnologia','ciencia'])for(const second of ['tecnologia','ciencia']){
  const p=emptyProgress();
  for(const c of catalog.courses)if(!c.choice_group||c.id===(c.period===7?first+'-1':second+'-2'))p.statuses[c.id]='completed';
  p.activities=[activity('activity-3',2),activity('activity-9',2)];
  const s=evaluate(catalog,p);
  assert.equal(s.required,2370);assert.equal(s.elective,480);assert.equal(s.activity,240);assert.equal(s.total,3090);assert.equal(s.graduated,true);
 }
});
test('extra electives and activities do not fill missing required courses',()=>{
 const p=emptyProgress();for(const c of catalog.courses.filter(c=>c.kind==='elective'))p.statuses[c.id]='completed';
 p.activities=[activity('activity-3',100),activity('activity-9',100),activity('activity-15',100)];
 const s=evaluate(catalog,p);assert.equal(s.total,720);assert.equal(s.required,0);assert.equal(s.graduated,false);
});
test('both project options are visible and selecting one resets only its alternative',()=>{
 let p=emptyProgress();
 assert.equal(activeCourses(catalog,p).filter(c=>c.choice_group).length,4);
 p=updateCourseStatus(catalog,p,'tecnologia-1','completed');
 p=updateCourseStatus(catalog,p,'ciencia-2','completed');
 assert.equal(evaluate(catalog,p).required,120);
 p=updateCourseStatus(catalog,p,'ciencia-1','in_progress');
 assert.equal(p.statuses['tecnologia-1'],'pending');
 assert.equal(p.statuses['ciencia-2'],'completed');
 assert.equal(evaluate(catalog,p).required,60);
 assert.equal(evaluate(catalog,p).in_progress,1);
 p=updateCourseStatus(catalog,p,'ciencia-1','completed');
 assert.equal(evaluate(catalog,p).required,120);
 assert.equal(evaluate(catalog,p).completed,2);
});
test('new backups reject conflicting projects, including planned and in-progress choices',()=>{
 for(const period of [1,2])for(const a of ['planned','in_progress','completed'])for(const b of ['planned','in_progress','completed']){
  const p={...emptyProgress(),statuses:{['tecnologia-'+period]:a,['ciencia-'+period]:b}};
  assert.throws(()=>validateProgress(p,catalog),/apenas um projeto/);
  assert.throws(()=>evaluate(catalog,p),/apenas um projeto/);
 }
});
test('legacy backups migrate per-period choices and resolve old hidden conflicts',()=>{
 const legacy={schema_version:1,name:'Ana',track:'ciencia',statuses:{'tecnologia-1':'completed','ciencia-1':'in_progress','tecnologia-2':'completed','core-01':'completed'},activities:[]};
 const p=validateProgress(legacy,catalog);
 assert.equal(p.schema_version,2);
 assert.equal(p.statuses['tecnologia-1'],'pending');
 assert.equal(p.statuses['ciencia-1'],'in_progress');
 assert.equal(p.statuses['tecnologia-2'],'completed');
 assert.equal(evaluate(catalog,p).required,120);
 assert.equal(legacy.statuses['tecnologia-1'],'completed');
 assert.ok(!Object.hasOwn(p,'track'));
 assert.throws(()=>validateProgress({...legacy,statuses:{'ciencia-1':'completed','tecnologia-1':'invalid'}},catalog));
});
test('activities share caps across records and merged spreadsheet groups',()=>{
 const p=emptyProgress();p.activities=[activity('activity-3',1),activity('activity-3',2),activity('activity-5',10),activity('activity-6',2)];
 const s=evaluate(catalog,p);assert.deepEqual(s.activity_details.map(a=>a.credited),[60,60,30,15]);assert.equal(s.activity,165);
});
test('event organizer and publication scores respect caps',()=>{
 const p=emptyProgress();p.activities=[activity('activity-17',2,{variant:'international',organizer:true}),activity('activity-10',1,{variant:'a'})];
 const s=evaluate(catalog,p);assert.deepEqual(s.activity_details.map(a=>a.raw),[130,120]);assert.deepEqual(s.activity_details.map(a=>a.credited),[90,90]);
});
test('in progress and planned courses earn no completed hours',()=>{
 const p=emptyProgress();p.statuses={'core-01':'in_progress','core-02':'planned'};const s=evaluate(catalog,p);assert.equal(s.total,0);assert.equal(s.in_progress,1);
});
test('backup round-trip preserves profile, project choices and all records',()=>{
 const p=emptyProgress();p.name='João';p.statuses={'core-01':'completed','ciencia-1':'completed','tecnologia-2':'planned'};p.activities=[activity('activity-16',12.5)];
 assert.deepEqual(validateProgress(JSON.parse(JSON.stringify(p)),catalog),p);
});
test('import rejects unknown IDs, invalid scores and duplicate activities',()=>{
 for(const statuses of [{'unknown':'completed'},{'core-01':'other'},{'toString':'completed'}])assert.throws(()=>validateProgress({...emptyProgress(),statuses},catalog));
 for(const quantity of [0,-1,Infinity,NaN,10001])assert.throws(()=>validateProgress({...emptyProgress(),activities:[activity('activity-16',quantity)]},catalog));
 const a=activity('activity-3',1);assert.throws(()=>validateProgress({...emptyProgress(),activities:[a,a]},catalog));
 assert.throws(()=>validateProgress({...emptyProgress(),activities:[activity('activity-3',1.5)]},catalog));
 assert.throws(()=>validateProgress({...emptyProgress(),activities:[activity('activity-17',1,{variant:'invalid'})]},catalog));
});
