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
        bundleId: ($('bundleId') ? $('bundleId').value : '') || '',
        staff:$('staff').value, date:$('date').value, time:$('time').value,
        confirmed:$('confirmed')?.checked||false, quotationOk:$('quotationOk')?.checked||false,
        customer:$('customer').value.trim(), lineIds:getLineIds(),
        lineId:(getLineIds()[0] || $('lineId').value.trim()),
        phone:getPhones().trim(),
        slots:getChecked('slot'), slotNote:$('slotNote')?.value.trim()||'', addressId:(($('addressSelect')?.value||'')!=='_CUSTOM_'? ($('addressSelect')?.value||'') : ''), address:$('address').value.trim(),
        residenceType:$('residenceType')?.value||'', residenceOther:$('residenceOther')?.value.trim()||'',
        contactTimes:getChecked('contactTime'), contactTimeNote:$('contactTimeNote')?.value.trim()||'',
        acFloors:getChecked('acFloor'), washerFloors:getChecked('washerFloor'),
        contactMethod:$('contactMethod').value, status:$('status').value,
        acSplit:+$('acSplit').value||0, acDuct:+$('acDuct').value||0, washerTop:+$('washerTop').value||0, waterTank:+$('waterTank').value||0,
        // Water tank ladder requirement (saved even if waterTank==0; UI will clear on 0)
        waterTankLadderRequired: ($('waterTankLadderRequired')?.value||''),
        waterTankLadderType: ($('waterTankLadderType')?.value||''),
        waterTankLadderHeightRange: ($('waterTankLadderHeightRange')?.value||''),
        waterTankLadderHeightFt: ($('waterTankLadderHeightFt')?.value||''),
        waterTankLadderNotes: ($('waterTankLadderNotes')?.value||''),
        waterTankLadderOnsiteFlags: ($('waterTankLadderOnsiteFlags')?.value||''),
        pipesAmount:+$('pipesAmount').value||0, antiMold:+$('antiMold').value||0, ozone:+$('ozone').value||0,
        transformerCount:+$('transformerCount').value||0,
        // 變形金剛機型：室內機位置（依台數）
        transformerLocations: (typeof window.gatherTransformerLocations === 'function') ? window.gatherTransformerLocations() : [],
        longSplitCount:+$('longSplitCount').value||0,
        // 長度>182cm 室內機位置（依台數）
        longSplitLocations: (typeof window.gatherLongSplitLocations === 'function') ? window.gatherLongSplitLocations() : [],
        onePieceTray:+$('onePieceTray').value||0,
        // 一體式水盤：室內機位置（依台數）
        onePieceTrayLocations: (typeof window.gatherOnePieceTrayLocations === 'function') ? window.gatherOnePieceTrayLocations() : [],
        note:$('note').value.trim(),
        acBrands: getChecked('acBrand'),
        acBrandOther: $('acBrandOtherText')? $('acBrandOtherText').value.trim() : '', total:+$('total').value||0, extraCharge:+$('extraCharge').value||0, discount:+$('discount').value||0, transportFee:+$('transportFee').value||0, helperEnabled: !!($('helperEnabled')?.checked), helperCount:+$('helperCount')?.value||0, helperDailyWage:+$('helperDailyWage')?.value||0, helperCost:+$('helperCost')?.value||0,
        taxIncluded: !!($('taxIncluded')?.checked), taxRate: (Number($('taxRate')?.value) || 5), taxAmount: (+$('taxAmount')?.value||0), netBeforeTax: (+$('netBeforeTax')?.value||0),
        netTotal:+$('netTotal').value||0,
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
      setChecked('slot', o.slots||[]); $('slotNote').value=o.slotNote||''; $('slotNote').classList.toggle('hidden', !((o.slots||[]).includes('日期指定') || (o.slots||[]).includes('時間指定')));
      $('address').value=o.address||'';
      try{ if(typeof populateAddressSelectFromCurrentCustomer==='function') populateAddressSelectFromCurrentCustomer(); }catch(e){}
      try{ const sel=$('addressSelect'); if(sel){ sel.value = (o.addressId ? o.addressId : '_CUSTOM_'); } }catch(e){};
      $('residenceType').value=o.residenceType||''; $('residenceOther').value=o.residenceOther||''; $('residenceOther').classList.toggle('hidden', (o.residenceType||'')!=='其他');
      setChecked('contactTime', o.contactTimes||[]); $('contactTimeNote').value=o.contactTimeNote||''; $('contactTimeNote').classList.toggle('hidden', !(o.contactTimes||[]).includes('時間指定'));
      setChecked('acFloor', o.acFloors||[]); setChecked('washerFloor', o.washerFloors||[]);
      updateAbove5Visibility();
      ;
      $('contactMethod').value=o.contactMethod||contactList[0]; $('status').value=o.status||'排定';
      $('reminderEnabled').checked=(o.reminderEnabled!==undefined? !!o.reminderEnabled : true); $('reminderMonths').value=(o.reminderMonths!==undefined? +o.reminderMonths : 24);
      $('reminderNotified').checked=!!o.reminderNotified; $('reminderMuted').checked=!!o.reminderMuted;
      $('acFloorAbove').value=o.acFloorAbove||''; $('washerFloorAbove').value=o.washerFloorAbove||'';
      $('acSplit').value=o.acSplit||0; $('acDuct').value=o.acDuct||0; $('washerTop').value=o.washerTop||0; $('waterTank').value=o.waterTank||0;
      // restore water tank ladder requirement
      try{
        if ($('waterTankLadderRequired')) $('waterTankLadderRequired').value = o.waterTankLadderRequired || '';
        if ($('waterTankLadderType')) $('waterTankLadderType').value = o.waterTankLadderType || '';
        if ($('waterTankLadderHeightRange')) $('waterTankLadderHeightRange').value = o.waterTankLadderHeightRange || '';
        if ($('waterTankLadderHeightFt')) $('waterTankLadderHeightFt').value = o.waterTankLadderHeightFt || '';
        if ($('waterTankLadderNotes')) $('waterTankLadderNotes').value = o.waterTankLadderNotes || '';
        if ($('waterTankLadderOnsiteFlags')) $('waterTankLadderOnsiteFlags').value = o.waterTankLadderOnsiteFlags || '';
        if (typeof window.updateWaterTankLadderSummary === 'function') window.updateWaterTankLadderSummary();
      }catch(e){}
      $('pipesAmount').value=o.pipesAmount||0; $('antiMold').value=o.antiMold||0; $('ozone').value=o.ozone||0;
      $('transformerCount').value=o.transformerCount||0; $('longSplitCount').value=o.longSplitCount||0; $('onePieceTray').value=o.onePieceTray||0;
      // restore 變形金剛機型室內機位置
      try{ if (typeof window.syncTransformerLocationUI === 'function') window.syncTransformerLocationUI(o.transformerLocations||[]); }catch(e){}
      // restore 長度>182cm 室內機位置
      try{ if (typeof window.syncLongSplitLocationUI === 'function') window.syncLongSplitLocationUI(o.longSplitLocations||[]); }catch(e){}
      // restore 一體式水盤 室內機位置
      try{ if (typeof window.syncOnePieceTrayLocationUI === 'function') window.syncOnePieceTrayLocationUI(o.onePieceTrayLocations||[]); }catch(e){}
      $('note').value=o.note||'';
      // restore AC brand selections
      try{ setChecked('acBrand', o.acBrands||[]); if(document.getElementById('acBrandOtherText')){ document.getElementById('acBrandOtherText').classList.toggle('hidden', !((o.acBrands||[]).includes && (o.acBrands||[]).includes('其他'))); $('acBrandOtherText').value = o.acBrandOther||''; } }catch(e){console.warn(e);}  $('extraCharge').value = o.extraCharge || 0; $('discount').value=o.discount||0; if($('transportFee')) $('transportFee').value = o.transportFee || 0;
      // day-wage helper
      try{
        if($('helperEnabled')) $('helperEnabled').checked = !!o.helperEnabled;
        if($('helperCount')) $('helperCount').value = (o.helperCount!=null? o.helperCount : 1);
        if($('helperDailyWage')) $('helperDailyWage').value = (o.helperDailyWage!=null? o.helperDailyWage : (typeof getDefaultHelperWage==='function'? getDefaultHelperWage() : 2000));
        if (typeof recalcHelperCost === 'function') recalcHelperCost();
        else if($('helperCost')) $('helperCost').value = o.helperCost || 0;
      }catch(e){}
      $('total').value=o.total||0;
      // tax controls
      try{
        const included = !!o.taxIncluded;
        if($('taxIncluded')) $('taxIncluded').checked = included;
        if($('taxRate')) $('taxRate').value = (o.taxRate!=null ? o.taxRate : 5);
        const base = Math.max(0, (+o.total||0) + (+o.extraCharge||0) - (+o.discount||0));
        if($('netBeforeTax')) $('netBeforeTax').value = base;
        const taxAmt = included ? Math.max(0, (+o.netTotal||0) - base) : 0;
        if($('taxAmount')) $('taxAmount').value = taxAmt;
        if($('taxRate')) $('taxRate').disabled = !included;
      }catch(e){}
      $('netTotal').value=o.netTotal||0;
      $('deleteBtn').disabled=!o.id; $('formTitle').textContent=o.id?'編輯訂單':'新增訂單';

      try{ if(window.updateAcBrandOtherVisibility) window.updateAcBrandOtherVisibility(); }catch(e){}
      setFormLock(!!o.locked);
      document.getElementById('durationMinutes').value = (o.durationMinutes ?? '');

      try{ if (typeof window.updateWaterTankLadderSummary === 'function') window.updateWaterTankLadderSummary(); }catch(e){}
    }
    function recalcHelperCost(){
      const enabled = !!($('helperEnabled')?.checked);
      const countEl = $('helperCount');
      const wageEl = $('helperDailyWage');
      const costEl = $('helperCost');

      if(countEl) countEl.disabled = !enabled;
      if(wageEl) wageEl.disabled = !enabled;

      let count = Math.max(0, Math.floor(Number(countEl ? countEl.value : 0) || 0));
      let wage = Math.max(0, Math.floor(Number(wageEl ? wageEl.value : 0) || 0));

      if(enabled){
        if(count <= 0){ count = 1; if(countEl) countEl.value = 1; }
        if(wage <= 0){
          const def = (typeof getDefaultHelperWage === 'function') ? getDefaultHelperWage() : 2000;
          wage = def;
          if(wageEl) wageEl.value = def;
        }
      }

      const cost = enabled ? (count * wage) : 0;
      if(costEl) costEl.value = cost;
      return cost;
    }

    function recalcTotals(){
      recalcHelperCost();
      const total = calcTotal(gatherForm());
      $('total').value = total;
      const extra = Math.max(0, +$('extraCharge').value || 0);
      const discount = Math.max(0, +$('discount').value || 0);
      const base = Math.max(0, total + extra - discount);
      if($('netBeforeTax')) $('netBeforeTax').value = base;

      const included = !!($('taxIncluded')?.checked);
      const rateEl = $('taxRate');
      let rate = Number(rateEl ? rateEl.value : 5);
      if(!Number.isFinite(rate) || rate < 0) rate = 5;
      if(rateEl){ rateEl.value = rate; rateEl.disabled = !included; }

      const tax = included ? Math.max(0, Math.round(base * rate / 100)) : 0;
      if($('taxAmount')) $('taxAmount').value = tax;

      $('netTotal').value = included ? (base + tax) : base;
    }

    function setFormLock(lock){
      const ids=['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','extraCharge','discount','recalc','helperEnabled','helperCount','helperDailyWage','taxIncluded','taxRate'];
      ids.forEach(id=>{ const el=$(id); if(el){ el.disabled = !!lock; el.readOnly = !!lock; }});

      // 長度>182cm 室內機位置子表單（跟著鎖定）
      try{
        const wrap = document.getElementById('longSplitLocationWrap');
        if(wrap){
          wrap.querySelectorAll('input, select, button, textarea').forEach(el=>{ el.disabled = !!lock; });
        }
      }catch(e){}
      $('toggleLock').textContent = lock ? '解除鎖定（允許修改）' : '解鎖金額編輯';
      $('lockInfo').textContent = lock ? '金額已鎖定（完成）' : '';
    }


