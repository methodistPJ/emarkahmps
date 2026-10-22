/* Run only from the Apps Script editor as the project owner. Private to google.script.run. */
function install_() {
  var cfg = config_();
  need_(cfg.secret && cfg.secret.length >= 43, 'Jana AUTH_PEPPER melalui tools/bootstrap.html.');
  need_(cfg.parent, 'Tetapkan DRIVE_PARENT_ID.');
  var book = cfg.spreadsheet ? SpreadsheetApp.openById(cfg.spreadsheet) : SpreadsheetApp.create(
    'MPS e-Assessment ' + cfg.year);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', book.getId());
  Object.keys(SCHEMA_).forEach(function(t) {
    var s = book.getSheetByName(t);
    if (s) {
      need_(JSON.stringify(s.getRange(1, 1, 1, SCHEMA_[t].length).getValues()[0]) === JSON.stringify(
        SCHEMA_[t]), 'Jadual sedia ada tidak serasi.');
      return;
    }
    s = book.insertSheet(t);
    s.getRange(1, 1, 1, SCHEMA_[t].length).setValues([SCHEMA_[t]]);
    s.setFrozenRows(1);
    if (t[0] === '_') s.hideSheet();
  });
    // Preserve leading zeros in teacher identification codes.
  var usersSheet = book.getSheetByName('USERS');
  var identificationColumn =
    SCHEMA_.USERS.indexOf('identification_code') + 1;

  need_(
    identificationColumn > 0,
    'Kolum identification_code tidak dijumpai.'
  );

  usersSheet
    .getRange(
      2,
      identificationColumn,
      usersSheet.getMaxRows() - 1,
      1
    )
    .setNumberFormat('@');
    
  DriveApp.getFileById(book.getId()).moveTo(rootFolder_());
  locked_(function(db) {
    if (!db.read('SUBJECTS').length) SUBJECT_SEED_.forEach(function(s, i) {
      db.put('SUBJECTS', {
        subject_code: s[0],
        subject_name: s[1],
        offered_year_levels: JSON.stringify(i >= 12 ? [4, 5, 6] : [1, 2, 3, 4, 5, 6]),
        display_order: i + 1,
        default_status: ['PI', 'PM', 'BA', 'BC', 'BT'].indexOf(s[0]) >= 0 ? 'TB' : 'EMPTY',
        active: true
      });
    });
    if (!db.read('GRADE_RULES').length)[[0, 19, 'F'], [20, 34, 'E'], [35, 49, 'D'], [50, 65, 'C'], [66,
      81, 'B'
    ], [82, 100, 'A']].forEach(function(g) {
      db.put('GRADE_RULES', {
        rule_id: 'v1-' + g[2],
        grading_version: 'v1',
        minimum_score: g[0],
        maximum_score: g[1],
        grade: g[2],
        description: 'Aturan awal dari workbook 2026',
        active: true
      });
    });
    var bootstrap = PropertiesService.getScriptProperties().getProperty('BOOTSTRAP_ADMIN');
    if (!db.read('USERS').length) {
      var p = json_(bootstrap, null);
      need_(p, 'BOOTSTRAP_ADMIN diperlukan.');
      userSave_(db, {
        user_id: 'INSTALL',
        roles: '["ADMINISTRATOR"]'
      }, p, id_());
    }
    commit_(db, id_(), {
      user_id: 'INSTALL'
    }, {
      action: 'initialize'
    }, {});
  });
  PropertiesService.getScriptProperties().deleteProperty('BOOTSTRAP_ADMIN');
  templateInstall_();
  if (!ScriptApp.getProjectTriggers().some(function(t) {
      return t.getHandlerFunction() === 'processQueue_';
    })) ScriptApp.newTrigger('processQueue_').timeBased().everyMinutes(1).create();
  console.log('Initialized ' + book.getUrl());
}
function runInstallation_() {
  install_();
}
