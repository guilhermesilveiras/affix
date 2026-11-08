"""Generate versioned catalog from source files and a visually transcribed matrix.

The matrix PDF is a raster printout: names, colors, hours and equivalencies below
were checked against the rendered page. Catalog IDs are internal, NOT SIGAA codes.
"""
import json
import re
from pathlib import Path
from openpyxl import load_workbook
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
categories = [
    ('basica', 'Formação básica', '#e7836b'),
    ('tecnologica', 'Formação tecnológica', '#5daa88'),
    ('complementar', 'Formação complementar', '#6d9dcc'),
    ('humanistica', 'Formação humanística', '#a38acc'),
    ('suplementar', 'Formação suplementar', '#b47bc8'),
    ('optativa', 'Optativas', '#c8a84e'),
]
# period | name | category | hours | former curriculum equivalent
matrix = '''1|Projeto Interdisciplinar de Sistemas de Informação I|suplementar|60|Introdução à Programação;Laboratório de Informática
1|Fundamentos Matemáticos para Sistemas de Informação I|basica|60|Matemática Discreta
1|Princípios de Programação|basica|60|Introdução à Programação
1|Sustentabilidade em Sistemas de Informação|humanistica|60|Aspectos Filosóficos e Sociológicos da Informação
1|Introdução à Administração|complementar|60|Teoria Geral da Administração
2|Projeto Interdisciplinar de Sistemas de Informação II|suplementar|60|Metodologia da Expressão Técnica e Científica
2|Fundamentos Matemáticos para Sistemas de Informação II|basica|60|Álgebra Linear e Vetorial para Computação
2|Fundamentos de Problemas Computacionais I|basica|60|Laboratório de Programação
2|Elementos de Sistemas Computacionais|basica|60|Infraestrutura de Hardware
2|Fundamentos de Sistemas de Informação|complementar|60|
3|Projeto Interdisciplinar de Sistemas de Informação III|suplementar|60|Análise e Projeto de Sistemas de Informação
3|Desenvolvimento de Sistemas de Informação|tecnologica|60|Modelagem e Programação Orientada a Objetos
3|Engenharia para Sistemas de Informação I|tecnologica|60|Fundamentos para Engenharia de Software
3|Introdução ao Armazenamento e Análise de Dados|tecnologica|60|Fundamentos de Banco de Dados
4|Projeto Interdisciplinar de Sistemas de Informação IV|suplementar|60|Projeto de Sistemas Distribuídos
4|Princípios de Software Básico|tecnologica|60|Infraestrutura de Software
4|Fundamentos de Problemas Computacionais II|basica|60|Algoritmos para Sistemas
4|Sistemas de Informação na Internet|tecnologica|60|Redes e Sistemas de Internet
5|Projeto de Desenvolvimento Tecnológico para o Mundo I|suplementar|60|Interface Homem-Máquina
5|Segurança e Auditoria de Sistemas|tecnologica|60|
5|Engenharia para Sistemas de Informação II|tecnologica|60|Processo de Desenvolvimento de Software
5|Empreendedorismo e Inovação|complementar|60|Empreendedorismo e Legislação
6|Projeto de Desenvolvimento Tecnológico para o Mundo II|suplementar|60|Linguagens de Programação
6|Cálculo N1|basica|60|Cálculo a uma Variável
6|Engenharia para Sistemas de Informação III|tecnologica|60|Gerência de Projeto de Software
6|Modelagem de Dados|tecnologica|60|Projeto de Banco de Dados
7|Princípios da Teoria da Computação|basica|60|Introdução à Teoria da Computação
7|Estatística Aplicada à Análise de Dados|basica|60|Estatística Exploratória
8|Gestão do Conhecimento|complementar|60|Sistemas de Apoio à Decisão
8|Fundamentos de Estratégia Competitiva|complementar|60|
9|Trabalho de Conclusão de Curso — Sistemas de Informação|suplementar|420|
9|Educação Física A|suplementar|30|'''
courses = []
for i, line in enumerate(matrix.splitlines(), 1):
    period, name, category, hours, old = line.split('|')
    courses.append(dict(id=f'core-{i:02}', name=name, category=category, hours=int(hours), period=int(period), kind='required', equivalents=old.split(';') if old else [], prerequisites=[], track=None, code=None))
for track, names in {
    'tecnologia': ['Projeto para Sociedade I', 'Projeto para Sociedade II'],
    'ciencia': ['Projeto de Soluções Complexas I', 'Projeto de Soluções Complexas II'],
}.items():
    for i, name in enumerate(names, 1):
        courses.append(dict(id=f'{track}-{i}', name=name, category='suplementar', hours=60, period=6+i, kind='required', track=track, choice_group=f'project-{6+i}', equivalents=[], prerequisites=[], code=None))
