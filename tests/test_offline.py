"""Offline Python validation and accounting; no server or database required."""
import json
import shutil
import subprocess
import sys
import pytest
from pydantic import ValidationError
from backend.progress import CATALOG, ROOT, Progress, evaluate


def activity(rule, quantity, id='one', **extra):
    return dict(id=id, rule_id=rule, quantity=quantity, title='Atividade', **extra)


def test_catalog():
    assert len(CATALOG['courses']) == 113
    assert len([c for c in CATALOG['courses'] if c['kind']=='elective']) == 77
    assert CATALOG['total_hours'] == 3090


@pytest.mark.parametrize('first,second', [('tecnologia','tecnologia'),('tecnologia','ciencia'),('ciencia','tecnologia'),('ciencia','ciencia')])
def test_full_degree_without_double_counting_projects(first, second):
    statuses={c['id']:'completed' for c in CATALOG['courses'] if not c.get('choice_group') or c['id']==(first+'-1' if c['period']==7 else second+'-2')}
    p=Progress(statuses=statuses, activities=[activity('activity-3',2),activity('activity-9',2,id='two')])
    result=evaluate(p)
    assert result['required'] == 2370
    assert result['elective'] == 480
    assert result['total'] == 3090
    assert result['percent'] == 100
    assert result['graduated'] is True


def test_shared_activity_caps_and_scoring():
    p=Progress(activities=[activity('activity-5',10),activity('activity-6',2,id='two'),activity('activity-10',1,id='three',variant='a'),activity('activity-17',1,id='four',variant='international',organizer=True)])
    result=evaluate(p)
    assert [a['credited'] for a in result['activity_details']] == [30,15,90,65]
    assert result['activity'] == 200


@pytest.mark.parametrize('suffix', [1,2])
@pytest.mark.parametrize('other_status', ['planned','in_progress','completed'])
def test_conflicting_projects_rejected(suffix,other_status):
    payload={**Progress().model_dump(), 'statuses':{f'tecnologia-{suffix}':'completed',f'ciencia-{suffix}':other_status}}
    with pytest.raises(ValidationError,match='apenas um projeto'):
        Progress.model_validate(payload)


def test_legacy_backup_migration():
    legacy={'schema_version':1,'name':'Ana','track':'ciencia','statuses':{'tecnologia-1':'completed','ciencia-1':'completed','tecnologia-2':'completed'},'activities':[]}
    progress=Progress.model_validate(legacy)
    assert evaluate(progress)['required'] == 120
    stored=progress.model_dump()
    assert stored['schema_version'] == 2
    assert stored['statuses']['tecnologia-1'] == 'pending'
    assert stored['statuses']['tecnologia-2'] == 'completed'
    assert 'track' not in stored
    legacy['statuses']['tecnologia-1']='invalid'
    with pytest.raises(ValidationError):
        Progress.model_validate(legacy)


@pytest.mark.parametrize('patch', [
    {'statuses':{'unknown':'completed'}},
    {'statuses':{'core-01':'wrong'}},
    {'activities':[activity('unknown',1)]},
    {'activities':[activity('activity-3',-1)]},
    {'activities':[activity('activity-3',1.5)]},
    {'activities':[activity('activity-17',1,variant='unknown')]},
    {'activities':[activity('activity-3',1),activity('activity-3',1)]},
    {'track':'both'},
])
def test_rejects_invalid_json_data(patch):
    with pytest.raises(ValidationError):
        Progress.model_validate({**Progress().model_dump(),**patch})


def test_local_json_cli(tmp_path):
    file=tmp_path/'progresso.json'
    file.write_text(Progress(statuses={'core-01':'completed'}).model_dump_json(),encoding='utf-8')
    valid=subprocess.run([sys.executable,'-m','backend.progress',str(file)],cwd=ROOT,capture_output=True,text=True,check=True)
    assert json.loads(valid.stdout)['total'] == 60
    file.write_text('{invalid',encoding='utf-8')
    invalid=subprocess.run([sys.executable,'-m','backend.progress',str(file)],cwd=ROOT,capture_output=True)
    assert invalid.returncode == 1


def test_javascript_python_calculations_agree():
    if not shutil.which('node'):
        pytest.skip('Node unavailable')
    profiles=[]
    for first,second in [('tecnologia','tecnologia'),('tecnologia','ciencia'),('ciencia','tecnologia'),('ciencia','ciencia')]:
        for cutoff in [0,4,10,30,113]:
            statuses={c['id']:'completed' for c in CATALOG['courses'][:cutoff] if not c.get('choice_group') or c['id']==(first+'-1' if c['period']==7 else second+'-2')}
            profiles.append(Progress(statuses=statuses,activities=[activity('activity-3',3),activity('activity-5',5,id='two'),activity('activity-6',3,id='three'),activity('activity-17',2,id='four',variant='international',organizer=True)]).model_dump())
    code="import {evaluate} from './frontend/progress.js'; let input='';for await(const chunk of process.stdin)input+=chunk;const {catalog,profiles}=JSON.parse(input);console.log(JSON.stringify(profiles.map(p=>evaluate(catalog,p))));"
    result=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,input=json.dumps(dict(catalog=CATALOG,profiles=profiles)),capture_output=True,text=True,check=True)
    assert json.loads(result.stdout) == [evaluate(Progress.model_validate(p)) for p in profiles]
