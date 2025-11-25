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

    

// ---------- Reminder Utilities ----------

function reminderFlagsForCustomer(name){
  const n=(name||'').trim(); if(!n) return {photoUrls: getPhotoUrls(), muted:false, notified:false};
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  if(related.length===0) return {photoUrls: getPhotoUrls(), muted:false, notified:false};
  const last = related[0];
  return { photoUrls: getPhotoUrls(), muted: !!last.reminderMuted, notified: !!last.reminderNotified };
}

function addMonths(dateStr, months){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  if(isNaN(d)) return null;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if(d.getDate() < day) d.setDate(0);
  return d;
}

function fmtDate(d){
  if(!d) return '';
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function lastCompletedDateForCustomer(name){
  const n = (name||'').trim();
  if(!n) return null;
  // find latest order with status 完成 for this customer
  const done = orders
    .filter(o => (o.customer||'').trim()===n && (o.status||'')==='完成' && (o.date || o.completedAt))
    .sort((a,b)=> new Date(b.date||b.completedAt) - new Date(a.date||a.completedAt));
  if(done.length===0) return null;
  return done[0].date || done[0].completedAt;
}

function reminderMonthsForCustomer(name){
  const n = (name||'').trim();
  if(!n) return 0;
  // prefer the last completed order's reminderMonths if set; else the latest order's setting
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  if(related.length===0) return 0;
  const lastDone = related.find(o => (o.status||'')==='完成' && +o.reminderMonths>0);
  if(lastDone) return +lastDone.reminderMonths;
  const any = related.find(o => +o.reminderMonths>0);
  return any ? +any.reminderMonths : 0;
}

function nextDueDateForCustomer(name){
  const months = reminderMonthsForCustomer(name);
  if(!months) return null;
  const last = lastCompletedDateForCustomer(name);
  if(!last) return null;
  return addMonths(last, months);
}

// ---------- Pricing (extracted constants) ----------
const PRICING_KEY = 'yl_clean_pricing_v1';

const DEFAULT_PRICING = {
  acSplit: { unit: 1800, bulk3plus: 1500 },
  acDuct: { unit: 2800 },
  washerTop: { withAC: 1800, withoutAC: 2000 },
  waterTank: { unit: 1000 },
  pipesAmount: { passthrough: true },
  antiMold: { unit: 300, bulk5plus: 250 },
  ozone: { unit: 200 },
  transformerCount: { unit: 500 },
  longSplitCount: { unit: 300 },
  onePieceTray: { unit: 500 },
  thresholds: {
    // example: freeShippingOver: 5000
  }
};

let pricingConfig = load(PRICING_KEY, JSON.parse(JSON.stringify(DEFAULT_PRICING)));

function calcTotal(f){
  const cfg = pricingConfig || DEFAULT_PRICING;

  const acSplit = +f.acSplit || 0;
  const acDuct = +f.acDuct || 0;
  const washerTop = +f.washerTop || 0;
  const waterTank = +f.waterTank || 0;
  const pipesAmount = +f.pipesAmount || 0;
  const antiMold = +f.antiMold || 0;
  const ozone = +f.ozone || 0;
  const transformerCount = +f.transformerCount || 0;
  const longSplitCount = +f.longSplitCount || 0;
  const onePieceTray = +f.onePieceTray || 0;

  const splitUnit = acSplit >= 3 ? cfg.acSplit.bulk3plus : cfg.acSplit.unit;
  const splitTotal = acSplit * splitUnit;

  const ductTotal = acDuct * cfg.acDuct.unit;

  const washerUnit = (acSplit + acDuct) > 0 ? cfg.washerTop.withAC : cfg.washerTop.withoutAC;
  const washerTotal = washerTop * washerUnit;

  const tankTotal = waterTank * cfg.waterTank.unit;

  const pipesTotal = Math.max(0, pipesAmount);

  const antiMoldUnit = antiMold >= 5 ? cfg.antiMold.bulk5plus : cfg.antiMold.unit;
  const antiMoldTotal = antiMold * antiMoldUnit;

  const ozoneTotal = ozone * cfg.ozone.unit;
  const transformerTotal = transformerCount * cfg.transformerCount.unit;
  const longSplitTotal = longSplitCount * cfg.longSplitCount.unit;
  const onePieceTotal = onePieceTray * cfg.onePieceTray.unit;

  const total = splitTotal + ductTotal + washerTotal + tankTotal + pipesTotal + antiMoldTotal + ozoneTotal + transformerTotal + longSplitTotal + onePieceTotal;
  return Math.max(0, Math.round(total));
}

function gatherForm() {
return {
    
    
        photoUrls: getPhotoUrls(), reminderEnabled: !!($('reminderEnabled')?.checked),
        reminderMonths: +$('reminderMonths')?.value || 0,

        reminderNotified: !!($('reminderNotified')?.checked),
        reminderMuted: !!($('reminderMuted')?.checked),
acFloorAbove: (document.querySelector('input[type="checkbox"][data-name="acFloor"][value="5F以上"]:checked') ? ($('acFloorAbove')?.value||'').trim() : ''),
    washerFloorAbove: (document.querySelector('input[type="checkbox"][data-name="washerFloor"][value="5F以上"]:checked') ? ($('washerFloorAbove')?.value||'').trim() : ''),
durationMinutes: +$('durationMinutes').value,
        id: $('id').value || crypto.randomUUID(),
        staff:$('staff').value, date:$('date').value, time:$('time').value,
        confirmed:$('confirmed')?.checked||false, quotationOk:$('quotationOk')?.checked||false,
        customer:$('customer').value.trim(), lineIds:getLineIds(),
        lineId:(getLineIds()[0] || $('lineId').value.trim()),
        phone:getPhones().trim(),
        slots:getChecked('slot'), slotNote:$('slotNote')?.value.trim()||'', address:$('address').value.trim(),
        residenceType:$('residenceType')?.value||'', residenceOther:$('residenceOther')?.value.trim()||'',
        contactTimes:getChecked('contactTime'), contactTimeNote:$('contactTimeNote')?.value.trim()||'',
        acFloors:getChecked('acFloor'), washerFloors:getChecked('washerFloor'),
        contactMethod:$('contactMethod').value, status:$('status').value,
        acSplit:+$('acSplit').value||0, acDuct:+$('acDuct').value||0, washerTop:+$('washerTop').value||0, waterTank:+$('waterTank').value||0,
        pipesAmount:+$('pipesAmount').value||0, antiMold:+$('antiMold').value||0, ozone:+$('ozone').value||0,
        transformerCount:+$('transformerCount').value||0, longSplitCount:+$('longSplitCount').value||0, onePieceTray:+$('onePieceTray').value||0,
        note:$('note').value.trim(),
        acBrands: getChecked('acBrand'),
        acBrandOther: $('acBrandOtherText')? $('acBrandOtherText').value.trim() : '', total:+$('total').value||0, extraCharge:+$('extraCharge').value||0, discount:+$('discount').value||0, netTotal:+$('netTotal').value||0,
        createdAt:$('id').value ? undefined : new Date().toISOString()
      };
    }
    function fillForm(o){
  
  renderPhotoUrlsFromString(o.photoUrls || '');
  renderPhotoUrlLinks(o.photoUrls || '');
      $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      $('id').value=o.id||''; $('staff').value=o.staff||staffList[0];
      $('date').value=o.date||''; $('time').value=o.time||'';
      $('confirmed').checked=!!o.confirmed; $('quotationOk').checked=!!o.quotationOk;
      $('customer').value=o.customer||''; $('lineId').value=o.lineId||''; renderPhonesFromString(o.phone||'');
      setChecked('slot', o.slots||[]); $('slotNote').value=o.slotNote||''; $('slotNote').classList.toggle('hidden', !((o.slots||[]).includes('日期指定') || (o.slots||[]).includes('時間指定'))); $('address').value=o.address||'';
      $('residenceType').value=o.residenceType||''; $('residenceOther').value=o.residenceOther||''; $('residenceOther').classList.toggle('hidden', (o.residenceType||'')!=='其他');
      setChecked('contactTime', o.contactTimes||[]); $('contactTimeNote').value=o.contactTimeNote||''; $('contactTimeNote').classList.toggle('hidden', !(o.contactTimes||[]).includes('時間指定'));
      setChecked('acFloor', o.acFloors||[]); setChecked('washerFloor', o.washerFloors||[]);
      updateAbove5Visibility();
      (function(){ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; })();
      $('contactMethod').value=o.contactMethod||contactList[0]; $('status').value=o.status||'排定';
      $('reminderEnabled').checked=(o.reminderEnabled!==undefined? !!o.reminderEnabled : true); $('reminderMonths').value=(o.reminderMonths!==undefined? +o.reminderMonths : 24);
      $('reminderNotified').checked=!!o.reminderNotified; $('reminderMuted').checked=!!o.reminderMuted;
      $('acFloorAbove').value=o.acFloorAbove||''; $('washerFloorAbove').value=o.washerFloorAbove||'';
      $('acSplit').value=o.acSplit||0; $('acDuct').value=o.acDuct||0; $('washerTop').value=o.washerTop||0; $('waterTank').value=o.waterTank||0;
      $('pipesAmount').value=o.pipesAmount||0; $('antiMold').value=o.antiMold||0; $('ozone').value=o.ozone||0;
      $('transformerCount').value=o.transformerCount||0; $('longSplitCount').value=o.longSplitCount||0; $('onePieceTray').value=o.onePieceTray||0;
      $('note').value=o.note||'';
      // restore AC brand selections
      try{ setChecked('acBrand', o.acBrands||[]); if(document.getElementById('acBrandOtherText')){ document.getElementById('acBrandOtherText').classList.toggle('hidden', !((o.acBrands||[]).includes && (o.acBrands||[]).includes('其他'))); $('acBrandOtherText').value = o.acBrandOther||''; } }catch(e){console.warn(e);}  $('extraCharge').value = o.extraCharge || 0; $('discount').value=o.discount||0; $('total').value=o.total||0; $('netTotal').value=o.netTotal||0;
      $('deleteBtn').disabled=!o.id; $('formTitle').textContent=o.id?'編輯訂單':'新增訂單';

      try{ if(window.updateAcBrandOtherVisibility) window.updateAcBrandOtherVisibility(); }catch(e){}
      setFormLock(!!o.locked);
      document.getElementById('durationMinutes').value = (o.durationMinutes ?? '');
      if(o.completedAt){ $('lockInfo').textContent = '完成於 ' + new Date(o.completedAt).toLocaleString(); }
    }
    function recalcTotals(){ const total=calcTotal(gatherForm()); $('total').value=total; const extra=Math.max(0,+$('extraCharge').value||0); const discount=Math.max(0,+$('discount').value||0); $('netTotal').value=Math.max(0,total+extra-discount); }

    function setFormLock(lock){
      const ids=['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','extraCharge','discount','recalc'];
      ids.forEach(id=>{ const el=$(id); if(el){ el.disabled = !!lock; el.readOnly = !!lock; }});
      $('toggleLock').textContent = lock ? '解除鎖定（允許修改）' : '解鎖金額編輯';
      $('lockInfo').textContent = lock ? '金額已鎖定（完成）' : '';
    }


    // ---------- Table & quick status ----------
    function nextStatus(s){ const i=STATUS_FLOW.indexOf(s); return STATUS_FLOW[(i+1)%STATUS_FLOW.length]; }
    function refreshTable(){
      // Enhanced search: tokens -> filter every token across fields, score by relevance
      const y = +$('yearSel').value, m = +$('monthSel').value, staffF = $('staffFilter').value, statusF = $('statusFilter').value, showUndated = $('showUndated').checked;
      const tbody = $('ordersTable')?.querySelector('tbody');
      if(!tbody) return;
      tbody.innerHTML = '';
      const q = ($('searchInput')?.value || '').trim();
      // raw tokens for highlighting
      const rawTokens = q ? q.split(/\s+/).filter(Boolean) : [];
      // normalized tokens for matching
      const tokens = rawTokens.map(t => t.toLowerCase().replace(/\s|-/g,''));
      const digitTokens = tokens.map(t => { const d = t.replace(/\D+/g,''); return d.length >= 3 ? d : null; });

      // expose tokens for highlight helpers
      searchTokens = rawTokens.slice();

      const range = $('completedRange')?.value || '';
      const now = Date.now();

      function normalizeForMatch(s){ return (s||'').toLowerCase(); }
      function scoreForOrder(o){
        const customer = normalizeForMatch(o.customer||'');
        const address = normalizeForMatch(o.address||'');
        const phone = normalizePhone(o.phone || '');
        let score = 0;
        for(let i=0;i<tokens.length;i++){
          const t = tokens[i];
          const dt = digitTokens[i];
          if(!t) continue;
          if(customer.includes(t)){
            score += 6;
            if(customer.startsWith(t)) score += 4;
          }
          if(address.includes(t)){
            score += 2;
          }
          if(dt && phone.includes(dt)){
            score += 12;
          }
          if((o.customer||'').toLowerCase() === t) score += 8;
        }
        return score;
      }

      function matchesFilter(o){
        if(tokens.length === 0) return true;
        const customer = normalizeForMatch(o.customer||'');
        const address = normalizeForMatch(o.address||'');
        const phone = normalizePhone(o.phone || '');
        return tokens.every((t,i) => {
          const dt = digitTokens[i];
          if(dt){
            return customer.includes(t) || address.includes(t) || phone.includes(dt);
          } else {
            return customer.includes(t) || address.includes(t);
          }
        });
      }

      const filtered = (orders || []).filter(o => {
        const s1 = !staffF || o.staff === staffF;
        const s2 = !statusF || o.status === statusF;
        const condRange = !range || (o.completedAt && (now - new Date(o.completedAt).getTime()) <= (+range)*24*60*60*1000);
        if(!s1 || !s2 || !condRange) return false;
        
        if(tokens.length > 0){
          return matchesFilter(o);
        }
        if(!o.date) return showUndated && matchesFilter(o);
        const d = new Date(o.date);
        const ym = (d.getFullYear() === y && (d.getMonth()+1) === m);
        return ym && matchesFilter(o);
      }).map(o => ({ order: o, score: scoreForOrder(o) }));

      if(tokens.length === 0){
        filtered.sort((a,b) => {
          if(!a.order.date && b.order.date) return -1;
          if(a.order.date && !b.order.date) return 1;
          const dc = (a.order.date||'9999-99-99').localeCompare(b.order.date||'9999-99-99');
          if(dc !== 0) return dc;
          if(!a.order.time && b.order.time) return -1;
          if(a.order.time && !b.order.time) return 1;
          return (a.order.time||'').localeCompare(b.order.time||'');
        });
      } else {
        filtered.sort((a,b) => {
          if(b.score !== a.score) return b.score - a.score;
          const da = a.order.date ? new Date(a.order.date).getTime() : 0;
          const db = b.order.date ? new Date(b.order.date).getTime() : 0;
          if(db !== da) return db - da;
          return (b.order.time||'').localeCompare(a.order.time||'');
        });
      }

      filtered.forEach((item, idx) => {
        const o = item.order;
        const tr = document.createElement('tr');

        const dateCell = o.date ? escapeHtml(o.date) : '<span class="badge-soft">未排期</span>';
        tr.innerHTML = `
          <td class="small muted" data-label="#">${idx+1}</td>
          <td class="editable" data-label="日期">${dateCell}</td>
          <td class="editable" data-label="時間">${o.time ? escapeHtml(o.time) : '<span class="badge-soft">未排定</span>'}</td>
          <td class="staff-cell" data-label="作業人員">
            ${o.staff==='自然大叔' ? '<img src="https://res.cloudinary.com/dijzndzw2/image/upload/v1757176751/logo-3_hddq08.png" alt="自然大叔" class="staff-icon">' : escapeHtml(o.staff||'')}
          </td>
          <td class="vtext" data-label="客戶"><span class="copy-target">${escapeHtml(o.customer||'')}</span><button class="copy-btn" aria-label="複製客戶姓名" title="複製">📋</button></td>
          <td data-label="電話"><span class="copy-target">${escapeHtml(o.phone||'')}</span><button class="copy-btn" aria-label="複製電話" title="複製">📋</button></td>
          <td data-label="時段">${(o.slots||[]).join('、')}</td>
          <td data-label="地址"><span class="copy-target">${escapeHtml(o.address||'')}</span><button class="copy-btn" aria-label="複製地址" title="複製">📋</button></td>
          <td class="vtext" data-label="狀況"></td>
          <td class="toggle-confirm vtext" data-label="確認"></td>
          <td class="toggle-quote vtext" data-label="報價單"></td>
          <td class="right-align" data-label="總金額">${fmtCurrency(o.total||0)}</td>
          <td class="right-align" data-label="折後">${fmtCurrency(o.netTotal||0)}</td>
          <td data-label="來源">${escapeHtml(o.contactMethod||'')}</td>
          <td class="op-cell" data-label="操作"></td>
        `;

        // 附加照片按鈕
        const opCell = tr.querySelector('.op-cell');
        if (opCell) {
          const urls = (o.photoUrls || '').trim();
          if (urls) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-btn';
            btn.textContent = '📎';
            btn.title = '查看附加照片 / 檔案連結';
            btn.addEventListener('click', (ev)=>{
              ev.stopPropagation();
              fillForm(o);
              try { renderPhotoUrlLinks(o.photoUrls || ''); } catch(e) {}
              try {
                const acc = document.getElementById('orderAccordion');
                if (acc) acc.open = true;
              } catch(e) {}
              try {
                setTimeout(() => {
                  let target = document.getElementById('photoUrlContainer');
                  if (!target) target = document.getElementById('photoUrlViewer') || document.querySelector('.photo-url-input');
                  if (target) {
                    const row = target.closest('.row') || target.closest('.col') || target;
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const firstInput = row.querySelector('.photo-url-input');
                    if (firstInput) firstInput.focus();
                  }
                }, 30);
              } catch(e) {}
            });
            opCell.appendChild(btn);
          }
        }

        // status pill
        const st = o.status || '排定';
        const span = document.createElement('span');
        span.className = 'status ' + (st==='排定'?'P排定': st==='完成'?'C完成':'N未完成');
        span.textContent = st;
        span.title = '點一下快速切換狀況' + (o.completedAt ? ('\n完成於：' + new Date(o.completedAt).toLocaleString()) : '');
        span.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const i = orders.findIndex(x => x.id === o.id);
          if(i >= 0){
            const prev = orders[i].status || '排定';
            const next = nextStatus(prev);
            orders[i].status = next;
            if(next === '完成'){ orders[i].completedAt = new Date().toISOString(); orders[i].locked = true; }
            else { orders[i].completedAt = undefined; orders[i].locked = false; }
            save(KEY, orders);
            refreshTable();
          }
        });
        tr.children[8].appendChild(span);

        // click to open
        tr.addEventListener('click', ()=>{ fillForm(o); });

        // inline edit
        const dateTd = tr.children[1];
        const timeTd = tr.children[2];
        dateTd.addEventListener('click', (ev)=>{ ev.stopPropagation(); startInlineEdit(dateTd, 'date', o); });
        timeTd.addEventListener('click', (ev)=>{ ev.stopPropagation(); startInlineEdit(timeTd, 'time', o); });

        // highlight
        tr.children[4].innerHTML = highlightText(o.customer||'');
        tr.children[5].innerHTML = highlightPhone(o.phone||'');
        // 地址欄位將在下面重新處理

        // render confirm/quote toggles
        const ctd = tr.querySelector('.toggle-confirm');
        const qtd = tr.querySelector('.toggle-quote');
        const cspan = renderTogglePill(ctd, !!o.confirmed, '已確認', '未確認');
        const qspan = renderTogglePill(qtd, !!o.quotationOk, '已確認', '未確認');
        cspan.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i=orders.findIndex(x=>x.id===o.id); if(i>=0){ orders[i].confirmed = !orders[i].confirmed; save(KEY, orders); refreshTable(); }});
        qspan.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i=orders.findIndex(x=>x.id===o.id); if(i>=0){ orders[i].quotationOk = !orders[i].quotationOk; save(KEY, orders); refreshTable(); }});

        // op buttons
        const op = tr.querySelector('.op-cell');
        const calBtn2 = document.createElement('button'); calBtn2.className='icon-btn'; calBtn2.textContent='📅';
        calBtn2.title = '加入 Google 日曆';
        calBtn2.addEventListener('click', (ev)=>{ ev.stopPropagation(); handleUploadWithAuth(o); });
        op.appendChild(calBtn2);
        const delBtn = document.createElement('button'); delBtn.className='icon-btn danger'; delBtn.textContent='刪';
        delBtn.addEventListener('click', async (ev)=>{ ev.stopPropagation(); if (typeof showConfirm === 'function' ? await showConfirm('此頁面說明','確定要刪除此訂單嗎？','確定','取消') : confirm('確定要刪除此訂單嗎？')) { orders = orders.filter(x=>x.id!==o.id); save(KEY, orders); refreshTable(); }});
        op.appendChild(delBtn);

        // mobile classes
        try {
          tr.children[1]?.classList.add('keep-mobile');
          tr.children[2]?.classList.add('keep-mobile');
          tr.children[4]?.classList.add('keep-mobile');
          tr.children[5]?.classList.add('keep-mobile');
          tr.children[7]?.classList.add('keep-mobile');
          tr.querySelector('.toggle-confirm')?.classList.add('keep-mobile');
          tr.querySelector('.toggle-quote')?.classList.add('keep-mobile');
          tr.children[12]?.classList.add('keep-mobile');
          tr.querySelector('.op-cell')?.classList.add('keep-mobile');

          tr.children[6]?.classList.add('col-slot');
          tr.children[8]?.classList.add('col-status');
          tr.children[11]?.classList.add('col-total');
        } catch(err){ /* noop */ }

        // append floor info AND google maps link to address cell
        try {
          const addrTd = tr.children[7];
          const acList = Array.isArray(o.acFloors) ? o.acFloors.slice() : [];
          const wList = Array.isArray(o.washerFloors) ? o.washerFloors.slice() : [];
          const acExtra = (acList.includes('5F以上') && (o.acFloorAbove||'').trim()) ? `（實際：${(o.acFloorAbove||'').trim()}）` : '';
          const wExtra = (wList.includes('5F以上') && (o.washerFloorAbove||'').trim()) ? `（實際：${(o.washerFloorAbove||'').trim()}）` : '';
          const parts = [];
          if(acList.length) parts.push(`冷氣：${acList.join('、')}${acExtra}`);
          if(wList.length) parts.push(`洗衣：${wList.join('、')}${wExtra}`);
          const note = parts.length ? `<div class="floor-note">${parts.join('｜')}</div>` : '';

          // --- 地圖連結邏輯 ---
          const addrVal = o.address || '';
          const addrDisplay = highlightText(addrVal); 
          const mapUrl = addrVal ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrVal)}` : '';
          const addrHtml = mapUrl 
            ? `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:underline; text-decoration-style:dashed; text-underline-offset:4px; text-decoration-color:#9ca3af;" title="開啟 Google Maps" onclick="event.stopPropagation();">${addrDisplay}</a>` 
            : addrDisplay;

          // 重新組合（保留複製功能）
          addrTd.innerHTML = `<span class="copy-target">${addrHtml}</span><button class="copy-btn" aria-label="複製地址" title="複製">📋</button>${note}`;
          // ------------------

        } catch(err) { /* noop */ }

        tr.dataset.orderId = o.id || o._id || '';
        tbody.appendChild(tr);
      });

      try { refreshDueSoonPanel(); } catch(e){ /* ignore */ }

      // Summary
      const sumEl = $('summary'); if(sumEl) sumEl.innerHTML = '';
      const monthly = orders.filter(o=> o.date && (new Date(o.date).getFullYear()===y) && (new Date(o.date).getMonth()+1===m));
      const count = monthly.length;
      const total = monthly.reduce((a,b)=>a+(+b.total||0),0);
      const net = monthly.reduce((a,b)=>a+(+b.netTotal||0),0);
      const done = monthly.filter(o=>o.status==='完成').length;
      const pending = monthly.filter(o=>o.status!=='完成').length;
      const undatedCount = orders.filter(o=>!o.date).length;
      const monthExpense = expenses.filter(e=>{ if(!e.date) return false; const d=new Date(e.date); return d.getFullYear()===y && (d.getMonth()+1)===m; }).reduce((a,b)=>a+(+b.amount||0),0);
      const mk = (t,v,h='')=>{const box=document.createElement('div');box.className='box';box.innerHTML=`<div class="small muted">${t}</div><div class="number">${v}</div>${h?`<div class="small muted">${h}</div>`:''}`;return box;};
      if(sumEl){
        sumEl.appendChild(mk('本月訂單數', count));
        sumEl.appendChild(mk('本月總金額', fmtCurrency(total)));
        sumEl.appendChild(mk('本月折後總金額', fmtCurrency(net)));
        sumEl.appendChild(mk('本月花費', fmtCurrency(monthExpense)));
        sumEl.appendChild(mk('本月淨收入', fmtCurrency(Math.max(0, net - monthExpense))));
        sumEl.appendChild(mk('完成 / 未完成', `${done} / ${pending}`));
        if(undatedCount>0) sumEl.appendChild(mk('未排期訂單數', undatedCount, '可勾選上方「顯示未排期」查看'));
      }
    }
    
    // ---------- Calendar Exports ----------
    function toTwo(n){ return n.toString().padStart(2,'0'); }
    function formatICSDateTimeLocal(dateStr, timeStr){
      // Returns YYYYMMDDTHHMMSS for local time (floating). For better TZ, user can import and choose timezone in Google Calendar.
      if(!dateStr) return '';
      const d = new Date(dateStr + 'T' + (timeStr||'09:00') + ':00');
      return d.getFullYear().toString()+toTwo(d.getMonth()+1)+toTwo(d.getDate())+'T'+toTwo(d.getHours())+toTwo(d.getMinutes())+'00';
    }
    function sanitizeText(t){ return (t||'').replace(/([,;])/g,'\\$1').replace(/\n/g,'\\n'); }

    function buildICSFromOrders(list){
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Yuliang Clean Scheduler//v8//ZH-TW'
      ];
      list.forEach(o=>{
        const dtStart = formatICSDateTimeLocal(o.date, o.time);
        if(!dtStart) return;
        // use durationMinutes instead of default 2h
        const dtEnd = formatICSDateTimeLocal(o.date, o.time ? o.time : '11:00');
        const title = sanitizeText(`${o.customer||'客戶'} 清洗安排`);
        const staff = `作業人員：${o.staff||''}`;
        const tel = `電話：${o.phone||''}`;
        const slots = `時段：${(o.slots||[]).join('、')}`;
        const price = `金額(折後)：${o.netTotal||o.total||0}`;
        const note = o.note ? `備註：${o.note}` : '';
        const brands = (o.acBrands && (o.acBrands.length>0)) ? `品牌：${(o.acBrands||[]).join('、')}${(o.acBrandOther?('（'+o.acBrandOther+'）'):(''))}` : '';
        const desc = sanitizeText([staff, tel, slots, price, brands, note].filter(Boolean).join('\\n'));
        const loc = sanitizeText(o.address||'');
        const uid = o.id || (dtStart + '@yl-clean');
        lines.push('BEGIN:VEVENT');
        lines.push('UID:'+uid);
        lines.push('DTSTAMP:'+formatICSDateTimeLocal(new Date().toISOString().slice(0,10), new Date().toTimeString().slice(0,5)));
        lines.push('DTSTART:'+dtStart);
        lines.push('DTEND:'+dtEnd);
        lines.push('SUMMARY:'+title);
        if(loc) lines.push('LOCATION:'+loc);
        if(desc) lines.push('DESCRIPTION:'+desc);
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }

    function exportICS(){
      // rule: only include orders with date & time present, and either 已確認時間 或 狀況為「排定/完成」
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const list = orders.filter(o=>{
        if(!o.date || !o.time) return false;
        const d=new Date(o.date);
        const inMonth = d.getFullYear()===y && (d.getMonth()+1)===m;
        const okStatus = ['排定','完成'].includes(o.status||'排定');
        const okConfirm = !!o.confirmed;
        return inMonth && okStatus && okConfirm;
      });
      if(list.length===0){ alert('本月沒有符合條件（已確認且有日期與時間）的訂單可匯出。'); return; }
      const ics = buildICSFromOrders(list);
      download(`行事曆_${y}-${toTwo(m)}.ics`, ics);
    }

    function exportGCalCsv(){
      // Google Calendar CSV columns: Subject, Start Date, Start Time, End Date, End Time, All Day Event, Description, Location
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const headers = ['Subject','Start Date','Start Time','End Date','End Time','All Day Event','Description','Location'];
      const list = orders.filter(o=>{
        if(!o.date || !o.time) return false;
        const d=new Date(o.date);
        const inMonth = d.getFullYear()===y && (d.getMonth()+1)===m;
        const okStatus = ['排定','完成'].includes(o.status||'排定');
        const okConfirm = !!o.confirmed;
        return inMonth && okStatus && okConfirm;
      });
      if(list.length===0){ alert('本月沒有符合條件（已確認且有日期與時間）的訂單可匯出。'); return; }
      const rows = list.map(o=>{
        const startDate = o.date.replace(/-/g,'/'); // mm/dd/yyyy also works; we'll keep yyyy/mm/dd is okay for import in Google Calendar if locale matches
        const startTime = o.time || '09:00';
        // use order duration
        const duration = (+o.durationMinutes||120);
        const end = new Date(new Date(o.date+'T'+startTime+':00').getTime()+duration*60000);
        const endH = end.getHours(); const endDate = o.date; // simplistic; if crossing midnight, ignore for now
        const endTime = (endH.toString().padStart(2,'0'))+':'+(mm.toString().padStart(2,'0'));
        const subject = `${o.customer||'客戶'} 清洗安排`;
        const staff = `作業人員：${o.staff||''}`;
        const tel = `電話：${o.phone||''}`;
        const slots = `時段：${(o.slots||[]).join('、')}`;
        const price = `金額(折後)：${o.netTotal||o.total||0}`;
        const note = o.note ? `備註：${o.note}` : '';
        const desc = [staff, tel, slots, price, note].filter(Boolean).join('\\n');
        const loc = o.address||'';
        return [subject, startDate, startTime, endDate, endTime, 'False', desc, loc];
      });
      const csv = [headers.join(','), ...rows.map(r=>r.map(x=>{
        const s=(x??'').toString();
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(','))].join('\n');
      download(`GoogleCalendar_${y}-${toTwo(m)}.csv`, csv);
    }

    
    
        // ---------- Excel Export (.xlsx) ----------
    function exportXLSX(){
      if (typeof XLSX === 'undefined'){
        alert('Excel 程式庫尚未載入，請稍後或改用「匯出JSON」備份。');
        return;
      }
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const pad2 = n => String(n).padStart(2,'0');

      const inMonth = (dstr) => {
        if(!dstr) return false;
        const d = new Date(dstr);
        return !isNaN(d) && d.getFullYear()===y && (d.getMonth()+1)===m;
      };

      // 訂單表（只取該年該月有日期者；未排期通常不列入月報表）
      const orderHeaders = [
        'id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話',
        '安排時段(多選)','日期/時段備註','地址',
        '居住地型態','居住地型態(其他)','方便聯繫時間(多選)','方便聯繫備註',
        '冷氣樓層(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定',
        '分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤',
        '備註','總金額','折扣金額','折後總金額','建立時間'
      ];

      const includeUndated = !!($('showUndated') && $('showUndated').checked);
    const ORDERS_SRC = (typeof orders!=='undefined' && Array.isArray(orders)?orders:[]);
    const orderRows = ORDERS_SRC
      .filter(o => o.date ? inMonth(o.date) : includeUndated)
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
        .map(o => [
          o.id||'',
          o.staff||'',
          o.date||'',
          o.time||'',
          o.confirmed?'是':'否',
          o.quotationOk?'是':'否',
          o.customer||'',
          o.lineId||'',
          o.phone||'',
          (o.slots||[]).join('|')||'',
          o.slotNote||'',
          o.address||'',
          o.residenceType||'',
          o.residenceOther||'',
          (o.contactTimes||[]).join('|')||'',
          o.contactTimeNote||'',
          (o.acFloors||[]).join('|')||'',
          (o.washerFloors||[]).join('|')||'',
          o.contactMethod||'',
          o.status||'',
          o.completedAt||'',
          o.locked?'是':'否',
          +o.acSplit||0,
          +o.acDuct||0,
          +o.washerTop||0,
          +o.waterTank||0,
          +o.pipesAmount||0,
          +o.antiMold||0,
          +o.ozone||0,
          +o.transformerCount||0,
          +o.longSplitCount||0,
          +o.onePieceTray||0,
          (o.note||'').replace(/\n/g,' '),
          +o.total||0,
          +o.discount||0,
          +o.netTotal||0,
          o.createdAt||''
        ]);

      // 花費表
      const expHeaders = ['id','日期','類別','說明','金額','建立時間'];
      const expRows = (expenses||[])
        .filter(e => inMonth(e.date))
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
        .map(e => [ e.id||'', e.date||'', e.category||'', (e.note||'').replace(/\n/g,' '), +e.amount||0, e.createdAt||'' ]);

      const wb = XLSX.utils.book_new();
      const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      const wsExp = XLSX.utils.aoa_to_sheet([expHeaders, ...expRows]);

      wsOrders['!cols'] = orderHeaders.map((_,i)=>({wch:[10,10,10,8,6,6,12,12,12,16,16,20,12,14,16,14,14,14,10,8,10,8,8,8,8,10,8,8,8,10,10,12,20,10,10,10,16][i]||12}));
      wsExp['!cols'] = expHeaders.map((_,i)=>({wch:[10,10,10,24,10,16][i]||12}));

      XLSX.utils.book_append_sheet(wb, wsOrders, '訂單');
      XLSX.utils.book_append_sheet(wb, wsExp, '花費');
      XLSX.writeFile(wb, `訂單_${y}-${pad2(m)}.xlsx`);
    }

    // ---------- Search highlight helpers ----------
    let searchTokens = [];
    function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function highlightText(s){
      let out = escapeHtml(s||'');
      if(!searchTokens || searchTokens.length===0) return out;
      searchTokens.forEach(tok => {
        if(!tok) return;
        const pattern = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${pattern})`, 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    }
    function highlightPhone(s){
      const src = escapeHtml(s||'');
      if(!searchTokens || searchTokens.length===0) return src;
      let out = src;
      searchTokens.forEach(tok => {
        const digits = tok.replace(/\D+/g,'');
        if(digits.length<3) return; // avoid over-highlighting
        // Build a pattern that allows optional separators between each digit
        const parts = digits.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
        const pattern = parts.join('[\\s-]*');
        const re = new RegExp(`(${pattern})`, 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    }

    // ---------- Inline edit for date/time in table ----------
    // ---------- Quick toggle for Confirm / Quotation and quick delete ----------
    function renderTogglePill(td, value, onText='已確認', offText='未確認'){
      td.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'checkpill ' + (value ? 'on' : 'off');
      span.textContent = value ? onText : offText;
      td.appendChild(span);
      return span;
    }

    function startInlineEdit(td, kind, order){
      if(td.querySelector('input')) return; // already editing
      const input = document.createElement('input');
      input.type = (kind === 'date') ? 'date' : 'time';
      input.value = (kind === 'date') ? (order.date || '') : (order.time || '');
      input.style.width = kind === 'date' ? '140px' : '110px';
      input.addEventListener('click', e => e.stopPropagation());
      td.innerHTML = '';
      td.appendChild(input);
      input.focus();
      const commit = () => {
        const val = (input.value || '').trim();
        const idx = orders.findIndex(x => x.id === order.id);
        if(idx >= 0){
          if(kind === 'date') orders[idx].date = val;
          else orders[idx].time = val;
          save(KEY, orders);
          refreshTable();
        }
      };
      const cancel = () => refreshTable();
      input.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter') commit();
        if(e.key === 'Escape') cancel();
      });
      input.addEventListener('blur', commit);
    }

    // ---------- Orders save/delete/export/import ----------
    function saveOrder(e){
e.preventDefault();
      
      
      // Contact validation: phone optional; LINE 可替代
      const phoneVal = $('phone')?.value?.trim() || '';
      const lineVal = $('lineId')?.value?.trim() || '';
      if (phoneVal && !isValidTwPhone(phoneVal)){
        if (typeof Swal !== 'undefined' && Swal.fire){
          Swal.fire('電話格式不正確', '請輸入台灣電話（手機 0912345678/0912-345-678，或市話如 02-xxxx-xxxx、03-xxxxxxx），或改填 LINE 聯絡方式', 'warning');
        } else {
          alert('電話格式不正確，請輸入：手機 0912345678/0912-345-678，或市話（如 02-xxxx-xxxx、03-xxxxxxx），或改填 LINE 聯絡方式');
        }
        $('phone')?.focus();
        return;
      }
recalcTotals();
      const data=gatherForm();
      // Ensure items snapshot is saved for history
      try {
        if (typeof getOrderItems === 'function') {
          data.items = getOrderItems(data) || (data.items || []);
        } else {
          // fallback derive from known fields
          data.items = (function(o2){
            const arr = [];
            try{
              if (+o2.acSplit) arr.push('分離式冷氣 ' + o2.acSplit + ' 台');
              if (+o2.acDuct) arr.push('管道式冷氣 ' + o2.acDuct + ' 台');
              if (+o2.washerTop) arr.push('洗衣機 ' + o2.washerTop + ' 台');
              if (+o2.waterTank) arr.push('水塔 ' + o2.waterTank + ' 個');
              if (+o2.pipesAmount) arr.push('管線 ' + o2.pipesAmount);
              if (+o2.antiMold) arr.push('防霉 ' + o2.antiMold);
              if (+o2.ozone) arr.push('臭氧 ' + o2.ozone);
              if (+o2.transformerCount) arr.push('變壓器 ' + o2.transformerCount);
              if (+o2.longSplitCount) arr.push('長聯接 ' + o2.longSplitCount);
              if (+o2.onePieceTray) arr.push('一件托盤 ' + o2.onePieceTray);
              if (Array.isArray(o2.items) && o2.items.length) {
                o2.items.forEach(function(it){ if (it && arr.indexOf(it) === -1) arr.push(it); });
              }
            } catch(e){}
            return arr;
          })(data);
        }
      } catch(e){}
 // 日期可留空
      // validate duration
      const dm = Number(document.getElementById('durationMinutes').value);
      if (!dm || dm <= 0) {
        if (typeof showAlert === 'function') { showAlert('此頁面說明','請輸入有效的工作時長（分鐘，需大於 0）').then(()=>{ try{ document.getElementById('durationMinutes').focus(); }catch(e){} }); } else { alert('請輸入有效的工作時長（分鐘，需大於 0）'); }
        document.getElementById('durationMinutes').focus();
        return;
      }
      // handle completedAt & lock
      if(data.status==='完成'){
        data.completedAt = data.completedAt || new Date().toISOString();
        data.locked = (data.locked!==false); // default lock when completed
      } else {
        data.completedAt = undefined; data.locked = false;
      }
      const idx=orders.findIndex(x=>x.id===data.id);
      if(idx>=0){ orders[idx]={...orders[idx], ...data}; } else { orders.push(data); }
      // upsert contact
      upsertContact(data.customer, data.phone, data.address, data.lineId);
      save(KEY, orders); refreshTable(); fillForm({}); refreshContactsDatalist();
      window.scrollTo({top:0, behavior:'smooth'});
    }
function quickCreateNextOrder(){
  try {
    const base = gatherForm ? gatherForm() : {};
    const name = (base.customer || '').trim();
    if (!name){
      if (typeof Swal !== 'undefined' && Swal.fire){
        Swal.fire('無法建立下一次', '請先填寫客戶姓名，或從訂單列表選擇一筆訂單再使用此功能。', 'info');
      } else {
        alert('請先填寫客戶姓名，或從訂單列表選擇一筆訂單再使用此功能。');
      }
      $('customer')?.focus();
      return;
    }

    // 推算週期（優先使用表單上的提醒月份，其次使用客戶歷史設定，最後預設 12 個月）
    let months = 0;
    if (+base.reminderMonths > 0){
      months = +base.reminderMonths;
    } else {
      try {
        if (typeof reminderMonthsForCustomer === 'function'){
          const m2 = reminderMonthsForCustomer(name);
          if (m2) months = m2;
        }
      } catch (e){}
    }
    if (!months) months = 12;

    // 決定基準日期：優先用目前訂單日期，否則用最後完成日期
    let baseDateStr = base.date || '';
    if (!baseDateStr){
      try {
        if (typeof lastCompletedDateForCustomer === 'function'){
          const last = lastCompletedDateForCustomer(name);
          if (last) baseDateStr = last;
        }
      } catch (e){}
    }

    let nextDateStr = '';
    if (baseDateStr && typeof addMonths === 'function' && typeof fmtDate === 'function'){
      const d = addMonths(baseDateStr, months);
      if (d) nextDateStr = fmtDate(d);
    }

    const next = Object.assign({}, base);
    // 新訂單應該有新的 ID 與狀態
    next.id = '';
    next.date = nextDateStr || '';
    // 預設下一次為「排定」、尚未確認 / 報價 / 提醒
    next.status = '排定';
    next.confirmed = false;
    next.quotationOk = false;
    next.reminderNotified = false;
    // 清掉可能存在的時間戳記欄位
    delete next.createdAt;
    delete next.completedAt;

    fillForm(next);

    if (typeof Swal !== 'undefined' && Swal.fire){
      Swal.fire(
        '已建立下一次訂單草稿',
        nextDateStr
          ? ('已根據目前資料建立下一次預約（預設日期：' + nextDateStr + '），請確認時間與內容後儲存。')
          : '已根據目前資料建立下一次預約，請設定日期與時間後儲存。',
        'success'
      );
    }
  } catch (err){
    console.error(err);
    if (typeof Swal !== 'undefined' && Swal.fire){
      Swal.fire('發生錯誤', '建立下一次訂單時發生錯誤，請稍後再試。', 'error');
    } else {
      alert('建立下一次訂單時發生錯誤。');
    }
  }
}

    async function deleteOrder(){
      const id=$('id').value; if(!id) return;
      const ok = await showConfirm('刪除訂單', '確定要刪除這筆訂單嗎？');
      if(!ok) return;
      orders=orders.filter(o=>o.id!==id); save(KEY, orders); refreshTable(); fillForm({});
    }
    function resetForm(){ fillForm({}); }
    function download(filename, text){ const blob=new Blob([text],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    function exportCSV(){
      const headers=['id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話','安排時段(多選)','地址','冷氣樓屯(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定','分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤','備註','總金額','折扣金額','折後總金額','建立時間'];
      const rows=orders.map(o=>[o.id,o.staff,o.date||'',o.time,o.confirmed?'是':'否',o.quotationOk?'是':'否',o.customer,o.lineId,o.phone,(o.slots||[]).join('|'),o.address,(o.acFloors||[]).join('|'),(o.washerFloors||[]).join('|'),o.contactMethod,o.status,o.completedAt||'',o.locked?'是':'否',o.acSplit,o.acDuct,o.washerTop,o.waterTank,o.pipesAmount,o.antiMold,o.ozone,o.transformerCount,o.longSplitCount,o.onePieceTray,(o.note||'').replace(/\n/g,' '),o.total,o.discount,o.netTotal,o.createdAt||'']);
      const csv=[headers.join(','),...rows.map(r=>r.map(x=>{const s=(x??'').toString();return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(','))].join('\n');
      download(`訂單_${$('yearSel').value}-${pad2($('monthSel').value)}.csv`, csv);
    }
    function exportJSON(){ download(`訂單資料備份.json`, JSON.stringify({orders, staffList, contactList}, null, 2)); }
    function importJSON(){ $('filePicker').click(); }
    $('filePicker')?.addEventListener('change',(e)=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result);
        if(data.orders && Array.isArray(data.orders)){ orders=data.orders; save(KEY, orders); }
        if(data.staffList && Array.isArray(data.staffList)){ staffList=data.staffList; save(STAFF_KEY, staffList); initStaffSelects(); }
        if(data.contactList && Array.isArray(data.contactList)){ contactList=data.contactList; save(CONTACT_KEY, contactList); initContactSelect(); }
        refreshTable(); alert('匯入完成！'); }catch{ alert('匯入失敗：檔案格式不正確。'); } };
      reader.readAsText(file,'utf-8'); e.target.value='';
    });

    // add staff/contact
    
// helper: show a custom input modal. onConfirm receives the trimmed value.
function showInputModal(title, label, placeholder, initialValue, onConfirm) {
  const modal = document.getElementById('inputModal');
  const input = document.getElementById('inputModalInput');
  const titleEl = document.getElementById('inputModalTitle');
  const labelEl = document.getElementById('inputModalLabel');
  const btnConfirm = document.getElementById('inputModalConfirm');
  const btnCancel = document.getElementById('inputModalCancel');
  const btnClose = document.getElementById('inputModalCloseBtn');

  if (!modal) {
    // fallback to native prompt
    const val = prompt(label || title) || '';
    if (onConfirm) onConfirm(val.trim());
    return;
  }

  titleEl.textContent = title || '輸入';
  labelEl.textContent = label || '';
  input.placeholder = placeholder || '';
  input.value = initialValue || '';
  modal.setAttribute('aria-hidden','false');
  input.focus();
  input.select();

  function cleanup() {
    modal.setAttribute('aria-hidden','true');
    btnConfirm.removeEventListener('click', onConfirmClick);
    btnCancel.removeEventListener('click', onCancel);
    btnClose.removeEventListener('click', onCancel);
    modal.querySelector('.modal-backdrop')?.removeEventListener('click', onCancel);
  }

  function onConfirmClick(e) {
    const val = (input.value || '').trim();
    cleanup();
    if (onConfirm) onConfirm(val);
  }
  function onCancel(e) {
    cleanup();
  }

  btnConfirm.addEventListener('click', onConfirmClick);
  btnCancel.addEventListener('click', onCancel);
  btnClose.addEventListener('click', onCancel);
  modal.querySelector('.modal-backdrop')?.addEventListener('click', onCancel);

  // allow Enter/Escape on input
  function onKey(e){
    if(e.key === 'Enter'){ onConfirmClick(); }
    else if(e.key === 'Escape'){ onCancel(); }
  }
  input.addEventListener('keydown', onKey);

  // cleanup input listener after modal closed by wrapping cleanup to remove key listener
  const origCleanup = cleanup;
  cleanup = function(){
    input.removeEventListener('keydown', onKey);
    origCleanup();
  };
}

// add staff/contact using custom modal
function addStaff(){ 
  showInputModal('新增作業人員','輸入新作業人員名稱：','姓名', '', function(name){
    name = (name||'').trim();
    if(!name) return;
    const staffList = loadStaffList ? loadStaffList() : (window.staffList||[]);
    if(!staffList.includes(name)){
      staffList.push(name);
      saveStaffList && saveStaffList(staffList);
      initStaffSelects && initStaffSelects();
    }
    $('staff').value = name; $('staffFilter').value = '';
  });
}
function addContact(){ 
  showInputModal('新增聯繫方式','輸入新聯繫方式：','例如：Line/Email/電話', '', function(name){
    name = (name||'').trim();
    if(!name) return;
    const contactList = loadContactList ? loadContactList() : (window.contactList||[]);
    if(!contactList.includes(name)){
      contactList.push(name);
      saveContactList && saveContactList(contactList);
      initContactSelect && initContactSelect();
    }
    $('contactMethod').value = name;
  });
}


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

    
// --- Above-5F toggles ---
function updateAbove5Visibility(){
  const acChecked = !!document.querySelector('input[type="checkbox"][data-name="acFloor"][value="5F以上"]:checked');
  const wChecked  = !!document.querySelector('input[type="checkbox"][data-name="washerFloor"][value="5F以上"]:checked');
  const acWrap = document.getElementById('acFloorAboveWrap');
  const wWrap  = document.getElementById('washerFloorAboveWrap');
  if(acWrap) acWrap.classList.toggle('hidden', !acChecked);
  if(wWrap)  wWrap.classList.toggle('hidden', !wChecked);
}
document.addEventListener('change', (e)=>{
  if(e.target && e.target.matches('input[type="checkbox"][data-name="acFloor"], input[type="checkbox"][data-name="washerFloor"]')){
    updateAbove5Visibility();
  }
});


// ---------- Due Soon Panel ----------
function findLatestOrderByCustomer(name){
  const n=(name||'').trim();
  if(!n) return null;
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  return related[0] || null;
}

function refreshDueSoonPanel(){
  const panel = document.getElementById('dueSoonPanel');
  const listEl = document.getElementById('dueSoonList');
  const statsEl = document.getElementById('dueSoonStats');
  if(!panel || !listEl) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const dayMs = 24*60*60*1000;
  const seen = new Set();
  const items = [];

  (orders || []).forEach(o => {
    if(!o.reminderEnabled) return;
    const name = (o.customer || '').trim();
    if(!name || seen.has(name)) return;
    seen.add(name);
    const flags = reminderFlagsForCustomer(name);
    if(flags.muted) return;
    const nd = nextDueDateForCustomer(name);
    if(!nd) return;
    const days = Math.floor((nd - today)/dayMs);
    if(days <= 30){
      const latest = findLatestOrderByCustomer(name) || {};
      items.push({
        name,
        due: nd,
        days,
        notified: !!flags.notified,
        phone: latest.phone || '',
        address: latest.address || '',
        last: lastCompletedDateForCustomer(name) || '',
        id: latest.id || ''
      });
    }
  });

  if(items.length === 0){
    if(statsEl){
      statsEl.textContent = '目前沒有需要提醒的客戶';
    }
    listEl.classList.add('empty');
    listEl.textContent = '目前沒有 30 天內將到期的客戶';
    return;
  }

  // 統計：逾期 / 7 天內 / 8–30 天內
  const overdue = items.filter(i => i.days <= 0).length;
  const soon7 = items.filter(i => i.days > 0 && i.days <= 7).length;
  const soon30 = items.filter(i => i.days > 7 && i.days <= 30).length;
  if(statsEl){
    statsEl.innerHTML =
      `逾期 <strong>${overdue}</strong> 位，` +
      `7 天內 <strong>${soon7}</strong> 位，` +
      `8–30 天內 <strong>${soon30}</strong> 位。`;
  }

  items.sort((a,b) => {
    if (a.days !== b.days){
      return a.days - b.days;
    }
    return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
  });

  const top = items.slice(0, 3);
  listEl.classList.remove('empty');
  listEl.innerHTML = top.map(it => {
    const dueStr = fmtDate(it.due);
    let statusText = '';
    if (it.days <= 0){
      const overdueDays = Math.abs(it.days);
      statusText = overdueDays === 0 ? '今天到期' : `已逾期 ${overdueDays} 天`;
    } else {
      statusText = `還有 ${it.days} 天`;
    }
    const notifiedText = it.notified ? '（已通知）' : '';
    const meta = `下次提醒：${dueStr}（${statusText}）${notifiedText}`;
    const safeName = escapeHtml(it.name || '');
    const safeMeta = escapeHtml(meta);

    const idAttr = it.id ? ` data-open="${escapeHtml(it.id)}"` : '';
    return `
      <div class="item"${idAttr}>
        <div>
          <div class="name">${safeName}</div>
          <div class="meta">${safeMeta}</div>
        </div>
        <button type="button" class="inline-btn" data-open="${escapeHtml(it.id || '')}">開啟</button>
      </div>
    `;
  }).join('');

  // Attach open handlers
  listEl.querySelectorAll('button[data-open]').forEach(btn => {
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = btn.getAttribute('data-open');
      let target = null;
      if(id){
        target = (orders || []).find(x => x.id === id) || null;
      }
      const name = btn.closest('.item')?.querySelector('.name')?.textContent.trim() || '';
      if(target){
        fillForm(target);
      } else if (name){
        fillForm({ customer: name });
      } else {
        fillForm({});
      }
      const acc = document.getElementById('orderAccordion');
      if(acc){
        acc.open = true;
        acc.scrollIntoView({behavior:'smooth', block:'start'});
      }
    });
  });
}

// ---------- Reminder Center（提醒中心獨立頁） ----------
function initReminderFilters(){
  const staffSel = document.getElementById('reminderStaffFilter');
  if (staffSel){
    staffSel.innerHTML = ['全部', ...staffList].map(s => {
      const v = (s === '全部') ? '' : s;
      return `<option value="${v}">${s}</option>`;
    }).join('');
    staffSel.onchange = refreshReminderCenter;
  }
  const rangeSel = document.getElementById('reminderRange');
  if (rangeSel){
    rangeSel.onchange = refreshReminderCenter;
  }
  const qEl = document.getElementById('reminderSearch');
  if (qEl){
    qEl.addEventListener('input', () => refreshReminderCenter());
  }
  const showMutedEl = document.getElementById('reminderShowMuted');
  if (showMutedEl){
    showMutedEl.onchange = refreshReminderCenter;
  }
  const onlyUnnotifiedEl = document.getElementById('reminderOnlyUnnotified');
  if (onlyUnnotifiedEl){
    onlyUnnotifiedEl.onchange = refreshReminderCenter;
  }
}

function setReminderNotifiedForCustomer(name, notified){
  const n = (name || '').trim();
  if (!n) return;
  let changed = 0;
  (orders || []).forEach(o => {
    if ((o.customer || '').trim() === n){
      if (!!o.reminderNotified !== !!notified){
        o.reminderNotified = !!notified;
        changed++;
      }
    }
  });
  if (changed > 0){
    if (typeof save === 'function' && typeof KEY !== 'undefined'){
      save(KEY, orders);
    }
  }
}

function setReminderMutedForCustomer(name, muted){
  const n = (name || '').trim();
  if (!n) return;
  let changed = 0;
  (orders || []).forEach(o => {
    if ((o.customer || '').trim() === n){
      if (!!o.reminderMuted !== !!muted){
        o.reminderMuted = !!muted;
        changed++;
      }
    }
  });
  if (changed > 0){
    if (typeof save === 'function' && typeof KEY !== 'undefined'){
      save(KEY, orders);
    }
  }
}

function refreshReminderCenter(){
  const listEl = document.getElementById('reminderList');
  const statsEl = document.getElementById('reminderStats');
  if (!listEl) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const dayMs = 24*60*60*1000;

  const rangeSel = document.getElementById('reminderRange');
  const rangeVal = rangeSel ? rangeSel.value : '30';
  const staffSel = document.getElementById('reminderStaffFilter');
  const staffF = staffSel ? staffSel.value : '';
  const showMuted = document.getElementById('reminderShowMuted')?.checked || false;
  const onlyUnnotified = document.getElementById('reminderOnlyUnnotified')?.checked || false;
  const qEl = document.getElementById('reminderSearch');
  const qRaw = (qEl ? qEl.value : '').trim();
  const q = qRaw.toLowerCase();
  const qDigits = q.replace(/\D+/g,'');

  const reminderTokens = qRaw ? qRaw.split(/\s+/).filter(Boolean) : [];
  const prevSearchTokens = Array.isArray(searchTokens) ? searchTokens.slice() : [];
  searchTokens = reminderTokens;

  const seen = new Set();
  const items = [];

  (orders || []).forEach(o => {
    if (!o.reminderEnabled) return;
    const name = (o.customer || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);

    const flags = reminderFlagsForCustomer(name);
    if (flags.muted && !showMuted) return;
    if (onlyUnnotified && flags.notified) return;

    const nd = nextDueDateForCustomer(name);
    if (!nd) return;
    const days = Math.floor((nd - today) / dayMs);

    if (rangeVal === 'overdue'){
      if (days > 0) return;
    } else if (rangeVal !== 'all'){
      const limit = parseInt(rangeVal, 10);
      if (!isNaN(limit) && days > limit) return;
    }

    const latest = findLatestOrderByCustomer(name) || {};
    if (staffF && latest.staff !== staffF) return;

    if (q){
      const fields = [
        (name || '').toLowerCase(),
        (latest.phone || '').toLowerCase(),
        (latest.address || '').toLowerCase()
      ];
      let hit = fields.some(s => s && s.indexOf(q) !== -1);
      if (!hit && qDigits){
        const phoneDigits = (latest.phone || '').replace(/\D+/g,'');
        hit = phoneDigits.indexOf(qDigits) !== -1;
      }
      if (!hit) return;
    }

    items.push({
      name,
      staff: latest.staff || '',
      due: nd,
      days,
      last: lastCompletedDateForCustomer(name) || '',
      cycleMonths: reminderMonthsForCustomer(name) || 0,
      muted: !!flags.muted,
      notified: !!flags.notified,
      phone: latest.phone || '',
      address: latest.address || '',
      id: latest.id || ''
    });
  });

  items.sort((a,b) => {
    if (a.notified !== b.notified){
      return a.notified ? 1 : -1;
    }
    if (a.due && b.due && a.due.getTime() !== b.due.getTime()){
      return a.due - b.due;
    }
    return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
  });

  if (statsEl){
    const total = items.length;
    const overdue = items.filter(i => i.days <= 0).length;
    const soon7 = items.filter(i => i.days > 0 && i.days <= 7).length;
    const soon30 = items.filter(i => i.days > 7 && i.days <= 30).length;
    statsEl.innerHTML =
      `目前共有 <strong>${total}</strong> 位客戶在提醒名單；` +
      `逾期 <strong>${overdue}</strong> 位，7 天內 <strong>${soon7}</strong> 位，8–30 天內 <strong>${soon30}</strong> 位。`;
  }

  if (items.length === 0){
    listEl.innerHTML = '<div class="empty">目前沒有符合條件的提醒客戶</div>';
    // 還原主列表搜索的 highlight tokens
    searchTokens = prevSearchTokens;
    return;
  }

  listEl.innerHTML = items.map(it => {
    const dueStr = fmtDate(it.due);
    let badgeClass = 'soon30';
    let badgeLabel = '';
    if (it.days <= 0){
      badgeClass = 'due';
      badgeLabel = '已到期';
    } else if (it.days <= 7){
      badgeClass = 'soon7';
      badgeLabel = `還有 ${it.days} 天`;
    } else {
      badgeLabel = `還有 ${it.days} 天`;
    }
    const mutedBadge = it.muted ? '<span class="badge muted">已靜音</span>' : '';
    const notifiedBadge = it.notified ? '<span class="badge notified">已通知</span>' : '';
    const cycleText = it.cycleMonths ? `${it.cycleMonths} 個月` : '未設定';
    const lastStr = it.last ? it.last.slice(0,10) : '—';
    const staffStr = it.staff || '';

    return `
      <div class="rem-row" data-id="${escapeHtml(it.id || '')}" data-name="${escapeHtml(it.name || '')}">
        <div class="c-main">
          <div class="title">${highlightText(it.name || '')}</div>
          <div class="meta">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            ${notifiedBadge}
            ${mutedBadge}
          </div>
        </div>
        <div class="c-dates">
          <div>下次提醒：<strong>${dueStr}</strong></div>
          <div class="muted">最近完成：${escapeHtml(lastStr)}</div>
        </div>
        <div class="c-cycle">
          <div>週期：${escapeHtml(cycleText)}</div>
          <div class="muted">作業人員：${highlightText(staffStr)}</div>
        </div>
        <div class="c-contact">
          <div>${highlightPhone(it.phone || '')}</div>
          <div class="muted">${highlightText(it.address || '')}</div>
        </div>
        <div class="c-actions">
          <button type="button" class="inline-btn" data-action="open">開啟訂單</button>
          <button type="button" class="inline-btn" data-action="notified">${it.notified ? '取消已通知' : '標記已通知'}</button>
          <button type="button" class="inline-btn" data-action="mute">${it.muted ? '恢復提醒' : '不再提醒'}</button>
        </div>
      </div>
    `;
  }).join('');

  // 還原主列表搜索的 highlight tokens
  searchTokens = prevSearchTokens;

  // 綁定 row 內的按鈕事件
  listEl.querySelectorAll('.rem-row').forEach(row => {
    const name = row.getAttribute('data-name') || row.querySelector('.title')?.textContent.trim() || '';
    const id = row.getAttribute('data-id') || '';

    row.querySelectorAll('button[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (action === 'open'){
          // 切回主畫面 + 開啟該客戶訂單
          setActiveView('main');
          let target = null;
          if (id){
            target = (orders || []).find(o => o.id === id) || null;
          }
          if (target){
            fillForm(target);
          } else {
            fillForm({ customer: name });
          }
          const acc = document.getElementById('orderAccordion');
          if (acc){
            acc.open = true;
            acc.scrollIntoView({ behavior:'smooth', block:'start' });
          }
        } else if (action === 'notified'){
          const nowNotified = !items.find(x => x.id === id)?.notified;
          setReminderNotifiedForCustomer(name, nowNotified);
          refreshDueSoonPanel();
          refreshReminderCenter();
        } else if (action === 'mute'){
          const nowMuted = !items.find(x => x.id === id)?.muted;
          setReminderMutedForCustomer(name, nowMuted);
          refreshDueSoonPanel();
          refreshReminderCenter();
        }
      });
    });
  });

}


function setActiveView(view){
  const mainMode = document.getElementById('mainMode');
  const reminderSection = document.getElementById('reminderCenterSection');
  const tabs = document.querySelectorAll('.view-tab');

  tabs.forEach(btn => {
    const v = btn.getAttribute('data-view') || 'main';
    if (view === v){
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });

  if (mainMode && reminderSection){
    if (view === 'reminder'){
      mainMode.style.display = 'none';
      reminderSection.style.display = '';
      refreshReminderCenter();
    } else {
      mainMode.style.display = '';
      reminderSection.style.display = 'none';
    }
  }
}

function initViewTabs(){
  const tabs = document.querySelectorAll('.view-tab');
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view') || 'main';
      setActiveView(v);
    });
  });
}

// ---------- Events ----------
    function attachEvents(){
      // order form
      $('orderForm').addEventListener('submit', saveOrder);
      $('deleteBtn').addEventListener('click', deleteOrder);
      $('resetBtn').addEventListener('click', resetForm);
      $('recalc').addEventListener('click', recalcTotals);
      ['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','extraCharge','discount']
        .forEach(id => $(id).addEventListener('input', recalcTotals));
      $('newBtn').addEventListener('click', ()=>{ fillForm({}); });
      $('quickNextBtn')?.addEventListener('click', quickCreateNextOrder);
$('exportJson').addEventListener('click', exportJSON);
$('importJson').addEventListener('click', importJSON);
      $('clearAll').addEventListener('click', ()=>{ (async ()=>{ const ok = await showConfirm('清空所有訂單','確定要清空所有訂單資料嗎？此動作無法復原。'); if(ok){ orders=[]; save(KEY, orders); refreshTable(); } })(); });
      $('addStaffBtn').addEventListener('click', addStaff);
      $('addContactMethod').addEventListener('click', addContact);
      // 新增 LINE/Facebook ID 按鈕動作：在 #lineIdContainer 新增一個輸入欄位
      $('addLineIdBtn')?.addEventListener('click', ()=>{
        const container = document.getElementById('lineIdContainer');
        if(!container) return;
        container.appendChild(createLineIdRow(''));
        // focus newest input
        const inputs = container.querySelectorAll('input.lineid-input');
        if(inputs.length) inputs[inputs.length-1].focus();
      });// Autofill from contacts when name/phone entered
      $('customer').addEventListener('blur', ()=>{ const c = findContactByName($('customer').value); if(c){ if ($('phone').dataset.touched !== '1' && !getPhones()) getPhones() = c.phone||''; if(!$('address').value) $('address').value = c.address||''; if(!$('lineId').value) $('lineId').value = c.lineId||''; }
      });
      // ---- phone touched guard (so user can keep it empty) ----
try {
  $('phone').dataset.touched = $('phone').dataset.touched || '0';
  $('phone').addEventListener('input', ()=>{ $('phone').dataset.touched = '1'; });
} catch(e) { /* ignore if element missing */ }
// ---------------------------------------------------------
const pc = document.getElementById('phoneContainer');
if (pc) {
  pc.addEventListener('blur', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('phone-input')) {
      const val = e.target.value;
      const c = findContactByPhone(val);
      if (c) {
        if (!$('customer').value) $('customer').value = c.name || '';
        if (!$('address').value) $('address').value = c.address || '';
        if (!$('lineId').value) $('lineId').value = c.lineId || '';
      }
    }
  }, true);
}
$('lineId').addEventListener('blur', ()=>{
        const c3 = findContactByLineId($('lineId').value);
        if(c3){ if(!$('customer').value) $('customer').value = c3.name||''; if(!$('address').value) $('address').value = c3.address||''; if ($('phone').dataset.touched !== '1' && !getPhones()) setFirstPhone(c3.phone || ''); }
      });
      // removed: phone blur handler (replaced by delegation)
// Recompute nextReminder when customer/reminderMonths change
      $('customer').addEventListener('blur', ()=>{ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; });
      $('reminderMonths').addEventListener('input', ()=>{ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; });

      // expenses
      $('expenseForm').addEventListener('submit', saveExpense);
      $('expDelete').addEventListener('click', deleteExpense);
      $('expReset').addEventListener('click', ()=>fillExpForm({}));
      $('expExportCsv').addEventListener('click', expExportCsv);
      $('expExportJson').addEventListener('click', expExportJson);
      $('expImportJson').addEventListener('click', expImportJson);
      $('expClear').addEventListener('click', ()=>{ if(confirm('確定要清空所有花費資料嗎？此動作無法復原。')){ expenses=[]; save(EXP_KEY, expenses); refreshExpense(); } });
      $('addExpCat').addEventListener('click', addExpCat);

      $('toggleLock').addEventListener('click', ()=>{
        const id=$('id').value; if(!id){ alert('請先選擇或儲存一筆訂單'); return; }
        const i=orders.findIndex(o=>o.id===id); if(i<0) return;
        const wantUnlock = orders[i].locked;
        if(wantUnlock && !confirm('確定要解除金額鎖定嗎？解除後可修改金額與折扣。')) return;
        orders[i].locked = !orders[i].locked;
        save(KEY, orders);
        setFormLock(orders[i].locked);
      });

      // 複製相關
      function copyOrderToForm(o){
        const t={...o};
        delete t.id; t.status='排定'; t.confirmed=false; t.quotationOk=false; t.completedAt=undefined; t.locked=false; t.date=''; t.time='';
        fillForm(t); recalcTotals();
        $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      }
      function copyOrderFrom(o){ copyOrderToForm(o); }
      $('copyLastBtn').addEventListener('click', ()=>{
        if(orders.length===0){ alert('目前沒有可複製的訂單'); return; }
        const last = [...orders].sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0];
        if(!last){ alert('找不到上一筆'); return; }
        copyOrderToForm(last);
      });
      $('copyFromHistoryBtn').addEventListener('click', ()=>{
        const np = normalizePhone(getPhones());
        let cand = null;
        if(np){ cand = [...orders].filter(o=> normalizePhone(o.phone)===np).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
        if(!cand && $('customer').value){ cand = [...orders].filter(o=> (o.customer||'')=== $('customer').value.trim()).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
        if(!cand){ alert('找不到此客戶的舊單（請先輸入姓名或電話）'); return; }
        copyOrderToForm(cand);
      });


      // Accordion behavior: auto-collapse on small screens
      function adjustAccordion(){
        const acc = $('expenseAcc');
        if(!acc) return;
        if(window.innerWidth < 900){ acc.open = false; } else { acc.open = true; }
      }
      window.addEventListener('resize', adjustAccordion);
      adjustAccordion();
    
      
    
      // residenceType toggle
      $('residenceType')?.addEventListener('change', ()=>{
        $('residenceOther').classList.toggle('hidden', $('residenceType').value!=='其他');
      });
      // contact time "時間指定" toggle
      document.addEventListener('change', (e)=>{
        if(e.target && e.target.matches('input[type="checkbox"][data-name="contactTime"]')){
          const specified = Array.from(document.querySelectorAll('input[type="checkbox"][data-name="contactTime"]'))
                              .some(x=> x.checked && (x.value==='日期指定' || x.value==='時間指定'));
          $('contactTimeNote').classList.toggle('hidden', !specified);
        }
      });
    
    
      // slot "時間指定" toggle
      document.addEventListener('change', (e)=>{
        if(e.target && e.target.matches('input[type="checkbox"][data-name="slot"]')){
          const specified = Array.from(document.querySelectorAll('input[type="checkbox"][data-name="slot"]'))
                              .some(x=> x.checked && (x.value==='日期指定' || x.value==='時間指定'));
          $('slotNote').classList.toggle('hidden', !specified);
        }
      });
    
    
      // auto-open orderAccordion when buttons clicked
      ;['saveBtn','resetBtn','copyLastBtn','copyFromHistoryBtn','quickNextBtn'].forEach(id=>{
        $(id)?.addEventListener('click', ()=>{ $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'}); });
      });
    
    
      // 新增花費按鈕：切到花費區塊頂部並重置表單
      $('newExpenseBtn')?.addEventListener('click', ()=>{
        if (typeof fillExpForm === 'function') fillExpForm({});
        const exp = $('expenseAcc');
        if (exp){ exp.open = true; exp.scrollIntoView({behavior:'smooth', block:'start'}); }
      });
    
    
      // 新增訂單：展開並捲動到區塊開頭
      $('newBtn')?.addEventListener('click', ()=>{
        $('orderAccordion').open = true;
        $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      });

      // 前往提醒中心（從首頁快到期區塊）
      $('btnOpenReminderCenter')?.addEventListener('click', ()=>{
        if (typeof setActiveView === 'function') setActiveView('reminder');
      });

      $('exportXlsx')?.addEventListener('click', exportXLSX);
      initViewTabs();
    }

    
// ---------- Pricing Settings Logic ----------
function initPricingLogic(){
  const modal = document.getElementById('pricingModal');
  const openBtn = document.getElementById('openPricingBtn');
  if (!modal || !openBtn) return;

  const closeBtn = document.getElementById('pricingCloseBtn');
  const saveBtn = document.getElementById('savePricingBtn');
  const resetBtn = document.getElementById('resetPricingBtn');
  const backdrop = modal.querySelector('.modal-backdrop');

  const fieldMap = {
    acSplit_unit: ['acSplit','unit'],
    acSplit_bulk3plus: ['acSplit','bulk3plus'],
    acDuct_unit: ['acDuct','unit'],
    washerTop_withAC: ['washerTop','withAC'],
    washerTop_withoutAC: ['washerTop','withoutAC'],
    waterTank_unit: ['waterTank','unit'],
    ozone_unit: ['ozone','unit'],
    transformerCount_unit: ['transformerCount','unit'],
    onePieceTray_unit: ['onePieceTray','unit'],
    antiMold_unit: ['antiMold','unit'],
    antiMold_bulk5plus: ['antiMold','bulk5plus'],
    longSplitCount_unit: ['longSplitCount','unit']
  };

  function deepGet(obj, path, fallback){
    let cur = obj;
    for (let i=0;i<path.length;i++){
      if (!cur || typeof cur !== 'object') return fallback;
      cur = cur[path[i]];
    }
    return (typeof cur === 'number') ? cur : fallback;
  }

  function deepSet(obj, path, value){
    let cur = obj;
    for (let i=0;i<path.length-1;i++){
      const k = path[i];
      if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[path[path.length-1]] = value;
  }

  function syncFormFromConfig(){
    const cfg = pricingConfig || DEFAULT_PRICING;
    Object.keys(fieldMap).forEach(key => {
      const input = document.getElementById('price_' + key);
      if (!input) return;
      const path = fieldMap[key];
      const defVal = deepGet(DEFAULT_PRICING, path, 0);
      const val = deepGet(cfg, path, defVal);
      input.value = val != null ? val : '';
    });
  }

  function buildConfigFromForm(){
    const base = JSON.parse(JSON.stringify(DEFAULT_PRICING));
    Object.keys(fieldMap).forEach(key => {
      const input = document.getElementById('price_' + key);
      if (!input) return;
      const raw = input.value;
      const path = fieldMap[key];
      const defVal = deepGet(DEFAULT_PRICING, path, 0);
      let num = Number(raw);
      if (!Number.isFinite(num) || num <= 0) num = defVal;
      deepSet(base, path, num);
    });
    return base;
  }

  function openModal(){
    syncFormFromConfig();
    modal.setAttribute('aria-hidden','false');
  }

  function closeModal(){
    modal.setAttribute('aria-hidden','true');
  }

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  if (resetBtn){
    resetBtn.addEventListener('click', () => {
      pricingConfig = JSON.parse(JSON.stringify(DEFAULT_PRICING));
      save(PRICING_KEY, pricingConfig);
      syncFormFromConfig();
    });
  }

  if (saveBtn){
    saveBtn.addEventListener('click', () => {
      pricingConfig = buildConfigFromForm();
      save(PRICING_KEY, pricingConfig);
      closeModal();
      try{
        recalcTotals();
      }catch(e){}
    });
  }
}

// ---------- Boot ----------
    (function boot(){
      setTimeout(refreshDueSoonPanel, 0);

      // Reminder summary (non-intrusive console + optional alert)
      try{
        const today = new Date(); today.setHours(0,0,0,0);
        let due=0, soon=0;
        const seen = new Set();
        orders.forEach(o=>{
          if(!o.reminderEnabled) return;
          const name = (o.customer||'').trim();
          if(!name || seen.has(name)) return;
          seen.add(name);
          const flags = reminderFlagsForCustomer(name);
    if(flags.muted) return;
          const nd = nextDueDateForCustomer(name);
          if(!nd) return;
          const days = Math.floor((nd - today)/(24*60*60*1000));
          if(days <= 0) due++;
          else if(days <= 30) soon++;
        });
        if(due>0 || soon>0){
          console.log(`[提醒] 到期:${due}，將到期(30天內):${soon}`);
        }
      }catch(e){}

      initYearMonth(); initStaffSelects(); initContactSelect(); initCheckboxes(); initExpenseCats(); initPricingLogic();
      attachEvents(); refreshContactsDatalist(); fillForm({}); fillExpForm({}); refreshTable();
      try { if(typeof makeOrdersTableResizable === 'function') makeOrdersTableResizable(); } catch(e){}
      refreshExpense();
    })();

// ---- concatenated from inline <script> blocks ----

/* ===== Offline .xlsx exporter (no external deps) =====
   Builds a minimal XLSX (2 sheets) using uncompressed ZIP.
   Sheets: 訂單 / 花費, with inline strings (no sharedStrings).
*/
(function(){
  // --- helpers ---
  const enc = new TextEncoder();
  const toBytes = (s)=> enc.encode(s);

  // CRC32
  const CRC_TABLE = (()=>{
    let c, table = new Uint32Array(256);
    for (let n=0; n<256; n++){
      c = n;
      for (let k=0; k<8; k++){
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(buf){
    let c = 0 ^ (-1);
    for (let i=0; i<buf.length; i++){
      c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
  }
  function strToXml(s){
    return (s||'').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\r?\n/g, '&#10;');
  }
  function colName(col){ // 1->A, 2->B, ...
    let s='', n=col;
    while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); }
    return s;
  }
  function sheetXML(headers, rows){
    let r=1, out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<sheetData>'];
    // header row
    let cells = headers.map((h,i)=>`<c r="${colName(i+1)}${r}" t="inlineStr"><is><t>${strToXml(h)}</t></is></c>`).join('');
    out.push(`<row r="${r}">${cells}</row>`); r++;
    // data rows
    for(const row of rows){
      let cs=[];
      for(let i=0;i<row.length;i++){
        const v = row[i];
        const ref = `${colName(i+1)}${r}`;
        if(typeof v === 'number' && isFinite(v)){
          cs.push(`<c r="${ref}"><v>${v}</v></c>`);
        }else{
          cs.push(`<c r="${ref}" t="inlineStr"><is><t>${strToXml(v)}</t></is></c>`);
        }
      }
      out.push(`<row r="${r}">${cs.join('')}</row>`); r++;
    }
    out.push('</sheetData></worksheet>');
    return out.join('');
  }

  // Minimal ZIP (store only)
  function buildZip(files){ // files: [{name, data(Uint8Array)}]
    const LFH = 0x04034b50, CDH=0x02014b50, EOCD=0x06054b50;
    const arrs=[];
    let offset=0;
    const cdEntries=[];
    function pushUint32(v){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,v,true); arrs.push(b); offset+=4; }
    function pushUint16(v){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,v,true); arrs.push(b); offset+=2; }
    function pushBytes(b){ arrs.push(b); offset+=b.length; }

    for(const f of files){
      const nameBytes = toBytes(f.name);
      const data = f.data;
      const crc = crc32(data);
      const comp = 0; // store
      const modTime = 0, modDate = 0;

      // local file header
      { pushUint32(LFH);
        pushUint16(20);      // version needed
        pushUint16(0);       // flags
        pushUint16(comp);    // method
        pushUint16(modTime); // time
        pushUint16(modDate); // date
        pushUint32(crc);
        pushUint32(data.length); // compressed size (store)
        pushUint32(data.length); // uncompressed size
        pushUint16(nameBytes.length);
        pushUint16(0); // extra len
        pushBytes(nameBytes);
        pushBytes(data);
      }
      const lfhEnd = offset;

      // central directory entry
      const cdStart = offset; // not used
      const cd = [];
      function push32(v){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,v,true); cd.push(b); }
      function push16(v){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,v,true); cd.push(b); }
      push32(CDH);
      push16(20); // version made by
      push16(20); // version needed
      push16(0);  // flags
      push16(comp);
      push16(modTime); push16(modDate);
      push32(crc);
      push32(data.length); push32(data.length);
      push16(nameBytes.length); push16(0); push16(0); // name, extra, comment
      push16(0); push16(0); // disk start, int attrs
      push32(0); // ext attrs
      // relative offset of local header -> need to compute; we track by sum of previous arrays, so we store now:
      const relOffset = lfhEnd - (30 + nameBytes.length + data.length);
      push32(relOffset);
      cd.push(nameBytes);
      cdEntries.push(cd);
    }

    const cdOffset = offset;
    for(const parts of cdEntries){ for(const b of parts){ arrs.push(b); offset+=b.length; } }
    const cdSize = offset - cdOffset;

    // EOCD
    pushUint32(EOCD);
    pushUint16(0); pushUint16(0); // disk numbers
    pushUint16(files.length); pushUint16(files.length);
    pushUint32(cdSize);
    pushUint32(cdOffset);
    pushUint16(0); // comment length

    // concat
    let total = 0; for(const a of arrs) total += a.length;
    const out = new Uint8Array(total);
    let p=0; for(const a of arrs){ out.set(a,p); p+=a.length; }
    return out;
  }

  // Workbook XML pieces
  function contentTypes(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
  }
  function rootRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }
  function workbook(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="訂單" sheetId="1" r:id="rId1"/>
    <sheet name="花費" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;
  }
  function workbookRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;
  }

  // Override existing function name
  window.exportXLSX = function(){
    const y = +$('yearSel').value, m = +$('monthSel').value;
    const pad2 = n => String(n).padStart(2,'0');

    const inMonth = (dstr) => {
      if(!dstr) return false;
      const d = new Date(dstr);
      return !isNaN(d) && d.getFullYear()===y && (d.getMonth()+1)===m;
    };

    const orderHeaders = [
      'id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話',
      '安排時段(多選)','日期/時段備註','地址',
      '居住地型態','居住地型態(其他)','方便聯繫時間(多選)','方便聯繫備註',
      '冷氣樓層(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定',
      '分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤',
      '備註','總金額','折扣金額','折後總金額','建立時間'
    ];
    const orderRows = (typeof orders!=='undefined' && Array.isArray(orders)?orders:[])
      .filter(o => inMonth(o.date))
      .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
      .map(o => [
        o.id||'', o.staff||'', o.date||'', o.time||'',
        o.confirmed?'是':'否', o.quotationOk?'是':'否', o.customer||'',
        o.lineId||'', o.phone||'',
        (o.slots||[]).join('|')||'', o.slotNote||'', o.address||'',
        o.residenceType||'', o.residenceOther||'',
        (o.contactTimes||[]).join('|')||'', o.contactTimeNote||'',
        (o.acFloors||[]).join('|')||'', (o.washerFloors||[]).join('|')||'',
        o.contactMethod||'', o.status||'', o.completedAt||'', o.locked?'是':'否',
        +o.acSplit||0, +o.acDuct||0, +o.washerTop||0, +o.waterTank||0, +o.pipesAmount||0,
        +o.antiMold||0, +o.ozone||0, +o.transformerCount||0, +o.longSplitCount||0, +o.onePieceTray||0,
        (o.note||'').replace(/\n/g,' '), +o.total||0, +o.discount||0, +o.netTotal||0, o.createdAt||''
      ]);

    const expHeaders = ['id','日期','類別','說明','金額','建立時間'];
    const expRows = (typeof expenses!=='undefined' && Array.isArray(expenses)?expenses:[])
      .filter(e => inMonth(e.date))
      .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
      .map(e => [e.id||'', e.date||'', e.category||'', (e.note||'').replace(/\n/g,' '), +e.amount||0, e.createdAt||'']);

    // Build files
    const files = [
      {name:'[Content_Types].xml', data: toBytes(contentTypes())},
      {name:'_rels/.rels', data: toBytes(rootRels())},
      {name:'xl/workbook.xml', data: toBytes(workbook())},
      {name:'xl/_rels/workbook.xml.rels', data: toBytes(workbookRels())},
      {name:'xl/worksheets/sheet1.xml', data: toBytes(sheetXML(orderHeaders, orderRows))},
      {name:'xl/worksheets/sheet2.xml', data: toBytes(sheetXML(expHeaders, expRows))},
    ];
    const zip = buildZip(files);
    const blob = new Blob([zip], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `訂單_${y}-${pad2(m)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
})();

// ---- concatenated from inline <script> blocks ----

// 重新綁定「匯出Excel」按鈕，避免沿用舊的 SheetJS 事件處理器
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exportXlsx');
  if (btn && typeof window.exportXLSX === 'function') {
    const clone = btn.cloneNode(true);           // 移除既有所有 listener
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', () => window.exportXLSX());
  }
});

// ---- concatenated from inline <script> blocks ----

var gTokenClient = null;


// --- Generic modal helpers (showConfirm / showAlert) ---
function showConfirm(title, message, okLabel = '確定', cancelLabel = '取消') {
  return new Promise((resolve) => {
    const modal = document.getElementById('genericConfirmModal');
    if (!modal) return resolve(confirm(message)); // fallback to native
    const t = document.getElementById('genericConfirmTitle');
    const m = document.getElementById('genericConfirmMessage');
    const ok = document.getElementById('genericConfirmOk');
    const cancel = document.getElementById('genericConfirmCancel');
    t.textContent = title || '確認';
    m.textContent = message || '';
    ok.textContent = okLabel || '確定';
    cancel.textContent = cancelLabel || '取消';
    function cleanup(res) {
      modal.setAttribute('aria-hidden','true');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      resolve(res);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    modal.setAttribute('aria-hidden','false');
  });
}

function showAlert(title, message, okLabel = '確定') {
  return new Promise((resolve) => {
    const modal = document.getElementById('genericAlertModal');
    if (!modal) { alert(message); return resolve(); }
    const t = document.getElementById('genericAlertTitle');
    const m = document.getElementById('genericAlertMessage');
    const ok = document.getElementById('genericAlertOk');
    t.textContent = title || '提示';
    m.textContent = message || '';
    ok.textContent = okLabel || '確定';
    function cleanup(){ modal.setAttribute('aria-hidden','true'); ok.removeEventListener('click', onOk); resolve(); }
    function onOk(){ cleanup(); }
    ok.addEventListener('click', onOk);
    modal.setAttribute('aria-hidden','false');
  });
}

// --- end modal helpers ---

function initGoogle() {
  gTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '894514639805-g3073pmjvadbasfp1g25r24rjhl9iacb.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setTimeout(() => {
        Swal.fire({
          title: '請選擇操作',
          input: 'radio',
          inputOptions: {
            '1': '備份至 Google 雲端',
            '2': '從 Google 雲端還原'
          },
          inputValidator: (value) => {
            if (!value) return '請選擇一項操作';
          },
          confirmButtonText: '確定'
        }).then(async (result) => {
          if (result.isConfirmed) {
            const choice = result.value;
            if (choice === '1') await backupToDrive(token);
            else if (choice === '2') await restoreFromDrive(token);
          }
        });
      }, 0);
    }
  });
}

