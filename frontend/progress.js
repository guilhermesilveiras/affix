export const STATUSES = {pending:'Não iniciada', planned:'Planejada', in_progress:'Cursando', completed:'Concluída'};
export const emptyProgress = () => ({schema_version:2,name:'',statuses:{},activities:[]});
export const clearProgress = progress => ({...emptyProgress(),name:progress.name});

export function projectGroups(catalog) {
  const groups=new Map();
  for(const c of catalog.courses)if(c.choice_group){if(!groups.has(c.choice_group))groups.set(c.choice_group,[]);groups.get(c.choice_group).push(c);}
  return [...groups.values()];
}

function assertProjectChoices(statuses,catalog) {
  for(const group of projectGroups(catalog))if(group.filter(c=>statuses[c.id]&&statuses[c.id]!=='pending').length>1)throw Error(`Escolha apenas um projeto para o ${group[0].period}º período.`);
}

function migrateLegacy(value,catalog) {
  if(value?.schema_version!==1)return value;
  if(!['tecnologia','ciencia'].includes(value.track))throw Error('Trilha do backup antigo inválida.');
  const statuses={...value.statuses};
  for(const group of projectGroups(catalog)){
    const selected=group.filter(c=>statuses[c.id]&&statuses[c.id]!=='pending');
    if(selected.length>1){const chosen=selected.find(c=>c.track===value.track)||selected[0];for(const c of selected)if(c.id!==chosen.id)statuses[c.id]='pending';}
  }
  return {...value,schema_version:2,statuses};
}

export function updateCourseStatus(catalog,progress,id,status) {
  const course=catalog.courses.find(c=>c.id===id);
  if(!course||!Object.hasOwn(STATUSES,status))throw Error('Disciplina ou situação inválida.');
  const next={...progress,statuses:{...progress.statuses,[id]:status}};
  if(course.choice_group&&status!=='pending')for(const c of catalog.courses)if(c.choice_group===course.choice_group&&c.id!==id)next.statuses[c.id]='pending';
  assertProjectChoices(next.statuses,catalog);
  return next;
}

export function validateProgress(value, catalog) {
  if(!value||![1,2].includes(value.schema_version)||!value.statuses||typeof value.statuses!=='object'||Array.isArray(value.statuses))throw Error('Backup inválido ou incompatível.');
  const courses = new Set(catalog.courses.map(c=>c.id));
  for (const [id,status] of Object.entries(value.statuses)) if (!courses.has(id) || !Object.hasOwn(STATUSES,status)) throw Error('O backup contém disciplinas ou situações desconhecidas.');
  value=migrateLegacy(value,catalog);
  if (value.schema_version !== 2 || typeof value.name !== 'string' || value.name.length>80) throw Error('Backup inválido ou incompatível.');
  if (!value.statuses || typeof value.statuses !== 'object' || Array.isArray(value.statuses) || !Array.isArray(value.activities) || value.activities.length>1000) throw Error('Estrutura do backup inválida.');
  assertProjectChoices(value.statuses,catalog);
  const ids = new Set();
  const activities = value.activities.map(a=>{
    const r = catalog.activity_rules.find(r=>r.id===a.rule_id);
    if (!r || typeof a.id!=='string' || !a.id || a.id.length>80 || ids.has(a.id) || typeof a.title!=='string' || !a.title.trim() || a.title.length>200 || !Number.isFinite(a.quantity) || a.quantity<=0 || a.quantity>10000 || (r.mode!=='hours' && !Number.isInteger(a.quantity))) throw Error('O backup contém uma atividade inválida.');
    if (r.mode==='event' && !['local','national','international'].includes(a.variant)) throw Error('Classificação do evento inválida.');
    if (r.mode==='publication' && !['a','b','c','d','unindexed','chapter'].includes(a.variant)) throw Error('Classificação da publicação inválida.');
    if (typeof a.organizer!=='boolean' || typeof a.date!=='string' || a.date.length>10 || typeof a.evidence!=='string' || a.evidence.length>500) throw Error('Dados da atividade inválidos.');
    ids.add(a.id);
    return {id:a.id,rule_id:a.rule_id,title:a.title,quantity:a.quantity,variant:a.variant||'',organizer:a.organizer,date:a.date,evidence:a.evidence};
  });
  return {schema_version:2,name:value.name,statuses:{...value.statuses},activities};
}

export function rawActivityHours(a, rule) {
  let rate = rule.rate;
  if (rule.mode==='publication') rate = {a:120,b:90,c:60,d:30,unindexed:15,chapter:60}[a.variant];
  if (rule.mode==='event') rate = {local:15,national:30,international:45}[a.variant] + (a.organizer?20:0);
  return a.quantity*rate;
}

export function activeCourses(catalog, progress) {
  return [...catalog.courses].sort((a,b)=>(a.period??99)-(b.period??99));
}

export function evaluate(catalog, progress) {
  assertProjectChoices(progress.statuses,catalog);
  const active=activeCourses(catalog,progress);
  const done=active.filter(c=>progress.statuses[c.id]==='completed');
  const required=done.filter(c=>c.kind==='required').reduce((s,c)=>s+c.hours,0);
  const elective_raw=done.filter(c=>c.kind==='elective').reduce((s,c)=>s+c.hours,0);
  const used={};
  const activity_details=progress.activities.map(a=>{
    const r=catalog.activity_rules.find(r=>r.id===a.rule_id);
    const raw=rawActivityHours(a,r);
    const credited=Math.min(raw,Math.max(0,r.maximum-(used[r.cap_group]||0)));
    used[r.cap_group]=(used[r.cap_group]||0)+credited;
    return {id:a.id,raw,credited};
  });
  const activity_raw=activity_details.reduce((s,a)=>s+a.raw,0);
  const activity_capped=activity_details.reduce((s,a)=>s+a.credited,0);
  const elective=Math.min(elective_raw,catalog.elective_hours);
  const activity=Math.min(activity_capped,catalog.activity_hours);
  const total=required+elective+activity;
  return {required,elective,elective_raw,activity,activity_raw,activity_capped,total,remaining:catalog.total_hours-total,percent:Math.round(total/catalog.total_hours*1000)/10,completed:done.length,in_progress:active.filter(c=>progress.statuses[c.id]==='in_progress').length,activity_details,graduated:required===2370&&elective===480&&activity===240};
}
