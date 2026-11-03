(function(M){
  M.openExamRoster=async(d,host)=>{
    const exams=d.EXAMS.filter(e=>String(e.academic_year)===String(d.settings.year)&&!['ARCHIVED','FINALIZED'].includes(e.status));
    const focus=M.currentExam(exams);
    host.innerHTML=`<h3>Murid Peperiksaan</h3><p>Keluarkan murid daripada peperiksaan yang dipilih sahaja. Rekod induk, sejarah markah dan peperiksaan lain dikekalkan.</p><div class="grid"><label>Peperiksaan<select id="roster-exam">${exams.map(e=>`<option value="${M.esc(e.exam_id)}" ${e.exam_id===focus?.exam_id?'selected':''}>${M.esc(e.exam_type+' '+e.academic_year)}</option>`).join('')}</select></label><label>Kelas<select id="roster-class"><option value="">Pilih kelas</option>${d.CLASSES.filter(c=>c.active&&String(c.academic_year)===String(d.settings.year)).map(c=>`<option value="${M.esc(c.class_id)}">${M.esc(c.class_name)}</option>`).join('')}</select></label></div><div id="exam-roster-list"></div>`;
    const list=host.querySelector('#exam-roster-list'),exam=host.querySelector('#roster-exam'),cls=host.querySelector('#roster-class');
    let serial=0;
    const load=async()=>{
      const request=++serial;if(!cls.value||!exam.value){list.innerHTML='';return;}
      list.textContent='Memuatkan senarai murid…';
      const result=await M.call('examRoster',{exam_id:exam.value,class_id:cls.value});if(request!==serial||!list.isConnected)return;
      list.innerHTML=`<h4>${M.esc(result.exam.exam_type+' '+result.exam.academic_year+' · '+result.class.class_name)}</h4><p>${result.students.filter(s=>!s.excluded).length} murid dalam peperiksaan · ${result.students.filter(s=>s.excluded).length} dikeluarkan</p><label>Cari murid<input id="exam-roster-search" type="search" placeholder="Nama murid"></label><div class="table-scroll"><table><thead><tr><th>Nama murid</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>${result.students.map((s,i)=>`<tr data-roster-name="${M.esc(s.name.toLowerCase())}"><td>${M.esc(s.name)}</td><td>${s.excluded?'Dikeluarkan':'Dalam peperiksaan'}</td><td>${s.excluded?M.esc(s.withdrawal?.reason||''):`<button class="secondary" data-exclude-student="${i}">Keluarkan daripada peperiksaan</button>`}</td></tr>`).join('')}</tbody></table></div><p class="muted">Jika kelas sudah disahkan, guru kelas perlu menyemak dan mengesahkannya semula. PDF lama akan ditandakan lapuk. Guru yang sedang mengisi kelas ini perlu memuat semula senarai.</p>`;
      list.querySelector('#exam-roster-search').oninput=e=>list.querySelectorAll('[data-roster-name]').forEach(row=>row.hidden=!row.dataset.rosterName.includes(e.target.value.toLowerCase()));
      list.querySelectorAll('[data-exclude-student]').forEach(button=>button.onclick=()=>{
        const s=result.students[Number(button.dataset.excludeStudent)];
        document.querySelector('#withdrawal-dialog')?.remove();
        const modal=document.createElement('dialog');modal.id='withdrawal-dialog';modal.setAttribute('aria-labelledby','withdrawal-title');
        modal.innerHTML=`<p class="eyebrow">SEMAKAN PENTADBIR</p><h3 id="withdrawal-title">Keluarkan murid</h3><p><strong>${M.esc(s.name)}</strong><br>${M.esc(result.class.class_name)} · ${M.esc(result.exam.exam_type+' '+result.exam.academic_year)}</p><p>Murid ini tidak akan muncul dalam pengisian, analisis dan slip peperiksaan ini. Rekod induk dan sejarah markah dikekalkan.</p><form id="withdrawal-form"><label>Sebab dikeluarkan<textarea name="reason" maxlength="300" required rows="3"></textarea></label><label class="withdrawal-ack"><input name="ack" type="checkbox" required> Saya telah menyemak nama, kelas dan peperiksaan.</label><div class="mark-actions"><button type="button" class="secondary" id="withdrawal-cancel">Batal</button><button type="submit" class="danger-button">Sahkan Keluarkan</button></div></form>`;
        document.body.append(modal);modal.showModal();
        modal.querySelector('#withdrawal-cancel').onclick=()=>{modal.close();modal.remove();button.focus();};
        modal.querySelector('#withdrawal-form').onsubmit=e=>{
          e.preventDefault();const reason=new FormData(e.target).get('reason').trim();if(!reason)return;
          modal.close();modal.remove();
          M.run(()=>M.feedback('Mengemas kini senarai peperiksaan…',async()=>{await M.call('examStudentExclude',{exam_id:result.exam.exam_id,class_id:result.class.class_id,student_id:s.student_id,student_name:s.name,reason,confirmed:true},true);await load();},'Murid dikeluarkan daripada peperiksaan yang dipilih.'));
        };
      });
    };
    exam.onchange=cls.onchange=()=>M.run(load);
  };
})(window.MPS);
