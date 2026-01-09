// ---------- Expense module ----------
    function refreshExpense(){
  const y = +$('yearSel').value, m = +$('monthSel').value;
  const table = $('expenseTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = expenses
    .filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (isNaN(d)) return false;
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // 更新本月花費摘要
  const summaryEl = $('expenseSummary');
  if (summaryEl){
    if (!list.length){
      summaryEl.textContent = '本月尚未有任何花費。';
    } else {
      let total = 0;
      const byCat = {};
      list.forEach(e => {
        const amt = Number(e.amount) || 0;
        total += amt;
        const key = (e.category || '未分類').trim() || '未分類';
        byCat[key] = (byCat[key] || 0) + amt;
      });
      const entries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
      const top = entries.slice(0,3)
        .map(([cat, amt]) => `${cat} ${fmtCurrency(amt)}`)
        .join('、');
      let text = `本月共有 ${list.length} 筆花費，累計 ${fmtCurrency(total)}。`;
      if (top) text += ` 主要花費項目：${top}`;
      summaryEl.textContent = text;
    }
  }

  list.forEach((e, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${escapeHtml(e.date || '')}</td>
      <td>${escapeHtml(e.category || '')}</td>
      <td>${escapeHtml(e.note || '')}</td>
      <td class="right-align">${fmtCurrency(e.amount || 0)}</td>
    `;
    tr.addEventListener('click', () => fillExpForm(e));
    tbody.appendChild(tr);
  });
}
    function gatherExpForm(){ return { photoUrls: getPhotoUrls(), id:$('expId').value || crypto.randomUUID(), date:$('expDate').value, category:$('expCategory').value, note:$('expNote').value.trim(), amount:+$('expAmount').value||0, createdAt:$('expId').value?undefined:new Date().toISOString() }; }
    function fillExpForm(e){ $('expId').value=e.id||''; $('expDate').value=e.date||''; $('expCategory').value=e.category||expCats[0]; $('expNote').value=e.note||''; $('expAmount').value=e.amount||0; $('expDelete').disabled=!e.id; }
    function saveExpense(ev){ ev.preventDefault(); const data=gatherExpForm(); if(!data.date){ alert('請輸入日期'); return; } const i=expenses.findIndex(x=>x.id===data.id); if(i>=0){ expenses[i]={...expenses[i], ...data}; } else { expenses.push(data); } save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); }
    async function deleteExpense(){ const id=$('expId').value; if(!id) return; const ok = (typeof showConfirm === 'function') ? await showConfirm('刪除花費','確定要刪除這筆花費嗎？','刪除','取消',{ danger:true }) : confirm('確定要刪除這筆花費嗎？'); if(!ok) return; expenses=expenses.filter(x=>x.id!==id); save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); }
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
    function addExpCat(){
      const openModal = (typeof showInputModal === 'function') ? showInputModal : null;

      const handle = async (raw)=>{
        const name = (raw||'').trim();
        if(!name) return;

        // length guard
        if(name.length > 20){
          if (typeof showAlert === 'function') await showAlert('新增類別', '類別名稱建議 20 字以內。');
          else alert('類別名稱建議 20 字以內。');
          return;
        }

        const lower = name.toLowerCase();
        const existed = expCats.find(c => (c||'').toLowerCase() === lower);
        if(existed){
          $('expCategory').value = existed;
          if (typeof showAlert === 'function') await showAlert('新增類別', '此類別已存在，已為你選取。');
          return;
        }

        expCats.push(name);
        save(EXP_CAT_KEY, expCats);
        initExpenseCats();
        $('expCategory').value = name;
      };

      if(openModal){
        openModal('新增花費類別', '請輸入新的花費類別名稱', '例如：油費 / 材料 / 外包', '', (val)=>{ handle(val); });
      } else {
        const val = prompt('輸入新花費類別：') || '';
        handle(val);
      }
    }

    
