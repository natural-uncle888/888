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
        transformerCount:+$('transformerCount').value||0, longSplitCount:+$('longSplitCount').value||0, onePieceTray:+$('onePieceTray').value||0,
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
      $('toggleLock').textContent = lock ? '解除鎖定（允許修改）' : '解鎖金額編輯';
      $('lockInfo').textContent = lock ? '金額已鎖定（完成）' : '';
    }


    