// ---------------- 長度>182cm 室內機位置：動態 UI + 序列化 ----------------
// 儲存格式：[{ place: '客廳'|'房間'|'手動', custom: 'xxx', floor: '3' }, ...]

function normalizeLongSplitLocItem(x){
  const out = { place:'客廳', custom:'', floor:'' };
  if(!x || typeof x !== 'object') return out;
  const p = String(x.place || x.type || '').trim();
  if(p === '客廳' || p === '房間' || p === '手動') out.place = p;
  out.custom = String(x.custom || x.text || '').trim();
  out.floor = String(x.floor || '').trim();
  return out;
}

function readLongSplitLocationsFromDOM(){
  const list = document.getElementById('longSplitLocationList');
  if(!list) return [];
  const rows = Array.from(list.querySelectorAll('.long-split-loc-row'));
  return rows.map(r=>{
    const place = (r.querySelector('.ls-place')?.value || '客廳');
    const custom = (r.querySelector('.ls-custom')?.value || '').trim();

    const floorSel = (r.querySelector('.ls-floorSel')?.value || '');
    const floorCustom = (r.querySelector('.ls-floorCustom')?.value || '').trim();
    const floor = (floorSel === '手動') ? floorCustom : floorSel;

    return normalizeLongSplitLocItem({ place, custom, floor });
  });
}