function initGoogleBackup() {
  if (!gTokenClient) initGoogle();
  gTokenClient.requestAccessToken();
}
function extractCityDistrict(address) {
  if (!address) return { photoUrls: getPhotoUrls(), city: '', district: '' };
  const match = address.match(/^(.*?[市縣])\s*([\u4e00-\u9fa5]{1,4}[區鄉鎮市])/);
  if (match) {
    return { photoUrls: getPhotoUrls(), city: match[1], district: match[2] };
  }
  return { photoUrls: getPhotoUrls(), city: '', district: '' };
}
function getOrderItems(o) {
  let items = [];
  if (+o.acSplit > 0) items.push(`分離式冷氣${o.acSplit}台`);
  if (+o.acDuct > 0) items.push(`吊隱式冷氣${o.acDuct}台`);
  if (+o.washerTop > 0) items.push(`直立式洗衣機${o.washerTop}台`);
  if (+o.waterTank > 0) items.push(`水塔${o.waterTank}顆`);
  if (+o.pipesAmount > 0) items.push(`自來水管`);
  if (+o.antiMold > 0) items.push(`防霉${o.antiMold}台`);
  if (+o.ozone > 0) items.push(`臭氧殺菌${o.ozone}間`);
  if (+o.transformerCount > 0) items.push(`變形金剛${o.transformerCount}台`);
  if (+o.longSplitCount > 0) items.push(`分離式>182cm ${o.longSplitCount}台`);
  if (+o.onePieceTray > 0) items.push(`一體式水盤${o.onePieceTray}台`);
  return items.join('、');
}

