function onboardingWritable_(db){var archive=db.state('archive:'+config_().year);need_(!archive||['QUEUED','PROCESSING'].indexOf(archive.status)<0,'Tahun sedang diarkibkan. Cuba semula selepas selesai.');}
/* Temporary credentials never yield a workspace session. Activation capabilities are separately hashed. */
function activationRate_(db, target) {
  authRate_(db, 'activate:' + target);
  var g = db.state('activation-global') || {
    n: 0,
    start: Date.now()
  };
  if (Date.now() - g.start > 60000) g = {
    n: 0,
    start: Date.now()
  };
  need_(g.n < 60, 'Terlalu banyak cubaan pengaktifan. Cuba sebentar lagi.');
  g.n++;
  db.setState('activation-global', g);
}

function activationFail_(db, target) {
  var r = db.state('rate:activate:' + target) || {
    n: 0,
    until: 0
  };
  r.n++;
  if (r.n >= 5) {
    r.n = 0;
    r.until = Date.now() + 900000;
  }
  db.setState('rate:activate:' + target, r);
  audit_(db, {
    user_id: 'AUTH'
  }, id_(), 'ACTIVATION_REJECTED', 'USERS', 'redacted', null, {
    rejected: true
  }, 'Maklumat pengaktifan tidak direkod.');
  commit_(db, id_(), {
    user_id: 'AUTH'
  }, {
    action: 'activationRejected'
  }, {});
  fail_('ACTIVATION', 'Maklumat pengaktifan tidak sah atau tamat tempoh. Hubungi pentadbir.');
}

function activationBegin_(db, p) {
  var target = authTarget_(p);
  activationRate_(db, target);
  var users = db.read('USERS').filter(function(u) {
      return u.identification_code === p.code && String(u.account_alias || '') === (p.alias || '');
    }),
    u = users.length === 1 ? users[0] : null,
    a = u ? json_(u.authentication_data, {}) : {},
    activation = a.activation;
  if (!u || !bool_(u.active) || !a.must_change || !activation || (!Number.isFinite(activation.expires) || activation.expires <= Date.now()) || !/^[A-Za-z0-9_-]{24}$/.test(p.activation_code || '') || !equal_(activation.digest || '', hmac_('activation:' + u.user_id + ':' + p.activation_code)) || !/^[A-Za-z0-9_-]{43}$/.test(p.proof || '') || !equal_(a.digest || '', hmac_('pin:' + p.proof))) activationFail_(db, target);
  var ticket = hmac_('activation-ticket:' + id_() + ':' + id_()),
    expires = Date.now() + 10 * 60000;
  db.setState('activation-ticket:' + hash_(ticket), {
    user_id: u.user_id,
    version: u.auth_version,
    generation: activation.generation,
    expires: expires,
    target: target
  });
  db.setState('rate:activate:' + target, {
    n: 0,
    until: 0
  });
  audit_(db, {
    user_id: u.user_id
  }, id_(), 'ACTIVATION_VERIFIED', 'USERS', u.user_id, null, {
    verified: true
  }, 'Capability terhad; tiada sesi workspace.');
  commit_(db, id_(), u, {
    action: 'activationBegin'
  }, {});
  return {
    ticket: ticket,
    expires: expires,
    salt: a.salt,
    iterations: a.iterations
  };
}

