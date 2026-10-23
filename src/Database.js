/* Write-ahead operations: PREPARED is replayed before any data is returned. No deletes or sorts. */
function database_() {
  need_(config_().spreadsheet, 'SPREADSHEET_ID belum dikonfigurasi.');
  return SpreadsheetApp.openById(config_().spreadsheet);
}

function Db_(book) {
  this.book = book || database_();
  this.cache = {};
  this.staged = {};
  this.sheets = {};
  this.ends = {};
  this.blocks = {};
  this.validated = {};
}
Db_.prototype.sheet = function(name) {
  need_(Object.prototype.hasOwnProperty.call(SCHEMA_, name), 'Jadual tidak dikenali.');
  if (!this.sheets[name]) this.sheets[name] = this.book.getSheetByName(name);
  need_(this.sheets[name], 'Database belum diinisialisasi: ' + name);
  return this.sheets[name];
};
Db_.prototype.end = function(name) {
  if (this.ends[name] === undefined) this.ends[name] = this.sheet(name).getLastRow();
  return this.ends[name];
};
Db_.prototype.decode = function(name, row, index) {
  var o = {
    _row: index
  };
  SCHEMA_[name].forEach(function(k, i) {
    o[k] = row[i] instanceof Date ? row[i].toISOString() : row[i];
  });
  return o;
};
Db_.prototype.validate = function(name) {
  if (this.validated[name]) return;
  var h = SCHEMA_[name];
  need_(JSON.stringify(diagnosticRead_(this.sheet(name).getRange(1, 1, 1, h.length))[0]) === JSON.stringify(h), 'Header database berubah: ' + name);
  this.validated[name] = true;
};
Db_.prototype.overlay = function(name, rows) {
  var self = this;
  return rows.map(function(r) {
    var p = self.staged[name + ':' + r._row];
    return p ? self.decode(name, p.values, p.row) : r;
  });
};
Db_.prototype.read = function(name) {
  if (!this.cache[name]) {
    this.validate(name);
    var last = this.sheet(name).getLastRow(),
      self = this;
    this.ends[name] = Math.max(this.ends[name] || 0, last);
    this.cache[name] = last < 2 ? [] : diagnosticRead_(this.sheet(name).getRange(2, 1, last - 1, SCHEMA_[name].length)).map(function(row, i) {
      return self.decode(name, row, i + 2);
    });
    Object.keys(this.staged).forEach(function(k) {
      var p = self.staged[k];
      if (p.table === name) self.cache[name][p.row - 2] = self.decode(name, p.values, p.row);
    });
  }
  return this.cache[name];
};
Db_.prototype.range = function(name, start, count) {
  if (count <= 0) return [];
  this.validate(name);
  var self = this;
  return this.overlay(name, diagnosticRead_(this.sheet(name).getRange(start, 1, count, SCHEMA_[name].length)).map(function(row, i) {
    return self.decode(name, row, start + i);
  }));
};
Db_.prototype.put = function(name, obj) {
  var row = obj._row;
  if (!row) {
    row = this.end(name) + 1;
    this.ends[name] = row;
    obj._row = row;
  }
  need_(Number.isInteger(row) && row >= 2, 'Koordinat rekod tidak sah.');
  var values = SCHEMA_[name].map(function(k) {
    var v = obj[k];
    return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
  });
  this.staged[name + ':' + row] = {
    table: name,
    row: row,
    values: values
  };
  if (this.cache[name]) this.cache[name][row - 2] = obj;
  return obj;
};
Db_.prototype.find = function(name, k, value) {
  return this.read(name).find(function(r) {
    return String(r[k]) === String(value);
  });
};
Db_.prototype.state = function(k) {
  var r = this.find('_STATE', 'state_id', k);
  return r ? json_(r.value, null) : null;
};
Db_.prototype.setState = function(k, v) {
  var r = this.find('_STATE', 'state_id', k) || {
    state_id: k
  };
  r.value = JSON.stringify(v);
  this.put('_STATE', r);
};
Db_.prototype.marks = function(exam, cls, sub) {
  var k = key_([exam, cls]),
    meta = this.state('block:' + k);
  if (!meta) return [];
  need_(Number.isInteger(meta.start) && meta.start >= 2 && Number.isInteger(meta.count) && meta.count > 0, 'Indeks markah rosak. Hubungi pentadbir.');
  var segment = sub && meta.subjects && meta.subjects[sub], cacheKey = segment ? k + ':' + sub : k;
  if (segment) {
    need_(Number.isInteger(segment.start) && Number.isInteger(segment.count) && segment.count > 0 && segment.start >= meta.start && segment.start + segment.count <= meta.start + meta.count, 'Indeks subjek rosak.');
  }
  if (!this.blocks[cacheKey]) {
    this.blocks[cacheKey] = this.range('MARKS', segment ? segment.start : meta.start, segment ? segment.count : meta.count);
    need_(this.blocks[cacheKey].every(function(r) {
      return r.exam_id === exam && r.class_id_snapshot === cls && (!segment || r.subject_code === sub);
    }), 'Indeks kelas tidak sepadan. Tiada markah ditulis.');
  }
  return this.overlay('MARKS', this.blocks[cacheKey]).filter(function(r) {
    return !sub || r.subject_code === sub;
  });
};

