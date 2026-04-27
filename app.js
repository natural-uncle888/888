

    
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
      try { if (typeof initHeaderLayoutEditor === 'function') { initHeaderLayoutEditor(); } if (typeof applyHeaderLayout === 'function') { applyHeaderLayout(loadHeaderLayout()); } } catch(e) {}
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
  // --- Auth Gate ---
  try {
    if (window.Auth && window.Auth.isEnabled && window.Auth.isEnabled() && !window.Auth.isAuthed()) {
      window.Auth.openLogin();
      return;
    }
  } catch (e) {
    console.warn('Auth gate error:', e);
  }

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
function showConfirm(title, message, okLabel = '確定', cancelLabel = '取消', options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('genericConfirmModal');
    if (!modal) return resolve(confirm(message)); // fallback to native

    const panel = modal.querySelector('.confirm-panel');
    const t = document.getElementById('genericConfirmTitle');
    const m = document.getElementById('genericConfirmMessage');
    const ok = document.getElementById('genericConfirmOk');
    const cancel = document.getElementById('genericConfirmCancel');

    const danger = !!(options && options.danger);
    if (panel) panel.classList.toggle('danger', danger);

    t.textContent = title || '確認';
    m.textContent = message || '';
    ok.textContent = okLabel || '確定';
    cancel.textContent = cancelLabel || '取消';

    function cleanup(res) {
      modal.setAttribute('aria-hidden','true');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      if (panel) panel.classList.remove('danger');
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


// --- Water tank ladder requirement modal ---
(function(){
  function $id(id){ return document.getElementById(id); }

  function formatWaterTankLadderSummaryFromFields(){
    const count = Number($id('waterTank')?.value || 0);
    const req = ($id('waterTankLadderRequired')?.value || '').trim();
    const type = ($id('waterTankLadderType')?.value || '').trim();
    const range = ($id('waterTankLadderHeightRange')?.value || '').trim();
    const ft = ($id('waterTankLadderHeightFt')?.value || '').trim();
    const onsite = ($id('waterTankLadderOnsiteFlags')?.value || '').trim();
    const notes = (($id('waterTankLadderNotes')?.value || '') + '').replace(/\s+/g,' ').trim();

    function onsiteLabelsFromFlags(flagsStr){
      const flags = (flagsStr ? flagsStr.split(',').map(s => s.trim()).filter(Boolean) : []);
      const map = {
        horizontal: '橫式擺放',
        vertical: '立式擺放',
        fixed_ladder: '有固定梯可到水塔',
        narrow_entry: '頂樓入口狹窄/樓梯陡',
        two_person: '需要兩人作業'
      };
      return flags.map(f => map[f]).filter(Boolean);
    }

    const onsiteLabels = onsiteLabelsFromFlags(onsite);

    function joinParts(base){
      const parts = [base];
      if (onsiteLabels.length) parts.push('現場：' + onsiteLabels.join('、'));
      if (notes) parts.push('備註：' + notes);
      return parts.join('；');
    }

    if (!count || count <= 0) return joinParts('梯子：未設定');
    if (!req) return joinParts('梯子：未設定');
    if (req === 'no') return joinParts('梯子：不需要');

    const typeLabel = (function(){
      if (type === 'plastic') return '三步梯';
      if (type === '5_8ft') return '5–8尺';
      if (type === 'climb') return '爬梯';
      if (type === 'higher'){
        let h = '';
        if (range === '9_10') h = '9–10尺';
        else if (range === '11_12') h = '11–12尺';
        else if (range === '13_14') h = '13–14尺';
        else if (range === '15_plus') h = (ft ? (ft + '尺') : '15尺以上');
        else h = '更高';
        return '更高（' + h + '）';
      }
      return '需要（未選類型）';
    })();

    return joinParts('梯子：需要 / ' + typeLabel);
  }

  window.updateWaterTankLadderSummary = function(){
    const summaryEl = $id('waterTankLadderSummary');
    const btn = $id('waterTankLadderBtn');
    if (!summaryEl) return;
    summaryEl.textContent = formatWaterTankLadderSummaryFromFields();
    const count = Number($id('waterTank')?.value || 0);
    if (btn) btn.disabled = !(count > 0);
  };

  function clearWaterTankLadderFields(){
    if ($id('waterTankLadderRequired')) $id('waterTankLadderRequired').value = '';
    if ($id('waterTankLadderType')) $id('waterTankLadderType').value = '';
    if ($id('waterTankLadderHeightRange')) $id('waterTankLadderHeightRange').value = '';
    if ($id('waterTankLadderHeightFt')) $id('waterTankLadderHeightFt').value = '';
    if ($id('waterTankLadderNotes')) $id('waterTankLadderNotes').value = '';
    if ($id('waterTankLadderOnsiteFlags')) $id('waterTankLadderOnsiteFlags').value = '';
  }

  function init(){
    const modal = $id('waterTankLadderModal');
    const openBtn = $id('waterTankLadderBtn');
    if (!modal || !openBtn) return;

    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = $id('waterTankLadderCloseBtn');
    const cancelBtn = $id('waterTankLadderCancelBtn');
    const saveBtn = $id('waterTankLadderSaveBtn');

    const reqNo = $id('wtLadderReqNo');
    const reqYes = $id('wtLadderReqYes');
    const typeSel = $id('wtLadderType');
    const typeWrap = $id('wtLadderTypeWrap');
    const heightWrap = $id('wtLadderHeightWrap');
    const heightRange = $id('wtLadderHeightRange');
    const heightFt = $id('wtLadderHeightFt');
    const notes = $id('wtLadderNotes');
    // onsite flags (multi-select)
    const onsiteHorizontal = $id('wtOnsiteHorizontal');
    const onsiteVertical = $id('wtOnsiteVertical');
    const onsiteFixedLadder = $id('wtOnsiteFixedLadder');
    const onsiteNarrow = $id('wtOnsiteNarrow');
    const onsiteTwoPerson = $id('wtOnsiteTwoPerson');

    function getOnsiteFlagsFromUI(){
      const flags = [];
      if (onsiteHorizontal?.checked) flags.push('horizontal');
      if (onsiteVertical?.checked) flags.push('vertical');
      if (onsiteFixedLadder?.checked) flags.push('fixed_ladder');
      if (onsiteNarrow?.checked) flags.push('narrow_entry');
      if (onsiteTwoPerson?.checked) flags.push('two_person');
      return flags;
    }

    function setOnsiteFlagsToUI(flags){
      const set = new Set((flags || []).filter(Boolean));
      if (onsiteHorizontal) onsiteHorizontal.checked = set.has('horizontal');
      if (onsiteVertical) onsiteVertical.checked = set.has('vertical');
      if (onsiteFixedLadder) onsiteFixedLadder.checked = set.has('fixed_ladder');
      if (onsiteNarrow) onsiteNarrow.checked = set.has('narrow_entry');
      if (onsiteTwoPerson) onsiteTwoPerson.checked = set.has('two_person');
    }

    function setVisible(el, visible){ if(!el) return; el.style.display = visible ? '' : 'none'; }

    function syncVisibility(){
      const required = reqYes?.checked;
      setVisible(typeWrap, !!required);
      const isHigher = required && (typeSel?.value === 'higher');
      setVisible(heightWrap, !!isHigher);
      const needsFt = isHigher && (heightRange?.value === '15_plus');
      if (heightFt) heightFt.disabled = !needsFt;
      if (heightFt && !needsFt) heightFt.value = '';
    }

    function open(){
      // populate from hidden fields
      const req = ($id('waterTankLadderRequired')?.value || '').trim();
      const type = ($id('waterTankLadderType')?.value || '').trim();
      const range = ($id('waterTankLadderHeightRange')?.value || '').trim();
      const ft = ($id('waterTankLadderHeightFt')?.value || '').trim();
      const n = ($id('waterTankLadderNotes')?.value || '').trim();
      const f = ($id('waterTankLadderOnsiteFlags')?.value || '').trim();

      if (req === 'yes') { if (reqYes) reqYes.checked = true; }
      else if (req === 'no') { if (reqNo) reqNo.checked = true; }
      else { if (reqNo) reqNo.checked = false; if (reqYes) reqYes.checked = false; }

      if (typeSel) typeSel.value = type || '';
      if (heightRange) heightRange.value = range || '';
      if (heightFt) heightFt.value = ft || '';
      if (notes) notes.value = n || '';

      // onsite flags
      const flags = f ? f.split(',').map(s => s.trim()).filter(Boolean) : [];
      setOnsiteFlagsToUI(flags);

      syncVisibility();
      modal.setAttribute('aria-hidden','false');
    }

    function close(){
      modal.setAttribute('aria-hidden','true');
    }

    function save(){
      const required = reqYes?.checked ? 'yes' : (reqNo?.checked ? 'no' : '');
      if (!required){
        if (typeof showAlert === 'function') { showAlert('請完成填寫', '請選擇「是否需要攜帶梯子」。'); }
        else { alert('請選擇是否需要攜帶梯子'); }
        return;
      }
      if (required === 'no'){
        clearWaterTankLadderFields();
        if ($id('waterTankLadderRequired')) $id('waterTankLadderRequired').value = 'no';
        // notes still allowed even when not required
        if ($id('waterTankLadderNotes')) $id('waterTankLadderNotes').value = (notes?.value||'').trim();
        if ($id('waterTankLadderOnsiteFlags')) $id('waterTankLadderOnsiteFlags').value = getOnsiteFlagsFromUI().join(',');
        window.updateWaterTankLadderSummary?.();
        close();
        return;
      }

      const type = (typeSel?.value || '').trim();
      if (!type){
        if (typeof showAlert === 'function') { showAlert('請完成填寫', '需要攜帶梯子時，請選擇梯子類型。'); }
        else { alert('請選擇梯子類型'); }
        return;
      }

      let range = (heightRange?.value || '').trim();
      let ft = (heightFt?.value || '').trim();
      if (type === 'higher'){
        if (!range){
          if (typeof showAlert === 'function') { showAlert('請完成填寫', '選擇「更高的梯子」時，請選擇高度區間。'); }
          else { alert('請選擇高度區間'); }
          return;
        }
        if (range === '15_plus'){
          const n = Number(ft);
          if (!Number.isFinite(n) || n < 15){
            if (typeof showAlert === 'function') { showAlert('請完成填寫', '「15 尺以上」請填入合理尺數（例如 15、16…）。'); }
            else { alert('15尺以上請填入合理尺數'); }
            return;
          }
          ft = String(Math.round(n));
        } else {
          ft = '';
        }
      } else {
        range = '';
        ft = '';
      }

      if ($id('waterTankLadderRequired')) $id('waterTankLadderRequired').value = 'yes';
      if ($id('waterTankLadderType')) $id('waterTankLadderType').value = type;
      if ($id('waterTankLadderHeightRange')) $id('waterTankLadderHeightRange').value = range;
      if ($id('waterTankLadderHeightFt')) $id('waterTankLadderHeightFt').value = ft;
      if ($id('waterTankLadderNotes')) $id('waterTankLadderNotes').value = (notes?.value||'').trim();
      if ($id('waterTankLadderOnsiteFlags')) $id('waterTankLadderOnsiteFlags').value = getOnsiteFlagsFromUI().join(',');

      window.updateWaterTankLadderSummary?.();
      close();
    }

    // open triggers
    openBtn.addEventListener('click', () => {
      const count = Number($id('waterTank')?.value || 0);
      if (!(count > 0)){
        if (typeof showAlert === 'function') { showAlert('提示', '請先設定水塔數量（大於 0）後再設定梯子需求。'); }
        else { alert('請先設定水塔數量（大於 0）'); }
        return;
      }
      open();
    });

    // close triggers
    if (backdrop) backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (saveBtn) saveBtn.addEventListener('click', save);

    // field listeners
    if (reqNo) reqNo.addEventListener('change', syncVisibility);
    if (reqYes) reqYes.addEventListener('change', syncVisibility);
    if (typeSel) typeSel.addEventListener('change', syncVisibility);
    if (heightRange) heightRange.addEventListener('change', syncVisibility);

    // keep fields consistent with waterTank count
    const tankInput = $id('waterTank');
    if (tankInput){
      tankInput.addEventListener('input', () => {
        const v = Number(tankInput.value || 0);
        if (!v || v <= 0){
          clearWaterTankLadderFields();
        }
        window.updateWaterTankLadderSummary?.();
      });
    }

    // initial state
    window.updateWaterTankLadderSummary?.();
    syncVisibility();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
// --- end water tank ladder modal ---



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
  const CUSTOMER_STORAGE_KEY = 'customerTableColWidths';

  function applySavedWidths(table, storageKey) {
    const key = storageKey || STORAGE_KEY;
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
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

  function saveWidths(table, storageKey) {
    const ths = table.querySelectorAll('thead th');
    const data = {};
    ths.forEach((th, i) => {
      const w = parseInt(window.getComputedStyle(th).width, 10);
      if (!isNaN(w)) data[i] = w;
    });
    const key = storageKey || STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(data));
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
        startDrag(e, table, index, STORAGE_KEY);
      });
      resizer.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        startDrag(touch, table, index, STORAGE_KEY);
      }, {passive:false});
    });

    applySavedWidths(table, STORAGE_KEY);
  };

  window.makeCustomerTableResizable = function() {
    const table = document.querySelector('#customerTable');
    if (!table) return;
    const thead = table.querySelector('thead');
    if (!thead) return;

    // 移除舊的把手
    table.querySelectorAll('.orders-col-resizer').forEach(el => el.remove());

    const ths = Array.from(thead.querySelectorAll('th'));
    ths.forEach((th, index) => {
      if (index === ths.length - 1) return;
      const resizer = document.createElement('div');
      resizer.className = 'orders-col-resizer';
      resizer.dataset.colIndex = index;
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
        startDrag(e, table, index, CUSTOMER_STORAGE_KEY);
      });
      resizer.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        startDrag(touch, table, index, CUSTOMER_STORAGE_KEY);
      }, {passive:false});
    });

    applySavedWidths(table, CUSTOMER_STORAGE_KEY);
  };

  function startDrag(e, table, colIndex, storageKey) {
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
      saveWidths(table, storageKey);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }



  // Auto-run after a short delay in case table is built later
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
      try{
        if (typeof makeOrdersTableResizable === 'function') makeOrdersTableResizable();
        if (typeof makeCustomerTableResizable === 'function') makeCustomerTableResizable();
      }catch(e){}
    }, 350);
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

    // Chart 實例暫存，避免重複建立
    let yearOrdersChart = null;
    let yearIncomeChart = null;

    function getYearsFromOrders(){
      try {
        const _ordForYear = (document.getElementById("mergeBundleReport")?.checked && typeof mergeOrdersByBundle==="function") ? mergeOrdersByBundle(orders||[]) : (orders||[]);
          const yrs = Array.from(new Set(
          (_ordForYear).map(o => o.date ? new Date(o.date).getFullYear() : null).filter(Boolean)
        ));
        yrs.sort((a,b)=>b-a); // desc
        return yrs;
      } catch(e){ return []; }
    }

    function populateYearOptions(){
      const years = getYearsFromOrders();
      const opts = ['<option value="all">全部年份</option>']
        .concat(years.map(y=>`<option value="${y}">${y}</option>`));
      sel.innerHTML = opts.join('');
      if (years.length > 0){
        sel.value = String(years[0]);
      } else {
        sel.value = 'all';
      }
    }

    function renderYearStats(targetYear){
      const ord = (document.getElementById('mergeBundleReport')?.checked && typeof mergeOrdersByBundle === 'function') ? mergeOrdersByBundle(orders || []) : (orders || []);
      const exp = expenses || [];

      // ---- 數字統計 ----
      const filtered = ord.filter(o=> {
        if(!o.date) return false;
        const y = new Date(o.date).getFullYear();
        return targetYear === 'all' ? true : (y == targetYear);
      });
      const totalCount = filtered.length;
      const totalAmount = filtered.reduce((s,o)=> s + (+o.total||0), 0);
      const netAmount   = filtered.reduce((s,o)=> s + (+o.netTotal||0), 0);
      const expenseTotalBase = (exp || []).filter(e => {
  if(!e.date) return false;
  const y = new Date(e.date).getFullYear();
  return targetYear === 'all' ? true : (y == targetYear);
}).reduce((s,e)=> s + (+e.amount||0), 0);

// 訂單內花費：車資 + 日薪助手（依訂單日期計）
const expenseTotalOrders = (orders || []).filter(o => {
  if(!o.date) return false;
  const d = new Date(o.date);
  if (isNaN(d)) return false;
  const y = d.getFullYear();
  return targetYear === 'all' ? true : (y == targetYear);
}).reduce((s,o)=> s + (typeof orderExpenseAmount === 'function' ? orderExpenseAmount(o) : ((Number(o.transportFee)||0) + (Number(o.helperCost)||0))), 0);

const expenseTotal = expenseTotalBase + expenseTotalOrders;
      const completed = filtered.filter(o=> o.status === '完成').length;
      const doneRate = totalCount ? ((completed/totalCount*100).toFixed(1) + '%') : '—';
      const netIncome = netAmount - expenseTotal;

      if (typeof fmtCurrency !== 'function'){
        // 後備：避免某些情況 fmtCurrency 未定義
        window.fmtCurrency = window.fmtCurrency || (n => (n||0).toLocaleString('zh-TW', {minimumFractionDigits:0}));
      }

      summaryEl.innerHTML = `
        <div class="box"><div class="small">年份</div><div class="number">${targetYear === 'all' ? '全部' : targetYear}</div></div>
        <div class="box"><div class="small">筆數</div><div class="number">${totalCount}</div></div>
        <div class="box"><div class="small">總金額</div><div class="number">${fmtCurrency(totalAmount)}</div></div>
        <div class="box"><div class="small">折後總金額</div><div class="number">${fmtCurrency(netAmount)}</div></div>
        <div class="box"><div class="small">花費</div><div class="number">${fmtCurrency(expenseTotal)}</div></div>
        <div class="box"><div class="small">淨收入</div><div class="number">${fmtCurrency(netIncome)}</div></div>
        <div class="box"><div class="small">完成率</div><div class="number">${doneRate}</div></div>
      `;

      // ---- 圖表資料（每月） ----
      const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      const ordersByMonth  = new Array(12).fill(0);
      const incomeByMonth  = new Array(12).fill(0);
      const expenseByMonth = new Array(12).fill(0);

      (ord || []).forEach(o => {
        if (!o.date) return;
        const d = new Date(o.date);
        if (isNaN(d)) return;
        const y = d.getFullYear();
        const m = d.getMonth(); // 0~11
        if (targetYear !== 'all' && y !== +targetYear) return;
        ordersByMonth[m] += 1;
        const income = +o.netTotal || +o.total || 0;
        incomeByMonth[m] += income;
      });

      (exp || []).forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        if (isNaN(d)) return;
        const y = d.getFullYear();
        const m = d.getMonth();
        if (targetYear !== 'all' && y !== +targetYear) return;
        expenseByMonth[m] += (+e.amount || 0);
      });

