// ---------- Expense module ----------
    function refreshExpense(){
      const y = +$('yearSel').value, m = +$('monthSel').value;
      const tbody = $('expenseTable').querySelector('tbody');
      tbody.innerHTML = '';
      const list = expenses
        .filter(e => {
          if(!e.date) return false;
          const d = new Date(e.date);
          if (isNaN(d)) return false;
          return d.getFullYear()===y && (d.getMonth()+1)===m;
        })
        .sort((a,b)=> (a.date||'').localeCompare(b.date));
      list.forEach((e, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx+1}</td>
                        <td>${escapeHtml(e.date||'')}</td>
                        <td>${escapeHtml(e.category||'')}</td>
                        <td>${escapeHtml(e.note||'')}</td>
                        <td class="right-align">${fmtCurrency(e.amount||0)}</td>`;
        tr.addEventListener('click', ()=>fillExpForm(e));
        
        // === Mobile keep list ===
        // idx: 1:日期 2:時間 4:客戶 5:電話 7:地址 9:確認 10:報價單 12:折後 14:操作
        try {
          tr.children[1]?.classList.add('keep-mobile');   // 日期
          tr.children[2]?.classList.add('keep-mobile');   // 時間
          tr.children[4]?.classList.add('keep-mobile');   // 客戶
          tr.children[5]?.classList.add('keep-mobile');   // 電話
          tr.children[7]?.classList.add('keep-mobile');   // 地址
          tr.querySelector('.toggle-confirm')?.classList.add('keep-mobile'); // 確認
          tr.querySelector('.toggle-quote')?.classList.add('keep-mobile');   // 報價單
          tr.children[12]?.classList.add('keep-mobile');  // 折後
          tr.querySelector('.op-cell')?.classList.add('keep-mobile');        // 操作

          // === Permanently hidden columns (provide td class hooks) ===
          tr.children[6]?.classList.add('col-slot');      // 時段
          tr.children[8]?.classList.add('col-status');    // 狀況
          tr.children[11]?.classList.add('col-total');    // 總金額
        } catch(err) { /* noop */ }

        tbody.appendChild(tr);
      });
}
    function gatherExpForm(){ return { photoUrls: getPhotoUrls(), id:$('expId').value || crypto.randomUUID(), date:$('expDate').value, category:$('expCategory').value, note:$('expNote').value.trim(), amount:+$('expAmount').value||0, createdAt:$('expId').value?undefined:new Date().toISOString() }; }
    function fillExpForm(e){ $('expId').value=e.id||''; $('expDate').value=e.date||''; $('expCategory').value=e.category||expCats[0]; $('expNote').value=e.note||''; $('expAmount').value=e.amount||0; $('expDelete').disabled=!e.id; }
    function saveExpense(ev){ ev.preventDefault(); const data=gatherExpForm(); if(!data.date){ alert('請輸入日期'); return; } const i=expenses.findIndex(x=>x.id===data.id); if(i>=0){ expenses[i]={...expenses[i], ...data}; } else { expenses.push(data); } save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); }
    function deleteExpense(){ const id=$('expId').value; if(!id) return; if(confirm('確定要刪除這筆花費嗎？')){ expenses=expenses.filter(x=>x.id!==id); save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); } }
    function expExportCsv(){ const headers=['id','日期','類別','說明','金額','建立時間']; const rows=expenses.map(e=>[e.id,e.date,e.category,(e.note||'').replace(/\n/g,' '),e.amount,e.createdAt||'']); const csv=[headers.join(','),...rows.map(r=>r.map(x=>{const s=(x??'').toString();return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(','))].join('\n'); download(`花費_${$('yearSel').value}-${pad2($('monthSel').value)}.csv`, csv); }
    function expExportJson(){ download(`花費資料備份.json`, JSON.stringify({expenses, expCats}, null, 2)); }
    function expImportJson(){ $('filePickerExp').click(); }
    $('filePickerExp')?.addEventListener('change',(e)=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result);
        if(data.expenses && Array.isArray(data.expenses)){ expenses=data.expenses; save(EXP_KEY, expenses); }
        if(data.expCats && Array.isArray(data.expCats)){ expCats=data.expCats; save(EXP_CAT_KEY, expCats); initExpenseCats(); }
        refreshExpense(); alert('花費匯入完成！'); }catch{ alert('匯入失敗：檔案格式不正確。'); } };
      reader.readAsText(file,'utf-8'); e.target.value='';
    });
    function addExpCat(){ const name=prompt('輸入新花費類別：')?.trim(); if(!name) return; if(!expCats.includes(name)){ expCats.push(name); save(EXP_CAT_KEY, expCats); initExpenseCats(); } $('expCategory').value=name; }

    