function renderLongSplitLocationsToDOM(items){
  const wrap = document.getElementById('longSplitLocationWrap');
  const list = document.getElementById('longSplitLocationList');
  if(!wrap || !list) return;

  const qty = Math.max(0, Math.floor(Number(document.getElementById('longSplitCount')?.value || 0) || 0));
  if(qty <= 0){
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');

  const safe = (Array.isArray(items) ? items : []).slice(0, qty).map(normalizeLongSplitLocItem);
  while(safe.length < qty) safe.push(normalizeLongSplitLocItem(null));

  list.innerHTML = safe.map((it, idx)=>{
    const showCustom = (it.place === '手動');
    const customCls = showCustom ? '' : 'hidden';
    const esc = (s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
    const customVal = esc(it.custom || '');
    const floorVal = esc(it.floor || '');
    const isPresetFloor = (floorVal==='1F' || floorVal==='2F' || floorVal==='3F' || floorVal==='4F');
    const floorSelVal = isPresetFloor ? floorVal : (floorVal ? '手動' : '');
    const floorCustomVal = isPresetFloor ? '' : floorVal;
    return `
      <div class="long-split-loc-row" data-idx="${idx}">
        <div class="ls-label">第${idx+1}台</div>
        <div>
          <select class="ls-place" aria-label="第${idx+1}台位置">
            <option value="客廳" ${it.place==='客廳'?'selected':''}>客廳</option>
            <option value="房間" ${it.place==='房間'?'selected':''}>房間</option>
            <option value="手動" ${it.place==='手動'?'selected':''}>手動填寫</option>
          </select>
        </div>
        <div>
          <input class="ls-custom ${customCls}" type="text" placeholder="請輸入位置（例：書房、主臥…）" value="${customVal}" aria-label="第${idx+1}台手動位置" />
        </div>
        <div class="ls-floor-wrap">
          <select class="ls-floorSel" aria-label="第${idx+1}台樓層選擇">
            <option value="" ${floorSelVal===''?'selected':''}>樓層</option>
            <option value="1F" ${floorSelVal==='1F'?'selected':''}>1F</option>
            <option value="2F" ${floorSelVal==='2F'?'selected':''}>2F</option>
            <option value="3F" ${floorSelVal==='3F'?'selected':''}>3F</option>
            <option value="4F" ${floorSelVal==='4F'?'selected':''}>4F</option>
            <option value="手動" ${floorSelVal==='手動'?'selected':''}>手動填寫</option>
          </select>
          <input class="ls-floorCustom ${floorSelVal==='手動'?'':'hidden'}" type="text" placeholder="請輸入樓層（例：B1、5F）" value="${floorCustomVal}" aria-label="第${idx+1}台樓層手動填寫" />
        </div>
      </div>
    `;
  }).join('');

  // attach per-row behaviors
  list.querySelectorAll('.long-split-loc-row').forEach(row=>{
    const sel = row.querySelector('.ls-place');
    const custom = row.querySelector('.ls-custom');
    if(sel && custom){
      sel.addEventListener('change', ()=>{
        const v = sel.value;
        if(v === '手動') custom.classList.remove('hidden');
        else custom.classList.add('hidden');
      });
    }

    const fsel = row.querySelector('.ls-floorSel');
    const fcustom = row.querySelector('.ls-floorCustom');
    if(fsel && fcustom){
      fsel.addEventListener('change', ()=>{
        if(fsel.value === '手動') fcustom.classList.remove('hidden');
        else fcustom.classList.add('hidden');
      });
    }
  });
}

// 對外：在 qty 變更 / fillForm 時呼叫，會盡量保留既有輸入
window.syncLongSplitLocationUI = function syncLongSplitLocationUI(seed){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('longSplitCount')?.value || 0) || 0));
    const current = readLongSplitLocationsFromDOM();
    const incoming = (Array.isArray(seed) ? seed : []).map(normalizeLongSplitLocItem);

    // 優先保留目前表單上的輸入；若目前是空表單（例如剛 fillForm），就使用 incoming
    const base = (current && current.length) ? current : incoming;
    const out = base.slice(0, qty);
    while(out.length < qty) out.push(normalizeLongSplitLocItem(null));
    renderLongSplitLocationsToDOM(out);
  }catch(e){
    console.warn('syncLongSplitLocationUI error', e);
  }
};

