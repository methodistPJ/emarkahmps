import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
import JSZip from 'jszip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const C=JSON.parse(await fs.readFile(path.join(root,'tools/setup-contract.json'),'utf8'));
const ctx=vm.createContext({});vm.runInContext(await fs.readFile(path.join(root,'src/Config.js'),'utf8'),ctx);
const subjects=JSON.parse(JSON.stringify(ctx.SUBJECT_SEED_));
const wb=Workbook.create(),out=path.join(root,'assets');await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(root,'tests/artifacts/workbook'),{recursive:true});
const navy='#172B4D',blue='#3563E9',gold='#D9A441',ivory='#F8F9FC';
const classes=Array.from({length:6},(_,i)=>({class_id:`DEMO-${i+1}H`,class_name:`${i+1} Hibiscus (CONTOH)`,academic_year:2026,year_level:i+1,active:true}));
classes.push({class_id:'DEMO-1J',class_name:'1 Jasmine (CONTOH)',academic_year:2026,year_level:1,active:true});
const teachers=[{teacher_ref:'DEMO-T01',full_name:'Nur Amani Binti Contoh',identification_code:'025849',account_alias:'',active:true,role:'CLASS_TEACHER|SUBJECT_TEACHER'},{teacher_ref:'DEMO-T02',full_name:'Daniel Contoh Kumar',identification_code:'004216',account_alias:'jasmine',active:true,role:'CLASS_TEACHER|SUBJECT_TEACHER'}];
const data={
 '01_SCHOOL':[{school_name:'SK Methodist Petaling Jaya',academic_year:2026,headmistress_name:'Nama Guru Besar (GANTI CONTOH)',grading_version:'v1',template_version:'replacement-v1'}],
 '02_CLASSES':classes,
 '03_STUDENTS':classes.flatMap((c,i)=>Array.from({length:2},(_,n)=>({student_id:`DEMO-S${String(i*2+n+1).padStart(3,'0')}`,full_name:`${['Alya','Ben','Chloe','Danish','Elisa','Farhan','Grace','Haziq','Iris','Johan','Kiran','Liyana','Mei','Naufal'][i*2+n]} Contoh`,class_id:c.class_id,start_date:new Date('2026-01-12T00:00:00Z'),student_status:'ACTIVE',enrolment_status:'ACTIVE'}))),
 '04_TEACHERS':teachers,
 '05_CLASS_TEACHERS':classes.map((c,i)=>({class_id:c.class_id,teacher_ref:i%2?'DEMO-T02':'DEMO-T01',academic_year:2026,active:true})),
 '06_SUBJECT_ASSIGNMENTS':classes.flatMap((c,i)=>subjects.filter((s,j)=>c.year_level>=4||j<12).map((s,j)=>({class_id:c.class_id,subject_code:s[0],teacher_ref:(i+j)%2?'DEMO-T02':'DEMO-T01',academic_year:2026,active:true}))),
 '07_SUBJECTS':subjects.map((s,i)=>({subject_code:s[0],subject_name:s[1],offered_year_levels:i>=12?'4,5,6':'1,2,3,4,5,6',display_order:i+1,default_status:['PI','PM','BA','BC','BT'].includes(s[0])?'TB':'EMPTY',active:true})),
 '08_EXAMS':[{academic_year:2026,exam_type:'UPSA',opening_date:new Date('2026-04-20T00:00:00Z'),closing_date:new Date('2026-05-29T00:00:00Z'),grading_version:'v1',template_version:'replacement-v1',intended_status:'DRAFT'},{academic_year:2026,exam_type:'UASA',opening_date:new Date('2026-10-12T00:00:00Z'),closing_date:new Date('2026-11-20T00:00:00Z'),grading_version:'v1',template_version:'replacement-v1',intended_status:'DRAFT'}]
};
const labels={'01_SCHOOL':'Tetapan sekolah','02_CLASSES':'Kelas','03_STUDENTS':'Murid dan enrolmen','04_TEACHERS':'Akaun guru','05_CLASS_TEACHERS':'Guru kelas','06_SUBJECT_ASSIGNMENTS':'Guru mata pelajaran','07_SUBJECTS':'Subjek backend','08_EXAMS':'Peperiksaan'};
const widths={full_name:36,school_name:38,headmistress_name:42,class_name:30,identification_code:24,account_alias:20,teacher_ref:20,student_id:20,class_id:20,subject_name:42,offered_year_levels:28,role:46,template_version:25,grading_version:22,intended_status:23,opening_date:23,closing_date:23,enrolment_status:25,student_status:23,academic_year:22};
for(const name of C.requiredSheets){const s=wb.worksheets.add(name);s.showGridLines=false;s.getRange('A1:L65').format.font={name:'Arial',size:11,color:navy};s.getRange('A1:L65').format.verticalAlignment='center';s.tabColor=name==='00_START_HERE'?navy:name==='09_VALIDATION_REFERENCE'?gold:blue;
 if(C.sheets[name]){
  const fields=C.sheets[name],rows=data[name];s.getRange('A1').values=[[labels[name]]];s.getRange('A1').format.font={name:'Arial',size:17,bold:true,color:navy};
  s.getRange('A2').values=[['DATA CONTOH REKAAN. Ganti semua baris DEMO sebelum import sekolah. Header pada baris 4 mesti dikekalkan.']];s.getRange('A2:L2').merge();s.getRange('A2:L2').format.font={name:'Arial',size:10,color:'#8B5410'};s.getRange('A2:L2').format.fill='#FFF4DB';s.getRange('A2:L2').format.rowHeight=25;
  s.getRangeByIndexes(3,0,1,fields.length).values=[fields];s.getRangeByIndexes(3,0,1,fields.length).format={fill:navy,font:{name:'Arial',size:11,color:'#FFFFFF',bold:true},rowHeight:36,wrapText:true,horizontalAlignment:'center'};
  s.getRangeByIndexes(4,0,rows.length,fields.length).values=rows.map(r=>fields.map(f=>r[f]));s.getRangeByIndexes(4,0,rows.length,fields.length).format.rowHeight=25;s.getRangeByIndexes(4,0,rows.length,fields.length).format.fill=ivory;
  fields.forEach((f,i)=>{const range=s.getRangeByIndexes(4,i,2000,1);range.format.columnWidth=widths[f]||21;if(/_id$|_ref$/.test(f)||f==='identification_code'||f==='account_alias')range.setNumberFormat('@');if(f==='start_date'||f==='opening_date'||f==='closing_date')range.setNumberFormat('yyyy-mm-dd');if(f==='active')range.dataValidation={rule:{type:'list',values:['TRUE','FALSE']}};if(f==='year_level')range.dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:6}};if(f==='student_status')range.dataValidation={rule:{type:'list',values:['ACTIVE','LEFT','GRADUATED']}};if(f==='enrolment_status')range.dataValidation={rule:{type:'list',values:['ACTIVE','ENDED']}};if(f==='role')range.dataValidation={rule:{type:'list',values:['CLASS_TEACHER','SUBJECT_TEACHER','CLASS_TEACHER|SUBJECT_TEACHER']}};if(f==='exam_type')range.dataValidation={rule:{type:'list',values:['UPSA','UASA']}};if(f==='intended_status')range.dataValidation={rule:{type:'list',values:['DRAFT','PREPARE','OPEN']}};if(f==='default_status')range.dataValidation={rule:{type:'list',values:['TB','EMPTY']}};if(f==='class_id'&&name!=='02_CLASSES')range.dataValidation={rule:{type:'list',formula1:"'02_CLASSES'!$A$5:$A$64"}};if(f==='teacher_ref'&&name!=='04_TEACHERS')range.dataValidation={rule:{type:'list',formula1:"'04_TEACHERS'!$A$5:$A$304"}};if(f==='subject_code'&&name!=='07_SUBJECTS')range.dataValidation={rule:{type:'list',formula1:"'07_SUBJECTS'!$A$5:$A$18"}};});s.freezePanes.freezeRows(4);
 }else{
  s.getRange('A:A').format.columnWidth=6;s.getRange('B:B').format.columnWidth=42;s.getRange('C:G').format.columnWidth=18;s.getRange('B2:G2').merge();s.getRange('B2').values=[[name==='00_START_HERE'?'MPS e-Assessment':'Rujukan validasi']];s.getRange('B2').format.font={name:'Arial',size:20,bold:true,color:navy};
  const notes=name==='00_START_HERE'?[
   ['Satu workbook untuk persediaan sekolah','Templat 2026. Semua nama, kod dan kelas DEMO ialah data rekaan.'],
   ['1. Ganti data contoh','Padam/ganti SEMUA baris DEMO dalam setiap worksheet input. Jangan import contoh ke database sebenar.'],
   ['2. Lengkapkan sekolah dan kelas','Gunakan tahun aktif. Kelas Tahun 1–6. Isi semua kolum kecuali account_alias boleh kosong.'],
   ['3. Lengkapkan murid dan guru','ID murid/class/ref serta enam digit pengenalan mesti teks. Contoh 025849 mengekalkan sifar awal.'],
   ['4. Padankan tugasan','teacher_ref mesti sama antara 04_TEACHERS dan worksheet tugasan. Satu guru boleh mengajar banyak subjek/kelas.'],
   ['5. Semak subjek dan exam','14 kod backend disediakan. Tahap 1:12 subjek; Tahap 2:14. PI/PM/BA/BC/BT bermula TB. Semak tarikh contoh.'],
   ['6. Upload dan validasi','Pentadbiran > Import: upload sekali, baca ralat/pratonton dan sahkan. Tiada perubahan sekolah sebelum commit disahkan.'],
   ['7. Aktifkan guru','Pentadbir mengesahkan identiti guru dan mengeluarkan kod individu sekali guna secara peribadi. Kod luput 48 jam.'],
   ['PIN sementara BBB8307','Guru baharu gunakan aliran Aktifkan Akaun, kod individu, kemudian tetapkan PIN sendiri 10–64 aksara. Tiada akses markah sebelum itu.'],
   ['Hasil import lengkap','Kelas, murid/enrolmen, akaun, tugasan, subjek dan exam didaftarkan. Readiness menyenaraikan perkara yang masih perlu diselesaikan.'],
   ['Import semula dengan selamat','Baris hilang tidak dipadam. PIN akaun sedia ada kekal. Pindaan sejarah/cohort disediakan ditolak untuk semakan manual.'],
   ['Warna dan perlindungan','Navy: header. Ivory: input. Gold: arahan/rujukan. Header/reference dilindungi daripada suntingan tersilap.'],
   ['Jangan isi rahsia','Tiada kolum PIN, kod pengaktifan, token, hash, Script ID, Spreadsheet ID atau AUTH_PEPPER dibenarkan.']
  ]:[
   ['Input bermula baris 5','Baris 4 ialah header tepat. Kolum boleh diatur semula tetapi nama header tidak boleh berubah. Jangan tambah formula.'],
   ['Identiti','student_id, class_id dan teacher_ref: teks stabil 1–80 aksara. Kod guru: tepat enam digit teks. Alias: a-z,0-9,_, - maksimum30.'],
   ['Status','active: TRUE/FALSE. Murid: ACTIVE/LEFT/GRADUATED. Enrolmen: ACTIVE/ENDED.'],
   ['Peranan','CLASS_TEACHER, SUBJECT_TEACHER atau CLASS_TEACHER|SUBJECT_TEACHER. Workbook tidak memberikan peranan pentadbir.'],
   ['Exam','UPSA/UASA. intended_status: DRAFT/PREPARE/OPEN ialah niat. Import tidak membuka exam; semak readiness dan sahkan prepare/open.'],
   ['Tarikh','Sel tarikh Excel biasa atau teks ISO yyyy-mm-dd. Datetime ISO mesti menggunakan Z atau +08:00. Sistem tarikh1904 ditolak.'],
   ['Pendua','ID/kod+alias/ref/tugasan berulang dalam worksheet ditolak. Nama murid berulang diberi amaran untuk semakan identiti.'],
   ['Konflik','Pertukaran enrolmen, deaktivasi akaun atau pertukaran guru sedia ada ditolak. Tiada pemadaman tersirat.'],
   ['Cakupan','BM,BI,MM,SN,PI,PM,BA,BC,BT,PJPK,MZ,PSV: Tahun1–6. SEJ,RBT: Tahun4–6.'],
   ['Had','8MB fail ZIP,40MB expanded,10,000 rekod input,2000 murid,300 guru,60 kelas. Setiap kelas maksimum60 murid aktif.'],
   ['Sumber peraturan','Kod/coverage/status daripada src/Config.js dan src/Setup.js v1.0.2; kontrak header sama dengan parser/backend v1.0.3.']
  ];
  let row=5;for(const [title,body]of notes){s.getRange(`B${row}:G${row}`).merge();s.getRange(`B${row}`).values=[[title]];s.getRange(`B${row}`).format.font={name:'Arial',size:11,bold:true,color:blue};s.getRange(`B${row+1}:G${row+2}`).merge();s.getRange(`B${row+1}`).values=[[body]];s.getRange(`B${row+1}:G${row+2}`).format.wrapText=true;s.getRange(`B${row+1}:G${row+2}`).format.rowHeight=23;row+=4;}
 }
}
wb.recalculate();
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:3000})).ndjson);
for(const name of C.requiredSheets){const range=C.sheets[name]?`A1:${String.fromCharCode(64+C.sheets[name].length)}${Math.min(10,4+data[name].length)}`:'B2:G17';const preview=await wb.render({sheetName:name,range,scale:1,format:'png'});await fs.writeFile(path.join(root,'tests/artifacts/workbook',name+'.png'),new Uint8Array(await preview.arrayBuffer()));}
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(path.join(out,'MPS-eAssessment-School-Setup-2026.xlsx'));
// The artifact API has no worksheet protection surface. Add native OOXML protection
// after export using JSZip; reference/header cells locked, input cells unlocked.
const target=path.join(out,'MPS-eAssessment-School-Setup-2026.xlsx');
const zip=await JSZip.loadAsync(await fs.readFile(target));
let styles=await zip.file('xl/styles.xml').async('string');
const cellXfs=/<x:cellXfs\b[^>]*>([\s\S]*?)<\/x:cellXfs>/.exec(styles);
const xfs=cellXfs[1].match(/<x:xf\b[^>]*\/>|<x:xf\b[^>]*>[\s\S]*?<\/x:xf>/g),unlocked=new Map();
const additions=xfs.map((xf,i)=>{unlocked.set(i,xfs.length+i);const clean=xf.replace(/\sapplyProtection="[^"]*"/g,'').replace(/<x:protection\b[^>]*\/>/g,'');return clean.endsWith('/>')?clean.slice(0,-2)+' applyProtection="1"><x:protection locked="0"/></x:xf>':clean.replace(/<x:xf\b/,'<x:xf applyProtection="1"').replace('</x:xf>','<x:protection locked="0"/></x:xf>');});
styles=styles.replace(cellXfs[0],`<x:cellXfs count="${xfs.length+additions.length}">${xfs.join('')}${additions.join('')}</x:cellXfs>`);zip.file('xl/styles.xml',styles);
for(let index=0;index<C.requiredSheets.length;index++){
 const name=C.requiredSheets[index],part=`xl/worksheets/sheet${index+1}.xml`;let xml=await zip.file(part).async('string');
 if(C.sheets[name])xml=xml.replace(/<x:c\b([^>]*?)(\/?)>/g,(all,attrs,closed)=>{const row=Number(/\br="[A-Z]+(\d+)"/.exec(attrs)?.[1]);if(row<5)return all;const existing=Number(/\bs="(\d+)"/.exec(attrs)?.[1]||0);return '<x:c'+attrs.replace(/\ss="\d+"/,'')+` s="${unlocked.get(existing)}"${closed}>`;});
 xml=xml.replace('</x:sheetData>','</x:sheetData><x:sheetProtection sheet="1" objects="1" scenarios="1"/>');zip.file(part,xml);
}
await fs.writeFile(target,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
await fs.writeFile(path.join(root,'client/school-template.js'),'window.MPS_SCHOOL_TEMPLATE='+JSON.stringify((await fs.readFile(target)).toString('base64'))+';\n');
console.log('Exported the complete fictional school workbook and ten sheet previews.');