// ---- concatenated from inline <script> blocks ----

async function backupToDrive(token) {
  try {
    const content = JSON.stringify(localStorage, null, 2);
    const file = new Blob([content], { type: 'application/json' });

    // 使用 localStorage 控制輪替（1或2）
    let index = parseInt(localStorage.getItem('backupIndex') || '1');
    const filename = `清洗訂單_備份_${index}.json`;

    // 查找同名舊檔案（如有則刪除）
    const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(`name='${filename}' and trashed=false`), {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const searchJson = await searchRes.json();
    const existingFile = searchJson.files?.[0];
    if (existingFile) {
      await fetch("https://www.googleapis.com/drive/v3/files/" + existingFile.id, {
        method: 'DELETE',
        headers: new Headers({ Authorization: 'Bearer ' + token })
      });
    }

    // 上傳新檔案（相同檔名）
    const metadata = { name: filename, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: new Headers({ Authorization: 'Bearer ' + token }),
      body: form
    });

    if (res.ok) {
      Swal.fire('✅ 備份成功', filename, 'success');
      const next = index === 1 ? 2 : 1;
      localStorage.setItem('backupIndex', next.toString());
    } else {
      const err = await res.json();
      Swal.fire('❌ 備份失敗', err.error.message, 'error');
    }
  } catch (e) {
    Swal.fire('❌ 備份錯誤', e.message, 'error');
  }
}