window.gatherLongSplitLocations = function gatherLongSplitLocations(){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('longSplitCount')?.value || 0) || 0));
    if(qty <= 0) return [];
    const arr = readLongSplitLocationsFromDOM().slice(0, qty).map(normalizeLongSplitLocItem);
    // 若 place != 手動，custom 直接清空，避免髒資料
    return arr.map(x=>{
      const y = normalizeLongSplitLocItem(x);
      if(y.place !== '手動') y.custom = '';
      return y;
    });
  }catch(e){
    console.warn('gatherLongSplitLocations error', e);
    return [];
  }
};

// 初始：頁面載入時先同步一次（避免既有資料匯入後 UI 未生成）
window.addEventListener('load', ()=>{
  try{ if(typeof window.syncLongSplitLocationUI === 'function') window.syncLongSplitLocationUI([]); }catch(e){}
});


// ---------------- 變形金剛機型：室內機位置：動態 UI + 序列化 ----------------
// 儲存格式：[{ place: '客廳'|'房間'|'手動', custom: 'xxx', floor: '1F'|'2F'|'3F'|'4F'|'<自訂>' }, ...]

function normalizeTransformerLocItem(x){
  const out = { place:'客廳', custom:'', floor:'' };
  if(!x || typeof x !== 'object') return out;
  const p = String(x.place || x.type || '').trim();
  if(p === '客廳' || p === '房間' || p === '手動') out.place = p;
  out.custom = String(x.custom || x.text || '').trim();
  out.floor = String(x.floor || '').trim();
  return out;
}

