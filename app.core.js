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
    let contacts = load(CONTACTS_KEY, []); // {id,name,phone,address,lineId,addresses:[]}

function normalizeAddressKey(addr){
  return (addr||'').toString().trim().toLowerCase().replace(/\s+/g,'');
}
function ensureContactAddressesSchema(c){
  if(!c) return;
  // migrate legacy single address -> addresses[]
  if(!Array.isArray(c.addresses)){
    const legacy = (c.address || '').toString().trim();
    c.addresses = legacy ? [{
      id: crypto.randomUUID(),
      label: '主要',
      address: legacy,
      note: '',
      isDefault: true,
      active: true,
      createdAt: new Date().toISOString()
    }] : [];
  } else {
    // normalize fields
    c.addresses = c.addresses.filter(Boolean).map(a => ({
      id: a.id || crypto.randomUUID(),
      label: (a.label || '').toString(),
      address: (a.address || '').toString(),
      note: (a.note || '').toString(),
      isDefault: !!a.isDefault,
      active: (a.active !== false),
      createdAt: a.createdAt || new Date().toISOString()
    }));
  }

  // ensure exactly one default among active addresses (if any)
  const active = c.addresses.filter(a => a && a.active !== false && (a.address||'').trim());
  if(active.length){
    if(!active.some(a => a.isDefault)){
      active[0].isDefault = true;
    } else {
      // if multiple defaults, keep the first
      let found = false;
      active.forEach(a => {
        if(a.isDefault){
          if(!found) found = true;
          else a.isDefault = false;
        }
      });
    }
  }

  // keep legacy c.address as the default address text for backward compatibility
  if(active.length){
    const def = active.find(a => a.isDefault) || active[0];
    if(def && def.address) c.address = def.address;
  }
}

function getContactDefaultAddress(c){
  if(!c) return '';
  ensureContactAddressesSchema(c);
  const active = c.addresses.filter(a => a && a.active !== false && (a.address||'').trim());
  if(!active.length) return (c.address||'').toString().trim();
  const def = active.find(a => a.isDefault) || active[0];
  return (def.address||'').toString().trim();
}

function addAddressToContact(c, address, opts){
  if(!c) return null;
  const addr = (address||'').toString().trim();
  if(!addr) return null;
  ensureContactAddressesSchema(c);

  const key = normalizeAddressKey(addr);
  const existing = c.addresses.find(a => normalizeAddressKey(a.address) === key);
  if(existing){
    // revive if it was disabled
    existing.active = true;
    if(opts && opts.makeDefault) {
      c.addresses.forEach(x => { if(x) x.isDefault = false; });
      existing.isDefault = true;
    }
    c.address = getContactDefaultAddress(c);
    return existing;
  }

  const count = c.addresses.length + 1;
  const item = {
    id: crypto.randomUUID(),
    label: (opts && opts.label) ? String(opts.label) : (count === 1 ? '主要' : ('地址' + count)),
    address: addr,
    note: (opts && opts.note) ? String(opts.note) : '',
    isDefault: !!(opts && opts.makeDefault) || (c.addresses.filter(a => a.active !== false).length === 0),
    active: true,
    createdAt: new Date().toISOString()
  };

  if(item.isDefault){
    c.addresses.forEach(x => { if(x) x.isDefault = false; });
    item.isDefault = true;
  }

  c.addresses.push(item);
  c.address = getContactDefaultAddress(c);
  return item;
}

function setDefaultContactAddress(c, addrId){
  if(!c || !addrId) return;
  ensureContactAddressesSchema(c);
  const target = c.addresses.find(a => a && a.id === addrId && a.active !== false);
  if(!target) return;
  c.addresses.forEach(a => { if(a) a.isDefault = false; });
  target.isDefault = true;
  c.address = getContactDefaultAddress(c);
}

function migrateContactsAddresses(){
  try{
    let changed = false;
    contacts.forEach(c => {
      const before = JSON.stringify(c.addresses || null) + '|' + (c.address||'');
      ensureContactAddressesSchema(c);
      const after = JSON.stringify(c.addresses || null) + '|' + (c.address||'');
      if(before !== after) changed = true;
    });
    if(changed) save(CONTACTS_KEY, contacts);
  }catch(e){
    console.warn('migrateContactsAddresses failed', e);
  }
}
migrateContactsAddresses();