// 加上訂單內花費（車資 + 日薪助手）
(orders || []).forEach(o => {
  if (!o.date) return;
  const d = new Date(o.date);
  if (isNaN(d)) return;
  const y = d.getFullYear();
  const m = d.getMonth(); // 0~11
  if (targetYear !== 'all' && y !== +targetYear) return;
  const amt = (typeof orderExpenseAmount === 'function')
    ? orderExpenseAmount(o)
    : ((Number(o.transportFee)||0) + (Number(o.helperCost)||0));
  expenseByMonth[m] += amt;
});


      // ---- Chart.js 繪製 ----
      if (window.Chart){
        const ordersCanvas = document.getElementById('chartOrdersByMonth');
        if (ordersCanvas){
          if (yearOrdersChart) yearOrdersChart.destroy();
          yearOrdersChart = new Chart(ordersCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: '訂單數',
                data: ordersByMonth
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true, ticks: { precision:0 } }
              }
            }
          });
        }

        const incomeCanvas = document.getElementById('chartIncomeVsExpense');
        if (incomeCanvas){
          if (yearIncomeChart) yearIncomeChart.destroy();
          yearIncomeChart = new Chart(incomeCanvas.getContext('2d'), {
            type: 'bar',
            data: {
              labels,
              datasets: [
                { label: '淨收入', data: incomeByMonth },
                { label: '花費',   data: expenseByMonth }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true }
              }
            }
          });
        }
      }
    }

    // 提供給外部呼叫（切換分頁時）
    window.refreshYearStatSelect = function(){
      const prev = sel.value;
      populateYearOptions();
      const foundPrev = Array.from(sel.options).some(o=>o.value === prev);
      sel.value = foundPrev ? prev : sel.value;
      renderYearStats(sel.value);
    };

    populateYearOptions();
    renderYearStats(sel.value);

    sel.addEventListener('change', function(){ renderYearStats(this.value); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (typeof orders === 'undefined' || typeof expenses === 'undefined'){
      document.addEventListener('appCoreReady', initYearStat, { once:true });
    } else {
      initYearStat();
    }
  });
})();




