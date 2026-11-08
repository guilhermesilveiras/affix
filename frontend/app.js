import {STATUSES, emptyProgress, clearProgress, validateProgress, evaluate, activeCourses, rawActivityHours, updateCourseStatus} from './progress.js';

const $ = s=>document.querySelector(s);
const icons={
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 grid:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18M3 15h18M15 3v18"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 settings:'<path d="m9 3-1 3-3 1-2 3 2 3v3l3 2 3-1 3 2 3-2v-3l3-3-1-3-3-1-1-3Z"/><circle cx="11" cy="11" r="3"/>',
 moon:'<path d="M20 13A8.5 8.5 0 0 1 11 4a8.5 8.5 0 1 0 9 9Z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 university:'<path d="m3 8 9-5 9 5H3Zm2 1v10m5-10v10m4-10v10m5-10v10M3 21h18"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 circle:'<circle cx="12" cy="12" r="8"/>',
 book:'<path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Z"/>',
 code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
 leaf:'<path d="M20 3c-1 5 3 14-6 16S1 10 10 7c4-1 7-1 10-4ZM4 21l10-10"/>',
 chart:'<path d="M4 3v17h17M8 16v-5m5 5V7m5 9V4"/>',
 sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 3v4m-2-2h4"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
 edit:'<path d="m4 15 12-12 5 5L9 20l-6 1 1-6Zm9-9 5 5"/>',
 file:'<path d="M14 3H5v18h14V8l-5-5Zm0 0v6h5M8 13h8m-8 4h6"/>',
 print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6v-7Z"/>',
 external:'<path d="M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7"/>',
};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(n);
const categoryIcon={basica:'code',tecnologica:'layers',complementar:'chart',humanistica:'leaf',suplementar:'sparkles',optativa:'book'};
const labels={overview:'Visão geral',curriculum:'Matriz curricular',electives:'Disciplinas optativas',activities:'Horas complementares',settings:'Meus dados e backup'};
const STORE='affix-progress-v1';
let catalog,progress,groupBy='category',query='',categoryFilter='',statusFilter='',electiveQuery='',electiveStatus='',toastTimer,storageAvailable=true;
let courseOrigin='curriculum';
const expandedGroups=new Map(),filteredExpandedGroups=new Map();
let electiveCatalogExpanded=false;
const hasCourseFilters=()=>Boolean(query||categoryFilter||statusFilter);
const main=$('#main'),modal=$('#modal');