// expose for other modules
window.getContactDefaultAddress = getContactDefaultAddress;
window.addAddressToContact = addAddressToContact;
window.setDefaultContactAddress = setDefaultContactAddress;
window.ensureContactAddressesSchema = ensureContactAddressesSchema;

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
  if (np) idx = contacts.findIndex(c => {
    const list = [];
    if (c.phone) list.push(String(c.phone));
    if (Array.isArray(c.phones)) c.phones.forEach(p => p && list.push(String(p)));
    const joined = list.join(' / ');
    return joined.split('/').some(p => normalizePhone(p) === np);
  });
  if (idx < 0 && lid) idx = contacts.findIndex(c => (c.lineId||'').trim()===lid);

  if(idx>=0){
    // merge
    contacts[idx].name = contacts[idx].name || name;
    if(lid) contacts[idx].lineId = contacts[idx].lineId || lineId;
    if(np) contacts[idx].phone = contacts[idx].phone || phone;

    // addresses
    if (address && String(address).trim()){
      addAddressToContact(contacts[idx], address, { makeDefault: !getContactDefaultAddress(contacts[idx]) });
    } else {
      ensureContactAddressesSchema(contacts[idx]);
    }
  } else {
    const c = {id: crypto.randomUUID(), name: name||'', phone: phone||'', address: (address||'').trim(), lineId: lineId||''};
    ensureContactAddressesSchema(c);
    if (address && String(address).trim()){
      addAddressToContact(c, address, { makeDefault: true });
    }
    contacts.push(c);
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
      return contacts.find(c => {
        const list = [];
        if (c.phone) list.push(String(c.phone));
        if (Array.isArray(c.phones)) c.phones.forEach(p => p && list.push(String(p)));
        const joined = list.join(' / ');
        return joined.split('/').some(p => normalizePhone(p) === np);
      }) || null;
    }
    function refreshContactsDatalist(){
      const dl = document.getElementById('contactsDL');
      if(!dl) return;
      dl.innerHTML = contacts.map(c => `<option value="${(c.name||'')}" label="${(c.phone||'')} ${(getContactDefaultAddress(c)||'')}"></option>`).join('');
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



// ---------- Report Helpers ----------
// 合併同單（bundleId）：用於報表統計「同一位技師同日同客戶跑多個地點」的合併顯示
window.mergeOrdersByBundle = function mergeOrdersByBundle(input){
  try{
    const arr = Array.isArray(input) ? input : [];
    const map = new Map();
    const out = [];
    const numericKeys = [
      'total','netTotal','discount','extraCharge',
      'acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone',
      'transformerCount','longSplitCount','onePieceTray','durationMinutes'
    ];
    const statusRank = (s)=>{
      if (s === '未完成') return 3;
      if (s === '排定') return 2;
      if (s === '完成') return 1;
      return 0;
    };
    for (const o of arr){
      if(!o || typeof o !== 'object'){ continue; }
      const b = (o.bundleId || '').trim();
      const key = b ? ('B:' + b) : ('O:' + (o.id || crypto.randomUUID()));
      if(!b){
        // 沒有 bundleId：直接原樣放進去（避免影響統計）
        out.push(o);
        continue;
      }
      if(!map.has(key)){
        const base = Object.assign({}, o);
        base.__merged = true;
        base.__mergedCount = 1;
        base.__childIds = [o.id].filter(Boolean);
        // address：先用當筆快照
        base.address = (o.address || '').trim();
        map.set(key, base);
      } else {
        const m = map.get(key);
        m.__mergedCount = (m.__mergedCount || 1) + 1;
        if(o.id) (m.__childIds = m.__childIds || []).push(o.id);
        // sums
        for(const k of numericKeys){
          const a = Number(m[k] || 0);
          const v = Number(o[k] || 0);
          if(!Number.isNaN(v)) m[k] = a + v;
        }
        // status: choose worse
        const s1 = statusRank(m.status);
        const s2 = statusRank(o.status);
        if(s2 > s1) m.status = o.status;
        // completedAt take latest
        try{
          if(o.completedAt){
            if(!m.completedAt) m.completedAt = o.completedAt;
            else if(String(o.completedAt) > String(m.completedAt)) m.completedAt = o.completedAt;
          }
        }catch(e){}
        // addresses merge distinct
        const addrs = new Set(
          String(m.address || '').split(' / ').map(x=>x.trim()).filter(Boolean)
        );
        const ao = String(o.address || '').trim();
        if(ao) addrs.add(ao);
        m.address = Array.from(addrs).join(' / ');
        // addressId drop when merged; keep first
        // notes merge (optional)
        if(o.note){
          const n1 = (m.note || '').trim();
          const n2 = String(o.note).trim();
          if(n2 && n2 !== n1){
            m.note = n1 ? (n1 + '\n---\n' + n2) : n2;
          }
        }
      }
    }
    // flush merged groups keeping original insertion order: append merged groups after unbundled
    // We'll preserve stable by iterating again and pushing first time seen
    const seen = new Set();
    const finalOut = [];
    for(const o of arr){
      if(!o || typeof o !== 'object') continue;
      const b = (o.bundleId || '').trim();
      if(!b){
        finalOut.push(o);
      } else {
        const k = 'B:' + b;
        if(!seen.has(k)){
          seen.add(k);
          finalOut.push(map.get(k));
        }
      }
    }
    return finalOut;
  } catch(e){
    console.warn('mergeOrdersByBundle failed', e);
    return Array.isArray(input) ? input : [];
  }
};
