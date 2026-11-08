"""Curriculum accounting. Excess elective/activity hours never replace core hours."""
import json
import math
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT/'frontend/data/catalog.json').read_text(encoding='utf-8'))
COURSES = {c['id']: c for c in CATALOG['courses']}
RULES = {r['id']: r for r in CATALOG['activity_rules']}
PROJECT_GROUPS = {}
for course in COURSES.values():
    if course.get('choice_group'):
        PROJECT_GROUPS.setdefault(course['choice_group'], []).append(course)
STATUSES = Literal['pending', 'planned', 'in_progress', 'completed']


class Activity(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=80)
    rule_id: str
    title: str = Field(min_length=1, max_length=200)
    quantity: float = Field(gt=0, le=10000)
    variant: str = ''
    organizer: bool = False
    date: str = Field(default='', max_length=10)
    evidence: str = Field(default='', max_length=500)

    @model_validator(mode='after')
    def valid_rule(self):
        if self.rule_id not in RULES:
            raise ValueError('Tipo de atividade desconhecido')
        mode = RULES[self.rule_id]['mode']
        variants = {'publication': ['a','b','c','d','unindexed','chapter'], 'event': ['local','national','international']}
        if mode in variants and self.variant not in variants[mode]:
            raise ValueError('Selecione a classificação da atividade')
        if mode != 'hours' and self.quantity != int(self.quantity):
            raise ValueError('A quantidade deve ser inteira')
        if not self.title.strip():
            raise ValueError('Informe o título')
        return self


class Progress(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal[2] = 2
    name: str = Field(default='', max_length=80)
    statuses: dict[str, STATUSES] = Field(default_factory=dict, max_length=200)
    activities: list[Activity] = Field(default_factory=list, max_length=1000)

    @model_validator(mode='before')
    @classmethod
    def migrate_legacy(cls, value):
        if isinstance(value, dict) and value.get('schema_version') == 1:
            data = dict(value)
            track = data.pop('track', 'tecnologia')
            if track not in ['tecnologia','ciencia']:
                raise ValueError('Trilha do backup antigo inválida')
            if not isinstance(data.get('statuses', {}), dict):
                return value
            statuses = dict(data.get('statuses', {}))
            if any(k not in COURSES or v not in ['pending','planned','in_progress','completed'] for k,v in statuses.items()):
                raise ValueError('Disciplina ou situação desconhecida no backup antigo')
            for group in PROJECT_GROUPS.values():
                selected = [c for c in group if statuses.get(c['id']) not in [None,'pending']]
                if len(selected) > 1:
                    chosen = next((c for c in selected if c['track'] == track), selected[0])
                    for course in selected:
                        if course['id'] != chosen['id']:
                            statuses[course['id']] = 'pending'
            data.update(schema_version=2, statuses=statuses)
            return data
        return value

    @model_validator(mode='after')
    def valid_catalog(self):
        if any(k not in COURSES for k in self.statuses):
            raise ValueError('Disciplina desconhecida')
        for group in PROJECT_GROUPS.values():
            if sum(self.statuses.get(c['id']) not in [None,'pending'] for c in group) > 1:
                raise ValueError(f"Escolha apenas um projeto para o {group[0]['period']}º período")
        ids = [a.id for a in self.activities]
        if len(ids) != len(set(ids)):
            raise ValueError('Atividades duplicadas')
        return self


def activity_hours(activity):
    r = RULES[activity.rule_id]
    rate = r['rate']
    if r['mode'] == 'publication':
        rate = dict(a=120,b=90,c=60,d=30,unindexed=15,chapter=60)[activity.variant]
    if r['mode'] == 'event':
        rate = dict(local=15,national=30,international=45)[activity.variant] + (20 if activity.organizer else 0)
    return activity.quantity * rate


def evaluate(progress: Progress):
    active = list(COURSES.values())
    completed = [c for c in active if progress.statuses.get(c['id']) == 'completed']
    required = sum(c['hours'] for c in completed if c['kind']=='required')
    elective_raw = sum(c['hours'] for c in completed if c['kind']=='elective')
    used = {}
    activity_details = []
    for a in progress.activities:
        rule = RULES[a.rule_id]
        raw = activity_hours(a)
        group = rule['cap_group']
        credited = min(raw, max(0, rule['maximum']-used.get(group,0)))
        used[group] = used.get(group,0) + credited
        activity_details.append(dict(id=a.id, raw=raw, credited=credited))
    activity_raw = sum(a['raw'] for a in activity_details)
    activity_capped = sum(a['credited'] for a in activity_details)
    elective = min(elective_raw, CATALOG['elective_hours'])
    activity = min(activity_capped, CATALOG['activity_hours'])
    total = required + elective + activity
    return dict(required=required, elective=elective, elective_raw=elective_raw, activity=activity, activity_raw=activity_raw, activity_capped=activity_capped, total=total, remaining=CATALOG['total_hours']-total, percent=math.floor(total/CATALOG['total_hours']*1000+0.5)/10, completed=len(completed), in_progress=sum(progress.statuses.get(c['id'])=='in_progress' for c in active), activity_details=activity_details, graduated=required==2370 and elective==480 and activity==240)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Validar e calcular um arquivo JSON de progresso localmente.')
    parser.add_argument('file', type=Path, help='Arquivo JSON exportado pelo Affix')
    args = parser.parse_args()
    try:
        progress = Progress.model_validate_json(args.file.read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        parser.exit(1, f'Arquivo inválido: {error}\n')
    print(json.dumps(evaluate(progress), ensure_ascii=False, indent=2))