function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
function readStorage(key){try{return localStorage.getItem(key);}catch{return null;}}
function writeStorage(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function persist(){
 storageAvailable=writeStorage(STORE,JSON.stringify(progress));
 $('#save-indicator').innerHTML=storageAvailable?'<span></span>Salvo neste navegador':'Exporte seus dados para salvá-los';
 if(!storageAvailable)toast('Não foi possível salvar no navegador. Exporte seu progresso para não perdê-lo.');
}
function syncTheme(){const dark=document.documentElement.dataset.theme==='dark';$('#theme-label').textContent=dark?'Modo claro':'Modo escuro';$('#theme-toggle').setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo escuro');$('#theme-toggle').setAttribute('aria-pressed',String(dark));$('#theme-toggle').firstElementChild.innerHTML=icon(dark?'sun':'moon');$('#mobile-theme').innerHTML=icon(dark?'sun':'moon');$('#mobile-theme').setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo escuro');}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('#theme-toggle').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';writeStorage('affix-theme',document.documentElement.dataset.theme);syncTheme();});
syncTheme();

function heading(eyebrow,title,subtitle,actions='',level='h2'){return `<div class="page-heading"><div>${eyebrow?`<div class="eyebrow">${eyebrow}</div>`:''}<${level}>${title}</${level}>${subtitle?`<p>${subtitle}</p>`:''}</div><div class="heading-actions">${actions}</div></div>`;}
const exportButton=()=>`<button class="button" data-action="export">${icon('download')}Exportar progresso</button>`;
const addActivityButton=()=>`<button class="button primary" data-action="add-activity">${icon('plus')}Adicionar atividade</button>`;
function stat(label,value,target,foot,ic,color){return `<article class="stat"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon(ic)}</span></div><div class="stat-value">${num(value)} <small>/ ${num(target)} h</small></div><div class="progress-track" style="--progress:${Math.min(100,value/target*100)}%;--bar:${color}"><span></span></div><div class="stat-foot"><span>${foot}</span><span>${num(Math.min(100,value/target*100))}%</span></div></article>`;}
function stats(s){return `<div class="stats">${stat('Disciplinas obrigatórias',s.required,2370,'Inclui projetos e TCC','book','var(--purple)')}${stat('Disciplinas optativas',s.elective,480,'8 disciplinas de 60 horas','layers','#c7ad60')}${stat('Horas complementares',s.activity,240,'Ensino, pesquisa e extensão','clock','var(--green)')}</div>`;}
function hero(s){return `<section class="hero" aria-label="Progresso total"><div class="hero-main"><div class="ring" style="--value:${s.percent}" role="img" aria-label="${num(s.percent)} por cento do curso"><div class="ring-content"><strong>${num(s.percent)}<span style="font-size:16px">%</span></strong><small>do curso</small></div></div><div class="hero-copy"><div class="eyebrow">BACHARELADO EM SISTEMAS DE INFORMAÇÃO</div><h2>${s.graduated?'Requisitos de carga horária atendidos':'Progresso do curso'}</h2><p>Marque a situação das disciplinas para atualizar os totais.</p><div class="hero-chips"><span>${icon('checkCircle')}${s.completed} ${s.completed===1?'disciplina concluída':'disciplinas concluídas'}</span><span>${icon('clock')}${s.in_progress} cursando</span><span>${icon('calendar')}9 períodos</span></div></div></div><div class="hero-aside"><span class="tiny-label">CARGA HORÁRIA INTEGRALIZADA</span><strong>${num(s.total)} <small>/ 3.090 h</small></strong><p>${s.graduated?'Todas as metas de planejamento alcançadas.':`Faltam <b>${num(s.remaining)} horas</b> para completar a carga horária.`}</p></div></section>`;}

function filterBar(electives=false){
 const prefix=electives?'elective':'course', search=electives?electiveQuery:query, selected=electives?electiveStatus:statusFilter;
 return `<div class="filter-bar"><div class="search">${icon('search')}<input id="${prefix}-search" type="search" placeholder="${electives?'Buscar entre as 77 optativas…':'Buscar disciplina ou equivalência…'}" value="${esc(search)}" aria-label="${electives?'Buscar optativas':'Buscar disciplinas'}"></div>${!electives?`<select id="category-filter" aria-label="Filtrar por formação"><option value="">Todas as formações</option>${catalog.categories.map(c=>`<option value="${c.id}" ${categoryFilter===c.id?'selected':''}>${c.name}</option>`).join('')}</select>`:''}<select id="${electives?'elective-status-filter':'status-filter'}" aria-label="${electives?'Filtrar optativas por situação':'Filtrar por situação'}"><option value="">Todas as situações</option>${Object.entries(STATUSES).map(([k,n])=>`<option value="${k}" ${selected===k?'selected':''}>${n}</option>`).join('')}</select></div>`;
}
function legend(){return `<div class="legend">${Object.entries(STATUSES).map(([k,v])=>`<span><i class="status-dot ${k}"></i>${v}</span>`).join('')}<span class="legend-hint">${icon('info')}Clique em uma disciplina para atualizar</span></div>`;}
function status(c){return progress.statuses[c.id]||'pending';}
function card(c){const cat=catalog.categories.find(cat=>cat.id===c.category),st=status(c);return `<button class="course-card ${st}" data-course="${c.id}" style="--category:${cat.color}" aria-label="${esc(c.name)}, ${STATUSES[st]}, ${c.hours} horas"><span class="course-symbol">${icon(categoryIcon[c.category])}</span><span class="course-info"><strong>${esc(c.name)}</strong><small>${c.period?`${c.period}º período <span>·</span>`:''}${c.hours} h${c.code?` <span>·</span> ${c.code}`:''}${st!=='pending'?` <span>·</span> ${STATUSES[st]}`:''}</small></span><span class="course-state">${icon({completed:'checkCircle',in_progress:'clock',planned:'calendar',pending:'circle'}[st])}</span></button>`;}
function courseList(courses){
 const seen=new Set();
 return courses.map(c=>{
  if(!c.choice_group)return card(c);
  if(seen.has(c.choice_group))return '';
  seen.add(c.choice_group);
  const choices=courses.filter(other=>other.choice_group===c.choice_group);
  return `<div class="project-choice"><h4>Projetos do ${c.period}º período</h4><p>Escolha uma opção · 60 h</p>${choices.map(card).join('')}</div>`;
 }).join('');
}

const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function matches(c){return (!categoryFilter||c.category===categoryFilter)&&(!statusFilter||status(c)===statusFilter)&&(!query||normalize([c.name,c.code,...c.equivalents].join(' ')).includes(normalize(query)));}
function groupCard(key,title,color,courses,extra=''){
 const completed=courses.filter(c=>status(c)==='completed');const done=completed.reduce((s,c)=>s+c.hours,0);
 const visible=courses.filter(matches);
 const slots=courses.filter((c,i)=>!c.choice_group||courses.findIndex(other=>other.choice_group===c.choice_group)===i);
 const target=slots.reduce((sum,c)=>sum+c.hours,0);
 if(!visible.length&&(query||categoryFilter||statusFilter))return '';
 const states=hasCourseFilters()?filteredExpandedGroups:expandedGroups;
 const open=states.get(key)??hasCourseFilters();
 return `<details class="course-group" data-group-key="${key}" style="--category:${color}" ${open?'open':''}><summary class="group-head"><h3 class="group-title"><span class="group-color"></span><span class="group-name">${title}</span><small>${completed.length} / ${slots.length}</small><span class="group-chevron">${icon('arrow')}</span></h3><span class="progress-track" style="--progress:${target?done/target*100:0}%;--bar:${color}"><span></span></span><span class="group-summary-meta"><span>${extra||`${slots.length} ${slots.length===1?'componente':'componentes'}`}</span><strong>${num(done)} / ${num(target||480)} h</strong></span></summary><div class="course-list">${visible.length?courseList(visible):`<div style="padding:20px 10px;font-size:11px;color:var(--muted);line-height:1.9">Nenhuma optativa selecionada.<br><a class="button text" href="#electives">Ver optativas ${icon('arrow')}</a></div>`}</div></details>`;
}
function emptyCourses(scope='curriculum'){return `<div class="empty">${icon('search')}<h3>Nenhuma disciplina encontrada</h3><p>Tente outro nome, uma equivalência ou ajuste os filtros.</p><button class="button" data-action="clear-filters" data-scope="${scope}">Limpar filtros</button></div>`;}
function renderCourses(){
 const container=$('#course-results');if(!container)return;
 const active=activeCourses(catalog,progress);
 const required=active.filter(c=>c.kind==='required');
 let html='';
 if(groupBy==='period'){
   for(let p=1;p<=9;p++)html+=groupCard(`period-${p}`,`${p}º período`,'var(--purple)',required.filter(c=>c.period===p));
   const chosen=active.filter(c=>c.kind==='elective'&&status(c)!=='pending');
   html+=groupCard('period-electives','Minhas optativas','#c8a84e',chosen,'Meta: 480 horas');
 }else{
   for(const cat of catalog.categories){
     const courses=cat.id==='optativa'?active.filter(c=>c.kind==='elective'&&status(c)!=='pending'):required.filter(c=>c.category===cat.id);
     if(categoryFilter&&cat.id!==categoryFilter)continue;
     html+=groupCard(cat.id,cat.name,cat.color,courses,cat.id==='optativa'?'Meta: 480 horas':'');
   }
 }
 container.innerHTML=html||emptyCourses();
}
function renderElectives(resetScroll=false){
 const container=$('#elective-results'),scrollTop=resetScroll?0:container.scrollTop;
 if(resetScroll||(!electiveQuery&&!electiveStatus))$('#elective-catalog-group').open=Boolean(electiveQuery||electiveStatus)||electiveCatalogExpanded;
 const list=catalog.courses.filter(c=>c.kind==='elective'&&(!electiveStatus||status(c)===electiveStatus)&&(!electiveQuery||normalize(c.name+' '+c.code).includes(normalize(electiveQuery))));
 container.innerHTML=list.length?list.map(card).join(''):emptyCourses('electives');
 container.scrollTop=scrollTop;
 $('#elective-count').textContent=`${list.length} de 77 disciplinas`;
}

function render({refreshSettings=false}={}){
 const s=evaluate(catalog,progress);
 const mounted=Boolean($('#overview'));
 // Keep forms and filters mounted while editing progress elsewhere on the page.
 if(!mounted){
  main.innerHTML=`<section class="page-section" id="overview" aria-label="Visão geral"></section>
   <section class="page-section" id="curriculum" aria-label="Matriz curricular">
    <div class="section-heading"><div><h2>Matriz curricular</h2><p>Disciplinas obrigatórias e optativas selecionadas.</p></div><div class="segmented" aria-label="Organização das disciplinas"><button data-group="category" class="active" aria-pressed="true">${icon('grid')}Por formação</button><button data-group="period" aria-pressed="false">${icon('calendar')}Por período</button></div></div>
    ${filterBar()}${legend()}<div class="group-grid" id="course-results"></div>
   </section>
   <section class="page-section" id="electives" aria-label="Disciplinas optativas">
    ${heading('','Disciplinas optativas','Consulte o catálogo e registre as optativas planejadas, em andamento ou concluídas.')}
    <div id="elective-summary"></div>${filterBar(true)}
    <details class="course-group" id="elective-catalog-group" style="--category:#c8a84e"><summary class="group-head"><h3 class="group-title"><span class="group-color"></span><span class="group-name">Catálogo de optativas</span><small id="elective-count"></small><span class="group-chevron">${icon('arrow')}</span></h3></summary><div class="electives-grid elective-catalog" id="elective-results" tabindex="0" aria-label="Catálogo de optativas"></div></details>
    <div class="tip">${icon('info')}<p>A oferta e os pré-requisitos das optativas devem ser consultados no SIGAA.</p></div>
   </section>
   <section class="page-section" id="activities" aria-label="Horas complementares"></section>
   <section class="page-section" id="settings" aria-label="Meus dados e backup"></section>`;
  renderSettings();
 }
 $('#overview').innerHTML=heading('','Ferramenta para acompanhar o progresso de alunos de BSI - UFRPE','Marque disciplinas concluídas, registre atividades e acompanhe a carga horária.',`${exportButton()}<button class="button" data-action="print">${icon('print')}Imprimir resumo</button><button class="button danger" data-action="reset" title="Zerar progresso" aria-label="Zerar progresso">${icon('trash')}Zerar progresso</button>`,'h1')+hero(s)+stats(s);
 $('#elective-summary').innerHTML=`<div class="wide-card"><div class="section-heading"><div><h3>Carga horária de optativas</h3><p>São exigidas 480 horas em optativas. Restam ${num(Math.max(0,480-s.elective))} horas.</p></div><span class="session-pill">${num(s.elective_raw)} / 480 h concluídas</span></div><div class="progress-track" style="--progress:${s.elective/480*100}%;--bar:#c8a84e"><span></span></div></div>`;
 renderCourses();
 renderElectives();
 const openRules=[...document.querySelectorAll('#activities details')].map(d=>d.open);
 renderActivities(s);
 document.querySelectorAll('#activities details').forEach((d,i)=>{d.open=Boolean(openRules[i]);});
 if(refreshSettings&&mounted)renderSettings();
 document.title='Affix — Progresso acadêmico BSI - UFRPE';
}

function renderActivities(s){
 $('#activities').innerHTML=heading('','Horas complementares','Registre atividades de ensino, pesquisa e extensão e consulte os limites de aproveitamento.',addActivityButton())
  +`<div class="activity-layout"><section><div class="section-heading"><h2>Minhas atividades</h2><span class="muted small">${progress.activities.length} registros</span></div>${progress.activities.length?progress.activities.map(a=>{
   const r=catalog.activity_rules.find(r=>r.id===a.rule_id),d=s.activity_details.find(d=>d.id===a.id);
   return `<article class="activity-item"><span class="course-symbol" style="--category:var(--green)">${icon(r.group==='Ensino'?'book':r.group==='Pesquisa'?'sparkles':'leaf')}</span><div class="activity-body"><h3>${esc(a.title)}</h3><p>${r.group} · ${esc(r.name)}${a.date?`<br>${esc(a.date.split('-').reverse().join('/'))}`:''}${a.evidence?`<br>Comprovante: ${esc(a.evidence)}`:''}</p><div class="inline-actions"><button class="button text" data-edit-activity="${esc(a.id)}">${icon('edit')}Editar</button><button class="icon-button" data-delete-activity="${esc(a.id)}" aria-label="Excluir ${esc(a.title)}">${icon('trash')}</button></div></div><div class="activity-hours">${num(d.credited)} h<small>de ${num(d.raw)} h</small></div></article>`;
  }).join(''):`<div class="empty">${icon('leaf')}<h3>Nenhuma atividade cadastrada.</h3><p>Adicione monitorias, pesquisas, eventos, cursos ou projetos de extensão para calcular as horas complementares.</p>${addActivityButton()}</div>`}</section><aside class="activity-aside"><div class="wide-card"><div class="eyebrow">HORAS COMPLEMENTARES</div><div class="stat-value">${num(s.activity)} <small>/ 240 h</small></div><div class="progress-track" style="--progress:${s.activity/240*100}%;--bar:var(--green)"><span></span></div><p style="margin-top:16px;margin-bottom:0">${num(s.activity_raw)} h calculadas antes dos limites.<br>${num(s.activity_capped)} h após os limites por atividade.<br>Faltam ${num(240-s.activity)} h para a meta.</p></div><div class="wide-card"><h3>Como as horas são contadas?</h3><p style="margin-top:10px">Aplicamos a pontuação e o teto de cada tipo conforme a tabela fornecida. Atividades do mesmo tipo compartilham o limite.</p><p style="margin-bottom:0">O cálculo é uma estimativa para planejamento. O aproveitamento depende dos comprovantes e da homologação pela coordenação.</p></div></aside></div><section class="wide-card" style="margin-top:25px"><h2>Guia de atividades</h2><p>Confira a pontuação, os limites e o que você precisa guardar.</p><div class="rule-list">${catalog.activity_rules.map(r=>`<details><summary>${esc(r.name)} <span>até ${r.maximum} h</span></summary><p><strong>${r.group}</strong>${r.description?' · '+esc(r.description):''}<br>${esc(r.scoring)}<br><br>Comprovação: ${esc(r.evidence)}${r.cap_group==='special-topics'?'<br>Limite de 45h compartilhado entre Tópicos Especiais e Prática Integrada.':''}</p></details>`).join('')}</div></section>`;
}

function renderSettings(){
 $('#settings').innerHTML=heading('','Meus dados e backup','Configure o perfil e importe ou exporte o progresso.')
 +`<div class="settings-grid"><section class="wide-card"><h2>Seu perfil</h2><p>Nome para identificação do backup.</p><form id="profile-form"><label class="field">Nome<input name="name" maxlength="80" value="${esc(progress.name)}" placeholder="Seu nome" autocomplete="given-name"></label><button class="button primary" type="submit">Salvar perfil</button></form></section><section class="wide-card"><h2>Arquivo de progresso (JSON)</h2><p>Importe um arquivo JSON para recuperar o progresso. As alterações ficam neste navegador; exporte um novo JSON para guardá-las ou continuar em outro dispositivo. O arquivo original não é modificado automaticamente.</p><div class="inline-actions">${exportButton()}<button class="button" data-action="import">${icon('upload')}Importar JSON</button></div><p style="margin-top:22px;margin-bottom:0">O arquivo contém suas disciplinas, escolhas de projeto e registros de atividades. Os dados importados são lidos no navegador, sem envio a um servidor. Guarde os comprovantes originais separadamente.</p><button class="button danger" style="margin-top:20px" data-action="reset">${icon('trash')}Limpar progresso local</button></section></div>`;
}

function openModal(content){$('#modal-content').innerHTML=content;if(!modal.open)modal.showModal();}
function modalHead(title,eyebrow=''){return `<div class="modal-head"><div>${eyebrow?`<div class="eyebrow">${eyebrow}</div>`:''}<h2 id="modal-title">${title}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>`;}
function courseModal(id){
 const c=catalog.courses.find(c=>c.id===id),cat=catalog.categories.find(cat=>cat.id===c.category),st=status(c);
 const prereq=c.prerequisites.map(id=>catalog.courses.find(c=>c.id===id));
 const alternative=c.choice_group?catalog.courses.find(other=>other.choice_group===c.choice_group&&other.id!==c.id):null;
 openModal(`${modalHead(esc(c.name),cat.name.toUpperCase())}<form id="course-form" data-id="${id}"><div class="modal-body"><div class="modal-meta"><span>${c.hours} horas</span><span>${c.period?c.period+'º período':'Disciplina optativa'}</span>${c.code?`<span>Código ${c.code}</span>`:''}${alternative?`<span>Uma opção por período</span>`:''}</div>${alternative?`<div class="rule-notice"><strong>Escolha de projeto do ${c.period}º período</strong><br>Esta disciplina e ${esc(alternative.name)} são alternativas. Ao marcar esta opção como planejada, cursando ou concluída, a outra será definida como Não iniciada.</div>`:''}<h3>Sua situação na disciplina</h3><div class="status-options">${Object.entries(STATUSES).map(([k,n])=>`<label class="status-option ${st===k?'selected':''}"><input type="radio" name="status" value="${k}" ${st===k?'checked':''}>${n}</label>`).join('')}</div>${c.equivalents.length?`<div class="detail-section"><h3>Equivalências na matriz anterior</h3><ul>${c.equivalents.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}${prereq.length?`<div class="detail-section"><h3>Disciplinas anteriores indicadas na matriz</h3><ul>${prereq.map(c=>`<li>${esc(c.name)} — ${STATUSES[status(c)]}</li>`).join('')}</ul><p>As setas são referências para planejamento. Confirme as regras de matrícula no SIGAA.</p></div>`:''}<div class="detail-section"><p>${c.kind==='elective'?'As optativas concluídas contam até o limite de 480 horas. Consulte a oferta e os pré-requisitos no SIGAA.':'Marque uma equivalência como concluída somente quando o aproveitamento tiver sido confirmado.'}</p></div></div><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancelar</button><button type="submit" class="button primary">${icon('check')}Salvar situação</button></div></form>`);
}

function activityModal(id){
 const a=id?progress.activities.find(a=>a.id===id):null;
 openModal(`${modalHead(a?'Editar atividade':'Adicionar atividade','HORAS COMPLEMENTARES')}<form id="activity-form" data-id="${a?esc(a.id):''}"><div class="modal-body"><label class="field">Tipo de atividade<select name="rule_id" id="activity-rule">${['Ensino','Pesquisa','Extensão'].map(g=>`<optgroup label="${g}">${catalog.activity_rules.filter(r=>r.group===g).map(r=>`<option value="${r.id}" ${a?.rule_id===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`).join('')}</select></label><div id="rule-fields"></div><label class="field">Título ou descrição<input name="title" required maxlength="200" value="${esc(a?.title||'')}" placeholder="Ex.: Monitoria de programação — 2026.2"></label><div class="fields-row"><label class="field" id="quantity-field">Quantidade<input name="quantity" type="number" min="1" max="10000" step="1" required value="${a?.quantity||1}"></label><label class="field">Data de conclusão<input name="date" type="date" value="${esc(a?.date||'')}"></label></div><label class="field">Referência do comprovante <span class="muted">(opcional)</span><input name="evidence" maxlength="500" value="${esc(a?.evidence||'')}" placeholder="Ex.: certificado-monitoria.pdf"><small>Somente uma referência. Guarde o arquivo original com você.</small></label><div class="form-error" id="activity-error" role="alert"></div></div><div class="modal-footer"><button type="button" class="button" data-action="close-modal">Cancelar</button><button type="submit" class="button primary">${icon('check')}Salvar atividade</button></div></form>`);
 activityRuleFields(a);
}
function activityRuleFields(a=null){
 const r=catalog.activity_rules.find(r=>r.id===$('#activity-rule').value);
 let variants='';
 if(r.mode==='event'||r.mode==='publication'){
   const choices=r.mode==='event'?{local:'Local ou regional · 15h',national:'Nacional · 30h',international:'Internacional · 45h'}:{a:'Qualis A · 120h',b:'Qualis B · 90h',c:'Qualis C · 60h',d:'Qualis D · 30h',unindexed:'Não indexada · 15h',chapter:'Capítulo de livro na área · 60h'};
   variants=`<label class="field">Classificação<select name="variant">${Object.entries(choices).map(([k,n])=>`<option value="${k}" ${a?.variant===k?'selected':''}>${n}</option>`).join('')}</select></label>${r.mode==='event'?`<label class="checkbox"><input type="checkbox" name="organizer" ${a?.organizer?'checked':''}>Membro da comissão organizadora (+20h por evento)</label>`:''}`;
 }
 $('#rule-fields').innerHTML=`<div class="rule-notice"><strong>Limite: ${r.maximum} horas${r.cap_group==='special-topics'?' (compartilhado com Tópicos Especiais / Prática Integrada)':''}</strong><br>${esc(r.scoring)}<br><br>Comprovação: ${esc(r.evidence)}</div>${variants}`;
 const q=$('#quantity-field input');q.step=r.mode==='hours'?'0.01':'1';q.min=r.mode==='hours'?'0.01':'1';$('#quantity-field').firstChild.textContent=`Quantidade de ${r.unit}`;
}

function exportProgress(){const blob=new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`affix-bsi-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Backup exportado. Guarde o arquivo com você.');}
function confirmReplace(title,description,callback,confirmLabel='Confirmar'){openModal(`${modalHead(title)}<div class="modal-body"><p>${description}</p><button class="button text" data-action="export">${icon('download')}Exportar dados atuais antes</button></div><div class="modal-footer"><button class="button" data-action="close-modal">Cancelar</button><button id="confirm-replace" class="button ${confirmLabel==='Zerar progresso'?'danger':'primary'}">${confirmLabel}</button></div>`);$('#confirm-replace').onclick=()=>{callback();modal.close();};}
$('#import-file').addEventListener('change',async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{if(file.size>1_000_000)throw Error('O arquivo deve ter no máximo 1 MB.');const imported=JSON.parse(await file.text());const next=validateProgress(imported,catalog);const s=evaluate(catalog,next);confirmReplace('Importar este backup?',`O backup contém ${s.completed} disciplinas concluídas e ${next.activities.length} atividades. Ele substituirá o progresso local atual.${imported.schema_version===1?' As escolhas do formato antigo serão adaptadas para uma opção por período.':''}`,()=>{progress=next;persist();render({refreshSettings:true});toast('Progresso importado.');});}catch(error){toast(error instanceof SyntaxError?'O arquivo não contém um backup JSON válido.':error.message);}
});

document.addEventListener('click',e=>{
 const summary=e.target.closest('summary.group-head');
 if(summary){const details=summary.parentElement;if(details.dataset.groupKey){const states=hasCourseFilters()?filteredExpandedGroups:expandedGroups;states.set(details.dataset.groupKey,!details.open);}else if(details.id==='elective-catalog-group')electiveCatalogExpanded=!details.open;}
 const course=e.target.closest('[data-course]');if(course){courseOrigin=course.closest('.page-section').id;courseModal(course.dataset.course);return;}
 const edit=e.target.closest('[data-edit-activity]');if(edit){activityModal(edit.dataset.editActivity);return;}
 const del=e.target.closest('[data-delete-activity]');if(del){const a=progress.activities.find(a=>a.id===del.dataset.deleteActivity);confirmReplace('Excluir esta atividade?',`“${esc(a.title)}” será removida do progresso local.`,()=>{progress.activities=progress.activities.filter(b=>b.id!==a.id);persist();render();toast('Atividade removida.');});return;}
 const group=e.target.closest('[data-group]');if(group){groupBy=group.dataset.group;document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('active',b===group);b.setAttribute('aria-pressed',String(b===group));});renderCourses();return;}
 const button=e.target.closest('[data-action]');if(!button)return;
 const action=button.dataset.action;
 if(action==='export')exportProgress();
 else if(action==='theme')$('#theme-toggle').click();
 else if(action==='import')$('#import-file').click();
 else if(action==='print')window.print();
 else if(action==='add-activity')activityModal();
 else if(action==='close-modal')modal.close();
 else if(action==='clear-filters'){if(button.dataset.scope==='electives'){electiveQuery='';electiveStatus='';$('#elective-search').value='';$('#elective-status-filter').value='';renderElectives();}else{query='';categoryFilter='';statusFilter='';filteredExpandedGroups.clear();$('#course-search').value='';$('#category-filter').value='';$('#status-filter').value='';renderCourses();}}
 else if(action==='reset')confirmReplace('Zerar progresso?','Todas as situações de disciplinas, escolhas de projetos e atividades complementares deste navegador serão removidas. Você pode exportar um backup antes de confirmar. Os arquivos JSON já exportados não serão alterados.',()=>{
  progress=clearProgress(progress);
  query='';categoryFilter='';statusFilter='';electiveQuery='';electiveStatus='';
  expandedGroups.clear();filteredExpandedGroups.clear();electiveCatalogExpanded=false;
  for(const id of ['course-search','category-filter','status-filter','elective-search','elective-status-filter'])$('#'+id).value='';
  persist();render({refreshSettings:true});toast('Todas as escolhas e atividades foram removidas. Progresso zerado.');
 },'Zerar progresso');
});
document.addEventListener('input',e=>{if(e.target.id==='course-search'){query=e.target.value;filteredExpandedGroups.clear();renderCourses();}if(e.target.id==='elective-search'){electiveQuery=e.target.value;renderElectives(true);}});
document.addEventListener('change',e=>{
 if(e.target.id==='category-filter'){categoryFilter=e.target.value;filteredExpandedGroups.clear();renderCourses();}
 if(e.target.id==='status-filter'){statusFilter=e.target.value;filteredExpandedGroups.clear();renderCourses();}
 if(e.target.id==='elective-status-filter'){electiveStatus=e.target.value;renderElectives(true);}
 if(e.target.id==='activity-rule')activityRuleFields();
 if(e.target.name==='status')document.querySelectorAll('.status-option').forEach(el=>el.classList.toggle('selected',el.querySelector('input').checked));
});
document.addEventListener('submit',e=>{
 const f=e.target;e.preventDefault();
 if(f.id==='course-form'){progress=updateCourseStatus(catalog,progress,f.dataset.id,f.elements.status.value);persist();modal.close();render();$('#'+courseOrigin+' [data-course="'+f.dataset.id+'"]')?.focus({preventScroll:true});toast('Situação da disciplina atualizada.');}
 if(f.id==='activity-form'){
  try{
   const r=catalog.activity_rules.find(r=>r.id===f.elements.rule_id.value);
   const a={id:f.dataset.id||crypto.randomUUID(),rule_id:r.id,title:f.elements.title.value.trim(),quantity:Number(f.elements.quantity.value),variant:f.elements.variant?.value||'',organizer:f.elements.organizer?.checked||false,date:f.elements.date.value,evidence:f.elements.evidence.value.trim()};
   const next={...progress,activities:progress.activities.filter(v=>v.id!==a.id)};
   const oldIndex=progress.activities.findIndex(v=>v.id===a.id);
   if(oldIndex<0)next.activities.push(a);else next.activities.splice(oldIndex,0,a);
   progress=validateProgress(next,catalog);persist();modal.close();render();toast(`Atividade salva. ${num(rawActivityHours(a,r))} h calculadas antes dos limites.`);
  }catch(error){$('#activity-error').textContent=error.message;}
 }
 if(f.id==='profile-form'){progress.name=f.elements.name.value.trim();persist();render({refreshSettings:true});toast('Perfil atualizado.');}
});
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
let printGroups=[];
window.addEventListener('beforeprint',()=>{printGroups=[...document.querySelectorAll('details.course-group')].map(group=>[group,group.open]);printGroups.forEach(([group])=>{group.open=true;});});
window.addEventListener('afterprint',()=>{printGroups.forEach(([group,open])=>{group.open=open;});printGroups=[];});
function markSection(id){
 document.querySelectorAll('[data-view]').forEach(a=>{const active=a.dataset.view===id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
}
function navigate(){
 const next=location.hash.slice(1)||'overview';
 if(next==='main'){main.focus();return;}
 const id=Object.hasOwn(labels,next)?next:'overview';
 markSection(id);
 $('#'+id)?.scrollIntoView({block:'start',behavior:'instant'});
}
window.addEventListener('hashchange',()=>{if(catalog)navigate();});
let scrollScheduled=false;
window.addEventListener('scroll',()=>{
 if(scrollScheduled||!catalog)return;
 scrollScheduled=true;
 requestAnimationFrame(()=>{
  scrollScheduled=false;
  const offset=matchMedia('(max-width:800px)').matches?$('.sidebar').getBoundingClientRect().height+24:30;
  let active='overview';
  document.querySelectorAll('.page-section').forEach(section=>{if(section.getBoundingClientRect().top<=offset)active=section.id;});
  markSection(active);
 });
},{passive:true});
window.addEventListener('storage',e=>{if(e.key===STORE&&e.newValue&&catalog){try{progress=validateProgress(JSON.parse(e.newValue),catalog);modal.close();render({refreshSettings:true});toast('Progresso atualizado a partir de outra aba.');}catch{toast('Não foi possível ler a alteração de outra aba.');}}});
async function start(){
 try{
  const response=await fetch('./data/catalog.json');if(!response.ok)throw Error('Não foi possível carregar a matriz.');catalog=await response.json();
  let corrupt=false,migrated=false;try{const raw=readStorage(STORE);const stored=raw?JSON.parse(raw):null;progress=stored?validateProgress(stored,catalog):emptyProgress();if(stored?.schema_version===1){if(!readStorage('affix-legacy-progress-backup-v1'))writeStorage('affix-legacy-progress-backup-v1',raw);migrated=true;}}catch{progress=emptyProgress();corrupt=true;}
  render();navigate();if(migrated){persist();toast('Progresso atualizado para escolhas de projeto por período. Uma cópia do formato anterior foi preservada neste navegador.');}if(corrupt){toast('O progresso salvo está corrompido. Importe um backup para recuperar seus dados.');$('#save-indicator').textContent='Dados salvos não puderam ser lidos';}

 }catch(e){main.innerHTML=`<div class="empty">${icon('info')}<h3>Não foi possível carregar os dados.</h3><p>${esc(e.message)} Atualize a página para tentar novamente.</p><button class="button" id="reload-app">Tentar novamente</button></div>`;$('#reload-app').onclick=()=>location.reload();}
}
start();
