/* Administrator-only acceptance on a private copy; reset keeps master records and credentials. */
var QA_CONFIG_ = null;
function masterFingerprint_(db){return hash_(JSON.stringify(['STUDENTS','ENROLMENTS','CLASSES','USERS','ASSIGNMENTS','SUBJECTS','EXAMS','GRADE_RULES'].map(function(t){return [t,db.read(t).map(function(r){var x=Object.assign({},r);delete x._row;return x;})];})));}
function acceptanceStart_(db,u,p,req){
 admin_(u);need_(p.confirmed===true,'Sahkan ujian salinan.');
 var old=db.state('acceptance:last');if(old&&old.request===req)return old;
 var original=config_(),folder=DriveApp.createFolder('MPS QA '+now_().replace(/[:.]/g,'-')),copy=db.book.copy('MPS QA - salinan ujian '+now_());DriveApp.getFileById(copy.getId()).moveTo(folder);
 var e=db.read('EXAMS').find(function(x){return x.exam_type==='UASA'&&String(x.academic_year)===String(original.year);});need_(e,'UASA belum disediakan.');
 var cls=db.read('CLASSES').filter(function(c){return bool_(c.active)&&String(c.academic_year)===String(original.year);}).sort(function(a,b){return db.marks(e.exam_id,a.class_id).length-db.marks(e.exam_id,b.class_id).length;})[0];need_(cls,'Kelas tiada.');
 function replace(t,rows){var sh=copy.getSheetByName(t),width=SCHEMA_[t].length;sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),width).clearContent();if(rows.length)sh.getRange(2,1,rows.length,width).setValues(rows.map(function(r){return SCHEMA_[t].map(function(k){return r[k]===undefined?'':r[k];});}));}
 var marks=db.marks(e.exam_id,cls.class_id).map(function(m){m=Object.assign({},m);m.score='';m.grade='';m.mark_status=bool_(m.default_tb)?'TB':'EMPTY';m.record_version=Number(m.record_version)+1;return m;});replace('MARKS',marks);
 replace('SUBMISSIONS',db.read('SUBMISSIONS').filter(function(s){return s.exam_id===e.exam_id&&s.class_id===cls.class_id;}).map(function(s){s=Object.assign({},s);s.submission_status='DRAFT';s.submitted_by='';s.submitted_at='';s.submitted_versions='';s.tb_acknowledged=false;return s;}));
 replace('CLASS_REVIEWS',db.read('CLASS_REVIEWS').filter(function(r){return r.exam_id===e.exam_id&&r.class_id===cls.class_id;}).map(function(r){r=Object.assign({},r);['class_teacher_remark','finalized_at','finalized_by','result_snapshot','pdf_file_id','pdf_url','job_lease','job_owner','job_error'].forEach(function(k){r[k]='';});r.pdf_status='NONE';return r;}));replace('_OPS',[]);replace('AUDIT_LOG',[]);
 replace('_STATE',db.read('_STATE').filter(function(r){return /^(block:|school-participation:|teacher-exam-focus:|email-pin-policy$)/.test(r.state_id);}).map(function(r){r=Object.assign({},r);if(r.state_id==='block:'+key_([e.exam_id,cls.class_id])){var b=json_(r.value,{}),offset=b.start-2;b.start=2;Object.keys(b.subjects||{}).forEach(function(k){b.subjects[k].start-=offset;});r.value=JSON.stringify(b);}return r;}));
 var report={request:req,book:copy.getId(),folder:folder.getId(),exam_id:e.exam_id,class_id:cls.class_id,class_name:cls.class_name,master_fingerprint:masterFingerprint_(db),checks:[],started:now_(),status:'RUNNING'};
 CONFIG_REQUEST_=Object.assign({},original,{spreadsheet:copy.getId(),parent:folder.getId()});
 try {
 function run(fn,actor){var q=new Db_(copy),r=fn(q);commit_(q,id_(),actor||u,{action:'acceptance'},r||{});return r;}
 function check(name,fn){need_(fn(),name);report.checks.push(name);}
 var q=new Db_(copy),assign=q.read('ASSIGNMENTS'),ctAssign=assign.find(function(a){return a.class_id===cls.class_id&&a.assignment_type==='CLASS_TEACHER'&&bool_(a.active);}),ct=q.find('USERS','user_id',ctAssign.user_id),subjects=subjectsExam_(q,e.exam_id,cls.year_level);
 check('Guru kelas disekat sebelum semua subjek dihantar',function(){return !reviewGet_(q,ct,{exam_id:e.exam_id,class_id:cls.class_id}).editable;});
 subjects.forEach(function(sub){var a=assign.find(function(a){return a.class_id===cls.class_id&&a.subject_code===sub.subject_code&&a.assignment_type==='SUBJECT_TEACHER'&&bool_(a.active);}),teacher=a?q.find('USERS','user_id',a.user_id):u;
 var rows=entryMarks_(new Db_(copy),e.exam_id,cls.class_id,sub.subject_code),context={exam_id:e.exam_id,class_id:cls.class_id,subject_code:sub.subject_code};
 if(rows.length){var bad=false;try{saveMarks_(new Db_(copy),teacher,Object.assign({},context,{changes:[{mark_id:rows[0].mark_id,version:rows[0].record_version,value:'101'}]}),id_());}catch(_){bad=true;}check('Had markah '+sub.subject_code,function(){return bad;});
 run(function(d){return saveMarks_(d,teacher,Object.assign({},context,{changes:rows.map(function(m,i){return {mark_id:m.mark_id,version:Number(m.record_version),value:i===0?'0':i===1?'100':i===2?'TH':'75'};})}),id_());},teacher);}
 rows=entryMarks_(new Db_(copy),e.exam_id,cls.class_id,sub.subject_code);
 run(function(d){return submit_(d,teacher,Object.assign({},context,{tb_acknowledged:true,all_tb_acknowledged:true,versions:rows.map(function(m){return [m.mark_id,Number(m.record_version)];})}),id_());},teacher);
 });
 check('Semua guru subjek selesai menghantar',function(){return classSubmissionGate_(new Db_(copy),e.exam_id,cls.class_id).ready;});
 var sample=new Db_(copy).marks(e.exam_id,cls.class_id).find(function(m){return m.mark_status==='SCORED';});
 run(function(d){return saveMarks_(d,ct,{exam_id:e.exam_id,class_id:cls.class_id,mode:'CLASS_REVIEW',changes:[{mark_id:sample.mark_id,version:Number(sample.record_version),value:'88',reason:'Ujian penerimaan pada salinan sahaja'}]},id_());},ct);
 var conflict=false;try{saveMarks_(new Db_(copy),ct,{exam_id:e.exam_id,class_id:cls.class_id,mode:'CLASS_REVIEW',changes:[{mark_id:sample.mark_id,version:Number(sample.record_version),value:'87',reason:'Ujian konflik'}]},id_());}catch(_){conflict=true;}check('Versi lama ditolak semasa suntingan serentak',function(){return conflict;});
 run(function(d){return remarkSave_(d,ct,{exam_id:e.exam_id,class_id:cls.class_id,changes:d.read('CLASS_REVIEWS').filter(function(r){return r.record_type==='STUDENT';}).map(function(r){return {student_id:r.student_id,version:Number(r.record_version),remark:'Ujian penerimaan sistem. Rekod salinan sahaja.'};})},id_());},ct);
 run(function(d){return finalize_(d,ct,{exam_id:e.exam_id,class_id:cls.class_id,revisionHash:readiness_(d,e.exam_id,cls.class_id).revisionHash,confirmed:true},id_());},ct);
 check('Nama pengesah guru kelas direkod',function(){return verificationView_(new Db_(copy),e.exam_id,cls.class_id).name===ct.full_name;});
 run(function(d){return pdfRetry_(d,u,{exam_id:e.exam_id,class_id:cls.class_id},id_());});report.status='PDF_QUEUED';
 }catch(err){report.status='FAILED';report.error=String(err.message||err);}finally{CONFIG_REQUEST_=original;}
 report.finished=now_();db.setState('acceptance:last',report);audit_(db,u,req,'ACCEPTANCE_COPY','_STATE','acceptance:last',null,{status:report.status,book:report.book},'Ujian pada salinan peribadi sahaja');
 if(report.status==='PDF_QUEUED'){PropertiesService.getScriptProperties().setProperty('QA_JOB',JSON.stringify({book:report.book,folder:report.folder}));ScriptApp.newTrigger('acceptanceWorker_').timeBased().after(60000).create();}
 return report;
}
async function acceptanceWorker_(){var job=json_(PropertiesService.getScriptProperties().getProperty('QA_JOB'),null);if(!job)return;CONFIG_REQUEST_=null;QA_CONFIG_={spreadsheet:job.book,parent:job.folder};try{for(var i=0;i<10;i++){await pdfStep_();var q=new Db_(SpreadsheetApp.openById(job.book)),m=q.read('CLASS_REVIEWS').find(function(r){return r.record_type==='CLASS';});if(!m||['COMPLETED','FAILED'].indexOf(m.pdf_status)>=0)break;}}finally{QA_CONFIG_=null;CONFIG_REQUEST_=null;}}
function acceptanceStatus_(db,u){admin_(u);var r=db.state('acceptance:last');if(!r)return null;var q=new Db_(SpreadsheetApp.openById(r.book)),m=metadata_(q,r.exam_id,r.class_id);return Object.assign({},r,{master_unchanged:masterFingerprint_(db)===r.master_fingerprint,pdf_status:m.pdf_status,pdf_url:m.pdf_url,pdf_error:m.job_error,validation:(q.state('pdfbuild:'+key_([m.review_id,m.pdf_revision]))||{}).validation||null});}
function resetTesting_(db,u,p,req){admin_(u);need_(p.confirmed==='RESET DATA UJIAN','Sahkan reset data ujian.');need_(!db.state('testing-reset:last'),'Reset persediaan sudah selesai; pengisian rasmi tidak boleh dikosongkan melalui alat ini lagi.');var qa=acceptanceStatus_(db,u);need_(qa&&qa.status==='PDF_QUEUED'&&qa.pdf_status==='COMPLETED'&&qa.master_unchanged,'Ujian salinan dan PDF mesti berjaya dahulu.');
 var backup=db.book.copy('MPS Sandaran sebelum reset ujian '+now_());var before=masterFingerprint_(db),now=now_(),marks=0;
 db.read('MARKS').forEach(function(m){m.score='';m.grade='';m.mark_status=bool_(m.default_tb)?'TB':'EMPTY';m.record_version=Number(m.record_version)+1;m.updated_by=u.user_id;m.updated_at=now;m.amendment_reason='';db.put('MARKS',m);marks++;});
 db.read('SUBMISSIONS').forEach(function(s){s.submission_status='DRAFT';s.revision=Number(s.revision||0)+1;['submitted_by','submitted_at','submitted_versions','amended_by','amended_at'].forEach(function(k){s[k]='';});s.tb_acknowledged=false;db.put('SUBMISSIONS',s);});
 db.read('CLASS_REVIEWS').forEach(function(r){['class_teacher_remark','remark_updated_at','finalized_by','finalized_at','result_snapshot','pdf_file_id','pdf_url','job_lease','job_owner','job_error'].forEach(function(k){r[k]='';});r.record_version=Number(r.record_version||0)+1;r.class_finalization_revision=Number(r.class_finalization_revision||0)+1;r.pdf_status='NONE';r.pdf_revision=0;r.job_attempts=0;db.put('CLASS_REVIEWS',r);});
 db.read('_STATE').filter(function(r){return /^(class-verification:|pdfbuild:|session:|pin-change:|rate:)/.test(r.state_id);}).forEach(function(r){db.setState(r.state_id,null);});
 need_(masterFingerprint_(db)===before,'Data induk berubah. Reset dihentikan.');var result={reset:true,marks:marks,master_unchanged:true,backup:backup.getUrl(),at:now};db.setState('testing-reset:last',result);audit_(db,u,req,'TESTING_RESET','MARKS','ALL',null,result,'Reset ujian selepas sandaran; data induk dan kelayakan dikekalkan');return result;
}

function acceptancePdfQueue_(db,u,p,req){admin_(u);var r=db.state('acceptance:last');need_(r&&r.status==='PDF_QUEUED','Ujian markah belum berjaya.');PropertiesService.getScriptProperties().setProperty('QA_JOB',JSON.stringify({book:r.book,folder:r.folder}));ScriptApp.newTrigger('acceptanceWorker_').timeBased().after(1000).create();return {queued:true};}
