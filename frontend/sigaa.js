import {validateProgress, updateCourseStatus} from './progress.js';

const completed = new Set(['APR','APRN','DISP','TRANS','INCORP','CUMP']);
const ongoing = new Set(['MATR','REC']);
const unsuccessful = new Set(['REP','REPF','REPMF','REPN','REPNF','TRANC','CANC']);
const rank = {pending:0,planned:1,in_progress:2,completed:3};
export const normalizeText = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const codeKey = code => String(code || '').replace(/^0+/,'');
const nameKey = name => normalizeText(name).split(' ').filter(word=>!['DE','DA','DO','DAS','DOS','PARA','A','AS','O','OS','E','AO'].includes(word)).join(' ');
// Spelling differences between the supplied matrix and current SIGAA labels.
const aliases = {
 'core-02':['Fundamentos Matemáticos para Sistema de Informação I'],
 'core-20':['Segurança e Auditoria de Sistemas de Informação'],
 'core-24':['Cálculo NI'],
};

export function transcriptStatus(code) {
 if(completed.has(code))return 'completed';
 if(ongoing.has(code))return 'in_progress';
 if(unsuccessful.has(code))return 'pending';
 return null;
}

function pageItems(page) {
 return page.items.filter(item=>typeof item.str==='string'&&item.str.trim()).map(item=>({
  str:item.str.trim(),x:item.transform?.[4]??item.x,y:item.transform?.[5]??item.y,
  width:item.width||0,height:Math.abs(item.height||item.transform?.[3]||7),
 })).filter(item=>Number.isFinite(item.x)&&Number.isFinite(item.y));
}

function textLines(items) {
 const lines=[];
 for(const item of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){
  let line=lines.find(line=>Math.abs(line.y-item.y)<1.8);
  if(!line){line={y:item.y,items:[]};lines.push(line);}
  line.items.push(item);
 }
 return lines.map(line=>({...line,items:line.items.sort((a,b)=>a.x-b.x),text:line.items.sort((a,b)=>a.x-b.x).map(item=>item.str).join(' ')}));
}

