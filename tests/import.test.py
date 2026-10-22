import importlib.util, tempfile, csv, hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location('legacy',Path(__file__).resolve().parent.parent/'tools/legacy_import.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
    p=Path(d)/'3H.csv';row=['1','Synthetic Pupil','3H']
    for code in m.SUBJECTS[:12]: row.extend([0 if code=='BM' else 'TH' if code=='BI' else '', 'F' if code=='BM' else 'TH' if code=='BI' else ''])
    with p.open('w',newline='') as f: csv.writer(f).writerows([['BIL','NAMA','KELAS'],row])
    before=hashlib.sha256(p.read_bytes()).hexdigest();r=m.inspect(p,'3H','2025')
    assert r['summary']['students']==1 and r['students'][0]['marks']['BM']['value']==0
    assert r['students'][0]['marks']['PI']['value'] is None
    assert r['students'][0]['marks']['BI']['value']=='TH'
    assert before==hashlib.sha256(p.read_bytes()).hexdigest()==r['source_sha256']
print('PASS legacy CSV helper: zero, TH, explicit blank review and unchanged source hash. Actual school XLSX was not reread.')