// === 報表：自訂統計圖表（年度 / 月份 / 比較） ===
(function(){
  function ensureOrdersArray(){
    let arr = [];
    if (Array.isArray(window.orders)) arr = window.orders;
    else if (typeof orders !== 'undefined' && Array.isArray(orders)) arr = orders;
    const mergeOn = !!document.getElementById('mergeBundleReport')?.checked;
    if (mergeOn && typeof mergeOrdersByBundle === 'function'){
      return mergeOrdersByBundle(arr);
    }
    return arr;
  }
  function ensureExpensesArray(){
    if (Array.isArray(window.expenses)) return window.expenses;
    if (typeof expenses !== 'undefined' && Array.isArray(expenses)) return expenses;
    return [];
  }

  function getAvailableYears(){
    const ord = ensureOrdersArray();
    const exp = ensureExpensesArray();
    const set = new Set();
    ord.forEach(o => {
      if (!o || !o.date) return;
      const d = new Date(o.date);
      if (!isNaN(d)) set.add(d.getFullYear());
    });
    exp.forEach(e => {
      if (!e || !e.date) return;
      const d = new Date(e.date);
      if (!isNaN(d)) set.add(d.getFullYear());
    });
    const arr = Array.from(set);
    arr.sort((a,b)=>b-a);
    return arr;
  }

  function daysInMonth(year, month){ // month: 1-12
    return new Date(year, month, 0).getDate();
  }

  function aggregateByMonth(year, metric){
    const ord = ensureOrdersArray();
    const exp = ensureExpensesArray();
    const labels = [];
    for (let m=1; m<=12; m++){
      labels.push(m + '月');
    }
    const count   = new Array(12).fill(0);
    const income  = new Array(12).fill(0);
    const expense = new Array(12).fill(0);

    ord.forEach(o => {
      if (!o || !o.date) return;
      const d = new Date(o.date);
      if (isNaN(d)) return;
      if (d.getFullYear() !== year) return;
      const m = d.getMonth(); // 0-11
      if (metric === 'count'){
        count[m] += 1;
      } else {
        const net = +o.netTotal || 0;
        income[m] += net;
      }
    });

    exp.forEach(e => {
      if (!e || !e.date) return;
      const d = new Date(e.date);
      if (isNaN(d)) return;
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      expense[m] += (+e.amount || 0);
    });

// 加上訂單內花費（車資 + 日薪助手）
(orders || []).forEach(o => {
  if (!o || !o.date) return;
  const d = new Date(o.date);
  if (isNaN(d)) return;
  if (d.getFullYear() !== year) return;
  const m = d.getMonth();
  const amt = (typeof orderExpenseAmount === 'function')
    ? orderExpenseAmount(o)
    : ((Number(o.transportFee)||0) + (Number(o.helperCost)||0));
  expense[m] += amt;
});

    if (metric === 'count'){
      return { labels, data: count };
    } else if (metric === 'revenue'){
      return { labels, data: income };
    } else if (metric === 'net'){
      const net = income.map((v,i)=> v - expense[i]);
      return { labels, data: net };
    } else if (metric === 'expense'){
      return { labels, data: expense };
    }
    return { labels, data: income };
  }

  function aggregateByDay(year, month, metric){
    const ord = ensureOrdersArray();
    const exp = ensureExpensesArray();
    const days = daysInMonth(year, month);
    const labels = [];
    for (let d=1; d<=days; d++){
      labels.push(d + '日');
    }
    const count   = new Array(days).fill(0);
    const income  = new Array(days).fill(0);
    const expense = new Array(days).fill(0);

    ord.forEach(o => {
      if (!o || !o.date) return;
      const dt = new Date(o.date);
      if (isNaN(dt)) return;
      if (dt.getFullYear() !== year) return;
      if ((dt.getMonth()+1) !== month) return;
      const day = dt.getDate();
      const idx = day - 1;
      if (idx < 0 || idx >= days) return;
      if (metric === 'count'){
        count[idx] += 1;
      } else {
        const net = +o.netTotal || 0;
        income[idx] += net;
      }
    });

    exp.forEach(e => {
      if (!e || !e.date) return;
      const dt = new Date(e.date);
      if (isNaN(dt)) return;
      if (dt.getFullYear() !== year) return;
      if ((dt.getMonth()+1) !== month) return;
      const day = dt.getDate();
      const idx = day - 1;
      if (idx < 0 || idx >= days) return;
      expense[idx] += (+e.amount || 0);
    });

// 加上訂單內花費（車資 + 日薪助手）
(orders || []).forEach(o => {
  if (!o || !o.date) return;
  const dt = new Date(o.date);
  if (isNaN(dt)) return;
  if (dt.getFullYear() !== year) return;
  if ((dt.getMonth()+1) !== month) return;
  const day = dt.getDate();
  const idx = day - 1;
  if (idx < 0 || idx >= days) return;
  const amt = (typeof orderExpenseAmount === 'function')
    ? orderExpenseAmount(o)
    : ((Number(o.transportFee)||0) + (Number(o.helperCost)||0));
  expense[idx] += amt;
});

    if (metric === 'count'){
      return { labels, data: count };
    } else if (metric === 'revenue'){
      return { labels, data: income };
    } else if (metric === 'net'){
      const net = income.map((v,i)=> v - expense[i]);
      return { labels, data: net };
    } else if (metric === 'expense'){
      return { labels, data: expense };
    }
    return { labels, data: income };
  }

  function buildSingleSeries(year, monthValue, metric){
    if (!year) return { labels: [], datasets: [] };
    if (!monthValue || monthValue === 'all'){
      const agg = aggregateByMonth(year, metric);
      return {
        labels: agg.labels,
        datasets: [{
          label: year + '年',
          data: agg.data
        }]
      };
    } else {
      const month = typeof monthValue === 'string' ? parseInt(monthValue, 10) : monthValue;
      if (!month || isNaN(month)) return { labels: [], datasets: [] };
      const agg = aggregateByDay(year, month, metric);
      return {
        labels: agg.labels,
        datasets: [{
          label: year + '年' + month + '月',
          data: agg.data
        }]
      };
    }
  }

  function buildYearCompareSeries(yearA, yearB, metric){
    if (!yearA || !yearB || yearA === yearB) return { labels: [], datasets: [] };
    const aggA = aggregateByMonth(yearA, metric);
    const aggB = aggregateByMonth(yearB, metric);
    return {
      labels: aggA.labels,
      datasets: [
        { label: yearA + '年', data: aggA.data },
        { label: yearB + '年', data: aggB.data }
      ]
    };
  }

  function buildMonthCompareSeries(yearA, yearB, month, metric){
    if (!yearA || !yearB || !month || yearA === yearB) return { labels: [], datasets: [] };
    const aggA = aggregateByDay(yearA, month, metric);
    const aggB = aggregateByDay(yearB, month, metric);
    if (!aggA.labels.length && !aggB.labels.length){
      return { labels: [], datasets: [] };
    }
    // labels 直接用 A 的，若 B 不同天數也無妨，Chart.js 會自動對齊 index
    return {
      labels: aggA.labels.length ? aggA.labels : aggB.labels,
      datasets: [
        { label: yearA + '年' + month + '月', data: aggA.data },
        { label: yearB + '年' + month + '月', data: aggB.data }
      ]
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    const canvas    = document.getElementById('customStatChart');
    const yearSel   = document.getElementById('customChartYear');
    const yearSelB  = document.getElementById('customChartYearB');
    const monthSel  = document.getElementById('customChartMonth');
    const metricSel = document.getElementById('customChartMetric');
    const modeSel   = document.getElementById('customChartCompareMode');
    const yearBWrap = document.querySelector('.custom-chart-yearB-wrap');
    if (!canvas || !yearSel || !metricSel || !modeSel) return;

    // 花費分類圓餅圖相關元素
    const expCatCanvas = document.getElementById('chartExpenseByCategory');
    const expMonthSelA = document.getElementById('expenseCatMonthA');
    const expMonthSelB = document.getElementById('expenseCatMonthB');
    const yearStatSel  = document.getElementById('yearStatSelect');

    let chart = null;           // 自訂統計圖表
    let expenseCatChart = null; // 花費分類圓餅圖

    function populateYearSelects(){
      const years = getAvailableYears();
      const nowY = new Date().getFullYear();
      const list = years.length ? years : [nowY];

      const prevA = yearSel.value;
      const prevB = yearSelB ? yearSelB.value : '';

      yearSel.innerHTML = '';
      list.forEach(y => {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = y + '年';
        yearSel.appendChild(opt);
      });

      if (yearSelB){
        yearSelB.innerHTML = '';
        list.forEach(y => {
          const opt = document.createElement('option');
          opt.value = String(y);
          opt.textContent = y + '年';
          yearSelB.appendChild(opt);
        });
      }

      if (prevA && Array.from(yearSel.options).some(o=>o.value === prevA)){
        yearSel.value = prevA;
      }
      if (yearSelB && prevB && Array.from(yearSelB.options).some(o=>o.value === prevB)){
        yearSelB.value = prevB;
      }
    }

    function getConfig(){
      const mode   = (modeSel.value || 'none');
      const yearA  = parseInt(yearSel.value, 10) || null;
      const yearB  = (yearSelB && yearSelB.value) ? (parseInt(yearSelB.value, 10) || null) : null;
      const metric = (metricSel.value || 'count');
      let monthVal = monthSel ? monthSel.value : 'all';
      if (mode === 'year') monthVal = 'all';
      return { mode, yearA, yearB, metric, month: monthVal };
    }

    function updateVisibility(){
      const cfg = getConfig();
      if (yearBWrap){
        yearBWrap.style.display = (cfg.mode === 'year' || cfg.mode === 'month') ? '' : 'none';
      }
      if (monthSel){
        if (cfg.mode === 'year'){
          monthSel.value = 'all';
          monthSel.disabled = true;
        } else {
          monthSel.disabled = false;
        }
      }
    }

    function updateChart(){
      if (!window.Chart) return;
      const cfg = getConfig();
      if (!cfg.yearA) return;

      let result;
      if (cfg.mode === 'year'){
        result = buildYearCompareSeries(cfg.yearA, cfg.yearB, cfg.metric);
      } else if (cfg.mode === 'month'){
        const month = cfg.month && cfg.month !== 'all' ? parseInt(cfg.month, 10) : null;
        if (!month) return;
        result = buildMonthCompareSeries(cfg.yearA, cfg.yearB, month, cfg.metric);
      } else {
        result = buildSingleSeries(cfg.yearA, cfg.month, cfg.metric);
      }

      if (!result || !result.labels || !result.labels.length){
        return;
      }

      const datasets = result.datasets.map((ds, idx) => {
        const base = {
          label: ds.label,
          data: ds.data
        };
        return base;
      });

      if (!chart){
        chart = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: result.labels,
            datasets: datasets
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true },
              title: { display: false }
            },
            scales: {
              x: { ticks: { autoSkip: false } },
              y: { beginAtZero: true }
            }
          }
        });
      } else {
        chart.data.labels = result.labels;
        chart.data.datasets = datasets;
        chart.update();
      }
    }

    function handleChange(){
      updateVisibility();
      updateChart();
    }

    [yearSel, yearSelB, monthSel, metricSel, modeSel].forEach(el => {
      if (!el) return;
      el.addEventListener('change', handleChange);
    });

    
    // --- 花費分類圓餅圖：依年度 / 月份顯示各類別金額，支援跨月份比較 ---
    function populateExpenseMonthSelects(){
      if (!expMonthSelA || !expMonthSelB) return;
      expMonthSelA.innerHTML = '';
      expMonthSelB.innerHTML = '';

      for (let m = 1; m <= 12; m++){
        const optA = document.createElement('option');
        optA.value = String(m);
        optA.textContent = m + ' 月';
        expMonthSelA.appendChild(optA);

        const optB = document.createElement('option');
        optB.value = String(m);
        optB.textContent = m + ' 月';
        expMonthSelB.appendChild(optB);
      }

      // 比較月份可以選擇「不比較」
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = '不比較';
      expMonthSelB.insertBefore(noneOpt, expMonthSelB.firstChild);

      // 預設主月份為本月
      const now = new Date();
      expMonthSelA.value = String(now.getMonth() + 1);
      expMonthSelB.value = '';
    }

    function updateExpenseCategoryChart(){
      if (!expCatCanvas || !yearStatSel || !window.Chart) return;
      const yearVal = yearStatSel.value;
      if (!yearVal || yearVal === 'all') return;
      const year = parseInt(yearVal, 10);
      if (!year || isNaN(year)) return;

      const mA = expMonthSelA ? parseInt(expMonthSelA.value || '0', 10) : 0;
      const mB = (expMonthSelB && expMonthSelB.value) ? parseInt(expMonthSelB.value, 10) : 0;
      if (!mA || isNaN(mA)) return;

      const exp = ensureExpensesArray();
      const byCatA = {};
      const byCatB = {};

      exp.forEach(e => {
        if (!e || !e.date) return;
        const dt = new Date(e.date);
        if (isNaN(dt)) return;
        if (dt.getFullYear() !== year) return;
        const month = dt.getMonth() + 1;
        const amt = +e.amount || 0;
        const cat = (e.category || '未分類').trim() || '未分類';
        if (month === mA){
          byCatA[cat] = (byCatA[cat] || 0) + amt;
        }
        if (mB && month === mB){
          byCatB[cat] = (byCatB[cat] || 0) + amt;
        }
      });
// 訂單內花費也納入分類（車資 / 日薪助手）
(orders || []).forEach(o => {
  if (!o || !o.date) return;
  const dt = new Date(o.date);
  if (isNaN(dt)) return;
  if (dt.getFullYear() !== year) return;
  const month = dt.getMonth() + 1;

  const transport = Number(o.transportFee) || 0;
  const helper = Number(o.helperCost) || 0;

  if (month === mA){
    if (transport) byCatA['車資'] = (byCatA['車資'] || 0) + transport;
    if (helper) byCatA['日薪助手'] = (byCatA['日薪助手'] || 0) + helper;
  }
  if (mB && month === mB){
    if (transport) byCatB['車資'] = (byCatB['車資'] || 0) + transport;
    if (helper) byCatB['日薪助手'] = (byCatB['日薪助手'] || 0) + helper;
  }
});

      const labelSet = new Set([
        ...Object.keys(byCatA),
        ...Object.keys(byCatB)
      ]);
      const labels = Array.from(labelSet);
      if (!labels.length){
        if (expenseCatChart){
          expenseCatChart.destroy();
          expenseCatChart = null;
        }
        return;
      }

      const dataA = labels.map(cat => byCatA[cat] || 0);
      const datasets = [{
        label: mA + ' 月',
        data: dataA
      }];

      if (mB){
        const dataB = labels.map(cat => byCatB[cat] || 0);
        datasets.push({
          label: mB + ' 月',
          data: dataB
        });
      }

      if (expenseCatChart){
        expenseCatChart.destroy();
      }

      expenseCatChart = new Chart(expCatCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels,
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true },
            title: {
              display: false
            }
          }
        }
      });
    }

    if (expCatCanvas && expMonthSelA && expMonthSelB && yearStatSel){
      populateExpenseMonthSelects();
      [yearStatSel, expMonthSelA, expMonthSelB].forEach(el => {
        el.addEventListener('change', updateExpenseCategoryChart);
      });
    }