function readTransformerLocationsFromDOM(){
  const list = document.getElementById('transformerLocationList');
  if(!list) return [];
  const rows = Array.from(list.querySelectorAll('.long-split-loc-row'));
  return rows.map(r=>{
    const place = (r.querySelector('.ls-place')?.value || '客廳');
    const custom = (r.querySelector('.ls-custom')?.value || '').trim();

    const floorSel = (r.querySelector('.ls-floorSel')?.value || '');
    const floorCustom = (r.querySelector('.ls-floorCustom')?.value || '').trim();
    const floor = (floorSel === '手動') ? floorCustom : floorSel;

    return normalizeTransformerLocItem({ place, custom, floor });
  });
}

function renderTransformerLocationsToDOM(items){
  const wrap = document.getElementById('transformerLocationWrap');
  const list = document.getElementById('transformerLocationList');
  if(!wrap || !list) return;

  const qty = Math.max(0, Math.floor(Number(document.getElementById('transformerCount')?.value || 0) || 0));
  if(qty <= 0){
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');

  const safe = (Array.isArray(items) ? items : []).slice(0, qty).map(normalizeTransformerLocItem);
  while(safe.length < qty) safe.push(normalizeTransformerLocItem(null));

  list.innerHTML = safe.map((it, idx)=>{
    const showCustom = (it.place === '手動');
    const customCls = showCustom ? '' : 'hidden';
    const esc = (s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');
    const customVal = esc(it.custom || '');
    const floorVal = esc(it.floor || '');
    const isPresetFloor = (floorVal==='1F' || floorVal==='2F' || floorVal==='3F' || floorVal==='4F');
    const floorSelVal = isPresetFloor ? floorVal : (floorVal ? '手動' : '');
    const floorCustomVal = isPresetFloor ? '' : floorVal;

    return `
      <div class="long-split-loc-row" data-idx="${idx}">
        <div class="ls-label">第${idx+1}台</div>
        <div>
          <select class="ls-place" aria-label="第${idx+1}台位置">
            <option value="客廳" ${it.place==='客廳'?'selected':''}>客廳</option>
            <option value="房間" ${it.place==='房間'?'selected':''}>房間</option>
            <option value="手動" ${it.place==='手動'?'selected':''}>手動填寫</option>
          </select>
        </div>
        <div>
          <input class="ls-custom ${customCls}" type="text" placeholder="請輸入位置（例：書房、主臥…）" value="${customVal}" aria-label="第${idx+1}台手動位置" />
        </div>
        <div class="ls-floor-wrap">
          <select class="ls-floorSel" aria-label="第${idx+1}台樓層選擇">
            <option value="" ${floorSelVal===''?'selected':''}>樓層</option>
            <option value="1F" ${floorSelVal==='1F'?'selected':''}>1F</option>
            <option value="2F" ${floorSelVal==='2F'?'selected':''}>2F</option>
            <option value="3F" ${floorSelVal==='3F'?'selected':''}>3F</option>
            <option value="4F" ${floorSelVal==='4F'?'selected':''}>4F</option>
            <option value="手動" ${floorSelVal==='手動'?'selected':''}>手動填寫</option>
          </select>
          <input class="ls-floorCustom ${floorSelVal==='手動'?'':'hidden'}" type="text" placeholder="請輸入樓層（例：B1、5F）" value="${floorCustomVal}" aria-label="第${idx+1}台樓層手動填寫" />
        </div>
      </div>
    `;
  }).join('');

  // attach per-row behaviors
  list.querySelectorAll('.long-split-loc-row').forEach(row=>{
    const sel = row.querySelector('.ls-place');
    const custom = row.querySelector('.ls-custom');
    if(sel && custom){
      sel.addEventListener('change', ()=>{
        const v = sel.value;
        if(v === '手動') custom.classList.remove('hidden');
        else custom.classList.add('hidden');
      });
    }

    const fsel = row.querySelector('.ls-floorSel');
    const fcustom = row.querySelector('.ls-floorCustom');
    if(fsel && fcustom){
      fsel.addEventListener('change', ()=>{
        if(fsel.value === '手動') fcustom.classList.remove('hidden');
        else fcustom.classList.add('hidden');
      });
    }
  });
}

// 對外：在 qty 變更 / fillForm 時呼叫，會盡量保留既有輸入
window.syncTransformerLocationUI = function syncTransformerLocationUI(seed){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('transformerCount')?.value || 0) || 0));
    const current = readTransformerLocationsFromDOM();
    const incoming = (Array.isArray(seed) ? seed : []).map(normalizeTransformerLocItem);

    // 優先保留目前表單上的輸入；若目前是空表單（例如剛 fillForm），就使用 incoming
    const base = (current && current.length) ? current : incoming;
    const out = base.slice(0, qty);
    while(out.length < qty) out.push(normalizeTransformerLocItem(null));
    renderTransformerLocationsToDOM(out);
  }catch(e){
    console.warn('syncTransformerLocationUI error', e);
  }
};