function activationFinish_(db, p) {
  onboardingWritable_(db);
  need_(/^[A-Za-z0-9_-]{43}$/.test(p.ticket || ''), 'Tiket pengaktifan tidak sah.');
  var key = 'activation-ticket:' + hash_(p.ticket),
    ticket = db.state(key);
  need_(ticket && Number.isFinite(ticket.expires) && ticket.expires > Date.now(), 'Tiket tamat tempoh. Mulakan pengaktifan semula.');
  activationRate_(db, ticket.target);
  var u = db.find('USERS', 'user_id', ticket.user_id),
    a = u ? json_(u.authentication_data, {}) : {};
  if (!u || !bool_(u.active) || !a.must_change || !a.activation || (!Number.isFinite(a.activation.expires) || a.activation.expires <= Date.now()) || String(u.auth_version) !== String(ticket.version) || a.activation.generation !== ticket.generation) activationFail_(db, ticket.target);
  need_(Number.isInteger(p.pin_length) && p.pin_length >= 10 && p.pin_length <= 64 && /^[A-Za-z0-9_-]{43}$/.test(p.proof || '') && p.salt === a.salt, 'PIN individu mesti 10–64 aksara.');
  need_(!equal_(hmac_('pin:' + p.proof), a.digest), 'PIN individu mesti berbeza daripada PIN sementara.');
  u.authentication_data = JSON.stringify({
    algorithm: 'PBKDF2-SHA256+HMAC-SHA256',
    iterations: a.iterations,
    salt: a.salt,
    digest: hmac_('pin:' + p.proof)
  });
  u.auth_version = Number(u.auth_version) + 1;
  u.updated_at = now_();
  db.put('USERS', u);
  db.setState(key, null);
  audit_(db, u, id_(), 'ACTIVATION_COMPLETED', 'USERS', u.user_id, null, {
    permanent: true
  }, 'Credential sementara/tiket/sesi terdahulu dibatalkan.');
  commit_(db, id_(), u, {
    action: 'activationFinish'
  }, {
    activated: true
  });
  return {
    activated: true
  };
}

function issueActivation_(db, u, p, req) {
  admin_(u);
  onboardingWritable_(db);
  need_(/^[a-zA-Z0-9_-]{16,100}$/.test(req || ''), 'Request ID tidak sah.');
  need_(Array.isArray(p.user_ids) && p.user_ids.length >= 1 && p.user_ids.length <= 30 && new Set(p.user_ids).size === p.user_ids.length, 'Pilih 1–30 akaun pending yang berbeza.');
  var payload = {
      action: 'issueActivation',
      user_ids: p.user_ids
    },
    prior = replay_(db, req, u, payload);
  if (prior) return {
    issued: true,
    replayed: true,
    codes: [],
    message: 'Kod hanya dipaparkan sekali. Jika respons asal hilang, keluarkan kod baharu.'
  };
  var rows = p.user_ids.map(function(id) {
      var target = db.find('USERS', 'user_id', id);
      need_(target && bool_(target.active) && json_(target.authentication_data, {}).must_change, 'Hanya akaun baharu yang pending boleh diaktifkan.');
      return target;
    }),
    codes = [];
  rows.forEach(function(target) {
    var code = hmac_('activation-code:' + id_() + ':' + id_()).slice(0, 24),
      expires = Date.now() + 48 * 3600000,
      a = json_(target.authentication_data, {});
    a.activation = {
      digest: hmac_('activation:' + target.user_id + ':' + code),
      expires: expires,
      generation: id_()
    };
    target.authentication_data = JSON.stringify(a);
    target.auth_version = Number(target.auth_version) + 1;
    target.updated_at = now_();
    db.put('USERS', target);
    codes.push({
      user_id: target.user_id,
      full_name: target.full_name,
      code: code,
      expires: expires
    });
    audit_(db, u, req, 'ACTIVATION_CODE_ISSUED', 'USERS', target.user_id, null, {
      expires: expires
    }, 'Kod raw tidak disimpan; kod/tiket terdahulu dibatalkan.');
  });
  commit_(db, req, u, payload, {
    issued: true,
    count: codes.length
  });
  return {
    issued: true,
    codes: codes,
    message: 'Edarkan secara peribadi selepas mengesahkan identiti setiap guru. Paparan sekali sahaja; kod luput 48 jam.'
  };
}

/* Editor-only emergency rollback preparation. Never invoked automatically. */
function suspendPendingOnboarding_() {
  return locked_(function(db) {
    var actor = {
        user_id: 'PROJECT_OWNER'
      },
      count = 0;
    db.read('USERS').forEach(function(u) {
      if (json_(u.authentication_data, {}).must_change) {
        u.active = false;
        u.auth_version = Number(u.auth_version) + 1;
        db.put('USERS', u);
        count++;
      }
    });
    audit_(db, actor, id_(), 'ONBOARDING_ROLLBACK_SUSPEND', 'USERS', 'pending', null, {
      count: count
    }, 'Private editor-only rollback safeguard.');
    return commit_(db, id_(), actor, {
      action: 'suspendPendingOnboarding'
    }, {
      suspended: count
    });
  });
}
