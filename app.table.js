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

        // 未排期（沒有日期）的訂單：加上醒目底色，避免與一般訂單混在一起難辨識
        if(!o.date) tr.classList.add('undated-row');

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
        span.title = '點一下快速切換狀況';
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
        delBtn.addEventListener('click', async (ev)=>{ ev.stopPropagation(); const msg='確定要刪除此訂單嗎？'; const ok = (typeof showConfirm === 'function') ? await showConfirm('刪除訂單', msg, '刪除', '取消', { danger:true }) : confirm(msg); if(ok) { orders = orders.filter(x=>x.id!==o.id); save(KEY, orders); refreshTable(); }});
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
      const transportTotal = monthly.reduce((a,b)=>a+(+b.transportFee||0),0);
      const helperTotal = monthly.reduce((a,b)=>a+(+b.helperCost||0),0);
      const monthExpense = (expenses.filter(e=>{ if(!e.date) return false; const d=new Date(e.date); return d.getFullYear()===y && (d.getMonth()+1)===m; }).reduce((a,b)=>a+(+b.amount||0),0)) + transportTotal + helperTotal;
const mk = (t,v,h='')=>{const box=document.createElement('div');box.className='box';box.innerHTML=`<div class="small muted">${t}</div><div class="number">${v}</div>${h?`<div class="small muted">${h}</div>`:''}`;return box;};
      if(sumEl){
        // 關鍵指標：本月案件數 / 完成狀態 / 本月金額小計（折後）
        sumEl.appendChild(mk('本月案件數', count));
        sumEl.appendChild(mk('完成 / 未完成', `${done} / ${pending}`));
        sumEl.appendChild(mk('本月金額小計', fmtCurrency(net)));
        // Breakdown: keep each item on its own line to avoid awkward wrapping on narrow cards
        const breakdownHtml = `<div class="kpi-breakdown">`
          + `<div class="kpi-breakdown-item">車資 ${fmtCurrency(transportTotal)}</div>`
          + `<div class="kpi-breakdown-item">日薪助手 ${fmtCurrency(helperTotal)}</div>`
          + `</div>`;
        sumEl.appendChild(mk('本月花費', fmtCurrency(monthExpense), breakdownHtml));
        sumEl.appendChild(mk('本月淨利', fmtCurrency(net - monthExpense), '本月金額小計 − 本月花費'));
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
        '備註','總金額','折扣金額','折後總金額','車資','建立時間'
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
          +o.transportFee||0,
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
              if (+o2.waterTank) {
                let ladder = '';
                try{
                  const req = (o2.waterTankLadderRequired || '').trim();
                  const type = (o2.waterTankLadderType || '').trim();
                  const range = (o2.waterTankLadderHeightRange || '').trim();
                  const ft = (o2.waterTankLadderHeightFt || '').trim();
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
                arr.push('水塔 ' + o2.waterTank + ' 個' + (ladder ? ('（' + ladder + '）') : ''));
              }
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
    // 如果該客戶有多個地址：複製新增下一筆時自動切換到「下一個地址」
    try{
      let c = null;
      const phone0 = (base.phone||'').toString().split('/')[0].trim();
      if(phone0 && typeof findContactByPhone==='function') c = findContactByPhone(phone0);
      if(!c && typeof findContactByName==='function') c = findContactByName(name);
      if(c && typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(c);
      if(c && Array.isArray(c.addresses)){
        const list = c.addresses.filter(a => a && a.active !== false && (a.address||'').trim());
        if(list.length > 1){
          let idx = -1;
          if(base.addressId) idx = list.findIndex(a => a.id === base.addressId);
          if(idx < 0 && base.address){
            const key = (typeof normalizeAddressKey==='function') ? normalizeAddressKey(base.address) : (base.address||'').toString().trim().toLowerCase().replace(/\s+/g,'');
            idx = list.findIndex(a => ((typeof normalizeAddressKey==='function') ? normalizeAddressKey(a.address) : (a.address||'').toString().trim().toLowerCase().replace(/\s+/g,'')) === key);
          }
          if(idx < 0) idx = 0;
          const nx = list[(idx + 1) % list.length];
          next.addressId = nx.id;
          if(nx.address) next.address = nx.address;
        }
      }
    }catch(e){}
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

    // 同日新增第二地點：複製目前訂單、保持同一天與同技師，地址自動切換到下一個，並寫入同一個 bundleId（報表可合併）
function duplicateSameDayNextLocation(){
  try{
    const base = (typeof gatherForm === 'function') ? gatherForm() : {};
    const name = (base.customer || '').trim();
    if(!name){
      if (typeof Swal !== 'undefined' && Swal.fire){
        Swal.fire('無法建立第二地點', '請先填寫客戶姓名（或從列表點選一筆訂單）。', 'info');
      } else {
        alert('請先填寫客戶姓名（或從列表點選一筆訂單）。');
      }
      $('customer')?.focus();
      return;
    }
    if(!base.date){
      if (typeof Swal !== 'undefined' && Swal.fire){
        Swal.fire('缺少日期', '同日新增第二地點需要先設定日期。', 'info');
      } else {
        alert('同日新增第二地點需要先設定日期。');
      }
      $('date')?.focus();
      return;
    }

    // 取得/建立 bundleId，並回寫目前表單（若目前訂單已存在，也同步寫回 orders）
    let bundleId = (base.bundleId || '').trim();
    if(!bundleId){
      bundleId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (String(Date.now()) + '_' + Math.random().toString(16).slice(2));
      try{ if($('bundleId')) $('bundleId').value = bundleId; }catch(e){}
      try{
        const curId = (base.id || '').trim();
        if(curId && Array.isArray(orders)){
          const idx = orders.findIndex(o => o && o.id === curId);
          if(idx >= 0){
            orders[idx].bundleId = bundleId;
            try{ save(KEY, orders); }catch(e){}
          }
        }
      }catch(e){}
    }

    const next = Object.assign({}, base);
    next.id = '';
    next.bundleId = bundleId;

    // 狀態：新一筆預設排定
    next.status = '排定';
    next.confirmed = false;
    next.quotationOk = false;
    next.reminderNotified = false;
    delete next.createdAt;
    delete next.completedAt;

    // 時間建議：若目前有時間與工時，預設在結束後 + 30 分鐘
    function addMinutesToTime(t, mins){
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(t||'').trim());
      if(!m) return '';
      let hh = parseInt(m[1],10), mm = parseInt(m[2],10);
      if(Number.isNaN(hh) || Number.isNaN(mm)) return '';
      let total = hh*60 + mm + (mins||0);
      if(total >= 24*60 || total < 0) return '';
      const nh = Math.floor(total/60);
      const nm = total%60;
      return String(nh).padStart(2,'0') + ':' + String(nm).padStart(2,'0');
    }
    if(base.time && base.durationMinutes){
      const suggest = addMinutesToTime(base.time, (+base.durationMinutes||0) + 30);
      next.time = suggest || '';
    } else {
      next.time = '';
    }

    // 地址：若客戶有多地址，自動切到下一個
    try{
      let c = null;
      const phone0 = (base.phone||'').toString().split('/')[0].trim();
      if(phone0 && typeof findContactByPhone==='function') c = findContactByPhone(phone0);
      if(!c && typeof findContactByName==='function') c = findContactByName(name);
      if(c && typeof ensureContactAddressesSchema==='function') ensureContactAddressesSchema(c);
      if(c && Array.isArray(c.addresses)){
        const list = c.addresses.filter(a => a && a.active !== false && (a.address||'').trim());
        if(list.length > 1){
          let idx = -1;
          if(base.addressId) idx = list.findIndex(a => a.id === base.addressId);
          if(idx < 0 && base.address){
            const key = (typeof normalizeAddressKey==='function')
              ? normalizeAddressKey(base.address)
              : String(base.address||'').toString().trim().toLowerCase().replace(/\s+/g,'');
            idx = list.findIndex(a => {
              const ak = (typeof normalizeAddressKey==='function')
                ? normalizeAddressKey(a.address||'')
                : String(a.address||'').toString().trim().toLowerCase().replace(/\s+/g,'');
              return ak === key;
            });
          }
          if(idx < 0) idx = 0;
          const nx = list[(idx + 1) % list.length];
          next.addressId = nx.id;
          if(nx.address) next.address = nx.address;
        }
      }
    }catch(e){}

    // 保持同一天
    next.date = base.date;

    fillForm(next);
    if (typeof Swal !== 'undefined' && Swal.fire){
      Swal.fire('已建立第二地點訂單草稿', '已複製並建立第二地點（同日），請確認時間與內容後儲存。', 'success');
    }
  } catch(err){
    console.error(err);
    if (typeof Swal !== 'undefined' && Swal.fire){
      Swal.fire('發生錯誤', '建立第二地點訂單時發生錯誤，請稍後再試。', 'error');
    } else {
      alert('建立第二地點訂單時發生錯誤。');
    }
  }
}

async function deleteOrder(){
      const id=$('id').value; if(!id) return;
      const msg='確定要刪除這筆訂單嗎？'; const ok = (typeof showConfirm === 'function') ? await showConfirm('刪除訂單', msg, '刪除', '取消', { danger:true }) : confirm(msg);
      if(!ok) return;
      orders=orders.filter(o=>o.id!==id); save(KEY, orders); refreshTable(); fillForm({});
    }
    function resetForm(){ fillForm({}); }
    function download(filename, text){ const blob=new Blob([text],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    function exportCSV(){
      const headers=['id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話','安排時段(多選)','地址','冷氣樓屯(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定','分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤','備註','總金額','折扣金額','折後總金額','車資(花費)','日薪助手','助手人數','每人日薪','日薪成本(花費)','建立時間'];
      const rows=orders.map(o=>[o.id,o.staff,o.date||'',o.time,o.confirmed?'是':'否',o.quotationOk?'是':'否',o.customer,o.lineId,o.phone,(o.slots||[]).join('|'),o.address,(o.acFloors||[]).join('|'),(o.washerFloors||[]).join('|'),o.contactMethod,o.status,o.completedAt||'',o.locked?'是':'否',o.acSplit,o.acDuct,o.washerTop,o.waterTank,o.pipesAmount,o.antiMold,o.ozone,o.transformerCount,o.longSplitCount,o.onePieceTray,(o.note||'').replace(/\n/g,' '),o.total,o.discount,o.netTotal,(o.transportFee||0),(o.helperEnabled?'是':'否'),(o.helperCount||0),(o.helperDailyWage||0),(o.helperCost||0),o.createdAt||'']);
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

    // Use global staffList (from app.core.js) when available; fallback to localStorage.
    const key = (typeof STAFF_KEY !== 'undefined') ? STAFF_KEY : 'yl_clean_staff_v1';
    let list = (typeof staffList !== 'undefined' && Array.isArray(staffList))
      ? staffList
      : (()=>{
          try{ return JSON.parse(localStorage.getItem(key) || 'null') || []; }catch(e){ return []; }
        })();

    if(!list.includes(name)){
      list.push(name);
      try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){}
      if(typeof staffList !== 'undefined') staffList = list; // keep global in sync
      if(typeof initStaffSelects === 'function') initStaffSelects();
    }
    if($('staff')) $('staff').value = name; 
    if($('staffFilter')) $('staffFilter').value = '';
  });
}
function addContact(){ 
  showInputModal('新增聯繫方式','輸入新聯繫方式：','例如：Line/Email/電話', '', function(name){
    name = (name||'').trim();
    if(!name) return;

    // Use global contactList (from app.core.js) when available; fallback to localStorage.
    const key = (typeof CONTACT_KEY !== 'undefined') ? CONTACT_KEY : 'yl_clean_contact_v1';
    let list = (typeof contactList !== 'undefined' && Array.isArray(contactList))
      ? contactList
      : (()=>{
          try{ return JSON.parse(localStorage.getItem(key) || 'null') || []; }catch(e){ return []; }
        })();

    if(!list.includes(name)){
      list.push(name);
      try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){}
      if(typeof contactList !== 'undefined') contactList = list; // keep global in sync
      if(typeof initContactSelect === 'function') initContactSelect();
    }
    if($('contactMethod')) $('contactMethod').value = name;
  });
}