window.gatherTransformerLocations = function gatherTransformerLocations(){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('transformerCount')?.value || 0) || 0));
    if(qty <= 0) return [];
    const arr = readTransformerLocationsFromDOM().slice(0, qty).map(normalizeTransformerLocItem);
    // 若 place != 手動，custom 直接清空，避免髒資料
    return arr.map(x=>{
      const y = normalizeTransformerLocItem(x);
      if(y.place !== '手動') y.custom = '';
      return y;
    });
  }catch(e){
    console.warn('gatherTransformerLocations error', e);
    return [];
  }
};

// 初始：頁面載入時先同步一次
window.addEventListener('load', ()=>{
  try{ if(typeof window.syncTransformerLocationUI === 'function') window.syncTransformerLocationUI([]); }catch(e){}
});


// ---------------- 一體式水盤：室內機位置：動態 UI + 序列化 ----------------
// 儲存格式：[{ place: '客廳'|'房間'|'手動', custom: 'xxx', floor: '1F'|'2F'|'3F'|'4F'|'<自訂>' }, ...]

function normalizeOnePieceTrayLocItem(x){
  const out = { place:'客廳', custom:'', floor:'' };
  if(!x || typeof x !== 'object') return out;
  const p = String(x.place || x.type || '').trim();
  if(p === '客廳' || p === '房間' || p === '手動') out.place = p;
  out.custom = String(x.custom || x.text || '').trim();
  out.floor = String(x.floor || '').trim();
  return out;
}