function ensureGrid_(sheet, lastRow, lastColumn) {
  if (lastRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(lastRow - sheet.getMaxRows(), 100));
  if (lastColumn > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), lastColumn - sheet.getMaxColumns());
}

function rowHintCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (e) {
    return null;
  }
}

function hintKey_(db, req, actor) {
  return 'mps-op:' + hash_(db.book.getId() + ':' + actor + ':' + req);
}

function rememberOp_(db, req, actor, row) {
  try {
    var cache = rowHintCache_();
    if (cache) cache.put(hintKey_(db, req, actor), String(row), 21600);
  } catch (e) {
    /* Optional row hint; the journal remains authoritative. */ }
}

function writePlan_(book, plan) {
  var groups = {};

  plan.forEach(function(p) {
    (groups[p.table] || (groups[p.table] = [])).push(p);
  });

  Object.keys(groups).forEach(function(name) {
    var rows = groups[name].sort(function(a, b) {
        return a.row - b.row;
      }),
      s = book.getSheetByName(name);

    ensureGrid_(s, rows[rows.length - 1].row, SCHEMA_[name].length);
    var i = 0;

    while (i < rows.length) {
      var j = i + 1;

      while (
        j < rows.length &&
        rows[j].row === rows[j - 1].row + 1
      ) {
        j++;
      }

      var vals = rows.slice(i, j).map(function(p) {
        return p.values.map(function(v) {
          return typeof v === 'string' && /^[=+@-]/.test(v) ?
            "'" + v :
            v;
        });
      });

      // FIX: Preserve leading zeros in identification codes.
      SCHEMA_[name].forEach(function(field,column){if(/_id$|_code$|_date$/.test(field)){s.getRange(rows[i].row,column+1,vals.length,1).setNumberFormat('@');vals.forEach(function(row){if(row[column]!==''&&row[column]!=null)row[column]=String(row[column]);});}});
      if (name === 'USERS') {
        var identificationColumn =
          SCHEMA_[name].indexOf('identification_code') + 1;

        need_(
          identificationColumn > 0,
          'Kolum identification_code tidak dijumpai.'
        );

        // Set column cells to Plain text BEFORE writing.
        s.getRange(
          rows[i].row,
          identificationColumn,
          vals.length,
          1
        ).setNumberFormat('@');

        // Ensure identification codes are stored as strings.
        vals.forEach(function(row) {
          var index = identificationColumn - 1;

          if (row[index] !== '' && row[index] != null) {
            row[index] = String(row[index]);
          }
        });
      }

      diagnosticWrite_(s.getRange(
        rows[i].row,
        1,
        vals.length,
        SCHEMA_[name].length
      ), vals);

      i = j;
    }
  });

  SpreadsheetApp.flush();
}

function recover_(book) {
  var props = PropertiesService.getScriptProperties(),
    start = Number(props.getProperty('RECOVERY_ROW'));
  if (!start) return;
  var s = book.getSheetByName('_OPS'),
    head = diagnosticRead_(s.getRange(start, 1, 1, 9))[0];
  if (head[4] === 'PREPARED') {
    var meta = json_(head[7], null);
    need_(meta && meta.pieces > 0, 'Metadata pemulihan rosak.');
    need_(Number.isInteger(meta.pieces) && meta.pieces > 0 && start + meta.pieces <= s.getLastRow(), 'Jurnal pemulihan tidak lengkap.');
    var pieces = diagnosticRead_(s.getRange(start + 1, 1, meta.pieces, 9));
    need_(pieces.every(function(p, i) {
      return p[0] === head[0] && p[1] === head[1] && p[2] === head[2] && p[3] === head[3] && p[4] === 'PIECE' && Number(p[6]) === i + 1;
    }), 'Bahagian jurnal pemulihan tidak sepadan.');
    var plan = json_(pieces.map(function(p) {
      return p[7];
    }).join(''), null);
    need_(Array.isArray(plan) && plan.every(function(p) {
      return p && Object.prototype.hasOwnProperty.call(SCHEMA_, p.table) && Number.isInteger(p.row) && p.row >= 2 && Array.isArray(p.values) && p.values.length === SCHEMA_[p.table].length;
    }), 'Pemulihan operasi diperlukan.');
    writePlan_(book, plan);
    s.getRange(start, 5).setValue('COMMITTED');
    SpreadsheetApp.flush();
  }
  need_(['PREPARED', 'COMMITTED', 'WRITING'].indexOf(head[4]) >= 0, 'Status jurnal pemulihan tidak sah.');
  props.deleteProperty('RECOVERY_ROW');
}

