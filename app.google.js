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

function getCalendarToolAlerts(o) {
  const data = o || {};
  const residenceText = [data.residenceType, data.residenceOther].filter(Boolean).join(' ').trim();
  const isBuilding = /大樓/.test(residenceText);
  const antiMoldCount = Number(data.antiMold || 0);
  const ozoneCount = Number(data.ozone || 0);

  const icons = [];
  const reminders = [];

  if (isBuilding) {
    icons.push('🏢');
    reminders.push(`🏢 大樓案件：${residenceText || '大樓'}，請留意停車、電梯、管理室與工具搬運`);
  }
  if (antiMoldCount > 0) {
    icons.push('🧴');
    reminders.push(`🧴 需帶防霉噴劑：${antiMoldCount}台份`);
  }
  if (ozoneCount > 0) {
    icons.push('💨');
    reminders.push(`💨 需帶臭氧殺菌設備：${ozoneCount}間份`);
  }

  return {
    icons,
    prefix: icons.length ? icons.join('') : '',
    reminders,
    hasAlerts: icons.length > 0
  };
}

function getOrderItems(o) {
  let items = [];
  if (+o.acSplit > 0) items.push(`分離式冷氣${o.acSplit}台`);
  if (+o.acDuct > 0) items.push(`吊隱式冷氣${o.acDuct}台`);
  if (+o.washerTop > 0) items.push(`直立式洗衣機${o.washerTop}台`);
  if (+o.waterTank > 0) {
    // Ladder requirement summary (optional)
    let ladder = '';
    try{
      const req = (o.waterTankLadderRequired || '').trim();
      const type = (o.waterTankLadderType || '').trim();
      const range = (o.waterTankLadderHeightRange || '').trim();
      const ft = (o.waterTankLadderHeightFt || '').trim();
      if (req === 'no') ladder = '梯子不需要';
      if (req === 'yes'){
        if (type === 'plastic') ladder = '梯子塑膠梯';
        else if (type === '5_8ft') ladder = '梯子5–8尺';
        else if (type === 'climb') ladder = '梯子爬梯';
        else if (type === 'higher'){
          let h='';
          if (range === '9_10') h='9–10尺';
          else if (range === '11_12') h='11–12尺';
          else if (range === '13_14') h='13–14尺';
          else if (range === '15_plus') h=(ft? (ft+'尺'):'15尺以上');
          ladder = '梯子更高' + (h?('('+h+')'):'');
        }
      }
    }catch(e){}
    items.push(`水塔${o.waterTank}顆${ladder ? ('（' + ladder + '）') : ''}`);
  }
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
const GOOGLE_CALENDAR_ID = 'primary';
let gToken = null;

function getOrderDurationMinutes(o) {
  const raw = o?.durationMinutes ?? o?.duration ?? o?.durationMin ?? o?.workMinutes;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeOrderDuration(o) {
  const durationMinutes = getOrderDurationMinutes(o);
  return {
    ...o,
    durationMinutes,
    duration: durationMinutes
  };
}

function getCalendarSyncStore() {
  if (!window.__calendarSyncByOrderId || typeof window.__calendarSyncByOrderId !== 'object') {
    window.__calendarSyncByOrderId = {};
  }
  return window.__calendarSyncByOrderId;
}

function getCalendarSyncFieldsForOrderId(orderId) {
  if (!orderId) return {};
  try {
    if (Array.isArray(orders)) {
      const found = orders.find(x => x && x.id === orderId);
      if (found) {
        return {
          googleCalendarEventId: found.googleCalendarEventId || '',
          googleCalendarHtmlLink: found.googleCalendarHtmlLink || '',
          googleCalendarUploadedAt: found.googleCalendarUploadedAt || '',
          googleCalendarUpdatedAt: found.googleCalendarUpdatedAt || '',
          googleCalendarLastAction: found.googleCalendarLastAction || ''
        };
      }
    }
  } catch (e) {}
  return getCalendarSyncStore()[orderId] || {};
}

function ensureCalendarOrderId(orderData) {
  const o = orderData || {};
  let id = (o.id || '').trim();
  try {
    const idEl = document.getElementById('id');
    if (id) {
      if (idEl && !idEl.value) idEl.value = id;
      return id;
    }
    id = (idEl?.value || '').trim();
  } catch (e) {}
  if (!id) {
    id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }
  try {
    const idEl = document.getElementById('id');
    if (idEl && !idEl.value) idEl.value = id;
  } catch (e) {}
  o.id = id;
  return id;
}

function mergeCalendarSyncFields(orderData) {
  const o = { ...(orderData || {}) };
  const orderId = ensureCalendarOrderId(o);
  const syncFields = getCalendarSyncFieldsForOrderId(orderId);
  return {
    ...syncFields,
    ...o,
    id: orderId
  };
}

function persistCalendarSyncToOrder(orderData, googleEvent, action) {
  const orderId = ensureCalendarOrderId(orderData);
  const now = new Date().toISOString();
  const fields = {
    googleCalendarEventId: googleEvent?.id || orderData.googleCalendarEventId || '',
    googleCalendarHtmlLink: googleEvent?.htmlLink || orderData.googleCalendarHtmlLink || '',
    googleCalendarUploadedAt: orderData.googleCalendarUploadedAt || now,
    googleCalendarUpdatedAt: now,
    googleCalendarLastAction: action || 'synced'
  };

  Object.assign(orderData, fields);
  getCalendarSyncStore()[orderId] = fields;

  try {
    if (Array.isArray(orders)) {
      const idx = orders.findIndex(x => x && x.id === orderId);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...fields };
        save(KEY, orders);
        if (typeof refreshTable === 'function') refreshTable();
      }
    }
  } catch (e) {
    console.warn('persistCalendarSyncToOrder failed', e);
  }
  return fields;
}

