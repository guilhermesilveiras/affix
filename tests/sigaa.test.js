import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTranscript,matchTranscript,mergeTranscript,transcriptStatus} from '../frontend/sigaa.js';
import {emptyProgress,evaluate} from '../frontend/progress.js';

const catalog=JSON.parse(readFileSync(new URL('../frontend/data/catalog.json',import.meta.url),'utf8'));
// Fabricated PDF text items. No student's transcript or personal data is a fixture.
const item=(str,x,y,height=7)=>({str,transform:[height,0,0,height,x,y],height,width:str.length*3.5});
const page=(rows)=>({width:595,items:[item('SIGAA UFRPE Histórico Escolar',30,800),item('Componentes Curriculares Cursados/Cursando',150,700),item('CH',402,675),...rows.flatMap((r,i)=>{
 const y=650-i*24;
 return [item(r.period||'2024.2',42,y),item(r.code,96,y),item(r.name,129,y+3.5),item('Dr. DOCENTE FICTÍCIO (60h)',129,y-3.5,6),item(String(r.hours||60),382,y),item(String(r.hours||60),402,y),item(r.result||'APR',538,y)];
}),item('Legenda',250,100),item('APR Aprovado por média',35,85)]});
const record=(name,result='APR',extra={})=>({code:'99999',name,hours:60,period:'2024.1',result,status:transcriptStatus(result),...extra});
const match=records=>matchTranscript({records,warnings:[],totals:null},catalog).rows;

test('PDF table reading excludes teachers, legends, and pending course lists',()=>{
 const first=page([{code:'14709',name:'PRINCÍPIOS DE PROGRAMAÇÃO'},{code:'14354',name:'PROJETO DE SOLUÇÕES COMPLEXAS I',result:'MATR'}]);
 const pending={width:595,items:[item('Componentes Curriculares Obrigatórios Pendentes',30,700),item('14356',96,650),item('PROJETO DE SOLUÇÕES COMPLEXAS II',129,650),item('MATR',538,650)]};
 const parsed=parseTranscript([first,pending]);
 assert.equal(parsed.records.length,2);
 assert.deepEqual(parsed.records.map(r=>[r.name,r.status,r.hours]),[['PRINCÍPIOS DE PROGRAMAÇÃO','completed',60],['PROJETO DE SOLUÇÕES COMPLEXAS I','in_progress',60]]);
 assert.deepEqual(parsed.warnings,[]);
});

test('wrapped titles and multipage tables remain separate course rows',()=>{
 const p=page([{code:'06280',name:'MODELAGEM MATEMÁTICO-COMPUTACIONAL APLICADA À',result:'MATR'}]);
 p.items.find(i=>i.str.startsWith('MODELAGEM')).transform[5]=657;
 p.items.push(item('EPIDEMIOLOGIA',129,650));
 const parsed=parseTranscript([p,page([{code:'04208',name:'EDUCAÇÃO FÍSICA A',hours:30,result:'TRANC'}])]);
 assert.equal(parsed.records[0].name,'MODELAGEM MATEMÁTICO-COMPUTACIONAL APLICADA À EPIDEMIOLOGIA');
 assert.equal(parsed.records[1].page,2);
 assert.equal(parsed.records[1].status,'pending');
});

test('unreadable row is reported rather than silently counted',()=>{
 const p=page([{code:'14709',name:'PRINCÍPIOS DE PROGRAMAÇÃO'},{code:'14708',name:'FUNDAMENTOS MATEMÁTICOS I'}]);
 p.items=p.items.filter(i=>i.str!=='14708');
 const parsed=parseTranscript([p]);
 assert.equal(parsed.records.length,1);
 assert.equal(parsed.warnings.length,1);
});

test('SIGAA totals are read independently of pending disciplines',()=>{
 const totals={width:595,items:[item('Carga Horária Integralizada/Pendente',30,700),item('Integralizado',30,650),item('120 h',180,650),item('60 h',290,650),item('0 h',400,650),item('180 h',520,650)]};
 assert.deepEqual(parseTranscript([page([{code:'14709',name:'PRINCÍPIOS DE PROGRAMAÇÃO'}]),totals]).totals,{required:120,elective:60,activity:0,total:180});
 assert.throws(()=>parseTranscript([{width:595,items:[item('Outro documento',30,700)]}]),/SIGAA/);
 assert.throws(()=>parseTranscript([{width:595,items:[item('SIGAA UFRPE Histórico Escolar',30,700)]}]),/tabela de disciplinas/);
});

test('official pass, enrollment and unsuccessful result codes have distinct meanings',()=>{
 for(const code of ['APR','APRN','DISP','TRANS','INCORP','CUMP'])assert.equal(transcriptStatus(code),'completed');
 for(const code of ['MATR','REC'])assert.equal(transcriptStatus(code),'in_progress');
 for(const code of ['REP','REPF','REPMF','REPN','REPNF','TRANC','CANC'])assert.equal(transcriptStatus(code),'pending');
 assert.equal(transcriptStatus('UNKNOWN'),null);
});

