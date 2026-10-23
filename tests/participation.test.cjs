const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {context:c,props,db,admin,mutate,book}=require('./backend.test.cjs');
props.ACADEMIC_YEAR='2026';c.CONFIG_REQUEST_=null;
const doc=JSON.parse(fs.readFileSync(__dirname+'/fixtures/school.json'));let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name)}catch(e){console.error('FAIL '+name,e);process.exitCode=1}}
function plan(d=doc){return c.schoolPlan_(db(),admin,{document:d},false)}
doc.sheets['08_EXAMS'].forEach(r=>Object.assign(r.values,{opening_date:'2020-01-01',closing_date:'2099-01-01'}));
doc.sheets['03_STUDENTS'].forEach((r,i)=>Object.assign(r.values,{religion_subject:i%2?'PM':'PI',elective_subject:i%2?'BC':'BA'}));
test('Paired elective choices validated before any commit',()=>{assert.equal(plan().errors.length,0);const bad=structuredClone(doc);bad.sheets['03_STUDENTS'][0].values.religion_subject='PM|PI';assert.ok(plan(bad).errors.some(e=>e.field==='religion_subject/elective_subject'));delete bad.sheets['03_STUDENTS'][0].values.elective_subject;assert.ok(plan(bad).errors.length)});
mutate(d=>{const credentials=plan().newTeachers.map(t=>({teacher_ref:t.teacher_ref,salt:t.salt,proof:crypto.pbkdf2Sync('BBB8307',t.salt,600000,32,'sha256').toString('base64url')}));const p=c.schoolPlan_(d,admin,{document:doc,credentials},true);assert.equal(p.errors.length,0);p.changes.forEach(x=>x.state?d.setState(x.state,x.value):d.put(x.table,x.record))});
const exam=db().read('EXAMS').find(e=>e.academic_year==='2026'&&e.exam_type==='UPSA');
mutate(d=>c.prepareExam_(d,admin,{exam_id:exam.exam_id},crypto.randomUUID()));
mutate(d=>{const e=d.find('EXAMS','exam_id',exam.exam_id);e.opening_date='2020-01-01';e.closing_date='2099-01-01';d.put('EXAMS',e)});
const cls='DEMO-1H';
test('Selected optional subjects start EMPTY and non-selected remain TB',()=>{const rows=db().marks(exam.exam_id,cls);assert.ok(rows.length);for(const m of rows.filter(m=>['PI','PM','BA','BC','BT'].includes(m.subject_code))){assert.equal(m.mark_status,c.takesSubject_(db(),exam.exam_id,cls,m.subject_code,m.student_id)?'EMPTY':'TB')}});
test('Subject view excludes students who do not take the subject; class review retains them',()=>{const view=c.marksGet_(db(),admin,{exam_id:exam.exam_id,class_id:cls,subject_code:'PI'});assert.equal(view.marks.length,1);assert.equal(c.marksGet_(db(),admin,{exam_id:exam.exam_id,class_id:cls}).marks.filter(m=>m.subject_code==='PI').length,2)});
test('Indexed subject reads fetch 2 rows rather than complete class marks',()=>{const d=db();const ranges=[];const read=d.range.bind(d);d.range=(t,s,n)=>{if(t==='MARKS')ranges.push(n);return read(t,s,n)};d.marks(exam.exam_id,cls,'PI');assert.deepEqual(ranges,[2]);d.marks(exam.exam_id,cls,'PI');assert.deepEqual(ranges,[2])});
test('Forged write to non-participating pupil rejected server-side',()=>{const a=db().read('ASSIGNMENTS').find(a=>a.class_id===cls&&a.subject_code==='PI');const u=db().find('USERS','user_id',a.user_id);const m=db().marks(exam.exam_id,cls,'PI').find(m=>m.mark_status==='TB');assert.throws(()=>c.saveMarks_(db(),u,{exam_id:exam.exam_id,class_id:cls,subject_code:'PI',changes:[{mark_id:m.mark_id,version:1,value:80}]},crypto.randomUUID()),/tidak mengambil/)});
test('UPSA and UASA preparation preserve independent frozen cohorts',()=>{const uasa=db().read('EXAMS').find(e=>e.academic_year==='2026'&&e.exam_type==='UASA');mutate(d=>c.prepareExam_(d,admin,{exam_id:uasa.exam_id},crypto.randomUUID()));assert.equal(c.entryMarks_(db(),uasa.exam_id,cls,'PI').length,1);assert.notEqual(c.entryMarks_(db(),uasa.exam_id,cls,'PI')[0].mark_id,c.entryMarks_(db(),exam.exam_id,cls,'PI')[0].mark_id)});
test('Prepared participation cannot be silently changed through reimport',()=>{assert.equal(plan().errors.length,0);const changed=structuredClone(doc);changed.sheets['03_STUDENTS'][0].values.elective_subject='BT';assert.ok(plan(changed).errors.some(e=>/dikunci/.test(e.message)));const reverse=structuredClone(doc);reverse.sheets['03_STUDENTS'].reverse();assert.equal(plan(reverse).errors.length,0)});
test('Reference cache reduces repeated grade reads and fails open to authoritative reads',()=>{const store=new Map();c.CacheService={getScriptCache:()=>({get:k=>store.get(k),put:(k,v)=>store.set(k,v)})};const d=db();let reads=0;const read=d.read.bind(d);d.read=t=>{if(t==='GRADE_RULES')reads++;return read(t)};assert.equal(c.rules_(d,'v1').length,6);assert.equal(c.rules_(db(),'v1').length,6);assert.equal(reads,1);store.clear();assert.equal(c.rules_(db(),'v1').length,6);delete c.CacheService});
test('Optional subject with no participants is automatically satisfied, not an empty teacher task',()=>{const s=c.submission_(db(),exam.exam_id,cls,'BT');assert.equal(s.submission_status,'SUBMITTED');assert.equal(s.tb_acknowledged,true);assert.ok(!c.readiness_(db(),exam.exam_id,cls).missingSubmissions.includes('BT'))});
test('Complete class review freezes scores and TB correctly for result/PDF snapshots',()=>{
 for(const sub of c.subjectsExam_(db(),exam.exam_id,1)){
  const rows=c.entryMarks_(db(),exam.exam_id,cls,sub.subject_code);if(!rows.length)continue;
  const a=db().read('ASSIGNMENTS').find(a=>a.class_id===cls&&a.subject_code===sub.subject_code),u=db().find('USERS','user_id',a.user_id);
  mutate(d=>c.saveMarks_(d,u,{exam_id:exam.exam_id,class_id:cls,subject_code:sub.subject_code,changes:rows.map(m=>({mark_id:m.mark_id,version:m.record_version,value:'73'}))},crypto.randomUUID()));
  const latest=c.entryMarks_(db(),exam.exam_id,cls,sub.subject_code);
  mutate(d=>c.submit_(d,u,{exam_id:exam.exam_id,class_id:cls,subject_code:sub.subject_code,versions:latest.map(m=>[m.mark_id,m.record_version]),tb_acknowledged:true,all_tb_acknowledged:true},crypto.randomUUID()));
 }
 const a=db().read('ASSIGNMENTS').find(a=>a.class_id===cls&&a.assignment_type==='CLASS_TEACHER'),u=db().find('USERS','user_id',a.user_id);
 const reviews=db().read('CLASS_REVIEWS').filter(r=>r.exam_id===exam.exam_id&&r.class_id===cls&&r.record_type==='STUDENT');
 mutate(d=>c.remarkSave_(d,u,{exam_id:exam.exam_id,class_id:cls,changes:reviews.map(r=>({student_id:r.student_id,version:r.record_version,remark:'Teruskan usaha.'}))},crypto.randomUUID()));
 const ready=c.readiness_(db(),exam.exam_id,cls);assert.equal(ready.ready,true);
 mutate(d=>c.finalize_(d,u,{exam_id:exam.exam_id,class_id:cls,revisionHash:ready.revisionHash,confirmed:true},crypto.randomUUID()));
 for(const r of db().read('CLASS_REVIEWS').filter(r=>r.exam_id===exam.exam_id&&r.class_id===cls&&r.record_type==='STUDENT')){
  const snap=JSON.parse(r.result_snapshot);assert.equal(snap.marks.filter(m=>m.mark_status==='TB').length,3);assert.equal(snap.marks.filter(m=>['PI','PM','BA','BC','BT'].includes(m.subject_code)&&m.mark_status==='SCORED').length,2);
 }
});
console.log(passed+' participation/index/cache tests passed.');