# Only arrows explicitly visible on the provided matrix; advisory, not enrollment rules.
edges = {'core-07':['core-02'], 'core-08':['core-03'], 'core-12':['core-08'], 'core-16':['core-09'], 'core-17':['core-08'], 'core-21':['core-13'], 'core-24':['core-07'], 'core-25':['core-21'], 'core-26':['core-14'], 'core-27':['core-07']}
for course in courses:
    course['prerequisites'] = edges.get(course['id'], course['prerequisites'])
pdf = next((ROOT/'source').glob('Optativas*.pdf'))
for page in PdfReader(pdf).pages:
    for code, name, hours in re.findall(r'^\s*(\d{4,5})\s+(.+?)\s*-\s*(\d+)h\s*$', page.extract_text(extraction_mode='layout'), re.M):
        courses.append(dict(id=f'opt-{code}', code=code, name=name.title(), category='optativa', hours=int(hours), period=None, kind='elective', track=None, equivalents=[], prerequisites=[]))
wb = load_workbook(ROOT/'source'/'Tabela.AtividadesComplementares.xlsx', read_only=True, data_only=True)
ws = wb['Tipos de Atividade']
rules = []
group = ''
for n, row in enumerate(ws.values, 1):
    row = list(row[:5]) + [None]*max(0, 5-len(row))
    a, b, c, d, e = row
    if a in ['ENSINO', 'PESQUISA', 'EXTENSÃO']:
        group = a.title()
    if not d or d == 'Pontuação':
        continue
    title = a or c
    if n in [10,11]: title = c
    title = ' '.join(str(title).split()).replace('Pequisa', 'Pesquisa')
    # Blank B6 inherits the merged B5:B6 maximum, shared by both activities.
    maximum = int(re.search(r'\d+', str(b)).group()) if b else 45
    mode, rate, unit = ('hours',1,'horas')
    if 'semestre' in d: mode,rate,unit = 'semester',60,'semestres'
    elif 'equivale a 3h' in d: mode,rate,unit = 'hours',3,'horas realizadas'
    elif 'artefato' in d: mode,rate,unit = 'artifact',15,'artefatos'
    elif n==10: mode,rate,unit = 'publication',0,'publicações'
    elif n==17: mode,rate,unit = 'event',0,'eventos'
    rules.append(dict(id=f'activity-{n}', group=group, name=title, description=' '.join(str(c or '').split()), maximum=maximum, cap_group='special-topics' if n in [5,6] else f'activity-{n}', mode=mode, rate=rate, unit=unit, scoring=d, evidence=e.strip(), source_row=n))
wb.close()
public_sources = [pdf, ROOT/'source'/'Tabela.AtividadesComplementares.xlsx', ROOT/'source'/'matriz-curricular-com-equivalencias.pdf']
catalog = dict(version=1, course='Bacharelado em Sistemas de Informação', institution='Universidade Federal Rural de Pernambuco', campus='Recife', total_hours=3090, required_hours=2370, elective_hours=480, activity_hours=240, periods=9, categories=[dict(id=k,name=n,color=c) for k,n,c in categories], courses=courses, activity_rules=rules, sources=[dict(name=p.name, url='sources/'+p.name) for p in sorted(public_sources)], notes=[
    'Matriz transcrita visualmente do PDF fornecido. Os identificadores das obrigatórias são internos; códigos SIGAA não constam na matriz.',
    'Pré-requisitos são referências às setas da matriz, não uma validação oficial de matrícula. Equivalências devem ser confirmadas pela coordenação.',
    'No 7º e no 8º período, os dois projetos são alternativas: somente uma opção por período pode ser planejada, cursada ou concluída. Cada escolha corresponde a 60h.',
    'Educação Física A consta com 30h e foi incluída na carga obrigatória. Sem esse componente, a soma da figura não alcança 3.090h.',
    'Tópicos Especiais e Prática Integrada compartilham o limite de 45h da célula mesclada B5:B6 da planilha.',
    'As horas complementares são estimativas para planejamento e dependem de homologação. A aba componentes contém códigos repetidos e sobrepostos ao catálogo de optativas, portanto não foi usada como identificador.'
])
assert sum(c['hours'] for c in courses if c['kind']=='required' and c['track'] in [None,'tecnologia']) == 2370
assert len([c for c in courses if c['kind']=='elective']) == 77
out = ROOT/'frontend'/'data'
out.mkdir(parents=True,exist_ok=True)
(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(courses)} disciplinas; {len(rules)} regras de atividades')
