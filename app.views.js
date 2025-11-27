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
        staff: latest.staff || '',
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
    const staffLabel = it.staff ? `｜作業人員：${it.staff}` : '';
    const meta = `下次提醒：${dueStr}（${statusText}）${notifiedText}${staffLabel}`;
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




function openReminderCenter(options){
  options = options || {};
  // 切換到提醒分頁
  if (typeof setActiveView === 'function') {
    setActiveView('reminder');
  }

  // 套用篩選條件
  try {
    var rangeSel = document.getElementById('reminderRange');
    if (rangeSel && options.range) {
      rangeSel.value = String(options.range);
    }
    var searchEl = document.getElementById('reminderSearch');
    if (searchEl && typeof options.search === 'string') {
      searchEl.value = options.search;
    }
    var onlyUnEl = document.getElementById('reminderOnlyUnnotified');
    if (onlyUnEl && typeof options.onlyPending === 'boolean') {
      onlyUnEl.checked = options.onlyPending;
    }
  } catch(e){ /* ignore */ }

  // 重新渲染提醒中心
  if (typeof refreshReminderCenter === 'function') {
    refreshReminderCenter();
  }
}

function setActiveView(view){
  const mainMode        = document.getElementById('mainMode');
  const expenseSection  = document.getElementById('expensePanel');
  const reportSection   = document.getElementById('reportPanel');
  const reminderSection = document.getElementById('reminderCenterSection');
  const settingsSection = document.getElementById('settingsPanel');
  const header = document.getElementById('scheduleHeader') || document.querySelector('header');
  const tabs = document.querySelectorAll('.view-tab');

  // Tab 外觀切換
  tabs.forEach(btn => {
    const v = btn.getAttribute('data-view') || 'main';
    if (view === v){
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  });

  // 先全部隱藏
  if (mainMode)       mainMode.style.display = 'none';
  if (expenseSection) expenseSection.style.display = 'none';
  if (reportSection)  reportSection.style.display = 'none';
  if (reminderSection) reminderSection.style.display = 'none';
  if (settingsSection) settingsSection.style.display = 'none';

  if (view === 'reminder'){
    if (reminderSection) reminderSection.style.display = '';
    if (header) header.style.display = 'none';
    if (typeof refreshReminderCenter === 'function') {
      refreshReminderCenter();
    }
  } else if (view === 'settings'){
    if (settingsSection) settingsSection.style.display = '';
    if (header) header.style.display = 'none';
  } else if (view === 'expense'){
    if (expenseSection) expenseSection.style.display = '';
    if (header) header.style.display = '';
    if (typeof refreshExpense === 'function') {
      refreshExpense();
    }
  } else if (view === 'report'){
    if (reportSection) reportSection.style.display = '';
    if (header) header.style.display = '';
    if (typeof refreshYearStatSelect === 'function') {
      refreshYearStatSelect();
    }
  } else {
    // 預設為排程頁
    if (mainMode) mainMode.style.display = '';
    if (header) header.style.display = '';
  }
}

// ---------- Header Layout (手機工具列布局) ----------
const HEADER_LAYOUT_KEY = 'headerLayoutMobile_v1';

const DEFAULT_HEADER_LAYOUT = [
  { id: 'yearMonth',  span: 6, enabled: true,  label: '年份 / 月份' },
  { id: 'staff',      span: 6, enabled: true,  label: '作業人員' },
  { id: 'status',     span: 6, enabled: true,  label: '狀況' },
  { id: 'completedRange', span: 6, enabled: true, label: '完成時間' },
  { id: 'showUndated', span: 6, enabled: true, label: '顯示未排期' },
  { id: 'search',     span: 12, enabled: true, label: '搜尋' },
  { id: 'newOrder',   span: 12, enabled: true, label: '新增訂單' },
  { id: 'newQuotation', span: 12, enabled: true, label: '新增報價單' },
  { id: 'newExpense', span: 12, enabled: true, label: '新增花費' }
];

function loadHeaderLayout(){
  try{
    const raw = localStorage.getItem(HEADER_LAYOUT_KEY);
    if (!raw) return DEFAULT_HEADER_LAYOUT.slice();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_HEADER_LAYOUT.slice();
    const map = {};
    DEFAULT_HEADER_LAYOUT.forEach(it => { map[it.id] = it; });
    const merged = parsed
      .filter(p => map[p.id])
      .map(p => ({
        id: p.id,
        span: p.span === 6 ? 6 : 12,
        enabled: p.enabled !== false,
        label: map[p.id].label
      }));
    DEFAULT_HEADER_LAYOUT.forEach(it => {
      if (!merged.some(m => m.id === it.id)){
        merged.push(Object.assign({}, it));
      }
    });
    return merged;
  }catch(e){
    return DEFAULT_HEADER_LAYOUT.slice();
  }
}

function saveHeaderLayout(layout){
  try{
    localStorage.setItem(HEADER_LAYOUT_KEY, JSON.stringify(layout));
  }catch(e){}
}

function applyHeaderLayout(layout){
  const isMobile = window.innerWidth <= 600;
  const items = document.querySelectorAll('.header-toolbar .header-item');
  items.forEach(el => {
    const id = el.getAttribute('data-header-id');
    const cfg = layout.find(it => it.id === id) || null;
    if (!cfg){
      el.style.order = '';
      el.classList.remove('span-6','span-4');
      el.style.display = '';
      return;
    }
    if (!isMobile){
      el.style.order = '';
      el.classList.remove('span-6','span-4');
      el.style.display = cfg.enabled === false ? 'none' : '';
      return;
    }
    el.style.order = String(layout.indexOf(cfg) * 10);
    el.classList.toggle('span-6', cfg.span === 6);
    el.classList.toggle('span-4', cfg.span === 4);
    el.style.display = cfg.enabled === false ? 'none' : '';
  });
}

function buildHeaderLayoutEditor(){
  const listEl = document.getElementById('headerLayoutList');
  if (!listEl) return;
  const layout = loadHeaderLayout();
  listEl.innerHTML = '';
  layout.forEach((cfg, index) => {
    const row = document.createElement('div');
    row.className = 'header-layout-row';
    row.dataset.id = cfg.id;

    const left = document.createElement('label');
    left.className = 'header-layout-row__label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = cfg.enabled !== false;
    checkbox.dataset.role = 'enabled';
    left.appendChild(checkbox);
    left.appendChild(document.createTextNode(cfg.label));

    const controls = document.createElement('div');
    controls.className = 'header-layout-row__controls';

    const spanSel = document.createElement('select');
    spanSel.dataset.role = 'span';
    spanSel.innerHTML = '<option value="12">整列</option><option value="6">半列</option>';
    spanSel.value = (cfg.span === 6 ? '6' : '12');

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '上移';
    upBtn.dataset.role = 'up';

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '下移';
    downBtn.dataset.role = 'down';

    controls.appendChild(spanSel);
    controls.appendChild(upBtn);
    controls.appendChild(downBtn);

    row.appendChild(left);
    row.appendChild(controls);

    listEl.appendChild(row);
  });
}

function readHeaderLayoutFromEditor(){
  const listEl = document.getElementById('headerLayoutList');
  if (!listEl) return DEFAULT_HEADER_LAYOUT.slice();
  const current = loadHeaderLayout();
  const ids = Array.from(listEl.querySelectorAll('.header-layout-row')).map(r => r.dataset.id);
  const next = [];
  ids.forEach(id => {
    const base = current.find(it => it.id === id) || DEFAULT_HEADER_LAYOUT.find(it => it.id === id);
    if (!base) return;
    const row = listEl.querySelector('.header-layout-row[data-id="' + id + '"]');
    if (!row) return;
    const enabledInput = row.querySelector('input[type="checkbox"][data-role="enabled"]');
    const spanSel = row.querySelector('select[data-role="span"]');
    next.push({
      id: id,
      label: base.label,
      enabled: enabledInput ? enabledInput.checked : true,
      span: spanSel && spanSel.value === '6' ? 6 : 12
    });
  });
  return next;
}

function initHeaderLayoutEditor(){
  const toggleBtn = document.getElementById('headerLayoutToggle');
  const editor = document.getElementById('headerLayoutEditor');
  const closeBtn = document.getElementById('headerLayoutClose');
  const resetBtn = document.getElementById('headerLayoutReset');
  const saveBtn = document.getElementById('headerLayoutSave');
  if (!toggleBtn || !editor) return;

  const openEditor = ()=>{
    buildHeaderLayoutEditor();
    editor.hidden = false;
  };
  const closeEditor = ()=>{
    editor.hidden = true;
  };

  toggleBtn.addEventListener('click', ()=>{
    if (editor.hidden){
      openEditor();
    }else{
      closeEditor();
    }
  });
  closeBtn && closeBtn.addEventListener('click', closeEditor);

  resetBtn && resetBtn.addEventListener('click', ()=>{
    saveHeaderLayout(DEFAULT_HEADER_LAYOUT);
    applyHeaderLayout(DEFAULT_HEADER_LAYOUT);
    buildHeaderLayoutEditor();
  });

  saveBtn && saveBtn.addEventListener('click', ()=>{
    const layout = readHeaderLayoutFromEditor();
    saveHeaderLayout(layout);
    applyHeaderLayout(layout);
    closeEditor();
  });

  const listEl = document.getElementById('headerLayoutList');
  if (listEl){
    listEl.addEventListener('click', (e)=>{
      const btn = e.target.closest('button');
      if (!btn) return;
      const role = btn.dataset.role;
      if (role !== 'up' && role !== 'down') return;
      const row = btn.closest('.header-layout-row');
      if (!row) return;
      if (role === 'up' && row.previousElementSibling){
        row.parentNode.insertBefore(row, row.previousElementSibling);
      }else if (role === 'down' && row.nextElementSibling){
        row.parentNode.insertBefore(row.nextElementSibling, row);
      }
    });
  }

  // 初次套用（依現有設定）
  applyHeaderLayout(loadHeaderLayout());
  window.addEventListener('resize', ()=>{
    applyHeaderLayout(loadHeaderLayout());
  });
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
    
    
      // auto-open orderAccordion when主要按鈕被點擊
      ;['saveBtn','resetBtn','quickNextBtn'].forEach(id=>{
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
        if (typeof openReminderCenter === 'function') {
          openReminderCenter({ range: '30', onlyPending: true });
        } else if (typeof setActiveView === 'function') {
          setActiveView('reminder');
        }
      });

      $('exportXlsx')?.addEventListener('click', exportXLSX);
      initViewTabs();
    }