// ---- concatenated from inline <script> blocks ----

async function restoreFromDrive(token) {
  try {
    // 搜尋兩個備份檔案
    const query = "name contains '清洗訂單_備份_' and trashed=false";
    const listRes = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc", {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const listJson = await listRes.json();
    const files = listJson.files || [];

    if (files.length === 0) {
      return Swal.fire('⚠️ 找不到任何備份檔', '', 'warning');
    }

    const inputOptions = {};
    files.slice(0, 2).forEach(file => {
      const time = new Date(file.modifiedTime).toLocaleString();
      inputOptions[file.id] = `${file.name}（${time}）`;
    });

    const { value: fileId } = await Swal.fire({
      title: '選擇要還原的備份檔',
      input: 'radio',
      inputOptions,
      inputValidator: (value) => !value && '請選擇一個檔案',
      confirmButtonText: '還原'
    });

    if (!fileId) return;

    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const data = await downloadRes.json();

    localStorage.clear();
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }

    Swal.fire('✅ 還原成功', '', 'success').then(() => location.reload());
  } catch (e) {
    Swal.fire('❌ 還原錯誤', e.message, 'error');
  }
}

// ---- concatenated from inline <script> blocks ----

const CLIENT_ID = '894514639805-g3073pmjvadbasfp1g25r24rjhl9iacb.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
let gToken = null;

