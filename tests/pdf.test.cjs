const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto'),
  path = require('node:path');
const root = path.resolve(process.env.MPS_SOURCE||path.join(__dirname,'../src'));
const c = vm.createContext({
  console,
  Uint8Array,
  Date,
  Math,
  JSON,
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => k === 'AUTH_PEPPER' ? 'x'.repeat(43) : null
    })
  },
  Utilities: {
    DigestAlgorithm: {
      SHA_256: 'sha256'
    },
    Charset: {
      UTF_8: 'utf8'
    },
    computeDigest: (_, s) => [...crypto.createHash('sha256').update(s).digest()],
    base64Encode: bytes => Buffer.from(bytes).toString('base64')
  }
});
// Layout contract checks use isolated DocumentApp doubles, not live Google rendering.
class Paragraph {
  editAsText() {
    return {
      setFontFamily() {
        return this;
      },
      setFontSize() {
        return this;
      },
      setBold() {
        return this;
      }
    };
  }
  setSpacingBefore() {
    return this;
  }
  setSpacingAfter() {
    return this;
  }
  setLineSpacing() {
    return this;
  }
  setAlignment() {
    return this;
  }
}
class Cell {
  setPaddingTop() {
    return this;
  }
  setPaddingBottom() {
    return this;
  }
  setPaddingLeft() {
    return this;
  }
  setPaddingRight() {
    return this;
  }
  setBackgroundColor() {
    return this;
  }
  getChild() {
    return {
      asParagraph: () => new Paragraph()
    };
  }
}
class Table {
  constructor(rows) {
    this.rows = rows;
  }
  setBorderWidth() {
    return this;
  }
  setColumnWidth() {
    return this;
  }
  getNumRows() {
    return this.rows.length;
  }
  getRow() {
    return {
      setMinimumHeight() {},
      getCell: () => new Cell()
    };
  }
}
c.DocumentApp = {
  HorizontalAlignment: {
    CENTER: 'CENTER'
  }
};
for (const f of ['PdfLib.js', 'Config.js', 'PDFGenerator.js']) vm.runInContext(fs.readFileSync(path.join(root,
  f), 'utf8'), c, {
  filename: f
});
(async () => {
  const captured = {
      paragraphs: [],
      table: null
    },
    body = {
      appendParagraph(text) {
        captured.paragraphs.push(text);
        return new Paragraph();
      },
      appendTable(rows) {
        const table = new Table(rows);
        if (rows[0][0] === 'Mata Pelajaran') captured.table = table;
        return table;
      }
    };
  const snapshot = {
    school: 'Fixture School',
    name: 'Long fixture student name '.repeat(5).slice(0, 140),
    class_name: 'Fixture Class',
    exam_type: 'UPSA',
    academic_year: '2027',
    remark: 'x'.repeat(300),
    class_teacher: 'Teacher fixture',
    headmistress: 'Head fixture',
    subjects: [{
      subject_code: 'BM',
      subject_name: 'Bahasa Melayu'
    }, {
      subject_code: 'PI',
      subject_name: 'Pendidikan Islam'
    }, {
      subject_code: 'BI',
      subject_name: 'Bahasa Inggeris'
    }],
    marks: [{
      subject_code: 'BM',
      mark_status: 'SCORED',
      score: 0,
      grade: 'F'
    }, {
      subject_code: 'PI',
      mark_status: 'TB'
    }, {
      subject_code: 'BI',
      mark_status: 'TH'
    }]
  };
  c.slip_(body, snapshot);
  assert.equal(captured.table.rows.length, 3);
  assert.deepEqual(Array.from(captured.table.rows[1]), ['Bahasa Melayu', '0', 'F']);
  assert.deepEqual(Array.from(captured.table.rows[2]), ['Bahasa Inggeris', 'TH', 'TH']);
  assert.ok(captured.paragraphs.includes(snapshot.remark));
  assert.throws(() => c.slip_(body, {
    ...snapshot,
    remark: 'x'.repeat(301)
  }));
  assert.throws(() => c.slip_(body, {
    ...snapshot,
    marks: [{
      subject_code: 'BM',
      mark_status: 'EMPTY'
    }]
  }));
  const pdf = await c.PDFLib.PDFDocument.create();
  pdf.addPage(vm.runInContext('[595.28,841.89]', c));
  pdf.addPage(vm.runInContext('[595.28,841.89]', c));
  const bytes = await pdf.save({
      objectsPerTick: Infinity,
      useObjectStreams: true
    }),
    blob = {
      getBytes: () => [...bytes]
    };
  assert.equal((await c.pdfValidate_(blob, 2)).pages, 2);
  await assert.rejects(() => c.pdfValidate_(blob, 3));
  const wrong = await c.PDFLib.PDFDocument.create();
  wrong.addPage(vm.runInContext('[612,792]', c));
  const wrongBytes = await wrong.save({
    objectsPerTick: Infinity
  });
  await assert.rejects(() => c.pdfValidate_({
    getBytes: () => [...wrongBytes]
  }, 1));
  await assert.rejects(() => c.pdfValidate_({
    getBytes: () => [1, 2, 3]
  }, 1));
  console.log(
    'PASS PDF layout contract + parser: zero/F, TH, TB omission, name/remark bounds, EMPTY rejection, compressed-object page count, A4, wrong count/paper, corrupt file. No live Docs/Drive export was run.'
  );
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
