// ---------- Utilities ----------

// === Multi-phone helpers ===
function createPhoneRow(value, removable){
  const row = document.createElement('div');
  row.className = 'phone-row';
  const input = document.createElement('input');
  input.className = 'phone-input';
  input.type = 'text';
  input.placeholder = '輸入電話';
  if (value) input.value = value;
  row.appendChild(input);
  if (removable){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'phone-remove';
    btn.setAttribute('aria-label', '刪除電話');
    btn.textContent = '−';
    row.appendChild(btn);
  }
  return row;
}

function renderPhonesFromString(s){
  const c = document.getElementById('phoneContainer');
  if (!c) return;
  c.innerHTML = '';
  const parts = (s||'').split('/').map(x=>x.trim()).filter(Boolean);
  if (parts.length === 0) {
    c.appendChild(createPhoneRow('', false));
  } else {
    parts.forEach((p, idx)=>{
      c.appendChild(createPhoneRow(p, idx > 0)); // 第2個開始可移除
    });
  }
}

function ensurePhoneDelegates(){
  const c = document.getElementById('phoneContainer');
  if (!c) return;
  // 移除事件（委派）
  c.addEventListener('click', (e)=>{
    const btn = e.target.closest('.phone-remove');
    if (!btn) return;
    const row = btn.closest('.phone-row');
    if (!row) return;
    // 移除該列
    row.remove();
    // 確保至少一個輸入框存在，且第一個沒有移除鍵
    const rows = c.querySelectorAll('.phone-row');
    if (rows.length === 0){
      c.appendChild(createPhoneRow('', false));
    } else {
      rows.forEach((r, i)=>{
        const rm = r.querySelector('.phone-remove');
        if (i === 0) {
          if (rm) rm.remove();
        } else {
          if (!r.querySelector('.phone-remove')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'phone-remove';
            btn.setAttribute('aria-label', '刪除電話');
            btn.textContent = '−';
            r.appendChild(btn);
          }
        }
      });
    }
  });
}

function getPhotoUrls(){
  return Array.from(document.querySelectorAll('.photo-url-input'))
    .map(i => i.value.trim())
    .filter(Boolean)
    .join(' | ');
}