test('matches zero-padded elective codes, accents and current matrix spelling variants',()=>{
 const rows=match([
  record('TÓPICOS EM OTIMIZAÇÃO','APR',{code:'06277'}),
  record('Projeto Interdisciplinar PARA Sistemas de Informação IV'),
  record('Fundamentos Matemáticos para SISTEMA de Informação I'),
  record('Segurança e Auditoria de Sistemas de Informação'),
  record('CÁLCULO NI'),
  record('Estatística Aplicada A Análise de Dados','MATR'),
 ]);
 assert.deepEqual(rows.map(r=>r.courseId),['opt-6277','core-15','core-02','core-20','core-24','core-28']);
 assert.ok(rows.every(r=>r.selected));
});

test('does not guess unknown names, ambiguous equivalencies or differing hours',()=>{
 const rows=match([
  record('INTRODUÇÃO À PROGRAMAÇÃO'),
  record('DISCIPLINA DESCONHECIDA'),
  record('Princípios de Programação','APR',{hours:30}),
  record('Engenharia para Sistemas de Informação III','UNKNOWN'),
  record('Educação Física A','TRANC',{hours:30}),
 ]);
 assert.ok(rows.every(r=>!r.selected));
 assert.equal(rows[0].courseId,'');
 assert.ok(rows[0].suggestions.length>1);
 assert.ok(rows[2].reason.includes('Carga horária diferente'));
 assert.ok(rows[3].reason.includes('não reconhecida'));
 assert.equal(match([record('Engenharia para Sistemas de Informação II')])[0].courseId,'core-21');
});

test('code and name pointing at different catalog courses require review',()=>{
 const row=match([record('Processamento de Imagens','APR',{code:'06277'})])[0];
 assert.equal(row.selected,false);
 assert.equal(row.courseId,'');
 assert.match(row.reason,/diferentes/);
});

test('merge is idempotent, deduplicates attempts, and preserves name, activities and earlier completions',()=>{
 const current={...emptyProgress(),name:'Perfil fictício',statuses:{'core-03':'completed','opt-14051':'planned'},activities:[{id:'test-activity',title:'Atividade fictícia',rule_id:'activity-16',quantity:10,variant:'',organizer:false,date:'',evidence:''}]};
 const original=structuredClone(current);
 const rows=match([record('Princípios de Programação','MATR'),record('Modelagem de Dados','APR'),record('Modelagem de Dados','MATR'),record('Modelagem de Dados','REP'),record('Educação Física A','TRANC',{hours:30})]);
 const {progress,selected}=mergeTranscript(catalog,current,rows);
 assert.equal(selected,2);
 assert.deepEqual(current,original);
 assert.equal(progress.statuses['core-03'],'completed');
 assert.equal(progress.statuses['core-26'],'completed');
 assert.equal(progress.statuses['opt-14051'],'planned');
 assert.equal(progress.statuses['core-32'],undefined);
 assert.equal(progress.name,current.name);
 assert.deepEqual(progress.activities,current.activities);
 assert.equal(evaluate(catalog,progress).required,120);
 assert.deepEqual(mergeTranscript(catalog,progress,rows).progress,progress);
 assert.deepEqual(Object.keys(progress).sort(),['activities','name','schema_version','statuses']);
});

test('project conflicts require review; a new choice explicitly reports the old one',()=>{
 const current={...emptyProgress(),statuses:{'tecnologia-1':'planned','tecnologia-2':'completed'}};
 const rows=match([record('Projeto de Soluções Complexas I','MATR'),record('Projeto para Sociedade I')]);
 assert.throws(()=>mergeTranscript(catalog,current,rows),/dois projetos/);
 rows[1].selected=false;
 const imported=mergeTranscript(catalog,current,rows);
 assert.deepEqual(imported.replaced,['Projeto para Sociedade I']);
 assert.equal(imported.progress.statuses['tecnologia-1'],'pending');
 assert.equal(imported.progress.statuses['ciencia-1'],'in_progress');
 assert.equal(imported.progress.statuses['tecnologia-2'],'completed');
 assert.equal(current.statuses['tecnologia-1'],'planned');
});

test('manual mapping validates hours and can skip unmatched records',()=>{
 const rows=match([record('DISCIPLINA DESCONHECIDA')]);
 assert.equal(mergeTranscript(catalog,emptyProgress(),rows).selected,0);
 rows[0]={...rows[0],courseId:'core-03',selected:true};
 assert.equal(evaluate(catalog,mergeTranscript(catalog,emptyProgress(),rows).progress).total,60);
 rows[0].hours=30;
 assert.throws(()=>mergeTranscript(catalog,emptyProgress(),rows),/carga horária/);
});