function buildGoogleCalendarEvent(orderData) {
  const o = normalizeOrderDuration(orderData || {});
  const start = new Date(`${o.date}T${o.time}:00`);
  const end = new Date(start.getTime() + o.durationMinutes * 60 * 1000);

  const { city, district } = extractCityDistrict(o.address || '');
  const area = `${city || ''}${district || ''}`.trim();
  const orderItems = getOrderItems(o);
  const toolAlerts = getCalendarToolAlerts(o);
  const baseSummary = [area, o.customer, orderItems].filter(Boolean).join(' ');
  const summary = [toolAlerts.prefix, baseSummary].filter(Boolean).join(' ');

  const descArr = [];
  descArr.push(`姓名：${o.customer || ''}`);
  descArr.push(`電話：${o.phone || ''}`);
  if (o.acFloors && o.acFloors.length > 0) {
    let s = `冷氣位於樓層：${(o.acFloors || []).join('、')}`;
    if ((o.acFloorAbove || '').trim()) s += `（實際：${(o.acFloorAbove || '').trim()}）`;
    descArr.push(s);
  }
  if (o.washerFloors && o.washerFloors.length > 0) {
    let s2 = `洗衣機位於樓層：${(o.washerFloors || []).join('、')}`;
    if ((o.washerFloorAbove || '').trim()) s2 += `（實際：${(o.washerFloorAbove || '').trim()}）`;
    descArr.push(s2);
  }
  if (o.netTotal || o.total) descArr.push(`金額(折後)：${o.netTotal || o.total || 0}`);
  if (o.acBrands && o.acBrands.length) descArr.push(`品牌：${(o.acBrands || []).join('、')}${o.acBrandOther ? '（' + o.acBrandOther + '）' : ''}`);
  if (o.note) descArr.push(`備註：${o.note}`);
  if (toolAlerts.hasAlerts) {
    descArr.push('');
    descArr.push('【工具提醒】');
    toolAlerts.reminders.forEach(line => descArr.push(line));
  }

  return {
    summary,
    location: o.address || '',
    description: descArr.join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() }
  };
}


function escapeCalendarPreviewHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCalendarPreviewDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCalendarPreviewTimeRange(orderData) {
  const o = normalizeOrderDuration(orderData || {});
  const start = new Date(`${o.date}T${o.time}:00`);
  const end = new Date(start.getTime() + o.durationMinutes * 60 * 1000);
  return {
    start,
    end,
    text: `${formatCalendarPreviewDateTime(start)} ～ ${formatCalendarPreviewDateTime(end)}（${o.durationMinutes} 分鐘）`
  };
}

function buildCalendarUploadPreview(orderData) {
  const o = normalizeOrderDuration(orderData || {});
  const event = buildGoogleCalendarEvent(o);
  const timeRange = formatCalendarPreviewTimeRange(o);
  const descriptionLines = (event.description || '').split('\n').filter(Boolean);
  return {
    event,
    timeRange,
    rows: [
      ['動作', o.googleCalendarEventId ? '更新既有事件' : '新增事件'],
      ['標題', event.summary || '未命名事件'],
      ['時間', timeRange.text || ''],
      ['地點', event.location || '未填寫'],
      ['Google Event ID', o.googleCalendarEventId || '尚未建立']
    ],
    descriptionLines
  };
}

async function showCalendarUploadPreview(orderData) {
  const o = normalizeOrderDuration(orderData || {});
  const preview = buildCalendarUploadPreview(o);
  const title = o.googleCalendarEventId ? '預覽更新 Google 日曆' : '預覽新增 Google 日曆';
  const confirmButtonText = o.googleCalendarEventId ? '確認更新' : '確認上傳';

  const descriptionHtml = preview.descriptionLines.length
    ? `<div style="white-space:pre-wrap;background:#f1f5f9;border:2px solid #94a3b8;border-radius:12px;padding:12px 14px;line-height:1.65;color:#111827;font-size:15px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.75);">${preview.descriptionLines.map(line => `<div style="padding:1px 0;">${escapeCalendarPreviewHtml(line)}</div>`).join('')}</div>`
    : '<div style="color:#475569;background:#f1f5f9;border:2px solid #94a3b8;border-radius:12px;padding:12px 14px;font-weight:700;">沒有描述內容</div>';

  const rowsHtml = preview.rows.map(([label, value], index) => {
    const valueBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    const valueText = label === '時間' ? '#0f172a' : '#1f2937';
    return `
      <div style="display:grid;grid-template-columns:118px minmax(0,1fr);border-bottom:1.5px solid #94a3b8;${index === 0 ? 'border-top:1.5px solid #94a3b8;' : ''}">
        <div style="background:#dbeafe;color:#1e3a8a;font-weight:900;padding:10px 12px;border-right:1.5px solid #94a3b8;line-height:1.35;display:flex;align-items:center;">${escapeCalendarPreviewHtml(label)}</div>
        <div style="background:${valueBg};color:${valueText};font-weight:700;padding:10px 12px;line-height:1.45;word-break:break-word;overflow-wrap:anywhere;">${escapeCalendarPreviewHtml(value)}</div>
      </div>`;
  }).join('');

  if (typeof Swal !== 'undefined' && Swal.fire) {
    const result = await Swal.fire({
      icon: 'info',
      title,
      html: `
        <div style="text-align:left;font-size:15px;color:#111827;">
          <div style="border:2px solid #64748b;border-radius:14px;overflow:hidden;background:#ffffff;box-shadow:0 10px 24px rgba(15,23,42,.14);margin:8px 0 16px;">
            ${rowsHtml}
          </div>
          <div style="margin:12px 0 8px;font-weight:900;color:#0f172a;font-size:16px;display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:#2563eb;"></span>
            日曆描述
          </div>
          ${descriptionHtml}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: '取消',
      focusConfirm: false,
      width: 760
    });
    return !!result.isConfirmed;
  }

  const plainRows = preview.rows.map(([label, value]) => `${label}：${value}`).join('\n');
  const plainDesc = preview.descriptionLines.length ? preview.descriptionLines.join('\n') : '沒有描述內容';
  if (typeof showConfirm === 'function') {
    return await showConfirm(title, `${plainRows}\n\n日曆描述：\n${plainDesc}`, confirmButtonText, '取消');
  }
  return confirm(`${title}\n\n${plainRows}\n\n日曆描述：\n${plainDesc}`);
}

function getCalendarApiUrl(eventId) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}?fields=id,htmlLink,updated,created` : `${base}?fields=id,htmlLink,updated,created`;
}

async function requestCalendarEvent(method, eventId, event) {
  const res = await fetch(getCalendarApiUrl(eventId), {
    method,
    headers: {
      'Authorization': 'Bearer ' + gToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });
  let payload = null;
  try { payload = await res.json(); } catch (e) {}
  return { res, payload };
}

async function handleUploadWithAuth(orderData) {
  const normalizedOrder = normalizeOrderDuration(mergeCalendarSyncFields(orderData));
  if (!normalizedOrder.date || !normalizedOrder.time) {
    await showAlert('錯誤', '請先填寫此訂單的日期與時間');
    return;
  }

  if (!normalizedOrder.durationMinutes) {
    await showAlert('缺少資料', '請輸入有效的工作時長（分鐘，需大於 0）。');
    return;
  }

  const okUpload = await showCalendarUploadPreview(normalizedOrder);
  if (!okUpload) return;

  const runUpload = () => uploadEventToCalendar(normalizedOrder);
  if (gToken) {
    await runUpload();
  } else {
    gTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        gToken = tokenResponse.access_token;
        await runUpload();
      }
    });
    gTokenClient.requestAccessToken();
  }
}

async function uploadEventToCalendar(orderData) {
  const o = normalizeOrderDuration(mergeCalendarSyncFields(orderData));
  const event = buildGoogleCalendarEvent(o);
  const existingEventId = (o.googleCalendarEventId || '').trim();
  let action = existingEventId ? 'updated' : 'created';
  let result = await requestCalendarEvent(existingEventId ? 'PATCH' : 'POST', existingEventId, event);

  if (existingEventId && (result.res.status === 404 || result.res.status === 410)) {
    const recreate = (typeof showConfirm === 'function')
      ? await showConfirm('找不到原本的日曆事件', 'Google 日曆中找不到原本連結的事件。是否改為重新建立一筆新的日曆事件？', '重新建立', '取消')
      : confirm('Google 日曆中找不到原本連結的事件。是否改為重新建立一筆新的日曆事件？');
    if (!recreate) return;
    o.googleCalendarEventId = '';
    result = await requestCalendarEvent('POST', '', event);
    action = 'recreated';
  }

  if (result.res.ok) {
    const fields = persistCalendarSyncToOrder(o, result.payload, action);
    const actionText = action === 'created' ? '新增' : (action === 'recreated' ? '重新建立' : '更新');
    if (typeof Swal !== 'undefined' && Swal.fire) {
      Swal.fire({
        icon: 'success',
        title: `已成功${actionText} Google 日曆`,
        text: `${o.customer || '這筆訂單'} 已${actionText}到行事曆中。`,
        footer: fields.googleCalendarHtmlLink ? `<a href="${fields.googleCalendarHtmlLink}" target="_blank" rel="noopener">開啟 Google 日曆事件</a>` : '可以到 Google 日曆查看與編輯這筆排程。',
        showConfirmButton: true,
        confirmButtonText: '太好了！'
      });
    } else if (typeof showAlert === 'function') {
      showAlert('上傳成功', `已成功${actionText} Google 日曆！`);
    } else {
      alert(`✅ 已成功${actionText} Google 日曆！`);
    }
    return result.payload;
  }

  const message = result.payload?.error?.message || '未知錯誤，請稍後再試。';
  if (typeof Swal !== 'undefined' && Swal.fire) {
    Swal.fire({
      icon: 'error',
      title: '上傳失敗',
      text: message,
      confirmButtonText: '了解'
    });
  } else if (typeof showAlert === 'function') {
    showAlert('上傳失敗', message);
  } else {
    alert(`❌ 上傳失敗：${message}`);
  }
}


// ---- concatenated from inline <script> blocks ----