function readOnePieceTrayLocationsFromDOM(){
  const list = document.getElementById('onePieceTrayLocationList');
  if(!list) return [];
  const rows = Array.from(list.querySelectorAll('.long-split-loc-row'));
  return rows.map(r=>{
    const place = (r.querySelector('.ls-place')?.value || '客廳');
    const custom = (r.querySelector('.ls-custom')?.value || '').trim();

    const floorSel = (r.querySelector('.ls-floorSel')?.value || '');
    const floorCustom = (r.querySelector('.ls-floorCustom')?.value || '').trim();
    const floor = (floorSel === '手動') ? floorCustom : floorSel;

    return normalizeOnePieceTrayLocItem({ place, custom, floor });
  });
}

function renderOnePieceTrayLocationsToDOM(items){
  const wrap = document.getElementById('onePieceTrayLocationWrap');
  const list = document.getElementById('onePieceTrayLocationList');
  if(!wrap || !list) return;

  const qty = Math.max(0, Math.floor(Number(document.getElementById('onePieceTray')?.value || 0) || 0));
  if(qty <= 0){
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');

  const safe = (Array.isArray(items) ? items : []).slice(0, qty).map(normalizeOnePieceTrayLocItem);
  while(safe.length < qty) safe.push(normalizeOnePieceTrayLocItem(null));

  list.innerHTML = safe.map((it, idx)=>{
    const showCustom = (it.place === '手動');
    const customCls = showCustom ? '' : 'hidden';
    const esc = (s)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;');
    const customVal = esc(it.custom || '');
    const floorVal = esc(it.floor || '');
    const isPresetFloor = (floorVal==='1F' || floorVal==='2F' || floorVal==='3F' || floorVal==='4F');
    const floorSelVal = isPresetFloor ? floorVal : (floorVal ? '手動' : '');
    const floorCustomVal = isPresetFloor ? '' : floorVal;

    return `
      <div class="long-split-loc-row" data-idx="${idx}">
        <div class="ls-label">第${idx+1}台</div>
        <div>
          <select class="ls-place" aria-label="一體式水盤第${idx+1}台位置">
            <option value="客廳" ${it.place==='客廳'?'selected':''}>客廳</option>
            <option value="房間" ${it.place==='房間'?'selected':''}>房間</option>
            <option value="手動" ${it.place==='手動'?'selected':''}>手動填寫</option>
          </select>
        </div>
        <div>
          <input class="ls-custom ${customCls}" type="text" placeholder="請輸入位置（例：書房、主臥…）" value="${customVal}" aria-label="一體式水盤第${idx+1}台手動位置" />
        </div>
        <div class="ls-floor-wrap">
          <select class="ls-floorSel" aria-label="一體式水盤第${idx+1}台樓層選擇">
            <option value="" ${floorSelVal===''?'selected':''}>樓層</option>
            <option value="1F" ${floorSelVal==='1F'?'selected':''}>1F</option>
            <option value="2F" ${floorSelVal==='2F'?'selected':''}>2F</option>
            <option value="3F" ${floorSelVal==='3F'?'selected':''}>3F</option>
            <option value="4F" ${floorSelVal==='4F'?'selected':''}>4F</option>
            <option value="手動" ${floorSelVal==='手動'?'selected':''}>手動填寫</option>
          </select>
          <input class="ls-floorCustom ${floorSelVal==='手動'?'':'hidden'}" type="text" placeholder="請輸入樓層（例：B1、5F）" value="${floorCustomVal}" aria-label="一體式水盤第${idx+1}台樓層手動填寫" />
        </div>
      </div>
    `;
  }).join('');

  // attach per-row behaviors
  list.querySelectorAll('.long-split-loc-row').forEach(row=>{
    const sel = row.querySelector('.ls-place');
    const custom = row.querySelector('.ls-custom');
    if(sel && custom){
      sel.addEventListener('change', ()=>{
        const v = sel.value;
        if(v === '手動') custom.classList.remove('hidden');
        else custom.classList.add('hidden');
      });
    }

    const fsel = row.querySelector('.ls-floorSel');
    const fcustom = row.querySelector('.ls-floorCustom');
    if(fsel && fcustom){
      fsel.addEventListener('change', ()=>{
        if(fsel.value === '手動') fcustom.classList.remove('hidden');
        else fcustom.classList.add('hidden');
      });
    }
  });
}

// 對外：在 qty 變更 / fillForm 時呼叫，會盡量保留既有輸入
window.syncOnePieceTrayLocationUI = function syncOnePieceTrayLocationUI(seed){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('onePieceTray')?.value || 0) || 0));
    const current = readOnePieceTrayLocationsFromDOM();
    const incoming = (Array.isArray(seed) ? seed : []).map(normalizeOnePieceTrayLocItem);

    // 優先保留目前表單上的輸入；若目前是空表單（例如剛 fillForm），就使用 incoming
    const base = (current && current.length) ? current : incoming;
    const out = base.slice(0, qty);
    while(out.length < qty) out.push(normalizeOnePieceTrayLocItem(null));
    renderOnePieceTrayLocationsToDOM(out);
  }catch(e){
    console.warn('syncOnePieceTrayLocationUI error', e);
  }
};

window.gatherOnePieceTrayLocations = function gatherOnePieceTrayLocations(){
  try{
    const qty = Math.max(0, Math.floor(Number(document.getElementById('onePieceTray')?.value || 0) || 0));
    if(qty <= 0) return [];
    const arr = readOnePieceTrayLocationsFromDOM().slice(0, qty).map(normalizeOnePieceTrayLocItem);
    // 若 place != 手動，custom 直接清空，避免髒資料
    return arr.map(x=>{
      const y = normalizeOnePieceTrayLocItem(x);
      if(y.place !== '手動') y.custom = '';
      return y;
    });
  }catch(e){
    console.warn('gatherOnePieceTrayLocations error', e);
    return [];
  }
};

// 初始：頁面載入時先同步一次
window.addEventListener('load', ()=>{
  try{ if(typeof window.syncOnePieceTrayLocationUI === 'function') window.syncOnePieceTrayLocationUI([]); }catch(e){}
});