function locked_(fn) {
  CONFIG_REQUEST_ = null;
  var waitStart = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) fail_('BUSY', 'Sistem sedang menyimpan. Cuba semula.');
  var acquired = Date.now();
  if (DIAG_) DIAG_.lock_wait_ms += acquired - waitStart;
  try {
    var b = database_();
    recover_(b);
    var db = new Db_(b),
      next = db.state('next-year');
    if (next && next.spreadsheet && Number(next.year) > Number(config_().year)) {
      activateYear_(next);
      b = database_();
      db = new Db_(b);
    }
    schoolApplyProfile_(db);
    return fn(db);
  } finally {
    if (DIAG_) DIAG_.lock_hold_ms += Date.now() - acquired;
    lock.releaseLock();
  }
}

function commit_(db, req, u, payload, result) {
  var transactionStart = Date.now();
  var s = db.sheet('_OPS'),
    fingerprint = hash_(JSON.stringify(payload)),
    plans = Object.keys(db.staged).map(function(k) {
      return db.staged[k];
    }),
    serialized = JSON.stringify(plans),
    op = id_(),
    rows = [
      [op, req, u.user_id, fingerprint, 'WRITING', JSON.stringify(result), 0, '', now_()]
    ];
  for (var i = 0; i < serialized.length; i += 40000) rows.push([op, req, u.user_id, fingerprint, 'PIECE', '',
    rows.length, serialized.slice(i, i + 40000), now_()
  ]);
  rows[0][7] = JSON.stringify({
    pieces: rows.length - 1
  });
  need_(rows[0][5].length < 45000, 'Respons kelompok terlalu besar. Kurangkan bilangan rekod.');
  var start = s.getLastRow() + 1;
  ensureGrid_(s, start + rows.length - 1, 9);
  s.getRange(start,1,rows.length,4).setNumberFormat('@');
  diagnosticWrite_(s.getRange(start, 1, rows.length, 9), rows);
  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().setProperty('RECOVERY_ROW', String(start));
  s.getRange(start, 5).setValue('PREPARED');
  SpreadsheetApp.flush();
  writePlan_(db.book, plans);
  s.getRange(start, 5).setValue('COMMITTED');
  SpreadsheetApp.flush();
  PropertiesService.getScriptProperties().deleteProperty('RECOVERY_ROW');
  if (DIAG_) DIAG_.transaction_ms += Date.now() - transactionStart;
  rememberOp_(db, req, u.user_id, start);
  return result;
}

function replay_(db, req, u, payload) {
  need_(/^[a-zA-Z0-9_-]{16,100}$/.test(req || ''), 'Request ID tidak sah.');
  var sheet = db.sheet('_OPS'),
    last = sheet.getLastRow(),
    cached = null,
    cache = rowHintCache_();
  try {
    cached = cache && Number(cache.get(hintKey_(db, req, u.user_id)));
  } catch (e) {}
  var match = null;

  function check(row) {
    if (!Number.isInteger(row) || row < 2 || row > last) return null;
    var r = diagnosticRead_(sheet.getRange(row, 1, 1, 9))[0];
    return r[1] === req && r[2] === u.user_id && Number(r[6]) === 0 && r[4] === 'COMMITTED' ? {
      row: row,
      data: r
    } : null;
  }
  if (cached) match = check(cached);
  if (!match && last >= 2) {
    var matches = sheet.getRange(2, 2, last - 1, 1).createTextFinder(req).matchEntireCell(true).useRegularExpression(false).findAll();
    for (var i = 0; i < matches.length && !match; i++) match = check(matches[i].getRow());
  }
  if (!match) return null;
  need_(match.data[3] === hash_(JSON.stringify(payload)), 'Request ID telah digunakan untuk permintaan lain.');
  rememberOp_(db, req, u.user_id, match.row);
  return {
    found: true,
    value: json_(match.data[5], null)
  };
}

function audit_(db, u, req, action, table, entity, before, after, reason) {
  db.put('AUDIT_LOG', {
    event_id: id_(),
    request_id: req,
    actor_id: u.user_id,
    action: action,
    entity_type: table,
    entity_id: entity,
    old_value: JSON.stringify(before || null),
    new_value: JSON.stringify(after || null),
    reason: reason || '',
    timestamp: now_()
  });
}
