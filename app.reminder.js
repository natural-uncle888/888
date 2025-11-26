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
