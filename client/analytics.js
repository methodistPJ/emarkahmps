(function(M) {
  M.openAnalytics = async () => {
    await M.guard();
    const dash = await M.call('sessionContext');
    document.querySelector('#content').innerHTML =
      `<p class="eyebrow">ASSESSMENT ANALYTICS</p><h2>Understand <em>the progress.</em></h2><form id="analytics-form" class="toolbar"><label>Peperiksaan<select name="exam_id">${dash.exams.map(e=>`<option value="${M.esc(e.exam_id)}">${M.esc(e.exam_type+' '+e.academic_year)}</option>`).join('')}</select></label><label>Mod<select name="mode"><option value="CURRENT">Analisis Semasa</option><option value="OFFICIAL">Analisis Rasmi</option></select></label><label>Tahap<select name="stage"><option value="">Semua</option><option value="1">Tahap 1</option><option value="2">Tahap 2</option></select></label><label>Tahun<select name="year_level"><option value="">Semua</option>${[1,2,3,4,5,6].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Subjek<input name="subject_code" placeholder="Semua / BM"></label><label>Kelas<select name="class_id"><option value="">Semua kelas dibenarkan</option>${dash.classes.map(c=>`<option value="${M.esc(c.class_id)}">${M.esc(c.class_name)}</option>`).join('')}</select></label><label>ID Murid<input name="student_id" placeholder="Semua murid dibenarkan"></label><button>Analisis</button></form><div class="toolbar"><label>Banding dengan<select id="compare-exam">${dash.exams.map(e=>`<option value="${M.esc(e.exam_id)}">${M.esc(e.exam_type+' '+e.academic_year)}</option>`).join('')}</select></label><button id="compare-action">Bandingkan UPSA / UASA</button><button id="analysis-print">Cetak Laporan</button></div><div id="analytics-output"></div>`;
    let result, selection;
    const table = (subjects) =>
      `<div class="table-scroll"><table><thead><tr><th>Subjek</th><th>Angka</th><th>TH</th><th>TB</th><th>EMPTY</th><th>Purata</th><th>A / B / C / D / E / F</th></tr></thead><tbody>${subjects.map(s=>`<tr><td>${M.esc(s.subject)}</td><td>${s.stats.status.SCORED}</td><td>${s.stats.status.TH}</td><td>${s.stats.status.TB}</td><td>${s.stats.status.EMPTY}</td><td>${s.stats.average??'—'}</td><td>${Object.values(s.stats.grades).join(' / ')}</td></tr>`).join('')}</tbody></table></div>`;
    const show = () => {
      document.querySelector('#analytics-output').innerHTML =
        `<h3>${result.mode==='OFFICIAL'?'Analisis Rasmi':'Analisis Semasa'} — ${M.esc(result.exam.exam_type)}</h3><p>${M.esc(result.summary.denominator)} Purata agregat ialah purata slot markah subjek, bukan purata individu murid.</p><div class="metrics"><div class="metric"><strong>${result.summary.status.SCORED}</strong><span>Rekod angka</span></div><div class="metric"><strong>${result.summary.average??'—'}</strong><span>Purata skor</span></div><div class="metric"><strong>${result.summary.status.EMPTY}</strong><span>Belum lengkap</span></div></div>${M.chart(result.summary.grades,'Taburan gred semua rekod dibenarkan')}${table(result.subjects)}<h3>Kelas & Subjek</h3>${table(result.groups.map(g=>({subject:g.class_name+' / '+g.subject,stats:g.stats})))}<div class="toolbar"><button id="export-summary">Eksport Ringkasan CSV</button><button id="export-marks">Eksport Dataset CSV</button></div><div class="grid">${result.subjects.map(s=>`<section><h3>${M.esc(s.subject)}</h3>${M.chart(s.stats.grades,'Taburan '+s.subject)}<p>${Object.entries(s.stats.percentages).map(([g,n])=>`${g}: ${n.toFixed(2)}%`).join(' · ')}</p></section>`).join('')}</div><div id="comparison"></div>`;
      document.querySelector('#export-summary').onclick = () => M.download('analisis-ringkasan.csv', M
        .csv([
          ['Subjek', 'SCORED', 'TH', 'TB', 'EMPTY', 'Purata', 'A', 'B', 'C', 'D', 'E', 'F'], ...
          result.subjects.map(s => [s.subject, s.stats.status.SCORED, s.stats.status.TH, s.stats
            .status.TB, s.stats.status.EMPTY, s.stats.average, ...Object.values(s.stats.grades)
          ])
        ]));
      document.querySelector('#export-marks').onclick = () => M.download('analisis-rekod.csv', M.csv([
        ['student_id', 'name', 'class_id', 'subject', 'score', 'status', 'grade'], ...result
        .dataset.map(r => [r.student_id, r.name, r.class_id, r.subject, r.score, r.status, r
          .grade
        ])
      ]));
    };
    document.querySelector('#analytics-form').onsubmit = e => {
      e.preventDefault();
      M.run(async () => {
        selection = Object.fromEntries(new FormData(e.target));
        selection.subject_code = selection.subject_code.toUpperCase().trim();
        result = await M.call('analytics', selection);
        show();
      });
    };
    document.querySelector('#compare-action').onclick = () => M.run(async () => {
      if (!selection) throw new Error('Jalankan analisis dahulu.');
      const compared = await M.call('compare', {
        ...selection,
        left_exam: selection.exam_id,
        right_exam: document.querySelector('#compare-exam').value
      });
      document.querySelector('#comparison').innerHTML =
        `<h3>Perbandingan Peperiksaan</h3><p>${M.esc(compared.note)}</p><p>Purata kohort: ${compared.left.summary.average??'—'} → ${compared.right.summary.average??'—'}. ${compared.matched.length} padanan murid-subjek; purata perubahan padanan ${compared.matchedAverageChange??'—'}.</p><div class="table-scroll"><table><thead><tr><th>Murid</th><th>Subjek</th><th>Awal</th><th>Akhir</th><th>Perubahan</th></tr></thead><tbody>${compared.matched.map(r=>`<tr><td>${M.esc(r.name)}</td><td>${M.esc(r.subject)}</td><td>${r.left}</td><td>${r.right}</td><td>${r.change}</td></tr>`).join('')}</tbody></table></div>`;
    });
    document.querySelector('#analysis-print').onclick = () => window.print();
  };
})(window.MPS);
