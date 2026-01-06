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
        acBrandOther: $('acBrandOtherText')? $('acBrandOtherText').value.trim() : '', total:+$('total').value||0, extraCharge:+$('extraCharge').value||0, travelFee:+$('travelFee').value||0, discount:+$('discount').value||0, netTotal:+$('netTotal').value||0,
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
      ;
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
    }
    function recalcTotals(){ const base=calcTotal(gatherForm()); const extra=Math.max(0,+$('extraCharge').value||0); const total=base+extra; $('total').value=total; const discount=Math.max(0,+$('discount').value||0); $('netTotal').value=Math.max(0,total-discount); }

    function setFormLock(lock){
      const ids=['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','extraCharge','travelFee','discount','recalc'];
      ids.forEach(id=>{ const el=$(id); if(el){ el.disabled = !!lock; el.readOnly = !!lock; }});
      $('toggleLock').textContent = lock ? '解除鎖定（允許修改）' : '解鎖金額編輯';
      $('lockInfo').textContent = lock ? '金額已鎖定（完成）' : '';
    }


    