function readTotals(lines) {
 const heading=lines.find(line=>normalizeText(line.text).includes('CARGA HORARIA INTEGRALIZADA PENDENTE'));
 if(!heading)return null;
 const line=lines.find(line=>line.y<heading.y&&/^INTEGRALIZADO\b/.test(normalizeText(line.text)));
 if(!line)return null;
 const values=line.items.filter(item=>/^\d[\d.,]*\s*h?$/i.test(item.str)).map(item=>Number(item.str.replace(/\s*h$/i,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')));
 return values.length===4?Object.fromEntries(['required','elective','activity','total'].map((key,i)=>[key,values[i]])):null;
}

/** Read only course rows inside Cursados/Cursando, never pending lists or legends. */
export function parseTranscript(pages) {
 const documentText=normalizeText(pages.flatMap(page=>page.items.map(item=>item.str||'')).join(' '));
 if(!documentText)throw Error('O PDF não contém texto selecionável. Baixe o histórico original no SIGAA; PDFs digitalizados como imagem não são aceitos.');
 if(!documentText.includes('SIGAA')||!documentText.includes('UFRPE')||!documentText.includes('HISTORICO ESCOLAR'))throw Error('Selecione um histórico escolar em PDF emitido pelo SIGAA da UFRPE.');
 const records=[],warnings=[];
 let totals=null;
 pages.forEach((page,pageIndex)=>{
  const items=pageItems(page),lines=textLines(items),width=page.width;
  totals=readTotals(lines)||totals;
  const header=lines.find(line=>normalizeText(line.text).includes('COMPONENTES CURRICULARES CURSADOS CURSANDO'));
  if(!header)return;
  const end=lines.find(line=>line.y<header.y&&/^(LEGENDA|COMPONENTES CURRICULARES OBRIGATORIOS PENDENTES|CARGA HORARIA)/.test(normalizeText(line.text)));
  const anchors=items.filter(item=>/^\d{4}\.\d$/.test(item.str)&&item.x<width*.25&&item.y<header.y&&(!end||item.y>end.y)).sort((a,b)=>b.y-a.y);
  const hoursHeading=items.find(item=>item.str==='CH'&&item.y<header.y&&item.y>(anchors[0]?.y??0));
  anchors.forEach((anchor,i)=>{
   const row=items.filter(item=>Math.abs(item.y-anchor.y)<1.8);
   const code=row.find(item=>/^\d{4,6}$/.test(item.str)&&item.x>anchor.x+anchor.width&&item.x<width*.25);
   const result=row.find(item=>item.x>width*.82&&/^[A-Z]{2,8}$/.test(item.str));
   if(!code||!result){warnings.push(`Não foi possível ler uma linha na página ${pageIndex+1} (${anchor.str}).`);return;}
   const upper=i?(anchors[i-1].y+anchor.y)/2:header.y-8;
   const lower=i+1<anchors.length?(anchor.y+anchors[i+1].y)/2:(end?.y??anchor.y-20);
   const title=items.filter(item=>item.y<upper&&item.y>lower&&item.x>code.x+code.width&&item.x<width*.63&&item.height>=anchor.height*.94&&!/^(?:Dr\.?|Dra\.?|Prof\.?|Profa\.?)\s/i.test(item.str));
   const name=title.sort((a,b)=>b.y-a.y||a.x-b.x).map(item=>item.str).join(' ').replace(/(\p{L})-\s+(?=\p{L})/gu,'$1');
   const hours=row.filter(item=>/^\d+$/.test(item.str)&&item.x>width*.6&&item.x<width*.75).sort((a,b)=>hoursHeading?Math.abs(a.x-hoursHeading.x)-Math.abs(b.x-hoursHeading.x):a.x-b.x)[0];
   if(!name||!hours){warnings.push(`Nome ou carga horária ilegível: componente ${code.str}, página ${pageIndex+1}.`);return;}
   records.push({code:code.str,name,hours:Number(hours.str),period:anchor.str,result:result.str,status:transcriptStatus(result.str),page:pageIndex+1});
  });
 });
 if(!records.length)throw Error('Não foi possível ler a tabela de disciplinas. Use o PDF original baixado do SIGAA, com texto selecionável.');
 return {records,totals,warnings};
}

export function matchTranscript(transcript,catalog) {
 return {...transcript,rows:transcript.records.map((record,index)=>{
  const byCode=catalog.courses.filter(course=>course.code&&codeKey(course.code)===codeKey(record.code));
  const byName=catalog.courses.filter(course=>[course.name,...(aliases[course.id]||[])].some(name=>nameKey(name)===nameKey(record.name)));
  let matches=byCode.length?byCode:byName;
  let reason='';
  if(byCode.length&&byName.length&&!byCode.some(course=>byName.includes(course))){matches=[];reason='Código e nome indicam disciplinas diferentes. Selecione a correspondência.';}
  else if(matches.length!==1)reason=matches.length?'Nome ambíguo. Selecione a correspondência.':'Componente não reconhecido. Selecione uma disciplina ou deixe sem importar.';
  const course=matches.length===1?matches[0]:null;
  if(course&&course.hours!==record.hours)reason=`Carga horária diferente: ${record.hours} h no histórico e ${course.hours} h no Affix. Confira antes de selecionar.`;
  if(record.status===null)reason=`Situação ${record.result} não reconhecida. Esta linha não será importada.`;
  const suggestions=catalog.courses.filter(course=>course.equivalents.some(name=>nameKey(name)===nameKey(record.name))).map(course=>course.id);
  return {...record,index,courseId:course?.id||'',selected:Boolean(course&&!reason&&['completed','in_progress'].includes(record.status)),reason,suggestions};
 })};
}

/** Merge selected records, keeping completions and manually recorded activities. */
export function mergeTranscript(catalog,current,rows) {
 let next={...current,statuses:{...current.statuses},activities:[...current.activities]};
 const targets=new Map(),replaced=[];
 for(const row of rows.filter(row=>row.selected)){
  if(!row.courseId||!['completed','in_progress'].includes(row.status))throw Error('Selecione uma disciplina válida para cada linha marcada.');
  const course=catalog.courses.find(course=>course.id===row.courseId);
  if(!course)throw Error('Disciplina desconhecida.');
  if(course.hours!==row.hours)throw Error(`A carga horária de ${course.name} difere do histórico. Faça o aproveitamento manualmente.`);
  const previous=targets.get(course.id);
  if(!previous||rank[row.status]>rank[previous.status])targets.set(course.id,{course,status:row.status});
 }
 const choices=new Map();
 for(const {course,status} of targets.values()){
  if(course.choice_group){
   if(choices.has(course.choice_group))throw Error(`Há dois projetos selecionados para o ${course.period}º período. Desmarque uma das alternativas.`);
   choices.set(course.choice_group,course.id);
   for(const alternative of catalog.courses.filter(other=>other.choice_group===course.choice_group&&other.id!==course.id)){
    if(current.statuses[alternative.id]&&current.statuses[alternative.id]!=='pending')replaced.push(alternative.name);
   }
  }
  const best=rank[current.statuses[course.id]||'pending']>rank[status]?current.statuses[course.id]:status;
  next=updateCourseStatus(catalog,next,course.id,best);
 }
 return {progress:validateProgress(next,catalog),replaced,selected:targets.size};
}
