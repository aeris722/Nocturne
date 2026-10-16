'use strict';

function dayStudyReport(k){
 const tasks=schedule(k),record=state.days[k],dayEnd=Date.parse(offsetDay(k,1)+'T00:00:00+05:30');
 const sessions=tasks.filter(t=>t.type==='focus').map(t=>{
  const saved=entry(k,t),timer=record?.timers?.[t.id];
  let durationMs=null;
  if(saved?.status==='done'&&Number.isFinite(saved.durationMs))durationMs=Math.max(0,saved.durationMs);
  else if(timer&&(Number.isFinite(timer.elapsedMs)||Number.isFinite(timer.startedAt))){
   durationMs=Math.max(0,Number.isFinite(timer.elapsedMs)?timer.elapsedMs:0);
   if(Number.isFinite(timer.startedAt))durationMs+=Math.max(0,Math.min(Date.now(),dayEnd)-timer.startedAt);
  }
  return {...t,status:saved?.status||'pending',durationMs,rating:saved?.status==='done'&&Number.isFinite(saved.rating)?Math.max(0,Math.min(100,saved.rating)):null};
 });
 const rated=sessions.filter(s=>s.rating!==null),timed=sessions.filter(s=>s.durationMs!==null);
 return {date:k,hasRecord:!!record,sessions,totalMs:timed.reduce((sum,s)=>sum+s.durationMs,0),hasTime:timed.length>0,unknownTime:sessions.some(s=>s.status==='done'&&s.durationMs===null),avgProductivity:rated.length?rated.reduce((sum,s)=>sum+s.rating,0)/rated.length:null,rituals:tasks.filter(t=>t.type!=='focus'&&entry(k,t)?.status==='done'),...summary(k)};
}

function daySummaryDuration(ms){
 if(ms===null)return '—';
 const seconds=Math.floor(ms/1000),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 return h+'<small>h</small> '+String(m).padStart(2,'0')+'<small>m</small>'+(s?' <span class="ds-seconds">'+String(s).padStart(2,'0')+'<small>s</small></span>':'');
}