async function handleUploadWithAuth(orderData) {
  if (!orderData.date || !orderData.time) {
    await showAlert('錯誤', '請先填寫此訂單的日期與時間');
    return;
  }
  
  // Validate duration: require durationMinutes or duration (positive number)
  const durRaw = orderData?.durationMinutes ?? orderData?.duration ?? orderData?.durationMin ?? orderData?.workMinutes;
  const hasDur = typeof durRaw !== 'undefined' && durRaw !== null && String(durRaw).trim() !== '';
  const durNum = hasDur ? Number(durRaw) : NaN;
  if (!hasDur || isNaN(durNum) || durNum <= 0) {
    await showAlert('缺少資料', '請輸入有效的工作時長（分鐘，需大於 0）。');
    return;
  }
const okUpload = await showConfirm('上傳 Google 日曆', '確定要將此訂單上傳至 Google 日曆嗎？');
  if (!okUpload) return;
  if (gToken) {
    uploadEventToCalendar(orderData);
  } else {
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        gToken = tokenResponse.access_token;
        uploadEventToCalendar(orderData);
      }
    });
    gTokenClient.requestAccessToken();
  }
}

async function uploadEventToCalendar(o) {
  const start = new Date(`${o.date}T${o.time}:00`);
  const duration = +o.durationMinutes || 120;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  // 新增：自動組合縣市區＋姓名＋清洗項目
  const { city, district } = extractCityDistrict(o.address || '');
  const orderItems = getOrderItems(o);
  const summary = `${city}${district} ${o.customer || ''} ${orderItems}`;

  const descArr = [];
    descArr.push(`姓名：${o.customer || ''}`);
    descArr.push(`電話：${o.phone || ''}`);
    if (o.acFloors && o.acFloors.length > 0) {
      let s = `冷氣位於樓層：${(o.acFloors||[]).join('、')}`;
      if ((o.acFloorAbove||'').trim()) s += `（實際：${(o.acFloorAbove||'').trim()}）`;
      descArr.push(s);
    }
    if (o.washerFloors && o.washerFloors.length > 0) {
      let s2 = `洗衣機位於樓層：${(o.washerFloors||[]).join('、')}`;
      if ((o.washerFloorAbove||'').trim()) s2 += `（實際：${(o.washerFloorAbove||'').trim()}）`;
      descArr.push(s2);
    }
    if (o.netTotal || o.total) descArr.push(`金額(折後)：${o.netTotal||o.total||0}`);
    if (o.acBrands && o.acBrands.length) descArr.push(`品牌：${(o.acBrands||[]).join('、')}${o.acBrandOther ? '（'+o.acBrandOther+'）' : ''}`);
    if (o.note) descArr.push(`備註：${o.note}`);
    const description = descArr.join('\n');

    const event = {
      summary,
      location: o.address || '',
      description: description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() }
    };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + gToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (res.ok) {
  // 使用 SweetAlert2 美化成功彈窗
  if (typeof Swal !== 'undefined' && Swal.fire) {
    Swal.fire({
      icon: 'success',
      title: '已成功加入 Google 日曆',
      text: `${o.customer || '這筆訂單'} 已新增到行事曆中。`,
      footer: '可以到 Google 日曆查看與編輯這筆排程。',
      showConfirmButton: true,
      confirmButtonText: '太好了！',
      // 如果想要自動關閉，可以加上這兩行：
      // timer: 1800,
      // timerProgressBar: true,
    });
  } else if (typeof showAlert === 'function') {
    // 若 SweetAlert2 不在，就走你自訂的 Alert Modal
    showAlert('上傳成功', '已成功加入 Google 日曆！');
  } else {
    // 最後保險：才用原生 alert
    alert('✅ 已成功加入 Google 日曆！');
  }
} else {
  const err = await res.json();
  if (typeof Swal !== 'undefined' && Swal.fire) {
    Swal.fire({
      icon: 'error',
      title: '上傳失敗',
      text: err.error?.message || '未知錯誤，請稍後再試。',
      confirmButtonText: '了解'
    });
  } else if (typeof showAlert === 'function') {
    showAlert('上傳失敗', err.error?.message || '未知錯誤，請稍後再試。');
  } else {
    alert(`❌ 上傳失敗：${err.error?.message || '未知錯誤'}`);
  }
}
}

// ---- concatenated from inline <script> blocks ----

// （已改為由操作列的第一顆按鈕提供📅上傳功能）
// ---- concatenated from inline <script> blocks ----

// 強制手風琴預設收合（解決部分瀏覽器 <details> 預設展開問題）
window.addEventListener('DOMContentLoaded', () => {
  const order = document.getElementById('orderAccordion');
  const exp = document.getElementById('expenseAcc');
  if (order) order.open = false;
  if (exp) exp.open = false;
});


// 🧔 顯示作業人員時自動轉換 icon
function displayStaff(name) {
  if (name === "自然大叔") {
    return '<img src="https://res.cloudinary.com/dijzndzw2/image/upload/v1757176751/logo-3_hddq08.png" alt="自然大叔" style="height:20px;width:20px;border-radius:50%;vertical-align:middle;">';
  }
  return name;
}

// 🧑‍🔧 修改所有需要渲染 staff 的欄位，可使用 innerHTML 而不是 innerText，例如：
const renderStaffCell = (cell, staffName) => {
  cell.innerHTML = displayStaff(staffName);
};

// === bootstrap for multi-phone UI ===
window.addEventListener('load', () => {
  try {
    const ensureOnePhone = () => {
      const c = document.getElementById('phoneContainer');
      if (!c) return;
      if (!c.querySelector('.phone-input')) {
        const rows = c.querySelectorAll('.phone-row');
        const row = createPhoneRow('', true);
        c.appendChild(row);
      }
    };

    const addBtn = document.getElementById('addPhoneBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const c = document.getElementById('phoneContainer');
        if (!c) return;
        const rows = c.querySelectorAll('.phone-row');
        const row = createPhoneRow('', true);
        c.appendChild(row);
      });
    }
    ensureOnePhone();
    ensurePhoneDelegates();
  } catch (e) { /* noop */ }
});



// === 保證顯示版 Copy 按鈕檢查 ===
window.addEventListener('load', () => {
  try {
    // 1. 若沒有 copy-btn 樣式則自動插入
    if (!document.querySelector('#copy-btn-style')) {
      const style = document.createElement('style');
      style.id = 'copy-btn-style';
      style.textContent = `
        .copy-btn {
          display: inline-block !important;
          margin-left: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 1rem;
          color: #6b7280;
          vertical-align: middle;
        }
        .copy-btn:active { transform: scale(0.92); }
      `;
      document.head.appendChild(style);
    }

    // 2. 在表格載入後檢查每列是否已有按鈕
    const patchCopyButtons = () => {
      document.querySelectorAll('#ordersTable tbody tr').forEach(tr => {
        ['客戶', '電話', '地址'].forEach(label => {
          const td = tr.querySelector(`[data-label="${label}"]`);
          if (td && !td.querySelector('.copy-btn')) {
            const span = td.querySelector('.copy-target') || td.querySelector('span') || td.firstChild;
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = '📋';
            btn.title = '複製';
            btn.setAttribute('aria-label', '複製');
            if (span) span.after(btn);
            else td.appendChild(btn);
          }
        });
      });
    };

    patchCopyButtons();
    // 監聽表格變化（當重新載入資料時自動補上）
    const table = document.querySelector('#ordersTable tbody');
    if (table && 'MutationObserver' in window) {
      const mo = new MutationObserver(() => patchCopyButtons());
      mo.observe(table, { childList: true, subtree: true });
    }

    // 3. 綁定點擊事件
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const td = btn.closest('td');
      let text = '';
      if (td) {
        const span = td.querySelector('.copy-target') || td.querySelector('span');
        if (span) text = span.textContent.trim();
        else text = td.textContent.trim().replace('📋', '').trim();
      }
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✅';
          setTimeout(() => (btn.textContent = '📋'), 800);
        });
      } else {
        alert('此瀏覽器不支援自動複製');
      }
    });
  } catch (err) {
    console.error('copy-btn init failed', err);
  }
});



// === 強化版 Copy-to-clipboard with capture phase ===
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopImmediatePropagation(); // 完全阻止其他 click handler
  e.stopPropagation(); // 阻止冒泡到 tr 或父層
  const td = btn.closest('td');
  let text = '';
  if (td) {
    const span = td.querySelector('.copy-target') || td.querySelector('span');
    if (span) text = span.textContent.trim();
    else text = td.textContent.trim().replace('📋', '').trim();
  }
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      btn.textContent = '✅';
      setTimeout(() => (btn.textContent = '📋'), 800);
    });
  } else {
    alert('此瀏覽器不支援自動複製');
  }
}, true); // ✅ use capture phase