populateYearSelects();
    updateVisibility();
    updateChart();

    // 若核心資料尚未準備好，等 appCoreReady 再刷新一次
    if (typeof orders === 'undefined' || typeof expenses === 'undefined'){
      document.addEventListener('appCoreReady', function(){
        populateYearSelects();
        updateVisibility();
        updateChart();
        if (expCatCanvas && expMonthSelA && expMonthSelB && yearStatSel){
          populateExpenseMonthSelects();
          updateExpenseCategoryChart();
        }
      }, { once:true });
    }
  });
})();


// === 報表：KPI 概覽（今日 / 本週 / 本月） ===
(function(){
  function parseDateOnly(str){
    if (!str) return null;
    try{
      const dStr = String(str).split('T')[0];
      const parts = dStr.split('-');
      if (parts.length < 3) return null;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    }catch(e){
      return null;
    }
  }

  function makeRangePredicate(range){
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = startToday;
    let end;

    if (range === 'today'){
      end = new Date(startToday);
      end.setDate(end.getDate() + 1);
    } else if (range === 'week'){
      // 以週一為一週開始
      const day = startToday.getDay(); // Sun=0
      const diff = (day + 6) % 7; // 轉成 Mon=0
      start = new Date(startToday);
      start.setDate(start.getDate() - diff);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else {
      // 預設使用本月
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return function(dateStr){
      const d = parseDateOnly(dateStr);
      if (!d) return false;
      return d >= start && d < end;
    };
  }

  function calcKpi(range){
    const inRange = makeRangePredicate(range);
    let ord = Array.isArray(window.orders) ? window.orders
      : (typeof orders !== 'undefined' && Array.isArray(orders) ? orders : []);
    if (document.getElementById('mergeBundleReport')?.checked && typeof mergeOrdersByBundle === 'function'){
      ord = mergeOrdersByBundle(ord);
    }
    const exp = Array.isArray(window.expenses) ? window.expenses
      : (typeof expenses !== 'undefined' && Array.isArray(expenses) ? expenses : []);


const ordRaw = Array.isArray(window.orders) ? window.orders
  : (typeof orders !== 'undefined' && Array.isArray(orders) ? orders : []);
    const oFiltered = ord.filter(o => inRange(o.date));
    const eFiltered = exp.filter(e => inRange(e.date));

    const totalOrders = oFiltered.length;
    const completed = oFiltered.filter(o => o.status === '完成').length;
    const completionRate = totalOrders ? ((completed / totalOrders) * 100).toFixed(1) + '%' : '—';

    let revenue = 0;
    oFiltered.forEach(o => {
      const v = (o.netTotal !== undefined && o.netTotal !== null)
        ? Number(o.netTotal)
        : Number(o.total || 0);
      if (!Number.isNaN(v)) revenue += v;
    });

    let expenseTotal = 0;
    eFiltered.forEach(e => {
      const v = Number(e.amount || 0);
      if (!Number.isNaN(v)) expenseTotal += v;
    });

    // 訂單內花費：車資 + 日薪助手
    let orderExpenseTotal = 0;
    (ordRaw || []).forEach(o => {
      if (!o || !o.date) return;
      if (!inRange(o.date)) return;
      const amt = (typeof orderExpenseAmount === 'function')
        ? orderExpenseAmount(o)
        : ((Number(o.transportFee)||0) + (Number(o.helperCost)||0));
      orderExpenseTotal += amt;
    });
    expenseTotal += orderExpenseTotal;

    const netIncome = revenue - expenseTotal;

    return {
      orders: totalOrders,
      completionRate,
      revenue,
      expense: expenseTotal,
      netIncome
    };
  }

  function renderKpi(range){
    const container = document.getElementById('kpiCards');
    if (!container) return;
    const data = calcKpi(range);

    const items = [
      { key:'orders', label:'訂單數', value: data.orders, isMoney:false },
      { key:'completion', label:'完成率', value: data.completionRate, isMoney:false },
      { key:'revenue', label:'營業額（折扣後）', value: data.revenue, isMoney:true },
      { key:'expense', label:'花費', value: data.expense, isMoney:true },
      { key:'netIncome', label:'淨收入', value: data.netIncome, isMoney:true }
    ];

    container.innerHTML = items.map(it => {
      let display = it.value;
      if (it.isMoney && typeof it.value === 'number'){
        display = (typeof fmtCurrency === 'function')
          ? fmtCurrency(it.value)
          : (it.value || 0).toLocaleString('zh-TW', {maximumFractionDigits:0});
      }
      return '<div class="box">' +
        '<div class="small">' + it.label + '</div>' +
        '<div class="number">' + display + '</div>' +
      '</div>';
    }).join('');
  }

  function setupKpi(){
    const container = document.getElementById('kpiCards');
    if (!container) return;

    let currentRange = 'today';
    renderKpi(currentRange);

    const mergeEl = document.getElementById('mergeBundleReport');
    if (mergeEl && mergeEl.dataset.boundKpiMerge !== '1'){
      mergeEl.addEventListener('change', function(){ renderKpi(currentRange); });
      mergeEl.dataset.boundKpiMerge = '1';
    }

    const btns = document.querySelectorAll('.kpi-range-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range') || 'today';
        currentRange = range;
        btns.forEach(b => b.classList.toggle('is-active', b === btn));
        renderKpi(range);
      });
    });

    window.refreshKpiCards = function(){
      renderKpi(currentRange);
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (typeof orders === 'undefined' || typeof expenses === 'undefined'){
      document.addEventListener('appCoreReady', setupKpi, { once:true });
    } else {
      setupKpi();
    }
  });
})();


