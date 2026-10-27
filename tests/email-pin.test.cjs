const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {context:c,db,book,admin,teacher,ct,mutate,props}=require('./backend.test.cjs');
const salt='mock-unique-salt',derive=pin=>crypto.pbkdf2Sync(pin,salt,600000,32,'sha256').toString('base64url');
book.getSheetByName('USERS').getRange(1,11).setValue('email');
mutate(d=>{for(const [u,name,email] of [[admin,'Muhaimin Fixture','mu@example.test'],[teacher,'Aliyah Fixture','ali@example.test'],[ct,'Teacher Fixture','teacher@example.test']]){const r=d.find('USERS','user_id',u.user_id);r.full_name=name;r.email=email;r.identification_code=u.user_id.toUpperCase();r.roles=JSON.stringify(u===ct?['CLASS_TEACHER']:['ADMINISTRATOR','SUBJECT_TEACHER']);r.authentication_data=JSON.stringify({salt,iterations:600000,digest:c.hmac_('pin:'+derive('BBB8307')),must_change:true});d.put('USERS',r);}});
let plan=c.accountsPlan_(db(),admin);assert.equal(plan.issues.length,0);assert.equal(plan.special.length,2);assert.equal(db().find('USERS','user_id',ct.user_id).email,'teacher@example.test');
assert.equal(c.challenge_(db(),{code:' MU@EXAMPLE.TEST '}).salt,salt);
const before=book.getSheetByName('MARKS').cells.map(r=>[...r]);
mutate(d=>c.accountsUpgrade_(d,admin,{fingerprint:plan.fingerprint,proofs:plan.special.map(id=>({user_id:id,salt,proof:derive('000000')}))},crypto.randomUUID().replaceAll('-','')));
let session=c.login_(db(),{code:'mu@example.test',proof:derive('000000')});assert.ok(session.token);assert.equal(c.session_(db(),session.token).user_id,admin.user_id);
let ticket=c.login_(db(),{code:'teacher@example.test',proof:derive('BBB8307')});assert.equal(ticket.change_required,true);assert.equal(ticket.token,undefined);assert.throws(()=>c.pinChangeFinish_(db(),{ticket:ticket.ticket,salt,proof:derive('12345'),pin_length:5}));
assert.equal(c.pinChangeFinish_(db(),{ticket:ticket.ticket,salt,proof:derive('012345'),pin_length:6}).changed,true);assert.throws(()=>c.pinChangeFinish_(db(),{ticket:ticket.ticket,salt,proof:derive('012345'),pin_length:6}));
session=c.login_(db(),{code:'teacher@example.test',proof:derive('012345')});assert.ok(session.token);assert.equal(c.session_(db(),session.token).user_id,ct.user_id);
assert.deepEqual(book.getSheetByName('MARKS').cells,before);
assert.throws(()=>c.accountsUpgrade_(db(),ct,{},'x'));assert.throws(()=>c.pdfReference_(db(),ct,{exam_id:'UPSA',class_id:'C4'}));
// Simulate new physical layout after migration. Credentials and lookup still work.
const sheet=book.getSheetByName('USERS');sheet.deleteColumn=n=>sheet.cells.forEach(r=>r.splice(n-1,1));sheet.showColumns=()=>{};sheet.hideColumns=()=>{};sheet.setColumnWidth=()=>{};
c.accountsLayout_(book);c.accountsLayout_(book);assert.equal(sheet.cells[0][3],'email');assert.equal(sheet.cells[0].includes('account_alias'),false);
assert.equal(db().find('USERS','user_id',ct.user_id).account_alias,'');assert.equal(db().find('USERS','user_id',ct.user_id).email,'teacher@example.test');
mutate(d=>{const r=d.find('USERS','user_id',ct.user_id);r.email='new@example.test';d.put('USERS',r);});assert.ok(c.login_(db(),{code:'new@example.test',proof:derive('012345')}).token);
console.log('PASS email layout compatibility, direct email edits, unique account validation, 000000 leading zeros, limited first-login ticket, six-digit change/replay rejection, preserved marks and admin-only PDF.');
// Stable reads execute without acquiring the shared write lock; overlapping writes retry under lock.
props.READ_EPOCH=JSON.stringify({id:'stable',busy:false});let locks=0;const oldLock=c.LockService.getScriptLock;c.LockService.getScriptLock=()=>{locks++;return oldLock();};assert.equal(c.consistentRead_(()=>42),42);assert.equal(locks,0);assert.equal(c.consistentRead_(()=>{props.READ_EPOCH=JSON.stringify({id:'changed',busy:false});return 9;}),9);assert.equal(locks,1);
console.log('PASS stable reads avoid global lock; changed epoch falls back to serialized recovery.');