function isAnalysisDate(k){
 if(typeof k!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(k)||k<'0001-01-01'||k>currentDay())return false;
 const parsed=new Date(k+'T12:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===k;
}
function setDayNote(k,note){
 if(!isAnalysisDate(k)||typeof note!=='string'||note.length>500)return false;
 state.dayNotes??={};if(note.trim())state.dayNotes[k]=note;else delete state.dayNotes[k];return true;
}
function showDaySummary(k=offsetDay(currentDay(),-1)){
 checkDate();if(!isAnalysisDate(k))return;
 const report=dayStudyReport(k),date=dateFrom(k).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'});
 const avg=report.avgProductivity,ring=avg===null?0:avg,longest=Math.max(1,...report.sessions.map(s=>s.durationMs||0));
 const rows=report.sessions.map((s,i)=>`<li class="ds-session"><div class="ds-session-heading"><span class="ds-session-index">${String(i+1).padStart(2,'0')}</span><span class="ds-session-name">${esc(s.name)}</span><span class="ds-status ${s.status==='done'?'is-done':''}" role="img" aria-label="${s.status==='done'?'Checked in':s.status==='missed'?'Missed':'Not checked in'}" title="${s.status==='done'?'Checked in':s.status==='missed'?'Missed':'Not checked in'}">${svg(s.status==='done'?'check':s.status==='missed'?'close':'moon')}</span></div><div class="ds-session-data"><span class="ds-duration" aria-label="Recorded study time">${daySummaryDuration(s.durationMs)}</span><span class="ds-session-rating" aria-label="${s.rating===null?'No productivity recorded':fmt(s.rating)+' percent productivity'}">${s.rating===null?'—':fmt(s.rating)+'<small>%</small>'}</span></div><div class="ds-time-track" role="img" aria-label="${esc(s.name)} study time relative to longest session"><span style="width:${(s.durationMs||0)/longest*100}%"></span></div><div class="ds-rating-dots" role="img" aria-label="${s.rating===null?'No productivity recorded':fmt(s.rating)+' percent productivity'}">${Array.from({length:20},(_,n)=>`<i style="--ds-fill:${s.rating===null?0:Math.max(0,Math.min(100,(s.rating-n*5)*20))}%"></i>`).join('')}</div></li>`).join('');
 const rituals=report.rituals.map(t=>`<li title="${esc(t.name)}"><span class="ds-ritual-symbol">${svg(t.icon)}<span>${svg('check')}</span></span><span>${esc(t.name)}</span></li>`).join('');
 showModal(`${modalHeader('Day analysis',k===today?'Today.':k===offsetDay(today,-1)?'Yesterday.':dateFrom(k).toLocaleDateString('en-GB',{day:'numeric',month:'long'}))}<div class="ds-date-controls"><button class="icon-button" id="analysis-prev" aria-label="Analyse previous day" ${k==='0001-01-01'?'disabled':''}>${svg('left')}</button><input type="date" id="analysis-date" aria-label="Analysis date" min="0001-01-01" max="${today}" value="${k}"><button class="icon-button" id="analysis-next" aria-label="Analyse next day" ${k>=today?'disabled':''}>${svg('right')}</button></div><article class="ds-report" aria-label="${esc(date)} detailed report"><div class="ds-dateline"><span>${esc(date)}</span><span>${report.done}<span class="ds-muted"> / ${report.total}</span> ${svg('check')}</span></div><div class="ds-hero"><div class="ds-time-total"><span class="ds-label">Total time studied</span><strong>${daySummaryDuration(report.hasTime?report.totalMs:null)}</strong>${report.unknownTime?'<span class="ds-time-note">Some time unrecorded</span>':''}</div><div class="ds-productivity"><div class="ds-orbit" role="img" aria-label="Average productivity ${avg===null?'not recorded':fmt(avg)+' percent'}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ds-orbit-track" cx="50" cy="50" r="44"/><circle class="ds-orbit-value" cx="50" cy="50" r="44" pathLength="100" stroke-dasharray="${ring} 100"/></svg><strong>${avg===null?'—':Math.round(avg)+'<small>%</small>'}</strong></div><span class="ds-label">Avg productivity</span></div></div><section class="ds-note"><div class="ds-note-heading"><label for="analysis-note">Note to self</label><span id="analysis-note-status" role="status" aria-live="polite">${state.dayNotes?.[k]?'Saved':''}</span></div><textarea id="analysis-note" rows="2" maxlength="500" aria-label="Note to self for ${esc(date)}">${esc(state.dayNotes?.[k]||'')}</textarea></section>${!report.hasRecord?'<div class="ds-empty">No recorded activity</div>':`<section class="ds-sessions" aria-label="Study sessions"><div class="ds-section-heading"><h3>Study sessions</h3><span>Time / Focus</span></div><ol>${rows}</ol></section><section class="ds-checkins" aria-label="Completed check-ins"><div class="ds-section-heading"><h3>Check-ins</h3><span>${report.rituals.length} ${svg('check')}</span></div>${rituals?'<ul>'+rituals+'</ul>':'<div class="ds-empty ds-empty-small">—</div>'}</section>`}<footer class="ds-footer"><span>${svg('spark')}<strong>${fmt(report.xp)}</strong><span>/ ${fmt(report.max)} XP</span></span><span>${svg('drop')}<strong>${fmt(report.water)}</strong><span>/ 4 L</span></span></footer></article>`);
 const picker=document.getElementById('analysis-date');
 picker.onchange=()=>{if(isAnalysisDate(picker.value)){showDaySummary(picker.value);document.getElementById('analysis-date').focus()}else picker.value=k};
 document.getElementById('analysis-prev').onclick=()=>{showDaySummary(offsetDay(k,-1));document.getElementById('analysis-prev')?.focus()};
 document.getElementById('analysis-next').onclick=()=>{if(k<today){showDaySummary(offsetDay(k,1));document.getElementById('analysis-next')?.focus()}};
 document.getElementById('analysis-note').oninput=e=>{
  if(!setDayNote(k,e.target.value))return;
  save();document.getElementById('analysis-note-status').textContent=storageOk?'Saved':'Could not save';
 };

}
