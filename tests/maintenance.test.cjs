const assert=require('node:assert/strict');
const {context:c,db,book,admin,teacher,mutate}=require('./backend.test.cjs');
assert.throws(()=>c.acceptanceStart_(db(),teacher,{confirmed:true},'qa'));
assert.throws(()=>c.resetTesting_(db(),teacher,{confirmed:'RESET DATA UJIAN'},'reset'));
assert.throws(()=>c.resetTesting_(db(),admin,{confirmed:'RESET DATA UJIAN'},'reset'));
c.QA_CONFIG_={spreadsheet:'qa-copy',parent:'qa-folder'};c.CONFIG_REQUEST_=null;assert.equal(c.config_().spreadsheet,'qa-copy');c.CONFIG_REQUEST_=null;assert.equal(c.config_().parent,'qa-folder');c.QA_CONFIG_=null;c.CONFIG_REQUEST_=null;assert.notEqual(c.config_().spreadsheet,'qa-copy');
const originalStatus=c.acceptanceStatus_;
c.acceptanceStatus_=()=>({status:'PDF_QUEUED',pdf_status:'COMPLETED',master_unchanged:true});
book.copy=()=>({getUrl:()=> 'https://docs.google.com/spreadsheets/d/fixture-backup'});
const before=c.masterFingerprint_(db()),versions=db().read('MARKS').map(m=>Number(m.record_version));
mutate(d=>c.resetTesting_(d,admin,{confirmed:'RESET DATA UJIAN'},'reset'));
assert.equal(c.masterFingerprint_(db()),before);
for(const [i,m] of db().read('MARKS').entries()){assert.equal(m.mark_status,c.bool_(m.default_tb)?'TB':'EMPTY');assert.equal(m.score,'');assert.ok(Number(m.record_version)>versions[i]);}
assert.ok(db().read('SUBMISSIONS').every(s=>s.submission_status==='DRAFT'&&!s.submitted_at));
assert.ok(db().read('CLASS_REVIEWS').every(r=>!r.finalized_at&&!r.class_teacher_remark&&!r.result_snapshot&&r.pdf_status==='NONE'));
assert.throws(()=>c.resetTesting_(db(),admin,{confirmed:'RESET DATA UJIAN'},'reset-again'));
c.acceptanceStatus_=originalStatus;
console.log('PASS reset requires admin and completed QA PDF, preserves all master data and credentials, increments versions, restores EMPTY/default TB, clears submissions, remarks, finalization and PDF state.');
