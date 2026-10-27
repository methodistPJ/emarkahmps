/* Browser PBKDF2-SHA256(600000) + server HMAC pepper. Derived key is a credential. */
function validLoginCode_(code) {
  return /^(?:[0-9]{6}|[A-Z][A-Z0-9_-]{1,29})$/.test(code);
}
function authSalt_(code, alias) {
  return hmac_('salt:' + String(code).trim().toUpperCase() + ':' + alias);
}

function authTarget_(p, db) {
  if(db&&String(p.code||'').indexOf('@')>=0){var email=String(p.code).trim().toLowerCase();need_(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Masukkan emel yang sah.');var matches=db.read('USERS').filter(function(u){return bool_(u.active)&&String(u.email||'').toLowerCase()===email;});p.code=matches.length===1?matches[0].identification_code:'UNKNOWN_EMAIL';p.alias='';}

  p.code = String(p.code || '').trim().toUpperCase();
  need_(validLoginCode_(p.code), 'Masukkan kod guru yang diberikan pentadbir.');
  need_(/^[a-z0-9_-]{0,30}$/.test(p.alias || ''), 'Alias akaun tidak sah.');
  return key_([p.code, p.alias || '']);
}

function authRate_(db, target) {
  var r = db.state('rate:' + target) || {
    n: 0,
    until: 0
  };
  if (r.until > Date.now()) fail_('COOLDOWN', 'Terlalu banyak cubaan. Cuba selepas 15 minit.');
  return r;
}

function challenge_(db, p) {
  var t = authTarget_(p, db);
  authRate_(db, t);
  return {
    salt: (function(){var u=db.read('USERS').filter(function(r){return r.identification_code===p.code&&String(r.account_alias||'')===(p.alias||'');});return u.length===1?json_(u[0].authentication_data,{}).salt||authSalt_(p.code,p.alias||''):authSalt_(p.code,p.alias||'');})(),
    iterations: config_().iterations
  };
}

function login_(db, p) {
  var target = authTarget_(p, db),
    rate = authRate_(db, target),
    global = db.state('global-login') || {
      n: 0,
      start: Date.now()
    };
  if (Date.now() - global.start > 60000) global = {
    n: 0,
    start: Date.now()
  };
  need_(global.n < 60, 'Cubaan log masuk terlalu kerap. Cuba semula sebentar lagi.');
  global.n++;
  db.setState('global-login', global);
  var users = db.read('USERS').filter(function(u) {
    return String(u.identification_code) === p.code && String(u.account_alias || '') === (p.alias || '');
  });
  var u = users.length === 1 ? users[0] : null,
    a = u ? json_(u.authentication_data, {}) : {};
  var valid = /^[A-Za-z0-9_-]{43}$/.test(p.proof || '') && u && bool_(u.active) && equal_(a.digest || '',
    hmac_('pin:' + p.proof));
  if (!valid) {
    rate.n++;
    if (rate.n >= 5) {
      rate.until = Date.now() + 900000;
      rate.n = 0;
    }
    db.setState('rate:' + target, rate);
    commit_(db, id_(), {
      user_id: 'AUTH'
    }, p, {
      ok: false
    });
    fail_('AUTH', 'Emel atau PIN tidak sah.');
  }
  db.setState('rate:' + target, {
    n: 0,
    until: 0
  });
  if(db.state('email-pin-policy')&&(a.must_change||a.pin_policy!==6))return pinChangeTicket_(db,u,target);
  if(a.must_change)fail_('ONBOARDING_REQUIRED','Akaun baharu mesti diaktifkan dan menetapkan PIN individu dahulu.');
  var token = hmac_('session:' + id_() + ':' + id_() + ':' + Date.now()),
    digest = hash_(token),
    expires = Date.now() + config_().sessionMinutes * 60000;
  db.setState('session:' + digest, {
    user: u.user_id,
    version: u.auth_version,
    expires: expires
  });
  commit_(db, id_(), u, {
    action: 'login'
  }, {});
  return {
    token: token,
    expires: expires,
    user: publicUser_(u)
  };
}

function session_(db, token) {
  need_(/^[A-Za-z0-9_-]{43}$/.test(token || ''), 'Sesi tamat. Sila log masuk semula.');
  var session = db.state('session:' + hash_(token)),
    u = session && db.find('USERS', 'user_id', session.user);
  if (!u || !bool_(u.active) || !Number.isFinite(Number(session.expires)) || !session.expires || session.expires < Date.now() || String(session.version) !== String(u
      .auth_version)) fail_('SESSION', 'Sesi tamat atau telah dibatalkan. Sila log masuk semula.');
  if(json_(u.authentication_data,{}).must_change)fail_('ONBOARDING_REQUIRED','Lengkapkan pengaktifan sebelum menggunakan workspace.');
  return u;
}

function publicUser_(u) {
  return {
    user_id: u.user_id,
    full_name: u.full_name,
    roles: json_(u.roles, [])
  };
}

function userSave_(db, u, p, req) {
  admin_(u);
  var old = p.user_id && db.find('USERS', 'user_id', p.user_id),
    r = old ? Object.assign({}, old) : {
      user_id: id_(),
      auth_version: 1,
      created_at: now_()
    };
  r.full_name = text_(p.full_name, 120);
  r.identification_code = String(p.identification_code).trim().toUpperCase();
  need_(validLoginCode_(r.identification_code), 'Kod guru mesti 2–30 aksara huruf/angka, _ atau -, atau enam digit untuk akaun lama.');
  r.account_alias = String(p.account_alias || '');
  need_(/^[a-z0-9_-]{0,30}$/.test(r.account_alias), 'Alias tidak sah.');
  need_(!db.read('USERS').some(function(x) {
    return x.user_id !== r.user_id && x.identification_code === r.identification_code && (x
      .account_alias || '') === r.account_alias;
  }), 'Kod pengenalan bertindih. Gunakan alias unik bagi setiap akaun bertindih.');
  var roles = p.roles;
  need_(Array.isArray(roles) && roles.length > 0 && roles.every(function(x) {
    return ['ADMINISTRATOR', 'CLASS_TEACHER', 'SUBJECT_TEACHER'].indexOf(x) >= 0;
  }), 'Peranan tidak sah.');
  r.roles = JSON.stringify(roles);
  r.active = p.active !== false;
  r.updated_at = now_();
  if (p.proof) {
    need_(/^[A-Za-z0-9_-]{43}$/.test(p.proof), 'PIN verifier tidak sah.');
    need_(p.salt === authSalt_(r.identification_code, r.account_alias), 'Salt berubah; jana semula PIN.');
    r.authentication_data = JSON.stringify({
      algorithm: 'PBKDF2-SHA256+HMAC-SHA256',
      iterations: config_().iterations,
      salt: p.salt,
      digest: hmac_('pin:' + p.proof)
    });
    r.auth_version = Number(r.auth_version) + 1;
  } else need_(old && old.identification_code === r.identification_code && old.account_alias === r
    .account_alias, 'Tetapkan PIN baharu untuk akaun atau pengenalan baharu.');
  if (p.revoke || old && (!r.active || old.roles !== r.roles)) r.auth_version = Number(r.auth_version) + 1;
  if (old && role_(old, 'ADMINISTRATOR') && (!r.active || roles.indexOf('ADMINISTRATOR') < 0)) need_(db.read(
    'USERS').some(function(x) {
    return x.user_id !== r.user_id && bool_(x.active) && role_(x, 'ADMINISTRATOR');
  }), 'Pentadbir aktif terakhir tidak boleh dinyahaktifkan.');
  db.put('USERS', r);
  audit_(db, u, req, 'USER_SAVE', 'USERS', r.user_id, old ? publicUser_(old) : null, publicUser_(r),
    'Pengurusan akaun; rahsia tidak direkod.');
  return publicUser_(r);
}