// ---- Contact method manager (delete / sort) ----
let __contactManagerState = { list: [] };

function __getContactKey(){
  return (typeof CONTACT_KEY !== 'undefined') ? CONTACT_KEY : 'yl_clean_contact_v1';
}

function __loadContactListSafe(){
  const key = __getContactKey();
  // Prefer global in-memory list when valid
  let list = (typeof contactList !== 'undefined' && Array.isArray(contactList)) ? contactList : null;
  if(!Array.isArray(list)){
    try{ list = JSON.parse(localStorage.getItem(key) || 'null'); }catch(e){ list = null; }
  }
  if(!Array.isArray(list)) list = [];
  // normalize
  list = list.map(x=>String(x||'').trim()).filter(Boolean);
  // de-dup while keeping order
  const seen = new Set();
  list = list.filter(x=>{ if(seen.has(x)) return false; seen.add(x); return true; });
  return list;
}

function __saveContactList(list){
  const key = __getContactKey();
  try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){}
  if(typeof contactList !== 'undefined') contactList = list;
  if(typeof initContactSelect === 'function') initContactSelect();
}

function openContactManager(){
  const modal = document.getElementById('contactManagerModal');
  if(!modal) return;

  const backdrop = modal.querySelector('.modal-backdrop');
  const btnClose = document.getElementById('contactManagerCloseBtn');
  const btnDone = document.getElementById('contactManagerDoneBtn');
  const btnAdd = document.getElementById('contactManagerAddBtn');
  const btnReset = document.getElementById('contactManagerResetBtn');
  const listEl = document.getElementById('contactManagerList');

  function close(){
    modal.setAttribute('aria-hidden','true');
  }

  async function confirmAsk(title, msg, danger){
    try{
      if(typeof showConfirm === 'function'){
        return await showConfirm(title, msg, danger ? '確定' : '好', '取消', { danger: !!danger });
      }
    }catch(e){}
    return confirm(msg);
  }

  function render(){
    if(!listEl) return;
    const list = __contactManagerState.list || [];
    if(list.length === 0){
      listEl.innerHTML = '<div class="cm-empty muted">目前沒有聯繫方式。可按「恢復預設」或「新增」。</div>';
      return;
    }
    listEl.innerHTML = '';
    list.forEach((name, i)=>{
      const row = document.createElement('div');
      row.className = 'cm-item';

      const label = document.createElement('div');
      label.className = 'cm-name';
      label.textContent = name;

      const actions = document.createElement('div');
      actions.className = 'cm-actions';

      const upBtn = document.createElement('button');
      upBtn.className = 'btn-small';
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.disabled = (i === 0);
      upBtn.title = '上移';
      upBtn.addEventListener('click', ()=>{
        if(i<=0) return;
        const arr = __contactManagerState.list;
        [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
        __saveContactList(arr);
        render();
      });

      const downBtn = document.createElement('button');
      downBtn.className = 'btn-small';
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.disabled = (i === list.length - 1);
      downBtn.title = '下移';
      downBtn.addEventListener('click', ()=>{
        const arr = __contactManagerState.list;
        if(i >= arr.length - 1) return;
        [arr[i+1], arr[i]] = [arr[i], arr[i+1]];
        __saveContactList(arr);
        render();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-small';
      delBtn.type = 'button';
      delBtn.textContent = '🗑';
      delBtn.title = '刪除';
      delBtn.addEventListener('click', async ()=>{
        const arr = __contactManagerState.list;
        if(arr.length <= 1){
          if(typeof showAlert === 'function') showAlert('提示', '至少保留一個聯繫方式。若想回復預設，請按「恢復預設」。');
          else alert('至少保留一個聯繫方式。若想回復預設，請按「恢復預設」。');
          return;
        }
        const ok = await confirmAsk('刪除聯繫方式', `確定要刪除「${name}」嗎？`, true);
        if(!ok) return;
        __contactManagerState.list = arr.filter((x, idx)=> idx !== i);
        __saveContactList(__contactManagerState.list);
        // If the current select value was deleted, move it to first item.
        try{
          const sel = document.getElementById('contactMethod');
          if(sel && sel.value === name){
            sel.value = (__contactManagerState.list[0] || '');
          }
        }catch(e){}
        render();
      });

      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      actions.appendChild(delBtn);

      row.appendChild(label);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  async function addFromManager(){
    if(typeof showInputModal !== 'function'){
      const name = prompt('新增聯繫方式：');
      if(name) __contactManagerState.list.push(name.trim());
      __contactManagerState.list = __contactManagerState.list.map(x=>String(x||'').trim()).filter(Boolean);
      __saveContactList(__contactManagerState.list);
      render();
      return;
    }
    showInputModal('新增聯繫方式','輸入新聯繫方式：','例如：Line/Email/電話', '', function(name){
      name = (name||'').trim();
      if(!name) return;
      const arr = __contactManagerState.list || [];
      if(arr.includes(name)){
        if(typeof showAlert === 'function') showAlert('提示', '此聯繫方式已存在。');
        else alert('此聯繫方式已存在。');
        return;
      }
      arr.push(name);
      __contactManagerState.list = arr;
      __saveContactList(arr);
      render();
      try{
        const sel = document.getElementById('contactMethod');
        if(sel) sel.value = name;
      }catch(e){}
    });
  }

  async function resetDefaults(){
    const ok = await confirmAsk('恢復預設', '確定要恢復預設的聯繫方式清單嗎？（目前清單會被覆蓋）', true);
    if(!ok) return;
    const defaults = (typeof DEFAULT_CONTACT_LIST !== 'undefined' && Array.isArray(DEFAULT_CONTACT_LIST))
      ? DEFAULT_CONTACT_LIST.slice()
      : ['Line','Facebook粉絲團','直接線上預約','直接來電','裕良電器行','其他'];
    __contactManagerState.list = defaults;
    __saveContactList(defaults);
    render();
  }

  // bind only once
  if(!modal.__cmBound){
    backdrop?.addEventListener('click', (e)=>{
      if(e.target && e.target.getAttribute('data-close')==='true') close();
    });
    btnClose?.addEventListener('click', close);
    btnDone?.addEventListener('click', close);
    btnAdd?.addEventListener('click', addFromManager);
    btnReset?.addEventListener('click', resetDefaults);
    modal.__cmBound = true;
  }

  __contactManagerState.list = __loadContactListSafe();
  render();
  modal.setAttribute('aria-hidden','false');
}


    