// ===== 靜音名單（Mute List） =====
(function(){
  const $ = (q,root=document)=>root.querySelector(q);
  const $$ = (q,root=document)=>Array.from(root.querySelectorAll(q));
  function normalizePhone(p){ return (p||'').replace(/\D+/g,''); }

  function getCustomerFlags(){
    // 聚合每位客戶（以電話為主，退而求其次用姓名）之提醒旗標
    const map = new Map(); // key: phone||name, val: {name, phone, address, muted:boolean}
    for(const o of (typeof orders!=='undefined'? orders: [])){
      const phone = normalizePhone(o.phone||o.customerPhone||o.tel||o.mobile||'');
      const name = (o.customer||'').trim() || (o.name||'').trim();
      const key = phone || name;
      if(!key) continue;
      const cur = map.get(key) || { name, phone, address: (o.address||''), muted: false };
      // 若任何一筆為靜音，視為該客戶靜音
      cur.muted = !!(cur.muted || o.reminderMuted);
      // 優化填入 name/phone/address
      if(!cur.name && name) cur.name = name;
      if(!cur.phone && phone) cur.phone = phone;
      if(!cur.address && o.address) cur.address = o.address;
      map.set(key, cur);
    }
    return Array.from(map.values());
  }

  function renderMuteTable(){
    const tbody = $('#muteTable tbody');
    if(!tbody) return;
    const kw = ($('#muteSearch')?.value||'').trim().toLowerCase();
    const list = getCustomerFlags()
      .filter(x=> x.muted)                             // 只列出已靜音者
      .filter(x=> !kw || (x.name||'').toLowerCase().includes(kw) || (x.phone||'').includes(kw) || (x.address||'').toLowerCase().includes(kw));

    const frag = document.createDocumentFragment();
    list.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.name||''}</td>
        <td>${c.phone||''}</td>
        <td>${c.address||''}</td>
        <td>${c.muted? '已靜音' : '—'}</td>
        <td><button type="button" class="icon-btn" data-action="toggle" data-phone="${c.phone}">恢復提醒</button></td>
      `;
      frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
  
    // 更新標題上的數量
    (function(){
      const h2 = document.querySelector('#muteListSection summary h2');
      if (h2) h2.textContent = `靜音名單 (${list.length})`;
    })();
    }

  function setMutedForKey(phoneOrName, muted){
    const key = (phoneOrName||'').trim();
    const np = normalizePhone(key);
    let changed = 0;
    for (let i=0; i<(orders||[]).length; i++){
      const o = orders[i];
      const op = normalizePhone(o.phone||o.customerPhone||o.tel||o.mobile||'');
      const name = (o.customer||'').trim() || (o.name||'').trim();
      const match = (np && op===np) || (!np && name===key);
      if (match){
        if (!!o.reminderMuted !== !!muted){
          o.reminderMuted = !!muted;
          changed++;
        }
      }
    }
    if (changed>0 && typeof save==='function' && typeof KEY!=='undefined') save(KEY, orders);
  }

  function mountMuteEvents(){
    const tbody = $('#muteTable tbody');
    if (!tbody) return;
    tbody.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action="toggle"]');
      if(!btn) return;
      const phone = btn.getAttribute('data-phone')||'';
      // 取消靜音 => 等同把 reminderMuted 設為 false
      setMutedForKey(phone, false);
      renderMuteTable();
      // 嘗試同步 UI：若表單區存在「不再提醒」勾選框，取消勾選
      const chk = document.getElementById('reminderMuted');
      if (chk) chk.checked = false;
      if (typeof Swal!=='undefined') Swal.fire({icon:'success', title:'已恢復提醒'});
    });

    // 搜尋
    const search = document.getElementById('muteSearch');
    search?.addEventListener('input', renderMuteTable);
  }

  function initMuteList(){
    if(!document.getElementById('muteListSection')) return;
    renderMuteTable();
    mountMuteEvents();
    const det = document.getElementById('muteCollapse');
    if(det) det.removeAttribute('open'); // 預設收合
  }

  document.addEventListener('DOMContentLoaded', initMuteList);

  // 與表單內「不再提醒」互相同步（共通邏輯）：
  document.addEventListener('change', (e)=>{
    const t = e.target;
    if (!(t && t.id==='reminderMuted' && t.type==='checkbox')) return;
    const muted = !!t.checked;
    // 以目前表單的電話或姓名當作 key，同步 orders 內所有相關訂單
    const phone = (document.getElementById('phoneContainer')?.querySelector('.phone-input')?.value||'').trim();
    const name = (document.getElementById('customer')?.value||'').trim();
    const key = (phone || name);
    if (key) setMutedForKey(key, muted);
    // 更新靜音名單表格
    renderMuteTable();
  });

})();

// 初始同步一次靜音名單數量（避免首次載入沒有數字）
document.addEventListener('DOMContentLoaded', ()=>{
  const tbody = document.querySelector('#muteTable tbody');
  if (tbody) {
    const cells = tbody.querySelectorAll('tr');
    const h2 = document.querySelector('#muteListSection summary h2');
    if (h2) h2.textContent = `靜音名單 (${cells.length})`;
  }
});


function createPhotoUrlRow(value, removable){
  const row = document.createElement('div');
  row.className = 'photo-row';
  const input = document.createElement('input');
  input.className = 'photo-url-input';
  input.type = 'url';
  input.placeholder = 'https://...';
  if (value) input.value = value;
  row.appendChild(input);
  if (removable){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-remove';
    btn.setAttribute('aria-label', '刪除網址');
    btn.textContent = '−';
    row.appendChild(btn);
  }
  return row;
}

function renderPhotoUrlsFromString(s){
  const c = document.getElementById('photoUrlContainer');
  if (!c) return;
  c.innerHTML = '';
  const parts = (s||'').split('|').map(x=>x.trim()).filter(Boolean);
  if (parts.length === 0) {
    c.appendChild(createPhotoUrlRow('', false));
  } else {
    parts.forEach((p, idx)=>{
      c.appendChild(createPhotoUrlRow(p, idx > 0));
    });
  }
}

document.getElementById('addPhotoUrlBtn')?.addEventListener('click', () => {
  const container = document.getElementById('photoUrlContainer');
  if (!container) return;

  // 這一步很關鍵：先切到「可編輯模式」
  // （把原本只讀的網址列表隱藏，把輸入區顯示出來）
  if (typeof enablePhotoUrlEdit === 'function') {
    enablePhotoUrlEdit();
  }

  // 新增一列空白輸入框
  const row = createPhotoUrlRow('', true);
  container.appendChild(row);

  // 幫你把游標直接放進去，好直接貼網址
  const input = row.querySelector('.photo-url-input');
  if (input) {
    input.focus();
  }
});

document.getElementById('photoUrlContainer')?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.photo-remove');
  if (!btn) return;
  const row = btn.closest('.photo-row');
  if (row) row.remove();
});
function renderPhotoUrlLinks(s){
  const viewer = document.getElementById('photoUrlViewer');
  const editor = document.getElementById('photoUrlContainer');
  if (!viewer || !editor) return;
  const urls = (s || '').split('|').map(x => x.trim()).filter(Boolean);
  viewer.innerHTML = '';
  if (urls.length === 0){
    viewer.style.display = 'none';
    editor.style.display = '';
    return;
  }
  urls.forEach(url => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.textContent = url;
    link.style.display = 'block';
    link.style.color = '#007bff';
    viewer.appendChild(link);
  });
  viewer.style.display = ''; const btn = document.getElementById('editPhotoUrlsBtn'); if (btn) btn.style.display = 'inline-block';
  editor.style.display = 'none';
}

function enablePhotoUrlEdit() {
  const viewer = document.getElementById('photoUrlViewer');
  const editor = document.getElementById('photoUrlContainer');
  const btn = document.getElementById('editPhotoUrlsBtn');
  viewer.style.display = 'none';
  editor.style.display = '';
  if (btn) btn.style.display = 'none';
}


/* ==== Assistant appended resizer utility ==== */


/* ==== Column resize utility injected by assistant ==== */
(function(){
  const STORAGE_KEY = 'ordersTableColWidths';

  function applySavedWidths(table) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (!data || Object.keys(data).length === 0) return;
      const ths = table.querySelectorAll('thead th');
      ths.forEach((th, i) => {
        const w = data[i];
        if (w) {
          th.style.width = w + 'px';
          const rows = table.querySelectorAll('tbody tr');
          rows.forEach(row => {
            const cell = row.querySelectorAll('td')[i];
            if (cell) cell.style.width = w + 'px';
          });
        }
      });
    } catch (e) {
      console.warn('applySavedWidths failed', e);
    }
  }

  function saveWidths(table) {
    const ths = table.querySelectorAll('thead th');
    const data = {};
    ths.forEach((th, i) => {
      const w = parseInt(window.getComputedStyle(th).width, 10);
      if (!isNaN(w)) data[i] = w;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  window.resetColumnWidths = function() {
    localStorage.removeItem(STORAGE_KEY);
    const table = document.querySelector('#ordersTable');
    if (table) {
      const ths = table.querySelectorAll('thead th');
      ths.forEach(th => th.style.width = '');
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        row.querySelectorAll('td').forEach(td => td.style.width = '');
      });
    }
  };

  window.makeOrdersTableResizable = function() {
    const table = document.querySelector('#ordersTable');
    if (!table) return;
    const thead = table.querySelector('thead');
    if (!thead) return;

    table.querySelectorAll('.orders-col-resizer').forEach(el => el.remove());

    const ths = Array.from(thead.querySelectorAll('th'));
    ths.forEach((th, index) => {
      if (index === ths.length - 1) return;
      const resizer = document.createElement('div');
      resizer.className = 'orders-col-resizer';
      resizer.dataset.colIndex = index;
      // minimal inline style if CSS not present
      resizer.style.position = 'absolute';
      resizer.style.top = '0';
      resizer.style.right = '0';
      resizer.style.width = '12px';
      resizer.style.height = '100%';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      resizer.style.zIndex = 5;
      th.style.position = th.style.position || 'relative';
      th.appendChild(resizer);

      resizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        startDrag(e, table, index);
      });
      resizer.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        startDrag(touch, table, index);
      }, {passive:false});
    });

    applySavedWidths(table);
  };

  function startDrag(e, table, colIndex) {
    const th = table.querySelectorAll('thead th')[colIndex];
    if (!th) return;
    const startX = e.clientX;
    const startWidth = parseInt(window.getComputedStyle(th).width, 10);

    document.documentElement.classList.add('orders-col-resizing');

    function onMove(ev) {
      const clientX = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
      if (clientX === undefined) return;
      const diff = clientX - startX;
      let newWidth = startWidth + diff;
      const min = 40;
      const max = 1200;
      if (newWidth < min) newWidth = min;
      if (newWidth > max) newWidth = max;
      th.style.width = newWidth + 'px';
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cell = row.querySelectorAll('td')[colIndex];
        if (cell) cell.style.width = newWidth + 'px';
      });
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.documentElement.classList.remove('orders-col-resizing');
      saveWidths(table);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  // Auto-run after a short delay in case table is built later
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => { try{ if(typeof makeOrdersTableResizable==='function') makeOrdersTableResizable(); }catch(e){} }, 350);
  });

})();


// --- 年度區塊收合 / 切換功能 (預設：收起) ---
(function(){
  const STORAGE_KEY = (typeof KEY !== 'undefined' ? KEY + '_year_expanded' : 'year_expanded');

  function setYearExpanded(expanded){
    const el = document.getElementById('yearSummary');
    const btn = document.getElementById('toggleYearBtn');
    if(!el || !btn) return;
    if(expanded){
      el.classList.remove('collapsed');
      btn.setAttribute('aria-expanded','true');
      btn.innerText = '年度統計 ▴';
    } else {
      el.classList.add('collapsed');
      btn.setAttribute('aria-expanded','false');
      btn.innerText = '年度統計 ▾';
    }
    try { localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0'); } catch(e){ /* ignore */ }
  }

  function toggleYear(){
    const el = document.getElementById('yearSummary');
    if(!el) return;
    const currentlyExpanded = !el.classList.contains('collapsed');
    setYearExpanded(!currentlyExpanded);
  }

  window.initYearToggle = function initYearToggle(){
    const btn = document.getElementById('toggleYearBtn');
    const el = document.getElementById('yearSummary');

    if(!el) {
      if(btn) btn.style.display = 'none';
      return;
    }
    if(!btn) {
      el.classList.add('collapsed');
      return;
    }

    if(btn.dataset.init === '1') {
      applyYearStateKeep();
      return;
    }

    let pref = null;
    try { pref = localStorage.getItem(STORAGE_KEY); } catch(e){ pref = null; }

    let shouldExpand = false;
    if(pref === '1') shouldExpand = true;
    else shouldExpand = false; // default collapsed

    if(shouldExpand) el.classList.remove('collapsed'); else el.classList.add('collapsed');

    btn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    btn.innerText = shouldExpand ? '年度統計 ▴' : '年度統計 ▾';
    btn.addEventListener('click', toggleYear);
    btn.dataset.init = '1';
  };

  window.applyYearStateKeep = function applyYearStateKeep(){
    const el = document.getElementById('yearSummary');
    const btn = document.getElementById('toggleYearBtn');
    if(!el) return;
    let pref = null;
    try { pref = localStorage.getItem(STORAGE_KEY); } catch(e){ pref = null; }
    if(pref === '1') el.classList.remove('collapsed');
    else el.classList.add('collapsed'); // include null => collapsed

    if(btn) {
      btn.setAttribute('aria-expanded', el.classList.contains('collapsed') ? 'false' : 'true');
      btn.innerText = el.classList.contains('collapsed') ? '年度統計 ▾' : '年度統計 ▴';
    }
  };

})();

// Ensure year toggle is initialized
document.addEventListener('DOMContentLoaded', function(){ if (typeof initYearToggle === 'function') initYearToggle(); });



// === 年度統計：獨立年份下拉選單 (可選單一年或全部) ===
(function(){
  // Wait until core variables (orders, expenses) are available
  function initYearStat(){
    const sel = document.getElementById('yearStatSelect');
    const summaryEl = document.getElementById('yearSummary');
    if(!sel || !summaryEl) return;

    function getYearsFromOrders(){
      try {
        const yrs = Array.from(new Set((orders || []).map(o=> o.date ? new Date(o.date).getFullYear() : null).filter(Boolean)));
        yrs.sort((a,b)=>b-a); // desc
        return yrs;
      } catch(e){ return []; }
    }

    function populateYearOptions(){
      const years = getYearsFromOrders();
      const opts = ['<option value="all">全部年份</option>'].concat(years.map(y=>`<option value="${y}">${y}</option>`));
      sel.innerHTML = opts.join('');
      // default: latest year (most recent) if exists, otherwise 'all'
      if(years.length>0){
        sel.value = String(years[0]);
      } else {
        sel.value = 'all';
      }
    }

    function renderYearStats(targetYear){
      const ord = orders || [];
      const exp = expenses || [];
      const filtered = ord.filter(o=> {
        if(!o.date) return false;
        const y = new Date(o.date).getFullYear();
        return targetYear === 'all' ? true : (y == targetYear);
      });
      const totalCount = filtered.length;
      const totalAmount = filtered.reduce((s,o)=> s + (+o.total||0), 0);
      const netAmount = filtered.reduce((s,o)=> s + (+o.netTotal||0), 0);
      const expenseTotal = exp.filter(e => {
        if(!e.date) return false;
        const y = new Date(e.date).getFullYear();
        return targetYear === 'all' ? true : (y == targetYear);
      }).reduce((s,e)=> s + (+e.amount||0), 0);
      const completed = filtered.filter(o=> o.status === '完成').length;
      const doneRate = totalCount ? ((completed/totalCount*100).toFixed(1) + '%') : '—';
      const netIncome = netAmount - expenseTotal;

      summaryEl.innerHTML = `
        <div class="box"><div class="small">年份</div><div class="number">${targetYear === 'all' ? '全部' : targetYear}</div></div>
        <div class="box"><div class="small">筆數</div><div class="number">${totalCount}</div></div>
        <div class="box"><div class="small">總金額</div><div class="number">${fmtCurrency(totalAmount)}</div></div>
        <div class="box"><div class="small">折後總金額</div><div class="number">${fmtCurrency(netAmount)}</div></div>
        <div class="box"><div class="small">花費</div><div class="number">${fmtCurrency(expenseTotal)}</div></div>
        <div class="box"><div class="small">淨收入</div><div class="number">${fmtCurrency(netIncome)}</div></div>
        <div class="box"><div class="small">完成率</div><div class="number">${doneRate}</div></div>
      `;
    }

    // expose a refresh function so other code can call it (e.g. after import)
    window.refreshYearStatSelect = function(){
      const prev = sel.value;
      populateYearOptions();
      // if previous still exists, restore it; else keep default (latest)
      const foundPrev = Array.from(sel.options).some(o=>o.value === prev);
      sel.value = foundPrev ? prev : sel.value;
      renderYearStats(sel.value);
    };

    // initial populate & render
    populateYearOptions();
    renderYearStats(sel.value);

    // when user changes selection
    sel.addEventListener('change', function(){ renderYearStats(this.value); });
  }

  // run init on DOMContentLoaded so elements exist; if DOM already loaded try immediately
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initYearStat);
  } else {
    initYearStat();
  }
})();



/* Customer history feature (added by assistant) */

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/[^\d+]/g, '');
}

function getCustomerKeyFromOrder(order) {
  if (!order) return '';
  if (order.lineId) return 'line:' + String(order.lineId).trim();
  if (Array.isArray(order.phones) && order.phones.length && order.phones[0]) {
    return 'phone:' + normalizePhone(order.phones[0]);
  }
  if (order.phone) return 'phone:' + normalizePhone(order.phone);
  if (order.customer) return 'name:' + String(order.customer).trim().toLowerCase();
  return '';
}


function getCustomerKeyFromRow(tr) {
  try {
    const phoneTd = tr.querySelector('[data-label="電話"]');
    const custTd = tr.querySelector('[data-label="客戶"]');
    const addrTd = tr.querySelector('[data-label="地址"]');
    let phone = '';
    if (phoneTd) {
      const pt = phoneTd.querySelector('.copy-target') || phoneTd;
      phone = (pt.textContent || '').trim();
    }
    if (phone && phone.replace(/\D/g,'').length >= 3) {
      return 'phone:' + normalizePhone(phone);
    }
    // try line or facebook in custTd dataset
    if (custTd) {
      const lineId = custTd.dataset.lineId || custTd.getAttribute('data-line-id');
      const fbId = custTd.dataset.facebookId || custTd.getAttribute('data-facebook-id');
      if (lineId) return 'line:' + String(lineId).trim();
      if (fbId) return 'facebook:' + String(fbId).trim();
      const ct = custTd.querySelector('.copy-target') || custTd;
      const name = (ct.textContent || '').trim();
      if (name) return 'name:' + name.toLowerCase();
    }
    if (addrTd) {
      const at = addrTd.querySelector('.copy-target') || addrTd;
      const addr = (at.textContent || '').trim();
      if (addr) return 'address:' + addr.toLowerCase().replace(/\s+/g,' ');
    }
  } catch(e) { /* noop */ }
  return '';
}




/* --- Customer history: multi-identifier grouping + ignored-orders support --- */

// Load/save ignored history ids from localStorage
function loadIgnoredHistoryIds() {
  try {
    const raw = localStorage.getItem('ignoredHistoryIds');
    if (!raw) return new Set();
    const arr = JSON.parse(raw || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}
function saveIgnoredHistoryIds(set) {
  try {
    const arr = Array.from(set || []);
    localStorage.setItem('ignoredHistoryIds', JSON.stringify(arr));
  } catch(e){}
}


// === Pair-based ignore (per-source-order vs target-history) ===
const IGNORED_PAIRS_KEY = 'ignoredHistoryPairs_v1';
function makePairKey(a, b){
  const a1 = String(a||''); const b1 = String(b||'');
  return [a1,b1].sort().join('::');
}
function loadIgnoredHistoryPairs(){
  try {
    const raw = localStorage.getItem(IGNORED_PAIRS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch(e){ return new Set(); }
}
function saveIgnoredHistoryPairs(set){
  try {
    const arr = Array.from(set || []);
    localStorage.setItem(IGNORED_PAIRS_KEY, JSON.stringify(arr));
  } catch(e){}
}
// Normalize address for matching (simple)
function normalizeAddress(a){
  if(!a) return '';
  return String(a).trim().toLowerCase().replace(/\s+/g,' ');
}

// Build set of identifier strings for an order (name, lineId/facebookId, phone(s), address)
function getOrderIdentifiers(o){
  const ids = new Set();
  if(!o) return ids;
  if (o.lineId) ids.add('line:' + String(o.lineId).trim());
  // support facebookId if present
  if (o.facebookId) ids.add('facebook:' + String(o.facebookId).trim());
  if (Array.isArray(o.phones)) {
    o.phones.forEach(p => { if (p) ids.add('phone:' + normalizePhone(p)); });
  }
  if (o.phone) ids.add('phone:' + normalizePhone(o.phone));
  if (o.customer) ids.add('name:' + String(o.customer).trim().toLowerCase());
  if (o.address) {
    const norm = normalizeAddress(o.address);
    if (norm) ids.add('address:' + norm);
  }
  // if line/profile inside contact object
  if (o.contact && o.contact.lineId) ids.add('line:' + String(o.contact.lineId).trim());
  if (o.contact && o.contact.facebookId) ids.add('facebook:' + String(o.contact.facebookId).trim());
  
  
  // --- Add all LINE/Facebook IDs (from lineIds/facebookIds arrays) as identifiers (快速全部ID策略)
  try{
    if (Array.isArray(o.lineIds) && o.lineIds.length){
      o.lineIds.forEach(id => {
        if(!id) return;
        try{ ids.add(('line:' + String(id).trim().toLowerCase()).replace(/\s+/g,'')); }catch(e){}
      });
    }
    if (Array.isArray(o.facebookIds) && o.facebookIds.length){
      o.facebookIds.forEach(id => {
        if(!id) return;
        try{ ids.add(('facebook:' + String(id).trim().toLowerCase()).replace(/\s+/g,'')); }catch(e){}
      });
    }
    // also consider legacy single fields
    try{ if(o.lineId) ids.add(('line:'+String(o.lineId).trim().toLowerCase()).replace(/\s+/g,'')); }catch(e){}
    try{ if(o.facebookId) ids.add(('facebook:'+String(o.facebookId).trim().toLowerCase()).replace(/\s+/g,'')); }catch(e){}
  }catch(e){}

  return ids;
}


// Rebuild a Map from identifier -> sorted list of orders (desc by _ts)
// New behavior: group orders into clusters where any identifier matches (name, line, facebook, phone, address).
// Also exclude ignored order IDs stored in localStorage.
function rebuildCustomerHistoryMap() {
  try {
    const all = (typeof orders !== 'undefined') ? orders : [];
    // union-find via id -> groupId mapping, groups store identifier sets and order lists
    const idToGroup = new Map();
    const groupData = new Map(); // groupId -> {ids: Set, orders: Set(orderIds)}
    let nextGroupId = 1;

    // helper to create new group
    function createGroupForIds(idsArray){
      const gid = 'g' + (nextGroupId++);
      const idset = new Set(idsArray);
      groupData.set(gid, { ids: idset, orders: new Set() });
      idsArray.forEach(id => idToGroup.set(id, gid));
      return gid;
    }
    // helper to merge groups into targetGid
    function mergeGroups(targetGid, otherGids){
      const target = groupData.get(targetGid);
      for(const og of otherGids){
        if (og === targetGid) continue;
        const other = groupData.get(og);
        // move ids
        for(const id of other.ids){ target.ids.add(id); idToGroup.set(id, targetGid); }
        // move orders
        for(const oid of other.orders){ target.orders.add(oid); }
        groupData.delete(og);
      }
    }

    // iterate orders and assign to groups based on identifiers
    all.forEach(o => {
      try {
        const orderId = (o.id || o._id || '');
        if (!orderId) return;
// skip ignored
        // determine timestamp
        let ts = null;
        if (o.datetimeISO) ts = new Date(o.datetimeISO);
        else if (o.date && o.time) ts = new Date(String(o.date) + ' ' + String(o.time));
        else if (o.date) ts = new Date(o.date);
        else ts = new Date(o.createdAt || Date.now());
        const copy = Object.assign({}, o, { _ts: ts });

        const ids = Array.from(getOrderIdentifiers(o));
        if (!ids.length) {
          // fallback: create anonymous id using order id
          const anonId = 'orderid:' + orderId;
          ids.push(anonId);
        }

        // find existing group ids touched by these identifiers
        const foundGroups = new Set();
        ids.forEach(id => {
          if (idToGroup.has(id)) foundGroups.add(idToGroup.get(id));
        });

        if (foundGroups.size === 0) {
          // create new group
          const gid = createGroupForIds(ids);
          groupData.get(gid).orders.add(orderId);
          // store the order object per group - we'll gather later
          groupData.get(gid)._orderObjs = groupData.get(gid)._orderObjs || [];
          groupData.get(gid)._orderObjs.push(copy);
        } else {
          // attach to one of existing groups (choose first), and merge others
          const gids = Array.from(foundGroups);
          const primary = gids[0];
          // ensure all ids map to primary
          ids.forEach(id => { idToGroup.set(id, primary); groupData.get(primary).ids.add(id); });
          // add order to primary
          groupData.get(primary).orders.add(orderId);
          groupData.get(primary)._orderObjs = groupData.get(primary)._orderObjs || [];
          groupData.get(primary)._orderObjs.push(copy);
          // if multiple groups found, merge them
          if (gids.length > 1) {
            mergeGroups(primary, gids.slice(1));
          }
        }
      } catch(e){
        // ignore
      }
    });

    // Now convert groupData into a map from each identifier -> sorted order list
    const map = new Map();
    for(const [gid, gd] of groupData.entries()){
      const arr = (gd._orderObjs || []).slice();
      // sort desc
      arr.sort((a,b) => b._ts - a._ts);
      // for each identifier in this group, map identifier -> arr
      for(const id of gd.ids){
        map.set(id, arr);
      }
      // also map a synthetic group key for direct access: 'group:' + gid
      map.set('group:' + gid, arr);
    }

    window._customerHistoryMap = map;
    window._customerHistoryGroups = groupData; // keep some metadata (not serialized)
  } catch(e) {
    console.error('rebuildCustomerHistoryMap failed', e);
    window._customerHistoryMap = null;
    window._customerHistoryGroups = null;
  }
}


function getHistoryByCustomerKey(customerKey) {
  if (!customerKey) return [];
  // prefer using cache if available; otherwise build it
  if (!window._customerHistoryMap) {
    rebuildCustomerHistoryMap();
  }
  const map = window._customerHistoryMap || new Map();
  const list = map.get(customerKey) || [];
  // return a shallow copy to avoid external mutation
  return Array.isArray(list) ? list.slice() : [];
}


function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}



function renderHistoryModal(customerKey, titleText) {
  const modal = document.getElementById('historyModal');
  const body = document.getElementById('historyTableBody');
  const empty = document.getElementById('historyEmpty');
  const title = document.getElementById('historyModalTitle');

  title.textContent = titleText || '客戶歷史紀錄';
  body.innerHTML = '';
  // Pair-based ignore: filter list by (fromOrderId,targetId) pairs
  const fromId = (modal.dataset && modal.dataset.fromOrderId) ? modal.dataset.fromOrderId : '';
  const ignoredPairs = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs() : new Set();



  const list = getHistoryByCustomerKey(customerKey);
  const filteredList = (list || []).filter(o => {
    const oid = (o.id || o._id || '');
    return !ignoredPairs.has(makePairKey(fromId, oid));
  });
  if (!filteredList.length) {
    empty.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal.dataset.customerKey = customerKey;
    modal.dataset.title = titleText || '';
    return;
  }
  empty.style.display = 'none';
// create rows
  filteredList.forEach(o=>{
    // Name
    const nameText = (o.name || o.customer || o.contact || '') + '';
    // Date only (no time)
    let dateOnly = '';
    if (o._ts) {
      const d = new Date(o._ts);
      if (!isNaN(d)) dateOnly = d.toLocaleDateString('zh-TW');
    } else if (o.date) {
      const d2 = new Date(o.date);
      if (!isNaN(d2)) dateOnly = d2.toLocaleDateString('zh-TW');
    }
    // Phone (single-line)
    let phoneText = '';
    if (Array.isArray(o.phone)) phoneText = o.phone.join(' / ');
    else phoneText = (o.phone || o.phones || o.tel || o.phoneNumber || '') + '';

    const items = (Array.isArray(o.items) ? o.items.join(' / ') : (o.items || '')) || getOrderItems(o) || '';
    const addr = o.address || '';
    const notes = o.notes || o.note || o.slotNote || '';
    const status = o.status || '';

    const tr = document.createElement('tr');
    tr.dataset.orderId = (o.id || o._id || '');

    // add clickable class and accessible role
    tr.classList.add('history-row-clickable');

    tr.innerHTML = `
      <td class="no-wrap">${escapeHtml(nameText)}</td>
      <td class="no-wrap">${escapeHtml(dateOnly)}</td>
      <td class="no-wrap">${escapeHtml(phoneText)}</td>
      <td>${escapeHtml(items)}</td>
      <td>${escapeHtml(addr)}</td>
      <td>${escapeHtml(notes)}</td>
      <td>
        <button class="btn-small history-ignore-row" data-order-id="${tr.dataset.orderId}">忽略</button>
      </td>
    `;
    body.appendChild(tr);
    // set ignore button label based on pair-ignore
    const btnIgnore2 = tr.querySelector('.history-ignore-row');
    if (btnIgnore2) {
      const targetId = tr.dataset.orderId || '';
      const isIgnored = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs().has(makePairKey(fromId, targetId)) : false;
      btnIgnore2.textContent = isIgnored ? '已忽略' : '忽略';
    }


    // Clicking the row opens the order (unless click target is the ignore button)
    tr.addEventListener('click', (ev) => {
      if (ev.target.closest('.history-ignore-row')) {
        // let the ignore button handler handle it
        return;
      }
      const id = tr.dataset.orderId;
      if (!id) return;
      const ord = (typeof orders !== 'undefined') ? (orders.find(x => (x.id||x._id||'') === id) || null) : null;
      if (ord) {
        if (typeof fillForm === 'function') fillForm(ord);
        // close modal
        modal.setAttribute('aria-hidden','true');
      }
    });

    // attach ignore handler
    const btnIgnore = tr.querySelector('.history-ignore-row');
    if (btnIgnore) btnIgnore.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const targetId = ev.currentTarget.dataset.orderId;
      if (!targetId) return;
      const from = (modal.dataset && modal.dataset.fromOrderId) ? modal.dataset.fromOrderId : '';
      const pairs = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs() : new Set();
      const k = makePairKey(from, targetId);
      if (pairs.has(k)) pairs.delete(k); else pairs.add(k);
      if (typeof saveIgnoredHistoryPairs === 'function') saveIgnoredHistoryPairs(pairs);
      // re-render modal and update badges
      renderHistoryModal(customerKey, titleText);
      try { transformCustomerCells(); } catch(e){}
    });

  });

  modal.setAttribute('aria-hidden', 'false');
  modal.dataset.customerKey = customerKey;
  modal.dataset.title = titleText || '';
}



function exportHistoryToCsv(list, filename) {
  if (!list || !list.length) return alert('沒有資料可匯出');
  const rows = [];
  rows.push(['清洗時間','清洗項目','狀態','備註','id']);
  list.forEach(o=>{
    const dateStr = (o._ts && !isNaN(o._ts)) ? o._ts.toLocaleString('zh-TW') : '';
    const items = (Array.isArray(o.items) ? o.items.join(' / ') : (o.items || '')) || getOrderItems(o) || '';
    rows.push([dateStr, items, o.status || '', (o.notes || o.note || o.slotNote || ''), (o.id||o._id||'')]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'history.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function initHistoryModalBindings() {
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  document.getElementById('historyCloseBtn').addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));
  const backdrop = modal.querySelector('.modal-backdrop');
  if (backdrop) backdrop.addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));

  document.getElementById('historySort').addEventListener('change', ()=> {
    const key = modal.dataset.customerKey;
    if (key) renderHistoryModal(key, modal.dataset.title || '客戶歷史紀錄');
  });
  document.getElementById('historySearch').addEventListener('input', ()=> {
    const key = modal.dataset.customerKey;
    if (key) renderHistoryModal(key, modal.dataset.title || '客戶歷史紀錄');
  });

  document.getElementById('historyExportCsv').addEventListener('click', ()=> {
    const key = modal.dataset.customerKey;
    if (!key) return alert('沒有可匯出的客戶');
    const list = getHistoryByCustomerKey(key);
    exportHistoryToCsv(list, `${(modal.dataset.title||'history')}.csv`);
  });

  document.getElementById('historyTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.history-open-order');
    if (btn) {
      const orderId = btn.dataset.orderId;
      modal.setAttribute('aria-hidden','true');
      if (typeof openOrder === 'function') openOrder(orderId);
      else console.warn('openOrder not found, orderId:', orderId);
    }
    const exp = e.target.closest('.history-export-row');
    if (exp) {
      const orderId = exp.dataset.orderId;
      const all = typeof orders !== 'undefined' ? orders : [];
      const o = all.find(x => (x.id||x._id) == orderId);
      if (o) exportHistoryToCsv([o], `order-${orderId}.csv`);
    }
  });
}




function transformCustomerCells() {
  const table = document.getElementById('ordersTable');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  // Rebuild cache once at transform time to ensure up-to-date history
  try { rebuildCustomerHistoryMap(); } catch(e){ console.warn('rebuildCustomerHistoryMap failed', e); }

  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach(tr => {
    try {
      const custTd = tr.querySelector('[data-label="客戶"]');
      if (!custTd) return;
      if (custTd.querySelector('.customer-link') || custTd.querySelector('.customer-badge')) return; // already transformed
      const orig = custTd.querySelector('.copy-target') || custTd;
      const nameText = (orig.textContent || '').trim();
      const key = getCustomerKeyFromRow(tr);
      const copyBtn = custTd.querySelector('.copy-btn');

      // Determine history list and count for this customer (use cache)
      let histList = [];
      try {
        {
        const fromId = (tr.dataset && tr.dataset.orderId) || '';
        const pairs = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs() : new Set();
        const list0 = getHistoryByCustomerKey(key) || [];
        histList = list0.filter(o => {
          const oid = (o.id || o._id || '');
          return !pairs.has(makePairKey(fromId, oid));
        });
      }
      } catch(e) { histList = []; }

      const count = Array.isArray(histList) ? histList.length : 0;
      const hasHistory = count > 1;
      if (hasHistory) {
        // create container with button + badge
        const container = document.createElement('span');
        container.className = 'customer-badge';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'customer-link';
        btn.textContent = nameText || '(未命名)';
        // ARIA label for better accessibility
        try { btn.setAttribute('aria-label', `${nameText || '(未命名)'} 的歷史訂單 ${count} 筆`); } catch(e){}

        btn.addEventListener('click', (e)=>{
          const modal = document.getElementById('historyModal');
          const fromId = (e.currentTarget.closest('tr')?.dataset?.orderId) || '';
          modal.dataset.fromOrderId = fromId;
          modal.dataset.customerKey = key;
          modal.dataset.title = nameText || key;
          renderHistoryModal(key, nameText || key);
        });

        const badge = document.createElement('span');
        badge.className = 'badge';
        // Cap display at 99+ to avoid layout break
        badge.textContent = (count > 99) ? '99+' : String(count);

        // Build tooltip with full count and up to 3 recent summaries
        try {
          const parts = [];
          parts.push(`歷史訂單：${count} 筆`);
          if (count > 0) {
            const recent = histList.slice(0,3);
            parts.push('最近筆數：');
            recent.forEach((o, idx) => {
              const d = o._ts ? new Date(o._ts) : null;
              const dateStr = d ? d.toLocaleString() : (o.date || '');
              let summary = dateStr;
              if (o.items) summary += ` • ${o.items}`;
              else if (o.note) summary += ` • ${String(o.note).slice(0,30)}`;
              parts.push(`${idx+1}. ${summary}`);
            });
            if (count > 3) parts.push(`...還有 ${count-3} 筆`);
          }
          badge.title = parts.join('\n');
        } catch(e){ /* ignore tooltip errors */ }

        container.appendChild(btn);
        container.appendChild(badge);

        custTd.innerHTML = '';
        custTd.appendChild(container);
        if (copyBtn) custTd.appendChild(copyBtn);
      } else {
        // no history: render as plain text (non-clickable) but keep copy button if any
        const span = document.createElement('span');
        span.className = 'customer-nohistory';
        span.textContent = nameText || '(未命名)';
        span.title = '此客戶目前沒有歷史紀錄';
        custTd.innerHTML = '';
        custTd.appendChild(span);
        if (copyBtn) custTd.appendChild(copyBtn);
      }
    } catch(e){ /* ignore row errors */ }
  });
}



// Monkey-patch refreshTable so transformation runs after table render
function patchRefreshTable() {
  if (typeof refreshTable !== 'function') return;
  if (refreshTable.__patched_for_history) return;
  const original = refreshTable;
  window.refreshTable = function(...args){
    const ret = original.apply(this, args);
    try { transformCustomerCells(); } catch(e){ console.error('transformCustomerCells failed', e); }
    return ret;
  };
  window.refreshTable.__patched_for_history = true;
}

// Init bindings on DOMContentLoaded


/* openOrder: fills the form with the specified order id and highlights the row */
function openOrder(orderId) {
  if (!orderId) return alert('找不到 orderId');
  const all = typeof orders !== 'undefined' ? orders : [];
  const o = all.find(x => (x.id || x._id || '') == orderId);
  if (!o) {
    console.warn('order not found for openOrder:', orderId);
    return alert('找不到對應的訂單');
  }
  // Fill the form
  if (typeof fillForm === 'function') {
    fillForm(o);
  } else {
    console.warn('fillForm not found; cannot populate form');
  }

  // Close history modal if open
  const modal = document.getElementById('historyModal');
  if (modal) modal.setAttribute('aria-hidden', 'true');

  // Refresh table and highlight the corresponding row
  try { refreshTable(); } catch(e){ /* ignore */ }

  // Find the row with matching data-order-id
  setTimeout(()=> {
    const table = document.getElementById('ordersTable');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const tr = tbody.querySelector(`tr[data-order-id="${orderId}"]`);
    // Fallback: try to match by customer + date + time if no data-order-id
    let target = tr;
    if (!target) {
      const matches = Array.from(tbody.querySelectorAll('tr')).filter(r => {
        const idx = r.querySelector('td[data-label="#"]');
        // try comparing dataset or cells
        return r.dataset && (r.dataset.orderId === orderId);
      });
      if (matches.length) target = matches[0];
    }
    if (target) {
      // remove existing highlight
      tbody.querySelectorAll('.highlight-row').forEach(el => el.classList.remove('highlight-row'));
      target.classList.add('highlight-row');
      // scroll into view
      target.scrollIntoView({behavior:'smooth', block:'center'});
      // brief flash
      target.animate([{backgroundColor:'#fff9c4'},{backgroundColor:'transparent'}], {duration:1200});
    }
  }, 150);
}
document.addEventListener('DOMContentLoaded', ()=> {
  initHistoryModalBindings();
  patchRefreshTable();
  // Initial transform in case table already rendered
  try { transformCustomerCells(); } catch(e){ /* ignore */ }
});


/* Layout editor JS for order form - allows width (span) and position edits */
(function(){
  const form = document.getElementById('orderForm');
  const toggleBtn = document.getElementById('toggleLayoutEditBtn');
  const saveBtn = document.getElementById('saveLayoutBtn');
  const resetBtn = document.getElementById('resetLayoutBtn');
  if (!form || !toggleBtn) return;
  // capture default layout
  function captureLayout(container) {
    const cols = Array.from(container.querySelectorAll('.col'));
    return cols.map((col, idx) => {
      // parse existing inline grid-column style 'grid-column:span N' or style attribute
      let span = 6;
      const style = col.getAttribute('style') || '';
      const m = style.match(/grid-column\s*:\s*span\s*([0-9]+)/i);
      if (m) span = parseInt(m[1],10);
      // fallback to computed -- not necessary
      return { id: col.id || ('col-'+idx), span: span, order: idx, locked: !!col.dataset.locked };
    });
  }
  const defaultLayout = captureLayout(form);

  function getCurrentLayout() {
    const cols = Array.from(form.querySelectorAll('.col'));
    return cols.map((col, idx) => {
      // try inline style first
      let span = 6;
      const style = col.getAttribute('style') || '';
      const m = style.match(/grid-column\s*:\s*span\s*([0-9]+)/i);
      if (m) span = parseInt(m[1],10);
      return { id: col.id || ('col-'+idx), span: span, order: idx, locked: !!col.dataset.locked };
    });
  }

  function applyLayout(layout) {
    // sort by order and re-append to parent to reorder
    layout.sort((a,b)=>a.order - b.order);
    layout.forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;
      // append to form (will place at end in order) - to preserve original row grouping this is best-effort
      form.appendChild(el);
      // set inline style grid-column:span N while preserving other style properties
      const old = el.getAttribute('style') || '';
      // remove any existing grid-column span directive
      const cleaned = old.replace(/grid-column\s*:\s*span\s*[0-9]+\s*;?/ig,'').trim();
      const newStyle = (cleaned + '; grid-column: span ' + item.span + ';').trim();
      el.setAttribute('style', newStyle);
      if (item.locked) el.dataset.locked = "true"; else delete el.dataset.locked;
    });
  }

  // control creation
  function createControlsFor(col) {
    if (col.querySelector('.layout-controls')) return;
    const wrap = document.createElement('div');
    wrap.className = 'layout-controls';
    // left/right increase/decrease span, up/down move, lock
    const btnDec = createBtn('-', ()=>changeSpan(col,-1));
    const btnInc = createBtn('+', ()=>changeSpan(col,1));
    const btnUp = createBtn('↑', ()=>moveUp(col));
    const btnDown = createBtn('↓', ()=>moveDown(col));
    const btnLock = createBtn('🔒', ()=>toggleLock(col));
    wrap.appendChild(btnDec);
    wrap.appendChild(btnInc);
    wrap.appendChild(btnUp);
    wrap.appendChild(btnDown);
    wrap.appendChild(btnLock);
    col.appendChild(wrap);
  }
  function createBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerText = label;
    b.addEventListener('click', function(e){ e.stopPropagation(); e.preventDefault(); onClick(); });
    return b;
  }

  function changeSpan(col, delta) {
    if (col.dataset.locked) return;
    // parse current span
    const style = col.getAttribute('style') || '';
    const m = style.match(/grid-column\s*:\s*span\s*([0-9]+)/i);
    let span = m ? parseInt(m[1],10) : 6;
    span = Math.min(12, Math.max(1, span + delta));
    const cleaned = style.replace(/grid-column\s*:\s*span\s*[0-9]+\s*;?/ig,'').trim();
    const newStyle = (cleaned + '; grid-column: span ' + span + ';').trim();
    col.setAttribute('style', newStyle);
  }
  function moveUp(col) {
    if (col.dataset.locked) return;
    const prev = col.previousElementSibling;
    if (prev && prev.classList.contains('col')) {
      form.insertBefore(col, prev);
    }
  }
  function moveDown(col) {
    if (col.dataset.locked) return;
    const next = col.nextElementSibling;
    if (next && next.classList.contains('col')) {
      form.insertBefore(next, col);
    }
  }
  function toggleLock(col) {
    if (col.dataset.locked) delete col.dataset.locked;
    else col.dataset.locked = "true";
  }

  function enterEditMode() {
    form.classList.add('layout-edit-mode');
    Array.from(form.querySelectorAll('.col')).forEach(col=> createControlsFor(col));
    toggleBtn.innerText = '結束編輯';
    saveBtn.style.display = '';
    resetBtn.style.display = '';
  }
  function exitEditMode() {
    form.classList.remove('layout-edit-mode');
    Array.from(form.querySelectorAll('.layout-controls')).forEach(n=> n.remove());
    toggleBtn.innerText = '編輯布局';
    saveBtn.style.display = 'none';
    resetBtn.style.display = 'none';
  }
  let editing = false;
  toggleBtn.addEventListener('click', ()=>{
    editing = !editing;
    if (editing) enterEditMode(); else exitEditMode();
  });

  saveBtn.addEventListener('click', ()=>{
    const layout = getCurrentLayout();
    localStorage.setItem('orderFormLayout_v1', JSON.stringify(layout));
    alert('布局已儲存');
    exitEditMode();
  });
  resetBtn.addEventListener('click', ()=>{
    if (!confirm('確定要還原為預設布局？')) return;
    applyLayout(defaultLayout);
    localStorage.removeItem('orderFormLayout_v1');
  });

  // on load apply saved layout if exists
  const stored = localStorage.getItem('orderFormLayout_v1');
  if (stored) {
    try { applyLayout(JSON.parse(stored)); } catch(e){ console.warn('apply layout failed', e); }
  }
})(); 



// === 儲存與還原表單布局寬度（全欄位 .col） ===

const FORM_LAYOUT_KEY = 'yl_clean_form_layout_v1';

function saveLayoutWidths() {
  const cols = document.querySelectorAll('#orderForm .col');
  const layout = Array.from(cols).map(col => col.style.gridColumn || '');
  localStorage.setItem(FORM_LAYOUT_KEY, JSON.stringify(layout));
  Swal.fire('✔️ 已儲存', '欄位寬度已成功儲存，下次開啟會自動套用', 'success');
}

function loadLayoutWidths() {
  const saved = JSON.parse(localStorage.getItem(FORM_LAYOUT_KEY) || '[]');
  const cols = document.querySelectorAll('#orderForm .col');
  saved.forEach((val, idx) => {
    if (cols[idx]) cols[idx].style.gridColumn = val || '';
  });
}

function resetLayoutWidths() {
  localStorage.removeItem(FORM_LAYOUT_KEY);
  Swal.fire('↩️ 已還原', '已清除欄位寬度設定，將重新整理頁面', 'info').then(() => {
    location.reload();
  });
}

// 掛載到按鈕（在 DOM ready 或 init function 中執行）
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('saveLayoutBtn');
  const resetBtn = document.getElementById('resetLayoutBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveLayoutWidths);
  if (resetBtn) resetBtn.addEventListener('click', resetLayoutWidths);
  loadLayoutWidths(); // 初始載入
});



// --- Ensure '其他' checkbox shows/hides the other-text input ---
// This handler watches checkboxes with data-name="acBrand" and toggles #acBrandOtherText visibility.
// It is safe to call multiple times.
function updateAcBrandOtherVisibility(){
  try{
    const inputs = Array.from(document.querySelectorAll('input[type="checkbox"][data-name="acBrand"]'));
    const otherInput = document.getElementById('acBrandOtherText');
    if(!otherInput) return;
    const checked = inputs.filter(i=>i.checked).map(i=>i.value);
    otherInput.classList.toggle('hidden', !checked.includes('其他'));
    // also ensure display style fallback
    otherInput.style.display = checked.includes('其他') ? '' : 'none';
  }catch(e){
    console.warn('updateAcBrandOtherVisibility error', e);
  }
}
document.addEventListener('change', function(e){
  if(e.target && e.target.matches && e.target.matches('input[type="checkbox"][data-name="acBrand"]')){
    updateAcBrandOtherVisibility();
  }
});
// Call on load to set initial visibility
window.addEventListener('load', updateAcBrandOtherVisibility);
// expose globally so other code can call it after programmatic setChecked
window.updateAcBrandOtherVisibility = updateAcBrandOtherVisibility;


document.addEventListener('click', function(e){
  try{
    if(e.target && e.target.closest && e.target.closest('#acBrandGroup')){
      updateAcBrandOtherVisibility();
    }
  }catch(e){}
});



/* --- Ignore Manager UI & actions --- */
function openIgnoreManager() {
  const modal = document.getElementById('ignoreManagerModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden','false');
  modal.style.display = 'flex';
  renderIgnoreManagerTable();
  updateIgnoreCountBadge();
}
function closeIgnoreManager() {
  const modal = document.getElementById('ignoreManagerModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden','true');
  modal.style.display = 'none';
}
function getIgnoredEntries() {
  const all = (typeof orders !== 'undefined') ? orders : [];
  const entries = [];

  // --- Legacy: global ignored IDs ---
  const ignoredIds = loadIgnoredHistoryIds();
  ignoredIds.forEach(id => {
    const o = all.find(x => (x.id||x._id||'') === id) || {};
    let ts = o._ts;
    if (!ts) {
      if (o.datetimeISO) ts = new Date(o.datetimeISO);
      else if (o.date && o.time) ts = new Date(String(o.date) + ' ' + String(o.time));
      else if (o.date) ts = new Date(o.date);
      else ts = new Date(o.createdAt || Date.now());
    }
    const phone = (Array.isArray(o.phones) && o.phones[0]) ? o.phones[0] : (o.phone || '');
    entries.push({
      kind: 'id',
      id: id,
      date: (ts && !isNaN(ts)) ? ts.toLocaleString() : (o.date || ''),
      customer: o.customer || '',
      phone: phone,
      address: o.address || '',
      raw: o
    });
  });

  // --- New: pair-based ignores (A::B). Display basic info for both sides.
  const ignoredPairs = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs() : new Set();
  ignoredPairs.forEach(key => {
    const parts = String(key || '').split('::');
    const a = parts[0] || '';
    const b = parts[1] || '';
    const oa = all.find(x => (x.id||x._id||'') === a) || null;
    const ob = all.find(x => (x.id||x._id||'') === b) || null;

    // Choose a display order (prefer target B info if present)
    const disp = ob || oa || {};
    let ts = disp._ts;
    if (!ts) {
      if (disp.datetimeISO) ts = new Date(disp.datetimeISO);
      else if (disp.date && disp.time) ts = new Date(String(disp.date) + ' ' + String(disp.time));
      else if (disp.date) ts = new Date(disp.date);
      else ts = new Date(disp.createdAt || Date.now());
    }

    const getPhone = (o) => (o && Array.isArray(o.phones) && o.phones[0]) ? o.phones[0] : ((o && o.phone) || '');
    const nameA = (oa && oa.customer) ? oa.customer : a;
    const nameB = (ob && ob.customer) ? ob.customer : b;
    const phoneA = getPhone(oa);
    const phoneB = getPhone(ob);
    const addrA = (oa && oa.address) ? oa.address : '';
    const addrB = (ob && ob.address) ? ob.address : '';

    entries.push({
      kind: 'pair',
      id: key,
      fromId: a,
      toId: b,
      date: (ts && !isNaN(ts)) ? ts.toLocaleString() : (disp.date || ''),
      customer: `${nameA} ↔ ${nameB}`.trim(),
      phone: [phoneA, phoneB].filter(Boolean).join(' / '),
      address: [addrA, addrB].filter(Boolean).join(' / '),
      rawA: oa,
      rawB: ob
    });
  });

  // Optional: sort newest first if possible by parsing date (fallback to string)
  entries.sort((x, y) => {
    const dx = Date.parse(x.date || '') || 0;
    const dy = Date.parse(y.date || '') || 0;
    return dy - dx;
  });

  return entries;
}
function renderIgnoreManagerTable(filterText) {
  const tbody = document.querySelector('#ignoreManagerTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const list = getIgnoredEntries();
  const q = (filterText||'').toLowerCase();
  list.forEach(e => {
    if (q) {
      const combined = `${e.kind||''} ${e.id} ${e.customer} ${e.phone} ${e.address}`.toLowerCase();
      if (!combined.includes(q)) return;
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:6px;"><input type="checkbox" class="ignore-row-checkbox" data-kind="${e.kind||'id'}" data-id="${e.id}" data-from="${e.fromId||''}" data-to="${e.toId||''}"></td>
      <td class="no-wrap" style="padding:6px;">${escapeHtml(e.date)}</td>
      <td class="no-wrap" style="padding:6px;">${escapeHtml(e.customer)}</td>
      <td class="no-wrap" style="padding:6px;">${escapeHtml(e.phone)}</td>
      <td style="padding:6px;">${escapeHtml(e.address)}</td>
      <td class="no-wrap" style="padding:6px;">
        <button class="btn-small ignore-unignore" data-kind="${e.kind||'id'}" data-id="${e.id}" data-from="${e.fromId||''}" data-to="${e.toId||''}">取消忽略</button>
        <button class="btn-small ignore-view" data-kind="${e.kind||'id'}" data-id="${e.id}" data-from="${e.fromId||''}" data-to="${e.toId||''}">查看</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // attach row button handlers
  tbody.querySelectorAll('.ignore-unignore').forEach(btn=>{
    btn.addEventListener('click', ev=>{
      const id = ev.currentTarget.dataset.id;
      const kind = ev.currentTarget.dataset.kind || 'id';
      if (kind === 'pair') {
        const pairs = (typeof loadIgnoredHistoryPairs === 'function') ? loadIgnoredHistoryPairs() : new Set();
        pairs.delete(id);
        if (typeof saveIgnoredHistoryPairs === 'function') saveIgnoredHistoryPairs(pairs);
      } else {
        const s = loadIgnoredHistoryIds();
        s.delete(id);
        saveIgnoredHistoryIds(s);
      }
      try { rebuildCustomerHistoryMap(); } catch(e){}
      try { transformCustomerCells(); } catch(e){}
      renderIgnoreManagerTable(document.getElementById('ignoreManagerSearch').value);
      updateIgnoreCountBadge();
    });
  });
  tbody.querySelectorAll('.ignore-view').forEach(btn=>{
    btn.addEventListener('click', ev=>{
      const kind = ev.currentTarget.dataset.kind || 'id';
      let openId = ev.currentTarget.dataset.id;
      if (kind === 'pair') {
        // Prefer opening the 'to' side; fallback to 'from'
        openId = ev.currentTarget.dataset.to || ev.currentTarget.dataset.from || openId;
      }
      const ord = (typeof orders !== 'undefined') ? (orders.find(x => (x.id||x._id||'') === openId) || null) : null;
      if (ord) {
        // 切回主畫面並帶入該訂單
        try { if (typeof setActiveView === 'function') setActiveView('main'); } catch(e){}
        fillForm(ord);
        closeIgnoreManager();
      } else {
        alert('找不到訂單：' + openId);
      }
    });
  });

  // 同步表頭「全選」勾選狀態
  const headerCheckbox = document.getElementById('ignoreSelectAll');
  if (headerCheckbox) {
    const rowChecks = Array.from(tbody.querySelectorAll('.ignore-row-checkbox'));
    const total = rowChecks.length;
    if (!total) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    } else {
      const checkedCount = rowChecks.filter(c => c.checked).length;
      headerCheckbox.checked = checkedCount === total;
      headerCheckbox.indeterminate = checkedCount > 0 && checkedCount < total;
    }
    rowChecks.forEach(cb => {
      cb.addEventListener('change', () => {
        const rows = Array.from(tbody.querySelectorAll('.ignore-row-checkbox'));
        const totalRows = rows.length;
        const checkedRows = rows.filter(x => x.checked).length;
        if (!totalRows) {
          headerCheckbox.checked = false;
          headerCheckbox.indeterminate = false;
        } else {
          headerCheckbox.checked = checkedRows === totalRows;
          headerCheckbox.indeterminate = checkedRows > 0 && checkedRows < totalRows;
        }
      });
    });
  }

}

function updateIgnoreCountBadge() {
  const badge = document.getElementById('ignoreCountBadge');
  if (!badge) return;
  const size = (loadIgnoredHistoryIds().size) + ((typeof loadIgnoredHistoryPairs==='function') ? loadIgnoredHistoryPairs().size : 0);
  badge.textContent = size ? (size>99 ? '99+' : String(size)) : '';
  badge.style.display = size ? 'inline-block' : 'none';
}

function exportIgnoredToCsv(selectedIds) {
  const list = getIgnoredEntries().filter(e => !selectedIds || selectedIds.includes(e.id));
  const rows = [['訂單ID','日期','客戶','電話','地址']];
  list.forEach(e => rows.push([e.id, e.date, e.customer, e.phone, e.address]));
  const csv = rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ignored_history.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Bind events
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('btnOpenIgnoreManager');
  if (btn) btn.addEventListener('click', openIgnoreManager);
  const closeBtn = document.getElementById('ignoreCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeIgnoreManager);
  const exportBtn = document.getElementById('ignoreExportBtn');
  if (exportBtn) exportBtn.addEventListener('click', ()=> exportIgnoredToCsv());
  const clearBtn = document.getElementById('ignoreClearBtn');
  if (clearBtn) clearBtn.addEventListener('click', async ()=>{
    const ok = await showConfirm('清空忽略清單','確定要清空所有忽略清單嗎？此操作可還原但會刪除本機記錄。');
    if (!ok) return;
    saveIgnoredHistoryIds(new Set());
    if (typeof saveIgnoredHistoryPairs === 'function') saveIgnoredHistoryPairs(new Set());
    try { rebuildCustomerHistoryMap(); } catch(e){}
    try { transformCustomerCells(); } catch(e){}
    renderIgnoreManagerTable(document.getElementById('ignoreManagerSearch').value);
    updateIgnoreCountBadge();
  });
  const searchInput = document.getElementById('ignoreManagerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e)=> renderIgnoreManagerTable(e.target.value));
  }
  const headerSelectAll = document.getElementById('ignoreSelectAll');
  if (headerSelectAll) {
    headerSelectAll.addEventListener('change', ()=>{
      const tbody = document.querySelector('#ignoreManagerTable tbody');
      if (!tbody) return;
      const checked = headerSelectAll.checked;
      tbody.querySelectorAll('.ignore-row-checkbox').forEach(cb => {
        cb.checked = checked;
      });
    });
  }
  const unignoreSelBtn = document.getElementById('ignoreUnignoreSelected');
  if (unignoreSelBtn) unignoreSelBtn.addEventListener('click', ()=>{
    const checks = Array.from(document.querySelectorAll('.ignore-row-checkbox:checked'));
    if (!checks.length) { if (typeof showAlert === 'function') { showAlert('此頁面說明','未選取任何項目'); } else { alert('未選取任何項目'); }; return; }
    const idsToRemove = [];
    const pairsToRemove = [];
    checks.forEach(c => {
      const kind = c.dataset.kind || 'id';
      const id = c.dataset.id;
      if (kind === 'pair') pairsToRemove.push(id); else idsToRemove.push(id);
    });
    if (idsToRemove.length) {
      const s = loadIgnoredHistoryIds();
      idsToRemove.forEach(id => s.delete(id));
      saveIgnoredHistoryIds(s);
    }
    if (pairsToRemove.length && typeof loadIgnoredHistoryPairs === 'function') {
      const pset = loadIgnoredHistoryPairs();
      pairsToRemove.forEach(k => pset.delete(k));
      if (typeof saveIgnoredHistoryPairs === 'function') saveIgnoredHistoryPairs(pset);
    }
    try { rebuildCustomerHistoryMap(); } catch(e){}
    try { transformCustomerCells(); } catch(e){}
    renderIgnoreManagerTable(document.getElementById('ignoreManagerSearch').value);
    updateIgnoreCountBadge();
  });

  // initial badge update
  updateIgnoreCountBadge();
});




async function safeUploadToCalendar(eventData) {
  try {
    // Build useful fields with flexible keys
    const id = eventData?.id || eventData?.orderId || eventData?._id || '';
    const name = eventData?.customer || eventData?.name || eventData?.clientName || '';
    const phone = (Array.isArray(eventData?.phones) && eventData.phones[0]) || eventData?.phone || eventData?.tel || '';
    const address = eventData?.address || eventData?.addr || eventData?.location || '';

    // Date/time extraction
    let dateVal = eventData?.date || eventData?._date || eventData?.datetime || null;
    let timeVal = eventData?.time || eventData?._time || null;
    if (!dateVal && eventData?._ts) {
      const d = new Date(eventData._ts);
      if (!isNaN(d)) {
        dateVal = dateVal || d.toLocaleDateString();
        timeVal = timeVal || d.toLocaleTimeString();
      }
    }
    if (!timeVal && typeof dateVal === 'string' && dateVal.indexOf('T') !== -1) {
      const parts = dateVal.split('T');
      dateVal = parts[0];
      timeVal = parts[1] ? parts[1].split('.')[0] : timeVal;
    }

    // Treat duration as required: must be present and positive number
    const durationRaw = eventData?.duration;
    const hasDuration = typeof durationRaw !== 'undefined' && durationRaw !== null && String(durationRaw).trim() !== '';
    const durationValid = hasDuration && !isNaN(Number(durationRaw)) && Number(durationRaw) > 0;

    const missing = [];
    if (!dateVal) missing.push('日期');
    if (!timeVal) missing.push('時間');
    if (!hasDuration) missing.push('工作時長（未填）');
    else if (!durationValid) missing.push('工作時長（需為正數）');

    // Build summary
    const summaryLines = [
      `訂單：${id || '-'}`,
      `客戶：${name || '-'}`,
      `電話：${phone || '-'}`,
      `地址：${address || '-'}`,
      `日期：${dateVal || '-'}`,
      `時間：${timeVal || '-'}`,
      `工作時長：${hasDuration ? String(durationRaw) : '-'}`
    ];
    const summary = summaryLines.join('\\n');

    if (missing.length) {
      const missText = missing.map((m,i)=>`${i+1}. ${m}`).join('\\n');
      const msg = summary + '\\n\\n缺少或不正確的欄位：\\n' + missText + '\\n\\n請補齊後再上傳。';
      if (typeof showAlert === 'function') {
        await showAlert('缺少資料', msg);
      } else {
        alert(msg);
      }
      return;
    }

    const confirmMsg = summary + '\\n\\n確定要將此訂單加入 Google 日曆嗎？';
    let ok;
    if (typeof showConfirm === 'function') {
      ok = await showConfirm('加入 Google 日曆', confirmMsg, '加入', '取消');
    } else {
      ok = confirm(confirmMsg);
    }
    if (!ok) return;

    if (typeof uploadEventToCalendar === 'function') {
      uploadEventToCalendar(eventData);
    } else if (typeof handleUploadWithAuth === 'function') {
      handleUploadWithAuth(eventData);
    } else {
      console.warn('uploadEventToCalendar / handleUploadWithAuth not found');
    }
  } catch (e) {
    console.error('safeUploadToCalendar error', e);
    if (typeof showAlert === 'function') {
      await showAlert('錯誤', '上傳過程發生錯誤，請查看 Console。');
    } else {
      alert('上傳過程發生錯誤，請查看 Console。');
    }
  }
}




// --- Helper for multiple LINE/Facebook IDs (新增ID 功能) ---
function escapeAttr(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function createLineIdRow(val){
  const div = document.createElement('div');
  div.className = 'lineid-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'lineid-input';
  input.value = val || '';
  input.placeholder = '輸入 LINE 或 Facebook ID';
  input.addEventListener('blur', ()=>{
    // try autofill from contact list if matches a contact
    const c = findContactByLineId(input.value);
    if(c){
      if(!$('customer').value) $('customer').value = c.name || '';
      if(!$('address').value) $('address').value = c.address || '';
      if ($('phone') && $('phone').dataset && $('phone').dataset.touched !== '1' && !getPhones()) setFirstPhone(c.phone || '');
    }
  });
  div.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lineid-remove btn-small';
  btn.title = '移除 ID';
  btn.textContent = '✖';
  btn.addEventListener('click', ()=>{ div.remove(); });
  div.appendChild(btn);
  return div;
}

function getLineIds(){
  const container = document.getElementById('lineIdContainer');
  if(!container) return [];
  const inputs = Array.from(container.querySelectorAll('input.lineid-input'));
  const vals = inputs.map(i=> (i.value||'').trim()).filter(Boolean);
  return vals;
}

// Utility: if there is only a legacy single #lineId input, ensure it's present in container on load
(function ensureLineIdContainerOnLoad(){
  try{
    const container = document.getElementById('lineIdContainer');
    if(!container){
      const single = $('lineId');
      if(single){
        const wrap = document.createElement('div');
        wrap.id = 'lineIdContainer';
        wrap.innerHTML = `<div class="lineid-row"></div>`;
        single.parentNode.insertBefore(wrap, single);
        wrap.querySelector('.lineid-row').appendChild(single);
      }
    }
  }catch(e){}
})();