// === 報表：依服務項目營收結構 ===
(function(){
  const SERVICE_ITEMS = [
    { key:'acSplit',          label:'分離式冷氣' },
    { key:'acDuct',           label:'吊隱式冷氣' },
    { key:'washerTop',        label:'滾筒/直立式洗衣機' },
    { key:'waterTank',        label:'水塔' },
    { key:'pipesAmount',      label:'自來水管（自訂金額）' },
    { key:'antiMold',         label:'防霉加強' },
    { key:'ozone',            label:'臭氧殺菌' },
    { key:'transformerCount', label:'變形金剛機型' },
    { key:'longSplitCount',   label:'長室內機加價' },
    { key:'onePieceTray',     label:'一體式水盤' }
  ];

  function parseDateOnly(str){
    if (!str) return null;
    try{
      const dStr = String(str).split('T')[0];
      const parts = dStr.split('-');
      if (parts.length < 3) return null;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    }catch(e){
      return null;
    }
  }

  function ensureItem(map, key, label){
    if (!map[key]){
      map[key] = { key, label, orders:0, revenue:0 };
    }
    return map[key];
  }

  function computeServiceStats(targetYear){
    let ord = Array.isArray(window.orders) ? window.orders
      : (typeof orders !== 'undefined' && Array.isArray(orders) ? orders : []);
    if (document.getElementById('mergeBundleReport')?.checked && typeof mergeOrdersByBundle === 'function'){
      ord = mergeOrdersByBundle(ord);
    }
    const cfg = (typeof pricingConfig !== 'undefined' && pricingConfig)
      || (typeof DEFAULT_PRICING !== 'undefined' && DEFAULT_PRICING)
      || (window.pricingConfig || {});

    const map = {};
    ord.forEach(o => {
      if (!o.date) return;
      const d = parseDateOnly(o.date);
      if (!d) return;
      const y = d.getFullYear();
      if (targetYear !== 'all' && y !== +targetYear) return;

      const acSplit = +o.acSplit || 0;
      const acDuct  = +o.acDuct || 0;
      const washer  = +o.washerTop || 0;
      const tank    = +o.waterTank || 0;
      const pipes   = +o.pipesAmount || 0;
      const anti    = +o.antiMold || 0;
      const ozone   = +o.ozone || 0;
      const trans   = +o.transformerCount || 0;
      const longSp  = +o.longSplitCount || 0;
      const oneTray = +o.onePieceTray || 0;

      // 冷氣：分離式
      if (acSplit > 0){
        const base   = (cfg.acSplit || {});
        const unit   = acSplit >= 3 ? (base.bulk3plus || base.unit || 0) : (base.unit || 0);
        const total  = acSplit * unit;
        const item   = ensureItem(map, 'acSplit', '分離式冷氣');
        item.orders += 1;
        item.revenue += total;
      }

      // 冷氣：吊隱式
      if (acDuct > 0){
        const base   = (cfg.acDuct || {});
        const unit   = base.unit || 0;
        const total  = acDuct * unit;
        const item   = ensureItem(map, 'acDuct', '吊隱式冷氣');
        item.orders += 1;
        item.revenue += total;
      }

      // 洗衣機
      if (washer > 0){
        const base   = (cfg.washerTop || {});
        const hasAC  = (acSplit + acDuct) > 0;
        const unit   = hasAC ? (base.withAC || base.withoutAC || 0) : (base.withoutAC || base.withAC || 0);
        const total  = washer * unit;
        const item   = ensureItem(map, 'washerTop', '滾筒/直立式洗衣機');
        item.orders += 1;
        item.revenue += total;
      }

      // 水塔
      if (tank > 0){
        const base   = (cfg.waterTank || {});
        const unit   = base.unit || 0;
        const total  = tank * unit;
        const item   = ensureItem(map, 'waterTank', '水塔');
        item.orders += 1;
        item.revenue += total;
      }

      // 自來水管（直接視為金額）
      if (pipes > 0){
        const total  = Math.max(0, pipes);
        const item   = ensureItem(map, 'pipesAmount', '自來水管（自訂金額）');
        item.orders += 1;
        item.revenue += total;
      }

      // 防霉加強
      if (anti > 0){
        const base   = (cfg.antiMold || {});
        const unit   = anti >= 5 ? (base.bulk5plus || base.unit || 0) : (base.unit || 0);
        const total  = anti * unit;
        const item   = ensureItem(map, 'antiMold', '防霉加強');
        item.orders += 1;
        item.revenue += total;
      }

      // 臭氧殺菌
      if (ozone > 0){
        const base   = (cfg.ozone || {});
        const unit   = base.unit || 0;
        const total  = ozone * unit;
        const item   = ensureItem(map, 'ozone', '臭氧殺菌');
        item.orders += 1;
        item.revenue += total;
      }

      // 變形金剛機型
      if (trans > 0){
        const base   = (cfg.transformerCount || {});
        const unit   = base.unit || 0;
        const total  = trans * unit;
        const item   = ensureItem(map, 'transformerCount', '變形金剛機型');
        item.orders += 1;
        item.revenue += total;
      }

      // 長室內機加價
      if (longSp > 0){
        const base   = (cfg.longSplitCount || {});
        const unit   = base.unit || 0;
        const total  = longSp * unit;
        const item   = ensureItem(map, 'longSplitCount', '長室內機加價');
        item.orders += 1;
        item.revenue += total;
      }

      // 一體式水盤
      if (oneTray > 0){
        const base   = (cfg.onePieceTray || {});
        const unit   = base.unit || 0;
        const total  = oneTray * unit;
        const item   = ensureItem(map, 'onePieceTray', '一體式水盤');
        item.orders += 1;
        item.revenue += total;
      }
    });

    const list = Object.values(map);
    const totalRevenue = list.reduce((s, it) => s + it.revenue, 0);
    list.forEach(it => {
      it.share = totalRevenue ? (it.revenue / totalRevenue * 100) : 0;
    });

    // 依營業額排序（高到低）
    list.sort((a,b) => b.revenue - a.revenue);

    return list;
  }

  function renderServiceStats(targetYear){
    const tbody = document.querySelector('#tableByService tbody');
    const canvas = document.getElementById('chartByService');
    if (!tbody || !canvas) return;

    const data = computeServiceStats(targetYear);
    const labels = data.map(it => it.label);
    const revenueData = data.map(it => Math.round(it.revenue));
    const countData = data.map(it => it.orders);

    // 表格
    if (data.length === 0){
      tbody.innerHTML = '<tr><td colspan="4">目前此年份沒有服務項目資料</td></tr>';
    } else {
      tbody.innerHTML = data.map(it => {
        const shareStr = it.share ? it.share.toFixed(1) + '%' : '—';
        const amountStr = (typeof fmtCurrency === 'function')
          ? fmtCurrency(it.revenue)
          : (it.revenue || 0).toLocaleString('zh-TW', {maximumFractionDigits:0});
        return '<tr>' +
          '<td>' + it.label + '</td>' +
          '<td class="right-align">' + it.orders + '</td>' +
          '<td class="right-align">' + amountStr + '</td>' +
          '<td class="right-align">' + shareStr + '</td>' +
        '</tr>';
      }).join('');
    }

    // 圖表
    if (!window.Chart) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (renderServiceStats._chart){
      renderServiceStats._chart.destroy();
      renderServiceStats._chart = null;
    }

    if (data.length === 0){
      return;
    }

    renderServiceStats._chart = new Chart(ctx, {
      type:'bar',
      data:{
        labels: labels,
        datasets:[
          {
            label:'營業額',
            data: revenueData,
            yAxisID:'y'
          },
          {
            label:'案件數',
            data: countData,
            yAxisID:'y1'
          }
        ]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        scales:{
          y:{
            beginAtZero:true,
            title:{ display:true, text:'金額（元）' }
          },
          y1:{
            beginAtZero:true,
            position:'right',
            grid:{ drawOnChartArea:false },
            title:{ display:true, text:'案件數' }
          }
        }
      }
    });
  }

  function setupServiceStats(){
    const yearSelect = document.getElementById('yearStatSelect');
    if (!yearSelect) return;

    const getYear = () => yearSelect.value || 'all';
    renderServiceStats(getYear());

    // 年度切換時更新
    yearSelect.addEventListener('change', () => {
      renderServiceStats(getYear());
    });

    const mergeEl = document.getElementById('mergeBundleReport');
    if (mergeEl && mergeEl.dataset.boundServiceMerge !== '1'){
      mergeEl.addEventListener('change', function(){ renderServiceStats(getYear()); });
      mergeEl.dataset.boundServiceMerge = '1';
    }

    // 如果有既有的 refreshYearStatSelect，包一層一併更新
    if (typeof window.refreshYearStatSelect === 'function'){
      const original = window.refreshYearStatSelect;
      window.refreshYearStatSelect = function(){
        original.apply(this, arguments);
        renderServiceStats(getYear());
      };
    }

    window.refreshServiceStats = function(){
      renderServiceStats(getYear());
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    if (typeof orders === 'undefined' || typeof expenses === 'undefined'){
      document.addEventListener('appCoreReady', setupServiceStats, { once:true });
    } else {
      setupServiceStats();
    }
  });
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
// ---- 客戶管理：從歷史紀錄群組產生客戶列表 ----
function getCustomerGroupsSnapshot(){
  try {
    if (!window._customerHistoryGroups || !window._customerHistoryMap) {
      if (typeof rebuildCustomerHistoryMap === 'function') {
        rebuildCustomerHistoryMap();
      }
    }
    const groups = window._customerHistoryGroups;
    if (!groups || typeof groups.entries !== 'function') return [];
    const result = [];

    for (const [gid, gd] of groups.entries()){
      const ordersList = Array.isArray(gd._orderObjs) ? gd._orderObjs.slice() : [];
      if (!ordersList.length) continue;
      // _orderObjs 在 rebuildCustomerHistoryMap 時已經排序為最新在前
      const latest = ordersList[0];
      const lastTs = latest._ts ? new Date(latest._ts) : null;

      let totalNet = 0;
      const nameSet = new Set();
      const phoneSet = new Set();
      const addrSet = new Set();

      ordersList.forEach(o => {
        if (!o) return;
        const n = (o.customer || '').trim();
        if (n) nameSet.add(n);
        const p1 = (o.phone || '').trim();
        if (p1) phoneSet.add(p1);
        if (Array.isArray(o.phones)) {
          o.phones.forEach(p => {
            const v = (p || '').trim();
            if (v) phoneSet.add(v);
          });
        }
        const a = (o.address || '').trim();
        if (a) addrSet.add(a);

        // 用淨額為主，若無則用總額
        let net = parseFloat(o.netTotal);
        if (isNaN(net)) {
          net = parseFloat(o.total);
        }
        if (!isNaN(net)) {
          totalNet += net;
        }
      });

      const name = latest.customer || (nameSet.size ? Array.from(nameSet)[0] : '');
      const phone = latest.phone || (Array.isArray(latest.phones) && latest.phones[0]) || (phoneSet.size ? Array.from(phoneSet)[0] : '');
      const address = latest.address || (addrSet.size ? Array.from(addrSet)[0] : '');
      const lastDateStr = lastTs && !isNaN(lastTs) ? lastTs.toISOString().slice(0,10) : (latest.date || '');

      result.push({
        key: 'group:' + gid,
        name,
        phone,
        address,
        lastDate: lastDateStr,
        lastTs: lastTs,
        orderCount: ordersList.length,
        totalNet: totalNet
      });
    }

    // 依最近服務時間排序（新到舊）
    result.sort((a,b) => {
      const ta = a.lastTs && !isNaN(a.lastTs) ? a.lastTs.getTime() : 0;
      const tb = b.lastTs && !isNaN(b.lastTs) ? b.lastTs.getTime() : 0;
      return tb - ta;
    });
    return result;
  } catch(e){
    console.error('getCustomerGroupsSnapshot failed', e);
    return [];
  }
}

function refreshCustomerView(){
  const table = document.getElementById('customerTable');
  const summaryEl = document.getElementById('customerSummary');
  const searchEl = document.getElementById('customerSearch');
  if (!table || !summaryEl) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const allRows = getCustomerGroupsSnapshot();
  const q = (searchEl && searchEl.value ? searchEl.value : '').trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean).slice(0, 6) : [];

  function escapeRegExp(s){
    return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightHtml(text){
    const s = (text ?? '').toString();
    if (!tokens.length) return escapeHtml(s);
    const re = new RegExp('(' + tokens.map(escapeRegExp).join('|') + ')', 'gi');
    let out = '';
    let last = 0;
    let mm;
    while((mm = re.exec(s))){
      out += escapeHtml(s.slice(last, mm.index));
      out += '<mark class="hl">' + escapeHtml(mm[0]) + '</mark>';
      last = re.lastIndex;
      // safety: avoid infinite loop on zero-width
      if (mm.index === re.lastIndex) re.lastIndex++;
    }
    out += escapeHtml(s.slice(last));
    return out;
  }

  const filtered = !q ? allRows : allRows.filter(row => {
    const name = (row.name || '').toLowerCase();
    const phone = (row.phone || '').toLowerCase();
    const addr = (row.address || '').toLowerCase();
    return (
      name.includes(q) ||
      phone.includes(q) ||
      addr.includes(q)
    );
  });

  // 快取給匯出功能使用
  window._customerViewCache = { all: allRows, filtered: filtered };

  tbody.innerHTML = '';
  if (typeof fmtCurrency !== 'function'){
    window.fmtCurrency = window.fmtCurrency || (n => (n||0).toLocaleString('zh-TW', {minimumFractionDigits:0}));
  }
  const fmt = window.fmtCurrency || (n => n);

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.dataset.customerKey = row.key;

    let dateText = row.lastDate || '';
    if (!dateText && row.lastTs && !isNaN(row.lastTs)) {
      try {
        dateText = row.lastTs.toISOString().slice(0,10);
      } catch(e){}
    }

    // link to contact addresses (if any)
    let c = null;
    try{
      const phone0 = (row.phone||'').toString().split('/')[0].trim();
      if(phone0 && typeof findContactByPhone==='function') c = findContactByPhone(phone0);
      if(!c && typeof findContactByName==='function') c = findContactByName(row.name||'');
      if(c && typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(c);
    }catch(e){}
    const defaultAddr = (c && typeof getContactDefaultAddress==='function') ? (getContactDefaultAddress(c)||'') : (row.address||'');
    const addrCount = (c && Array.isArray(c.addresses)) ? (c.addresses.filter(a=>a && a.active!==false && (a.address||'').trim()).length) : ((row.address||'').trim()?1:0);

    tr.innerHTML = `
      <td>${highlightHtml(row.name || '')}</td>
      <td>${highlightHtml(row.phone || '')}</td>
      <td>${highlightHtml(defaultAddr || '')}</td>
      <td class="right-align">${addrCount}</td>
      <td><button type="button" class="btn btn-secondary btn-small" data-act="manage-addr">管理</button></td>
      <td>${escapeHtml(dateText || '')}</td>
      <td class="right-align">${row.orderCount || 0}</td>
      <td class="right-align">${fmt(row.totalNet || 0)}</td>
    `;

    tr.addEventListener('click', (ev) => {
      try{
        const t = ev && ev.target;
        if (t && t.closest && t.closest('[data-act="manage-addr"]')){
          ev.preventDefault();
          ev.stopPropagation();
          // open address modal
          try{
            const phone0 = (row.phone||'').toString().split('/')[0].trim();
            let c2 = null;
            if(phone0 && typeof findContactByPhone==='function') c2 = findContactByPhone(phone0);
            if(!c2 && typeof findContactByName==='function') c2 = findContactByName(row.name||'');
            if(!c2){
              // create contact record from customer snapshot so it can store addresses
              if(typeof upsertContact==='function'){
                upsertContact(row.name||'', phone0||'', row.address||'', '');
                if(phone0 && typeof findContactByPhone==='function') c2 = findContactByPhone(phone0);
                if(!c2 && typeof findContactByName==='function') c2 = findContactByName(row.name||'');
              }
            }
            if(typeof openAddressManagerModal==='function') openAddressManagerModal(c2, {from:'customer'});
          }catch(e){}
          return;
        }

        if (typeof renderHistoryModal === 'function') {
          const title = row.name ? (row.name + ' 的歷史紀錄') : '客戶歷史紀錄';
          renderHistoryModal(row.key, title);
        }
      } catch(e){
        console.error('renderHistoryModal for customer failed', e);
      }
    });
tbody.appendChild(tr);
  });

  const totalCount = allRows.length;
  const shownCount = filtered.length;
  let totalAmount = 0;
  allRows.forEach(r => { totalAmount += (r.totalNet || 0); });

  let text = '';
  if (!totalCount) {
    text = '目前尚未有任何客戶資料（請先建立訂單）。';
  } else {
    text = `目前共 ${totalCount} 位客戶`;
    if (shownCount !== totalCount) {
      text += `，符合篩選條件的有 ${shownCount} 位`;
    }
    text += `，累計折後營收約 ${fmt(totalAmount)}。`;
  }
  summaryEl.textContent = text;
}

function exportCustomerListCsv(){
  const cache = window._customerViewCache || {};
  const rows = (cache.filtered && cache.filtered.length ? cache.filtered : cache.all) || [];
  if (!rows.length) {
    alert('目前沒有可匯出的客戶資料');
    return;
  }
  const header = ['客戶名稱','電話','地址','最近服務日','總訂單數','累計營收(折後)'];
  const dataRows = rows.map(r => [
    r.name || '',
    r.phone || '',
    r.address || '',
    r.lastDate || '',
    r.orderCount || 0,
    r.totalNet || 0
  ]);

  const all = [header].concat(dataRows);
  const csv = all.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(["\uFEFF", csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'customers.csv';
  a.click();
  URL.revokeObjectURL(a.href);
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
        // 切回主畫面並帶入該訂單
        try { if (typeof setActiveView === 'function') setActiveView('main'); } catch(e){}
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
  const search = document.getElementById('customerSearch');
  const exportBtn = document.getElementById('customerExportBtn');
  if (search) {
    search.addEventListener('input', () => {
      try { refreshCustomerView(); } catch(e){ console.error('refreshCustomerView failed', e); }
    });
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try { exportCustomerListCsv(); } catch(e){ console.error('exportCustomerListCsv failed', e); }
    });
  }
});

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
    if (typeof showLayoutSavedMessage === 'function'){
      showLayoutSavedMessage();
    } else if (window.Swal && Swal.fire){
      Swal.fire({
        icon: 'success',
        title: '布局已儲存',
        text: '欄位布局已更新，將會套用在之後編輯訂單時。',
        confirmButtonText: '好的',
        confirmButtonColor: '#2563eb',
        timer: 1800,
        timerProgressBar: true
      });
    } else {
      alert('布局已儲存');
    }
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
    const msg='確定要清空所有忽略清單嗎？此操作可還原但會刪除本機記錄。'; const ok = (typeof showConfirm === 'function') ? await showConfirm('清空忽略清單', msg, '清空', '取消', { danger:true }) : confirm(msg);
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
      if(!$('address').value) $('address').value = (typeof getContactDefaultAddress==='function') ? (getContactDefaultAddress(c)||'') : (c.address||'');
    try{ if(typeof populateAddressSelectFromCurrentCustomer==='function') populateAddressSelectFromCurrentCustomer(); }catch(e){}
      try{ const phoneEl = getFirstPhoneEl(); if(phoneEl && phoneEl.dataset && phoneEl.dataset.touched !== '1' && !getPhones()) setFirstPhone(c.phone || ''); }catch(e){}
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


