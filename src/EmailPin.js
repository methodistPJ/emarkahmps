/* Email is readable account data; credentials remain salted PBKDF2 + server HMAC. */
function pinChangeTicket_(db,u,target){
  var a=json_(u.authentication_data,{}),ticket=hmac_('pin-change:'+id_()+':'+id_()),expires=Date.now()+600000;
  db.setState('pin-change:'+hash_(ticket),{user_id:u.user_id,version:u.auth_version,digest:a.digest,expires:expires,target:target});
  commit_(db,id_(),u,{action:'pinChangeTicket'},{});
  return {change_required:true,ticket:ticket,salt:a.salt,iterations:a.iterations,expires:expires};
}
function pinChangeFinish_(db,p){
  need_(/^[A-Za-z0-9_-]{43}$/.test(p.ticket||''),'Tiket tidak sah.');
  var key='pin-change:'+hash_(p.ticket),t=db.state(key),u=t&&db.find('USERS','user_id',t.user_id),a=u?json_(u.authentication_data,{}):{};
  need_(t&&t.expires>Date.now()&&u&&bool_(u.active)&&String(t.version)===String(u.auth_version)&&equal_(t.digest||'',a.digest||''),'Tiket tamat tempoh atau akaun telah berubah. Log masuk semula.');
  activationRate_(db,t.target);onboardingWritable_(db);
  need_(p.pin_length===6&&/^[A-Za-z0-9_-]{43}$/.test(p.proof||'')&&p.salt===a.salt,'PIN baharu mesti enam digit.');
  need_(!equal_(hmac_('pin:'+p.proof),a.digest),'Pilih PIN baharu yang berbeza.');
  u.authentication_data=JSON.stringify({algorithm:'PBKDF2-SHA256+HMAC-SHA256',iterations:a.iterations,salt:a.salt,digest:hmac_('pin:'+p.proof),pin_policy:6});
  u.auth_version=Number(u.auth_version)+1;u.updated_at=now_();db.put('USERS',u);db.setState(key,null);
  audit_(db,u,id_(),'PIN_CHANGED','USERS',u.user_id,null,{pin_policy:6},'PIN tidak direkod.');
  commit_(db,id_(),u,{action:'pinChangeFinish'},{changed:true});return {changed:true};
}
function accountsPlan_(db,u){
  admin_(u);var users=db.read('USERS').filter(function(x){return bool_(x.active);}),seen={},issues=[];
  users.forEach(function(x){var e=String(x.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))issues.push('Emel tidak sah/kosong: '+x.full_name);else if(seen[e])issues.push('Emel berulang: '+e);seen[e]=true;if(x.account_alias)issues.push('Alias bukan kosong: '+x.full_name);});
  var special=users.filter(function(x){var n=String(x.full_name).toUpperCase().replace(/[^A-Z]/g,'');return role_(x,'ADMINISTRATOR')&&(n.indexOf('MUHAIMIN')>=0||n.indexOf('ALIYAH')>=0);});
  if(special.length!==2)issues.push('Semak dua akaun pentadbir Muhaimin dan Aliyah.');
  return {enabled:!!db.state('email-pin-policy'),issues:issues,users:users.map(function(x){return {user_id:x.user_id,name:x.full_name,email:x.email,salt:json_(x.authentication_data,{}).salt,iterations:json_(x.authentication_data,{}).iterations};}),special:special.map(function(x){return x.user_id;}),fingerprint:hash_(canonicalJson_(users.map(function(x){return [x.user_id,x.email,x.auth_version,x.roles];})))};
}
function accountsUpgrade_(db,u,p,req){
  var plan=accountsPlan_(db,u);need_(!plan.enabled,'Migrasi telah dilaksanakan. Gunakan Reset PIN untuk perubahan seterusnya.');need_(!plan.issues.length,plan.issues.join('; '));need_(p.fingerprint===plan.fingerprint,'Akaun telah berubah. Muat semula semakan.');
  need_(Array.isArray(p.proofs)&&p.proofs.length===2,'Dua bukti PIN pentadbir diperlukan.');
  plan.special.forEach(function(id){var user=db.find('USERS','user_id',id),old=json_(user.authentication_data,{}),proof=p.proofs.filter(function(x){return x.user_id===id;});need_(proof.length===1&&proof[0].salt===old.salt&&/^[A-Za-z0-9_-]{43}$/.test(proof[0].proof||''),'Bukti PIN tidak sepadan.');user.authentication_data=JSON.stringify({algorithm:'PBKDF2-SHA256+HMAC-SHA256',iterations:old.iterations,salt:old.salt,digest:hmac_('pin:'+proof[0].proof),pin_policy:6});user.auth_version=Number(user.auth_version)+1;user.updated_at=now_();db.put('USERS',user);audit_(db,u,req,'ADMIN_PIN_SET','USERS',id,null,{pin_policy:6},'Permintaan pentadbir; tiada PIN raw disimpan.');});
  db.setState('email-pin-policy',{enabled:true,at:now_()});audit_(db,u,req,'EMAIL_PIN_UPGRADE','USERS','all',null,{count:plan.users.length},'Markah dan tugasan dikekalkan.');return {upgraded:true,count:plan.users.length};
}
function accountsLayout_(book){
  var s=book.getSheetByName('USERS'),last=s.getLastRow(),headers=s.getRange(1,1,1,11).getValues()[0];
  if(headers[3]==='email'){if(headers[10]==='email')s.deleteColumn(11);return;}
  need_(headers[3]==='account_alias'&&headers[10]==='email','Struktur akaun tidak sepadan.');
  var rows=s.getRange(1,1,last,11).getValues().map(function(r,i){if(!i){r[3]='email';return r.slice(0,10);}need_(!r[3],'Alias sedia ada tidak boleh dibuang.');r[3]=r[10];return r.slice(0,10);});
  s.getRange(1,3,last,1).setNumberFormat('@');s.getRange(1,1,last,10).setValues(rows);s.deleteColumn(11);
  s.showColumns(4);s.hideColumns(1);s.hideColumns(5);s.hideColumns(8,3);s.setColumnWidth(4,280);
}
function resetPin_(db,u,p,req){admin_(u);var target=db.find('USERS','user_id',p.user_id),a=target?json_(target.authentication_data,{}):{};need_(target&&bool_(target.active)&&p.salt===a.salt&&/^[A-Za-z0-9_-]{43}$/.test(p.proof||''),'Akaun atau bukti reset tidak sah.');target.authentication_data=JSON.stringify({algorithm:'PBKDF2-SHA256+HMAC-SHA256',iterations:a.iterations,salt:a.salt,digest:hmac_('pin:'+p.proof),must_change:true});target.auth_version=Number(target.auth_version)+1;target.updated_at=now_();db.put('USERS',target);audit_(db,u,req,'PIN_RESET','USERS',target.user_id,null,{must_change:true},'Sesi terdahulu dibatalkan.');return {reset:true};}