function getPhones(){
  return Array.from(document.querySelectorAll('.phone-input'))
    .map(i=>i.value.trim())
    .filter(Boolean)
    .join(' / ');
}
function setFirstPhone(v){
  let input = document.querySelector('.phone-input');
  const pc = document.getElementById('phoneContainer');
  if(!input){
    if(pc){
      input = document.createElement('input');
      input.className='phone-input'; input.type='text'; input.placeholder='輸入電話';
      pc.appendChild(input);
    } else {
      return; // 沒有容器就不處理
    }
  }
  input.value = v || '';
}
function hasAnyPhone(){
  return Array.from(document.querySelectorAll('.phone-input')).some(i=>i.value.trim());
}

    const $ = (id) => document.getElementById(id);
    const fmtCurrency = n => Number(n||0).toLocaleString('zh-TW', {style:'currency', currency:'TWD', maximumFractionDigits:0});
    const today = new Date();
    const pad2 = n => n.toString().padStart(2,'0');
    const SLOT_OPTS = ['平日','假日','上午','下午','皆可','日期指定'];
    const BRAND_OPTS = ['HITACHI 日立','Panasonic 國際牌','DAIKIN 大金','MITSUBISHI 三菱','FUJITSU 富士通','國產貼牌','陸製品牌','其他'];

    const CONTACT_TIME_OPTS = ['平日','假日','上午','下午','晚上','皆可','時間指定'];
    const FLOOR_OPTS = ['1F','2F','3F','4F','5F','5F以上','大樓（同樓層）','透天（同樓層）'];
    const STATUS_FLOW = ['排定','完成','未完成'];

    function renderChecks(containerId, options, name){
      const el = $(containerId);
      el.innerHTML = options.map(opt => `<label class="checkbox"><input type="checkbox" data-name="${name}" value="${opt}"><span>${opt}</span></label>`).join('');
    }
    function getChecked(name){ return Array.from(document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]:checked')).map(x=>x.value); }
    function setChecked(name, values){ const set = new Set(values||[]); document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]').forEach(x=> x.checked = set.has(x.value)); }

    // ---------- Storage ----------
    const KEY = 'yl_clean_orders_v1';
    const STAFF_KEY = 'yl_clean_staff_v1';
    const CONTACT_KEY = 'yl_clean_contact_v1';
    const EXP_KEY = 'yl_clean_expenses_v1';
    const EXP_CAT_KEY = 'yl_clean_expense_categories_v1';
    const load = (k, fallback) => { try{ return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; }catch{ return fallback; } }
    const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    let orders = load(KEY, []);
    let staffList = load(STAFF_KEY, ['自然大叔']);
    let contactList = load(CONTACT_KEY, ['Line','Facebook粉絲團','直接線上預約','直接來電','裕良電器行','其他']);
    let expenses = load(EXP_KEY, []);
    let expCats = load(EXP_CAT_KEY, ['材料','加油','停車','工具/維修','其他']);


    const CONTACTS_KEY = 'yl_clean_contacts_v1';
    let contacts = load(CONTACTS_KEY, []); // {id,name,phone,address,lineId}
    function normalizePhone(p){ return (p||'').replace(/\D+/g,''); }

// ---------- Validation ----------
function isValidTwMobile(p){
  // Accept forms like 0912345678 or 0912-345-678
  const digits = (p||'').replace(/\D+/g, '');
  return /^09\d{8}$/.test(digits);
}

// --- Added: Taiwan landline + combined validator (v2, fixed recursion) ---
function isValidTwLandline(p){
  const digits = (p||'').replace(/\D+/g, '');
  if(!/^0\d+$/.test(digits)) return false;
  if(digits.startsWith('09')) return false; // mobile handled by isValidTwMobile
  // Taiwan landlines (w/ area code) are typically 9~10 digits, e.g. 02-xxxx-xxxx / 03-xxxxxxx / 0836-xxxxxx
  return digits.length >= 9 && digits.length <= 10;
}
function isValidTwPhone(p){ return isValidTwMobile(p) || isValidTwLandline(p);
}
// -------------------------------------------------------------------------


    function upsertContact(name, phone, address, lineId){
  const np = normalizePhone(phone);
  const lid = (lineId||'').trim();
  if(!name && !np && !lid) return;
  let idx = -1;
  if (np) idx = contacts.findIndex(c => normalizePhone(c.phone)===np);
  if (idx < 0 && lid) idx = contacts.findIndex(c => (c.lineId||'').trim()===lid);
  if(idx>=0){
    // merge
    contacts[idx].name = contacts[idx].name || name;
    contacts[idx].address = contacts[idx].address || address;
    if(lid) contacts[idx].lineId = contacts[idx].lineId || lineId;
    if(np) contacts[idx].phone = contacts[idx].phone || phone;
  } else {
    contacts.push({id: crypto.randomUUID(), name: name||'', phone: phone||'', address: address||'', lineId: lineId||''});
  }
  save(CONTACTS_KEY, contacts);
  refreshContactsDatalist();
}
function findContactByName(name){
      const n=(name||'').trim();
      if(!n) return null;
      const list = contacts.filter(c => (c.name||'')===n);
      if(list.length===1) return list[0];
      return null;
    }
    function findContactByLineId(lineId){
  const lid = (lineId||'').trim();
  if(!lid) return null;
  return contacts.find(c => (c.lineId||'').trim()===lid) || null;
}
function findContactByPhone(phone){
      const np = normalizePhone(phone);
      if(!np) return null;
      return contacts.find(c => normalizePhone(c.phone)===np) || null;
    }
    function refreshContactsDatalist(){
      const dl = document.getElementById('contactsDL');
      if(!dl) return;
      dl.innerHTML = contacts.map(c => `<option value="${(c.name||'')}" label="${(c.phone||'')} ${(c.address||'')}"></option>`).join('');
    }


    // ---------- Init ----------
    function initYearMonth(){
      const yearSel = $('yearSel'), monthSel = $('monthSel');
      const yearNow = new Date().getFullYear();
      const years = []; for(let y=yearNow-3;y<=yearNow+3;y++) years.push(y);
      yearSel.innerHTML = years.map(y=>`<option value="${y}" ${y===yearNow?'selected':''}>${y} 年</option>`).join('');
      monthSel.innerHTML = Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===today.getMonth()+1?'selected':''}>${m} 月</option>`).join('');
      yearSel.onchange = monthSel.onchange = ()=>{ refreshTable(); refreshExpense(); };
      $('showUndated').onchange = refreshTable;
    }
    function initFilters(){
      $('staffFilter').innerHTML = ['全部',...staffList].map(s=>`<option value="${s==='全部'?'':s}">${s}</option>`).join('');
      $('staffFilter').onchange = refreshTable;
      $('statusFilter').onchange = refreshTable;
      $('completedRange').onchange = refreshTable;
      $('searchInput').addEventListener('input', refreshTable);
    }
    function initStaffSelects(){ $('staff').innerHTML = staffList.map(s=>`<option value="${s}">${s}</option>`).join(''); initFilters(); initReminderFilters(); }
    function initContactSelect(){ $('contactMethod').innerHTML = contactList.map(c=>`<option value="${c}">${c}</option>`).join(''); }
    function initCheckboxes(){ renderChecks('slotGroup', SLOT_OPTS, 'slot');
      renderChecks('acBrandGroup', BRAND_OPTS, 'acBrand');
      try{ updateAcBrandOtherVisibility(); }catch(e){}
 renderChecks('contactTimesGroup', CONTACT_TIME_OPTS, 'contactTime'); renderChecks('acFloors', FLOOR_OPTS, 'acFloor'); renderChecks('washerFloors', FLOOR_OPTS, 'washerFloor'); updateAbove5Visibility(); }
    

// --- AC brand other visibility handler ---
// shows/hides the "其他" text input based on whether '其他' is checked
function updateAcOtherVisibility(){
  try{
    const otherInput = $('acBrandOtherText');
    if(!otherInput) return;
    const checked = !!document.querySelector('input[type="checkbox"][data-name="acBrand"][value="其他"]:checked');
    if(checked) otherInput.classList.remove('hidden');
    else otherInput.classList.add('hidden');
  }catch(e){ console.warn('updateAcOtherVisibility error', e); }
}
// listen for changes on acBrand checkboxes
document.addEventListener('change', function(e){
  if(e.target && e.target.matches && e.target.matches('input[type="checkbox"][data-name="acBrand"]')){
    updateAcOtherVisibility();
  }
});
// ensure correct visibility on initial load
window.addEventListener('load', updateAcOtherVisibility);
function initExpenseCats(){ $('expCategory').innerHTML = expCats.map(c=>`<option value="${c}">${c}</option>`).join(''); }