// ---------- Address Manager Modal ----------
(function initAddressManagerModal(){
  const modal = document.getElementById('addressModal');
  if(!modal) return;

  const backdrop = modal.querySelector('.modal-backdrop');
  const btnClose = document.getElementById('addressModalCloseBtn');
  const subtitle = document.getElementById('addressModalSubtitle');
  const tbody = modal.querySelector('#addressTable tbody');

  const inLabel = document.getElementById('addrLabel');
  const inText = document.getElementById('addrText');
  const inNote = document.getElementById('addrNote');
  const inDefault = document.getElementById('addrDefault');
  const inEditingId = document.getElementById('addrEditingId');
  const btnSave = document.getElementById('addrSaveBtn');
  const btnCancelEdit = document.getElementById('addrCancelEditBtn');

  let currentContact = null;
  let context = { from: '' };

  function open(){
    modal.setAttribute('aria-hidden','false');
  }
  function close(){
    modal.setAttribute('aria-hidden','true');
    clearEditor();
    currentContact = null;
    context = { from: '' };
  }

  function clearEditor(){
    if(inLabel) inLabel.value = '';
    if(inText) inText.value = '';
    if(inNote) inNote.value = '';
    if(inDefault) inDefault.checked = false;
    if(inEditingId) inEditingId.value = '';
  }

  function render(){
    if(!tbody) return;
    tbody.innerHTML = '';
    if(!currentContact){
      tbody.innerHTML = '<tr><td colspan="5" class="muted">找不到客戶資料，請先填寫並儲存一筆訂單。</td></tr>';
      return;
    }
    if(typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(currentContact);

    const items = (currentContact.addresses || []).filter(a => a && (a.address||'').trim());
    if(!items.length){
      tbody.innerHTML = '<tr><td colspan="5" class="muted">尚未有地址，請先新增。</td></tr>';
      return;
    }

    items.forEach(a=>{
      const tr = document.createElement('tr');
      const defBadge = a.isDefault ? '是' : '';
      const active = (a.active !== false);
      tr.innerHTML = `
        <td>${escapeHtml(a.label||'')}</td>
        <td>${escapeHtml(a.address||'')}${active ? '' : ' <span class="muted">（停用）</span>'}</td>
        <td>${escapeHtml(a.note||'')}</td>
        <td>${defBadge}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-small" data-act="edit" data-id="${a.id}">編輯</button>
          <button type="button" class="btn btn-secondary btn-small" data-act="default" data-id="${a.id}" ${active?'':'disabled'}>設為預設</button>
          <button type="button" class="btn btn-secondary btn-small" data-act="toggle" data-id="${a.id}">${active?'停用':'啟用'}</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function saveContacts(){
    try{ save(CONTACTS_KEY, contacts); }catch(e){}
    try{ if(typeof refreshContactsDatalist==='function') refreshContactsDatalist(); }catch(e){}
  }

  function refreshRelated(){
    // update order form select if needed
    try{
      if(typeof populateAddressSelectFromCurrentCustomer==='function') populateAddressSelectFromCurrentCustomer();
    }catch(e){}
    try{
      if(typeof refreshCustomerView==='function') refreshCustomerView();
    }catch(e){}
  }

  function resolveContact(c){
    if(!c) return null;
    // allow passing id
    if(typeof c === 'string'){
      const id = c;
      return contacts.find(x=>x && x.id===id) || null;
    }
    return c;
  }

  // public API
  window.openAddressManagerModal = function(contact, opts){
    context = opts || { from:'' };
    currentContact = resolveContact(contact);

    // if called from order form and contact missing, try to create it from form values
    if(!currentContact){
      try{
        const name = ($('customer')?.value || '').trim();
        const phone0 = (getPhones && getPhones()) ? String(getPhones()).split('/')[0].trim() : '';
        const addr0 = ($('address')?.value || '').trim();
        const lid0 = ($('lineId')?.value || '').trim();
        if(name || phone0 || lid0){
          if(typeof upsertContact==='function') upsertContact(name, phone0, addr0, lid0);
          if(phone0 && typeof findContactByPhone==='function') currentContact = findContactByPhone(phone0);
          if(!currentContact && name && typeof findContactByName==='function') currentContact = findContactByName(name);
        }
      }catch(e){}
    }

    if(currentContact && typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(currentContact);

    if(subtitle){
      const name = currentContact ? (currentContact.name||'') : (($('customer')?.value||'').trim());
      const phone = currentContact ? (currentContact.phone||'') : (getPhones?getPhones():'');
      subtitle.textContent = [name, phone].filter(Boolean).join(' / ');
    }

    render();

    // prefill editor based on opts
    clearEditor();
    if(opts && opts.mode === 'edit' && opts.editId && currentContact){
      const a = (currentContact.addresses||[]).find(x=>x && x.id===opts.editId);
      if(a){
        if(inLabel) inLabel.value = a.label||'';
        if(inText) inText.value = a.address||'';
        if(inNote) inNote.value = a.note||'';
        if(inDefault) inDefault.checked = !!a.isDefault;
        if(inEditingId) inEditingId.value = a.id;
      }
    }

    open();
  };

  // convenience wrapper for order form calls
  window.openAddressManagerForForm = function(opts){
    try{
      const name = ($('customer')?.value || '').trim();
      const phone0 = (getPhones && getPhones()) ? String(getPhones()).split('/')[0].trim() : '';
      let c = null;
      if(phone0 && typeof findContactByPhone==='function') c = findContactByPhone(phone0);
      if(!c && name && typeof findContactByName==='function') c = findContactByName(name);
      window.openAddressManagerModal(c, Object.assign({from:'order'}, opts||{}));
    }catch(e){}
  };

  // table actions
  tbody?.addEventListener('click', (ev)=>{
    const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if(!btn || !currentContact) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if(typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(currentContact);

    const a = (currentContact.addresses||[]).find(x=>x && x.id===id);
    if(!a) return;

    if(act === 'edit'){
      if(inLabel) inLabel.value = a.label||'';
      if(inText) inText.value = a.address||'';
      if(inNote) inNote.value = a.note||'';
      if(inDefault) inDefault.checked = !!a.isDefault;
      if(inEditingId) inEditingId.value = a.id;
      return;
    }

    if(act === 'default'){
      try{
        if(typeof setDefaultContactAddress==='function') setDefaultContactAddress(currentContact, id);
      }catch(e){}
      saveContacts();
      render();
      refreshRelated();
      return;
    }

    if(act === 'toggle'){
      a.active = (a.active === false) ? true : false;
      // if disabling default, pick another default
      if(a.active === false && a.isDefault){
        a.isDefault = false;
        const active = (currentContact.addresses||[]).filter(x=>x && x.active !== false && (x.address||'').trim());
        if(active.length){
          active[0].isDefault = true;
        }
      }
      // keep legacy address synced
      try{ if(typeof getContactDefaultAddress==='function') currentContact.address = getContactDefaultAddress(currentContact); }catch(e){}
      saveContacts();
      render();
      refreshRelated();
      return;
    }
  });

  // save button
  btnSave?.addEventListener('click', ()=>{
    if(!currentContact){
      if(window.Swal && Swal.fire) Swal.fire('找不到客戶資料', '請先儲存一筆訂單，或先讓系統辨識到客戶。', 'info');
      else alert('找不到客戶資料。');
      return;
    }
    const label = (inLabel?.value || '').trim();
    const addr = (inText?.value || '').trim();
    const note = (inNote?.value || '').trim();
    const makeDef = !!(inDefault && inDefault.checked);
    const editingId = (inEditingId?.value || '').trim();

    if(!addr){
      if(window.Swal && Swal.fire) Swal.fire('地址必填', '請輸入地址。', 'info');
      else alert('請輸入地址。');
      return;
    }

    if(typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(currentContact);

    if(editingId){
      const a = (currentContact.addresses||[]).find(x=>x && x.id===editingId);
      if(a){
        a.label = label;
        a.address = addr;
        a.note = note;
        a.active = true;
        if(makeDef){
          try{ if(typeof setDefaultContactAddress==='function') setDefaultContactAddress(currentContact, a.id); }catch(e){}
        }
      }
      // keep legacy address synced
      try{ if(typeof getContactDefaultAddress==='function') currentContact.address = getContactDefaultAddress(currentContact); }catch(e){}
    } else {
      try{
        if(typeof addAddressToContact==='function') addAddressToContact(currentContact, addr, {label, note, makeDefault: makeDef});
      }catch(e){}
    }

    saveContacts();
    render();
    refreshRelated();
    clearEditor();
  });

  btnCancelEdit?.addEventListener('click', clearEditor);

  btnClose?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
})();
// -----------------------------------------


// === 報表：訂單明細（bundle 折疊） ===
(function(){
  function safeArr(v){ return Array.isArray(v) ? v : []; }

  function getRawOrders(){
    if (Array.isArray(window.orders)) return window.orders;
    if (typeof orders !== 'undefined' && Array.isArray(orders)) return orders;
    return [];
  }
  function readSelectValue(sel, fallback){
    if(!sel) return fallback;
    const v = (sel.value ?? '').toString().trim();
    if(v) return v;
    try{
      const opt = (sel.options && sel.selectedIndex >= 0) ? sel.options[sel.selectedIndex] : null;
      const txt = (opt && opt.textContent) ? opt.textContent.trim() : '';
      if(txt){
        if(/全部/.test(txt)) return 'all';
        const n = parseInt(txt, 10);
        if(Number.isFinite(n)) return String(n);
      }
    }catch(e){}
    return fallback;
  }

  function getSelectedYear(){
    // 優先使用「報表明細（訂單）」區塊內的年份選單；若不存在則退回使用 yearStatSelect
    const detailSel = document.getElementById('reportDetailYear');
    if(detailSel) return readSelectValue(detailSel, 'all');
    const sel = document.getElementById('yearStatSelect');
    return readSelectValue(sel, 'all');
  }

  function getSelectedMonth(){
    const sel = document.getElementById('reportDetailMonth');
    return readSelectValue(sel, 'all');
  }

  function fmtMoney(v){
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.round(n).toLocaleString('zh-TW');
  }

  function parseDateStr(s){
    try{
      if(!s) return null;
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }catch(e){ return null; }
  }

  function getOrderDateParts(o){
    const d = parseDateStr(o?.date);
    if(!d) return null;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    return { y, m, d: dd };
  }

  function pad2(n){ n = Number(n||0); return (n<10?'0':'') + n; }

  function fmtDate(o){
    const p = getOrderDateParts(o);
    if(!p) return '—';
    return p.y + '/' + pad2(p.m) + '/' + pad2(p.d);
  }

  function fmtTime(o){
    const t = (o?.time || '').trim();
    return t || '—';
  }

  function statusRank(s){
    if (s === '未完成') return 3;
    if (s === '排定') return 2;
    if (s === '完成') return 1;
    return 0;
  }

  function resolveContact(order){
    try{
      if (typeof findContactByName === 'function' && order?.customer){
        const c = findContactByName(order.customer);
        if(c) return c;
      }
      if (typeof findContactByPhone === 'function' && order?.phone){
        const c = findContactByPhone(order.phone);
        if(c) return c;
      }
    }catch(e){}
    // fallback: try global contacts array
    try{
      const arr = safeArr(window.contacts || (typeof contacts !== 'undefined' ? contacts : []));
      const name = (order?.customer || '').trim();
      if(name) return arr.find(x => (x?.name||'').trim() === name) || null;
    }catch(e){}
    return null;
  }

  function getAddressLabel(order){
    try{
      const c = resolveContact(order);
      const id = order?.addressId;
      if(!c || !id) return '';
      const a = safeArr(c.addresses).find(x => x && x.id === id);
      if(!a) return '';
      const label = (a.label || '').trim();
      return label ? label : '';
    }catch(e){}
    return '';
  }

  function collectGroupLabels(orders){
    const labels = [];
    const seen = new Set();
    for(const o of orders){
      const lb = getAddressLabel(o);
      if(lb && !seen.has(lb)){
        labels.push(lb);
        seen.add(lb);
      }
    }
    return labels;
  }

  function computeGroupSummary(group){
    const g = safeArr(group);
    if(g.length === 0) return null;

    // base fields
    const first = g[0];
    const sum = {
      id: first.id || '',
      date: first.date || '',
      time: first.time || '',
      staff: first.staff || '',
      customer: first.customer || '',
      phone: first.phone || '',
      status: first.status || '',
      netTotal: 0,
      total: 0,
      address: '',
      bundleId: first.bundleId || '',
      __child: g
    };

    let worstRank = -1;
    let latestCompleted = null;
    let earliestDT = null;

    const addrs = [];
    const addrSeen = new Set();
    for(const o of g){
      const nt = Number(o?.netTotal || o?.total || 0);
      const tt = Number(o?.total || 0);
      if(Number.isFinite(nt)) sum.netTotal += nt;
      if(Number.isFinite(tt)) sum.total += tt;

      const r = statusRank(o?.status);
      if(r > worstRank){
        worstRank = r;
        sum.status = o?.status || sum.status;
      }

      if(o?.completedAt){
        const cd = parseDateStr(o.completedAt);
        if(cd && (!latestCompleted || cd > latestCompleted)) latestCompleted = cd;
      }

      // earliest date+time for displaying
      const d = parseDateStr(o?.date);
      if(d){
        let dt = d;
        try{
          const t = String(o?.time||'').trim();
          if(t && /^\d{1,2}:\d{2}$/.test(t)){
            const [hh,mm] = t.split(':').map(n=>parseInt(n,10));
            dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh||0, mm||0, 0, 0);
          }
        }catch(e){}
        if(!earliestDT || dt < earliestDT){
          earliestDT = dt;
          sum.date = o?.date || sum.date;
          sum.time = o?.time || sum.time;
        }
      }

      const addr = String(o?.address || '').trim();
      if(addr && !addrSeen.has(addr)){
        addrs.push(addr);
        addrSeen.add(addr);
      }
    }

    sum.completedAt = latestCompleted ? latestCompleted.toISOString() : (first.completedAt || '');
    sum.address = addrs.join(' / ');
    return sum;
  }

  function filterOrdersByYearMonth(raw, year, month){
    let arr = safeArr(raw).filter(o => o && o.date);
    if(year !== 'all'){
      const y = parseInt(year,10);
      if(Number.isFinite(y)){
        arr = arr.filter(o => {
          const p = getOrderDateParts(o);
          return p && p.y === y;
        });
      }
    }
    if(month !== 'all'){
      const m = parseInt(month,10);
      if(Number.isFinite(m)){
        arr = arr.filter(o => {
          const p = getOrderDateParts(o);
          return p && p.m === m;
        });
      }
    }
    return arr;
  }

  function sortByDateTime(arr){
    return safeArr(arr).slice().sort((a,b)=>{
      const da = parseDateStr(a?.date);
      const db = parseDateStr(b?.date);
      const ta = (a?.time||'').trim();
      const tb = (b?.time||'').trim();
      const toDT = (d,t)=>{
        if(!d) return 0;
        if(t && /^\d{1,2}:\d{2}$/.test(t)){
          const [hh,mm]=t.split(':').map(x=>parseInt(x,10));
          return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh||0, mm||0).getTime();
        }
        return d.getTime();
      };
      const va = toDT(da, ta);
      const vb = toDT(db, tb);
      return va - vb;
    });
  }

  function buildMonthOptionsForYear(raw, year){
    const arr = filterOrdersByYearMonth(raw, year, 'all');
    const months = new Set();
    arr.forEach(o=>{
      const p = getOrderDateParts(o);
      if(p) months.add(p.m);
    });
    const list = Array.from(months).sort((a,b)=>a-b);
    return list;
  }

  function renderMonthSelect(raw){
    const sel = document.getElementById('reportDetailMonth');
    if(!sel) return;
    const year = getSelectedYear();
    const prev = sel.value || 'all';

    const months = buildMonthOptionsForYear(raw, year);
    const opts = ['all'].concat(months.map(m=>String(m)));

    sel.innerHTML = opts.map(v=>{
      const label = (v==='all') ? '全部月份' : (v + '月');
      return '<option value="' + v + '">' + label + '</option>';
    }).join('');

    // keep previous if still valid
    if(opts.includes(prev)) sel.value = prev;
    else sel.value = 'all';
  }

  function syncDetailYearOptions(){
    const detailSel = document.getElementById('reportDetailYear');
    const globalSel = document.getElementById('yearStatSelect');
    if(!detailSel) return;

    // 以 yearStatSelect 為主來源（它會在切到報表分頁時由 refreshYearStatSelect() 填好）
    if(globalSel && globalSel.options && globalSel.options.length){
      const prev = detailSel.value;
      detailSel.innerHTML = globalSel.innerHTML;
      // 優先保持原本選擇，其次同步全域年份
      const hasPrev = Array.from(detailSel.options).some(o=>o.value===prev);
      detailSel.value = hasPrev ? prev : (globalSel.value || 'all');
    } else if(!detailSel.options.length){
      detailSel.innerHTML = '<option value="all">全部年份</option>';
      detailSel.value = 'all';
    }
  }

  function autoDefaultMonthIfNeeded(){
    const sel = document.getElementById('reportDetailMonth');
    if(!sel) return;
    // 使用者手動選過月，就不要自動覆蓋
    if(sel.dataset.userChanged === '1') return;
    const values = Array.from(sel.options).map(o=>o.value);
    // 若目前是「全部月份」，預設切到本月（若該年有資料），否則切到該年最新月份
    if(sel.value === 'all'){
      const curM = String(new Date().getMonth() + 1);
      if(values.includes(curM)){
        sel.value = curM;
        return;
      }
      const nums = values.filter(v=>v!=='all').map(v=>parseInt(v,10)).filter(n=>Number.isFinite(n));
      if(nums.length){
        sel.value = String(Math.max.apply(null, nums));
      }
    }
  }

  function renderTable(){
    const tbody = document.querySelector('#tableReportOrders tbody');
    if(!tbody) return;

    const raw = getRawOrders();
    const year = getSelectedYear();
    const month = getSelectedMonth();
    const mergeOn = !!document.getElementById('mergeBundleReport')?.checked;

    const filtered = sortByDateTime(filterOrdersByYearMonth(raw, year, month));
    if(filtered.length === 0){
      tbody.innerHTML = '<tr><td colspan="8">目前沒有符合條件的訂單</td></tr>';
      return;
    }

    // group by bundleId when mergeOn
    const groups = [];
    if(mergeOn){
      const map = new Map();
      const singles = [];
      for(const o of filtered){
        const bid = (o?.bundleId || '').trim();
        if(!bid){ singles.push(o); continue; }
        if(!map.has(bid)) map.set(bid, []);
        map.get(bid).push(o);
      }
      // preserve chronological order: iterate through filtered and push group once
      const pushed = new Set();
      for(const o of filtered){
        const bid = (o?.bundleId || '').trim();
        if(!bid){
          groups.push({ type:'single', order:o });
        } else if(!pushed.has(bid)){
          pushed.add(bid);
          const g = sortByDateTime(map.get(bid));
          if(g.length >= 2){
            groups.push({ type:'bundle', summary: computeGroupSummary(g), children: g });
          } else {
            groups.push({ type:'single', order:g[0] });
          }
        }
      }
    } else {
      filtered.forEach(o=> groups.push({ type:'single', order:o }));
    }

    function rowHtmlSingle(o){
      const money = fmtMoney(o?.netTotal || o?.total || 0);
      const staff = (o?.staff||'').trim() || '—';
      const cust = (o?.customer||'').trim() || '—';
      const status = (o?.status||'').trim() || '—';
      const label = getAddressLabel(o);
      const addr = (o?.address||'').trim() || '—';
      const addrText = label ? ('【' + label + '】' + addr) : addr;
      return (
        '<tr class="report-row">' +
          '<td>' + fmtDate(o) + '</td>' +
          '<td>' + fmtTime(o) + '</td>' +
          '<td>' + escapeHtml(staff) + '</td>' +
          '<td>' + escapeHtml(cust) + '</td>' +
          '<td>' + escapeHtml(addrText) + '</td>' +
          '<td style="text-align:right;">' + money + '</td>' +
          '<td>' + escapeHtml(status) + '</td>' +
          '<td>—</td>' +
        '</tr>'
      );
    }

    function rowHtmlBundle(summary, children){
      const money = fmtMoney(summary?.netTotal || summary?.total || 0);
      const staff = (summary?.staff||'').trim() || '—';
      const cust = (summary?.customer||'').trim() || '—';
      const status = (summary?.status||'').trim() || '—';

      const labels = collectGroupLabels(children);
      const labelStr = labels.length ? ('（' + labels.join('、') + '）') : '';
      const addrSummary = (children.length + ' 地點') + labelStr;

      const key = escapeHtml(summary?.bundleId || '');
      const btn = '<button type="button" class="bundle-toggle-btn" data-bundle="' + key + '" aria-expanded="false">展開</button>';

      return (
        '<tr class="bundle-parent" data-bundle="' + key + '">' +
          '<td>' + fmtDate(summary) + '</td>' +
          '<td>' + fmtTime(summary) + '</td>' +
          '<td>' + escapeHtml(staff) + '</td>' +
          '<td>' + escapeHtml(cust) + '</td>' +
          '<td>' + escapeHtml(addrSummary) + '</td>' +
          '<td style="text-align:right;">' + money + '</td>' +
          '<td>' + escapeHtml(status) + '</td>' +
          '<td>' + btn + '</td>' +
        '</tr>'
      );
    }

    // NOTE: escapeHtml exists in app.core.js; fallback if not
    function escapeHtml(s){
      try{
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(String(s??''));
      }catch(e){}
      return String(s??'').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
    }

    const htmlRows = [];
    const bundleChildrenMap = new Map(); // bundleId -> children orders
    for(const item of groups){
      if(item.type==='single'){
        htmlRows.push(rowHtmlSingle(item.order));
      } else if(item.type==='bundle'){
        const sum = item.summary;
        htmlRows.push(rowHtmlBundle(sum, item.children));
        bundleChildrenMap.set((sum?.bundleId||'').trim(), item.children);
      }
    }
    tbody.innerHTML = htmlRows.join('');

    // click to expand/collapse
    tbody.onclick = function(ev){
      const btn = ev.target?.closest?.('.bundle-toggle-btn');
      if(!btn) return;
      const bid = (btn.getAttribute('data-bundle') || '').trim();
      if(!bid) return;

      const _esc = (window.CSS && typeof CSS.escape==='function') ? CSS.escape(bid) : bid.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
      const parent = tbody.querySelector('tr.bundle-parent[data-bundle="' + _esc + '"]');
      if(!parent) return;

      const expanded = btn.getAttribute('aria-expanded') === 'true';
      if(expanded){
        // collapse: remove child rows
        parent.classList.remove('is-expanded');
        btn.setAttribute('aria-expanded','false');
        btn.textContent = '展開';
        let next = parent.nextElementSibling;
        while(next && next.classList.contains('bundle-child') && next.getAttribute('data-parent') === bid){
          const rm = next;
          next = next.nextElementSibling;
          rm.remove();
        }
        return;
      }

      // expand: insert child rows after parent
      const children = bundleChildrenMap.get(bid) || [];
      parent.classList.add('is-expanded');
      btn.setAttribute('aria-expanded','true');
      btn.textContent = '收起';

      const frag = document.createDocumentFragment();
      for(const o of children){
        const money = fmtMoney(o?.netTotal || o?.total || 0);
        const status = (o?.status||'').trim() || '—';
        const label = getAddressLabel(o);
        const addr = (o?.address||'').trim() || '—';
        const addrText = label ? ('【' + label + '】' + addr) : addr;

        const tr = document.createElement('tr');
        tr.className = 'bundle-child';
        tr.setAttribute('data-parent', bid);
        tr.innerHTML =
          '<td>' + fmtDate(o) + '</td>' +
          '<td>' + fmtTime(o) + '</td>' +
          '<td>' + escapeHtml((o?.staff||'').trim() || '—') + '</td>' +
          '<td>' + escapeHtml((o?.customer||'').trim() || '—') + '</td>' +
          '<td class="addr-cell">' + escapeHtml(addrText) + '</td>' +
          '<td style="text-align:right;">' + money + '</td>' +
          '<td>' + escapeHtml(status) + '</td>' +
          '<td></td>';
        frag.appendChild(tr);
      }
      parent.after(frag);
    };
  }

  let didBind = false;

  function bindOnce(){
    if(didBind) return;
    const monthSel = document.getElementById('reportDetailMonth');
    const yearSelDetail = document.getElementById('reportDetailYear');
    const yearSelGlobal = document.getElementById('yearStatSelect');
    if(!monthSel) return;

    // 月份選擇：標記使用者已手動選擇，避免自動覆蓋
    if(!monthSel.dataset.boundDetailMonth){
      monthSel.addEventListener('change', function(){
        monthSel.dataset.userChanged = '1';
        renderTable();
      });
      monthSel.dataset.boundDetailMonth = '1';
    }

    // 明細區塊內「年份」選擇：同步到 yearStatSelect（讓上方年度統計/圖表也跟著切換）
    if(yearSelDetail && !yearSelDetail.dataset.boundDetailYear){
      yearSelDetail.addEventListener('change', function(){
        try{
          if(yearSelGlobal && yearSelGlobal.value !== yearSelDetail.value){
            yearSelGlobal.value = yearSelDetail.value;
            yearSelGlobal.dispatchEvent(new Event('change', { bubbles:true }));
          }
        }catch(e){}
        // 年份變更後，若使用者尚未手動選月，改以本月/最新月份為預設
        if(monthSel) monthSel.dataset.userChanged = '';
        renderMonthSelect(getRawOrders());
        autoDefaultMonthIfNeeded();
        renderTable();
      });
      yearSelDetail.dataset.boundDetailYear = '1';
    }

    // 全域年份（yearStatSelect）變更時，同步到明細年份，並重建月份清單/表格
    if(yearSelGlobal && !yearSelGlobal.dataset.boundDetailYearMirror){
      yearSelGlobal.addEventListener('change', function(){
        try{
          if(yearSelDetail && yearSelDetail.value !== yearSelGlobal.value){
            // 先同步選單內容（refreshYearStatSelect 可能剛刷新 options）
            syncDetailYearOptions();
            yearSelDetail.value = yearSelGlobal.value;
          }
        }catch(e){}
        if(monthSel) monthSel.dataset.userChanged = '';
        renderMonthSelect(getRawOrders());
        autoDefaultMonthIfNeeded();
        renderTable();
      });
      yearSelGlobal.dataset.boundDetailYearMirror = '1';
    }

    const mergeEl = document.getElementById('mergeBundleReport');
    if(mergeEl && mergeEl.dataset.boundDetailMerge !== '1'){
      mergeEl.addEventListener('change', function(){
        renderTable();
      });
      mergeEl.dataset.boundDetailMerge = '1';
    }

    // 訂單變更（新增/刪除/匯入）後刷新月份清單與表格
    document.addEventListener('ordersUpdated', function(){
      syncDetailYearOptions();
      renderMonthSelect(getRawOrders());
      autoDefaultMonthIfNeeded();
      renderTable();
    });

    didBind = true;
  }

  function refresh(){
    const tbody = document.querySelector('#tableReportOrders tbody');
    const monthSel = document.getElementById('reportDetailMonth');
    // 若 DOM 還沒 ready，就先不做
    if(!tbody || !monthSel) return;
    syncDetailYearOptions();
    renderMonthSelect(getRawOrders());
    autoDefaultMonthIfNeeded();
    renderTable();
  }

  // 對外：由「切換到報表分頁」時呼叫（避免一進站就渲染大量明細）
  window.initReportOrderDetail = function initReportOrderDetail(){
    try{ bindOnce(); refresh(); }catch(e){}
  };
})();


// 快捷操作：手機/平板底部固定欄、桌機右下角浮動按鈕
(function(){
  function triggerNewOrder(){
    const btn = document.getElementById('newBtn');
    if (btn) {
      btn.click();
      return;
    }
    if (typeof setActiveView === 'function') setActiveView('main');
    if (typeof fillForm === 'function') fillForm({});
    const acc = document.getElementById('orderAccordion');
    if (acc) {
      acc.open = true;
      acc.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function triggerNewQuotation(){
    const btn = document.getElementById('openQuotationBtn');
    if (btn) {
      btn.click();
      return;
    }
    window.open('https://unclequotation.netlify.app','_blank','noopener');
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-quick-action]').forEach(function(btn){
      btn.addEventListener('click', function(){
        const action = btn.getAttribute('data-quick-action');
        if (action === 'new-order') triggerNewOrder();
        if (action === 'new-quotation') triggerNewQuotation();
        document.querySelector('.quick-actions-fab')?.classList.remove('is-open');
        document.querySelector('.quick-actions-fab__main')?.setAttribute('aria-expanded', 'false');
      });
    });

    const fab = document.querySelector('.quick-actions-fab');
    const fabMain = document.querySelector('.quick-actions-fab__main');
    fabMain?.addEventListener('click', function(){
      const isOpen = fab?.classList.toggle('is-open');
      fabMain.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function(e){
      if (!fab || fab.contains(e.target)) return;
      fab.classList.remove('is-open');
      fabMain?.setAttribute('aria-expanded', 'false');
    });
  });
})();
