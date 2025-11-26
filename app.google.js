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