/* Bounded OOXML, local parsing only. JSZip is vendored; no external parser service. */
(function(M) {
  const C = window.MPS_SETUP_CONTRACT;
  M.readSchoolXlsx = async file => {
    if (!/\.xlsx$/i.test(file.name) || file.size > C.limits.compressedBytes) throw new Error('Pilih .xlsx biasa, maksimum 8MB. Fail .xls/.xlsm tidak disokong.');
    const bytes = new Uint8Array(await file.arrayBuffer()),
      view = new DataView(bytes.buffer);
    let end = -1;
    for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
      if (view.getUint32(p, true) === 0x06054b50) {
        end = p;
        break;
      }
    if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('ZIP workbook rosak atau multipart.');
    const count = view.getUint16(end + 10, true),
      central = view.getUint32(end + 16, true),
      length = view.getUint32(end + 12, true);
    if (count === 65535 || count > 200 || central + length > end || end + 22 + view.getUint16(end + 20, true) !== bytes.length) throw new Error('Struktur ZIP/ZIP64 tidak disokong.');
    let pos = central,
      total = 0;
    const names = new Set(),
      metadata = new Map(),
      decoder = new TextDecoder('utf-8', {
        fatal: true
      });
    for (let i = 0; i < count; i++) {
      if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) throw new Error('Direktori ZIP rosak.');
      const flags = view.getUint16(pos + 8, true),
        method = view.getUint16(pos + 10, true),
        size = view.getUint32(pos + 24, true),
        packed = view.getUint32(pos + 20, true),
        n = view.getUint16(pos + 28, true),
        extra = view.getUint16(pos + 30, true),
        comment = view.getUint16(pos + 32, true),
        local = view.getUint32(pos + 42, true);
      if (pos + 46 + n + extra + comment > central + length) throw new Error('Entri ZIP tidak lengkap.');
      const name = decoder.decode(bytes.slice(pos + 46, pos + 46 + n));
      total += size;
      if (flags & 1 || ![0, 8].includes(method) || size > C.limits.partBytes || total > C.limits.expandedBytes || names.has(name) || /\\|(^|\/)\.\.(\/|$)|^\//.test(name) || /vbaProject|macrosheets|externalLinks|embeddings/i.test(name) || local + 30 > central || view.getUint32(local, true) !== 0x04034b50 || local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true) + packed > central) throw new Error('Workbook mengandungi format/enkripsi/pautan luar/saiz yang tidak dibenarkan.');
      metadata.set(name, {
        size,
        crc: view.getUint32(pos + 16, true)
      });
      names.add(name);
      pos += 46 + n + extra + comment;
    }
    if (pos !== central + length) throw new Error('Direktori ZIP tidak sepadan.');
    const zip = await JSZip.loadAsync(bytes, {
      checkCRC32: false,
      createFolders: false
    });
    const crcTable = Array.from({
      length: 256
    }, (_, n) => {
      for (let j = 0; j < 8; j++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
      return n >>> 0;
    });
    const xmlParts = new Map();
    let expanded = 0;
    for (const name of names) {
      const part = zip.file(name);
      if (!part) continue;
      const expected = metadata.get(name);
      const data = await new Promise((resolve, reject) => {
        let size = 0,
          crc = -1,
          chunks = [];
        const stream = part.internalStream('uint8array');
        stream.on('data', chunk => {
          size += chunk.length;
          expanded += chunk.length;
          if (size > expected.size || size > C.limits.partBytes || expanded > C.limits.expandedBytes) {
            stream.pause();
            reject(new Error('Saiz expanded sebenar melebihi had workbook.'));
            return;
          }
          for (const b of chunk) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
          chunks.push(chunk);
        }).on('error', reject).on('end', () => {
          if (size !== expected.size || ((crc ^ -1) >>> 0) !== expected.crc) return reject(new Error('Checksum/saiz workbook tidak sepadan.'));
          if (!/\.xml$|\.rels$/.test(name)) return resolve(null);
          const out = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            out.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(out);
        }).resume();
      });
      if (data) {
        const raw = decoder.decode(data);
        if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error('DOCTYPE/entity XML tidak dibenarkan.');
        xmlParts.set(name, raw);
      }
    }
    const xml = async path => {
      const raw = xmlParts.get(path);
      if (raw === undefined) throw new Error('Bahagian workbook tiada: ' + path);
      const doc = new DOMParser().parseFromString(raw, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) throw new Error('XML workbook rosak.');
      return doc;
    };
    const elements = (node, tag) => [...node.getElementsByTagNameNS('*', tag)];
    for (const name of names)
      if (/\.rels$/.test(name)) {
        const rel = await xml(name);
        if (elements(rel, 'Relationship').some(r => r.getAttribute('TargetMode') === 'External')) throw new Error('Pautan luar tidak dibenarkan. Buang hyperlink/external link sebelum import.');
      }
    const workbook = await xml('xl/workbook.xml'),
      rels = await xml('xl/_rels/workbook.xml.rels');
    if (elements(workbook, 'workbookPr').some(p => ['1', 'true'].includes(p.getAttribute('date1904')))) throw new Error('Sistem tarikh Excel 1904 tidak disokong. Gunakan template asal.');
    const relationship = new Map(elements(rels, 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const sheets = new Map();
    for (const s of elements(workbook, 'sheet')) {
      const name = s.getAttribute('name');
      if (sheets.has(name)) throw new Error('Nama worksheet bertindih.');
      const id = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'),
        target = relationship.get(id);
      if (!target || target.includes('..')) throw new Error('Hubungan worksheet tidak disokong.');
      sheets.set(name, target.startsWith('/') ? target.slice(1) : 'xl/' + target);
    }
    const issues = [];
    for (const name of C.requiredSheets)
      if (!sheets.has(name)) issues.push({
        sheet: name,
        row: 0,
        field: '*',
        message: 'Worksheet wajib tiada.'
      });
    if (issues.length) throw Object.assign(new Error('Worksheet wajib tidak lengkap.'), {
      issues
    });
    let shared = [];
    if (zip.file('xl/sharedStrings.xml')) shared = elements(await xml('xl/sharedStrings.xml'), 'si').map(n => elements(n, 't').map(t => t.textContent).join(''));
    const out = {
      version: C.version,
      sheets: {}
    };
    let recordCount = 0;
    for (const [name, fields] of Object.entries(C.sheets)) {
      const doc = await xml(sheets.get(name)),
        rows = new Map();
      for (const row of elements(doc, 'row')) {
        const ri = Number(row.getAttribute('r'));
        if (!Number.isInteger(ri) || ri < 1 || ri > 10005) throw new Error('Indeks baris tidak disokong.');
        if (ri < C.headerRow) continue;
        if (rows.has(ri)) throw new Error('Indeks baris bertindih.');
        const cells = new Map();
        for (const cell of elements(row, 'c')) {
          const ref = cell.getAttribute('r'),
            match = /^([A-Z]{1,3})([0-9]+)$/.exec(ref || '');
          if (!match || Number(match[2]) !== ri) throw new Error('Rujukan sel rosak.');
          let col = 0;
          for (const ch of match[1]) col = col * 26 + ch.charCodeAt(0) - 64;
          if (col > 100 || cells.has(col - 1)) throw new Error('Kolum/sel bertindih.');
          const t = cell.getAttribute('t'),
            v = elements(cell, 'v')[0]?.textContent;
          if (![null, '', 's', 'str', 'n', 'b', 'd', 'inlineStr', 'e'].includes(t) || t === 's' && (!Number.isInteger(Number(v)) || shared[Number(v)] === undefined) || t === 'b' && !['0', '1'].includes(v)) throw new Error('Jenis/nilai sel Excel tidak sah: ' + ref);
          let value = t === 'inlineStr' ? elements(cell, 't').map(n => n.textContent).join('') : t === 's' ? shared[Number(v)] : t === 'b' ? v === '1' : v === undefined ? '' : t === 'str' ? v : t === 'd' ? (Date.parse(v) / 86400000 + 25569) : Number(v);
          if (elements(cell, 'f').length || t === 'e') {
            issues.push({
              sheet: name,
              row: ri,
              field: ref,
              message: 'Formula/ralat tidak dibenarkan dalam input. Gunakan nilai sahaja.'
            });
            value = '';
          }
          cells.set(col - 1, value ?? '');
        }
        rows.set(ri, cells);
      }
      const header = rows.get(C.headerRow) || new Map(),
        headers = [...header].sort((a, b) => a[0] - b[0]).filter(([, v]) => v !== '').map(([i, v]) => [i, String(v).trim()]);
      const optional = (C.optionalFields || {})[name] || [];
      if (fields.some(f => headers.filter(([, v]) => v === f).length !== 1) || headers.some(([,v]) => !fields.includes(v) && !optional.includes(v)) || new Set(headers.map(([,v])=>v)).size !== headers.length || (optional.some(f => headers.some(([,v]) => v === f)) && !optional.every(f => headers.some(([,v]) => v === f)))) {
        issues.push({
          sheet: name,
          row: C.headerRow,
          field: 'header',
          message: 'Header mesti tepat: ' + fields.join(', ')
        });
        continue;
      }
      const entries = [];
      for (const [ri, cells] of rows) {
        if (ri <= C.headerRow) continue;
        if (![...cells.values()].some(v => v !== '' && v !== null)) continue;
        const values = {};
        for (const [i, f] of headers) {
          let value = cells.get(i) ?? '';
          if (C.dateFields.includes(f) && typeof value === 'number' && Number.isFinite(value)) {
            const d = new Date(Math.round((value - 25569) * 86400000));
            value = f === 'start_date' ? d.toISOString().slice(0, 10) : d.toISOString().replace(/\.\d{3}Z$/, '+08:00');
          }
          if ((/_id$|_ref$/.test(f) || f === 'identification_code') && typeof value !== 'string') issues.push({
            sheet: name,
            row: ri,
            field: f,
            message: 'Identiti mesti disimpan sebagai teks. Nilai nombor tidak dipad semula secara automatik.'
          });
          values[f] = value;
        }
        if ([...cells.keys()].some(i => !headers.some(([h]) => h === i) && cells.get(i) !== '')) issues.push({
          sheet: name,
          row: ri,
          field: '*',
          message: 'Data di luar kolum template.'
        });
        entries.push({
          row: ri,
          values
        });
        recordCount++;
      }
      out.sheets[name] = entries;
    }
    if (recordCount > C.limits.rows) throw new Error('Maksimum 10,000 rekod.');
    if (issues.length) throw Object.assign(new Error('Betulkan ralat workbook sebelum validasi.'), {
      issues
    });
    return out;
  };
})(window.MPS);
