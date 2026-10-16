const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const backup = require('../dist/backup.js');
function fixture() {
 return {days:{'2026-09-20':{water:2,tasks:{wake:{status:'done',rating:100}}}},dayModes:{'2026-09-20':'weekend'},exams:[{name:'JEE Main',date:'2026-10-11',improvements:'  First line\n\nSecond line\n• Keep this bullet'}, {name:'Full syllabus',date:'2026-10-11',improvements:'Legacy pattern note'}]};
}
function app() {
 const context=vm.createContext({Intl,Date,document:{getElementById:()=>({})}});
 const source=fs.readFileSync(require.resolve('../dist/app.js'),'utf8');
 vm.runInContext(source.slice(0,source.indexOf('const glanceButton='))+'\nthis.api={weekFor,setWeeklySkips,currentDay,fmt,taskXP,plannedDuration,parseStudyTime,summary,formatDuration,elapsedTimer,pauseSessionTimer,waterXP,schedule,dailyMapItems,statsHtml,examsHtml,dayEditorHtml,ICONS,setState(value){state=value},setToday(value){today=value;selected=value},setEditingDay(value){editingDay=value}};',context);
 return context.api;
}
test('legacy restore drops pattern improvements but preserves exam text and progress',()=>{
 const original=fixture(),restored=backup.normalizeState(original);
 assert.equal(restored.exams[0].improvements,original.exams[0].improvements);
 assert.equal('improvements' in restored.exams[1],false);
 assert.deepEqual(restored.days,original.days);assert.deepEqual(restored.dayModes,original.dayModes);
 assert.equal(original.exams[1].improvements,'Legacy pattern note');
 assert.deepEqual(backup.parse(backup.serialize(restored)),restored);
});
test('invalid restore is still rejected',()=>{
 const input=fixture();input.days['2026-09-20'].water=7;
 assert.throws(()=>backup.normalizeState(input));
 assert.throws(()=>backup.parse('{'));
});
test('restore supports the full extra water range',()=>{
 const input=fixture();input.days['2026-09-20'].water=6;
 assert.equal(backup.normalizeState(input).days['2026-09-20'].water,6);
});
test('all days share four 200 XP sessions; weekends add two morning sessions',()=>{
 const api=app();
 for(const day of ['2026-09-24','2026-09-25','2026-09-26']){
  const tasks=api.schedule(day),focus=tasks.filter(t=>t.type==='focus');
  assert.equal(tasks.some(t=>t.id==='class'||t.id==='swimming'),false);
  assert.ok(focus.every(t=>t.max===200&&t.penalty===50));
  assert.deepEqual(Array.from(focus.filter(t=>t.id.startsWith('session')),t=>[t.name,t.time]),[
   ['Session I - Major','15:30–17:30'],['Session II - Minor','17:30–18:15'],['Session III - Advanced','18:30–21:30'],['Session IV - Minor','22:00–23:00']]);
  assert.equal(tasks.find(t=>t.id==='wake').time,'06:20');
  assert.equal(focus.length,day==='2026-09-26'?6:4);
 }
 const weekend=api.schedule('2026-09-26');
 assert.equal(weekend.find(t=>t.id==='weekend1').time,'08:00–11:00');
 assert.equal(weekend.find(t=>t.id==='weekend2').time,'11:30–14:00');
});
test('each map activity has its own defined icon',()=>{
 const api=app();
 for(const mode of ['weekday','weekend']){
  const items=api.dailyMapItems(mode),paths=items.map(item=>api.ICONS[item.icon]);
  assert.ok(paths.every(Boolean),'Every map icon must exist');
  assert.equal(new Set(paths).size,items.length,'No map activities may share an icon');
 }
});
test('weekday map follows the requested morning and lunch sequence, without class focus',()=>{
 const api=app(),items=api.dailyMapItems('weekday');
 assert.deepEqual(Array.from(items.slice(0,7),item=>item.name),['Rise & Begin','Freshen up','Workout','Bath','Dry fruits + water','Meditate','Breakfast']);
 assert.equal(items.find(item=>item.name==='Lunch').time,'14:00–14:30');
 assert.equal(items.find(item=>item.name==='Sleep').time,'14:30–15:20');
 assert.ok(items.some(item=>item.name==='Wake up'&&item.time==='15:20'));
 assert.equal(items.some(item=>item.id==='class'||item.name==='Swimming'),false);
 assert.equal(items.find(item=>item.name==='Dinner').note,'Talk with parents');
 assert.equal(api.dailyMapItems('weekend').some(item=>item.name==='Swimming'),false);
});
test('exam notes keep their line breaks and do not render an edit action',()=>{
 const api=app(),state=backup.normalizeState(fixture());api.setState(state);api.setToday('2026-09-23');
 const html=api.examsHtml();
 assert.ok(html.includes(state.exams[0].improvements));
 assert.equal(html.includes('data-edit-notes'),false);
 assert.equal(html.includes('Review & edit'),false);
 assert.ok(html.includes('18'));
});
test('history XP summary stays numeric without explanatory labels or a graph',()=>{
 const api=app();api.setState(backup.normalizeState(fixture()));api.setToday('2026-09-23');
 const html=api.statsHtml({xp:500,max:1000},true);
 assert.ok(html.includes('+500'));assert.ok(html.includes('50%'));assert.ok(html.includes('>1000 <small>XP</small>'));
 for(const phrase of ['Total XP till date','maximum till date','benchmark-track','xp-segments','Across your recorded days','keeps the chain going','Every effort adds up'])assert.equal(html.includes(phrase),false);
});
test('dashboard XP gained bars mirror today’s check-ins, not a fixed count',()=>{
 const api=app(),state=backup.normalizeState(fixture());
 api.setState(state);api.setToday('2026-09-20');
 const html=api.statsHtml({xp:120,max:1500});
 const tasks=api.schedule('2026-09-20');
 assert.equal((html.match(/<i style="--fill:/g)||[]).length,tasks.length);
 assert.ok(html.includes(`aria-label="1 of ${tasks.length} check-ins today"`));
 assert.ok(html.includes('--fill:100%'));
 state.days['2026-09-20'].tasks.workout={status:'done',rating:60};
 const partial=api.statsHtml({xp:150,max:1500});
 assert.ok(partial.includes('--fill:60%'));
 assert.ok(partial.includes(`aria-label="2 of ${tasks.length} check-ins today"`));
});
test('removed daily check-in is ignored in backups and schedules; journal is in the evening',()=>{
 const input=fixture();input.days['2026-09-20'].tasks.dailycheck={status:'obsolete'};
 input.days['2026-09-20'].water=3.99;
 const restored=backup.parse(backup.serialize(input));
 assert.equal('dailycheck' in restored.days['2026-09-20'].tasks,false);
 assert.equal(restored.days['2026-09-20'].water,3.99);
 assert.deepEqual(restored.days['2026-09-20'].tasks.wake,input.days['2026-09-20'].tasks.wake);
 const api=app();
 for(const day of ['2026-09-24','2026-09-25','2026-09-26']){
  const tasks=api.schedule(day);
  assert.equal(tasks.some(t=>t.id==='dailycheck'),false);
  assert.equal(tasks.find(t=>t.id==='journal').phase,'Evening practice');
  assert.equal(tasks.filter(t=>t.id==='journal').length,1);
 }
 for(const mode of ['weekday','weekend']){
  const items=api.dailyMapItems(mode);
  assert.ok(items.findIndex(t=>t.id==='journal')>items.findIndex(t=>t.id==='session3'));
 }
});
test('fourth hydration check-in opens the big drop meter and keeps XP capped',()=>{
 const api=app(),state=backup.normalizeState(fixture());
 api.setState(state);api.setToday('2026-09-20');
 let html=api.dayEditorHtml('2026-09-20');
 assert.ok(html.includes('data-water-extra'));
 assert.ok(html.includes('<span>-</span>'));
 state.days['2026-09-20'].water=6;
 html=api.dayEditorHtml('2026-09-20');
 assert.ok(html.includes('<span>+3</span>'));
 assert.ok(html.includes('>+100 XP<'));
});
test('history shows a summary first, then an editor for past days after edit is enabled',()=>{
 const api=app();api.setState(backup.normalizeState(fixture()));api.setToday('2026-09-23');
 const past=api.dayEditorHtml('2026-09-20');
 assert.ok(past.includes('day-record'));
 assert.equal(past.includes('data-task'),false);
 assert.equal(past.includes('data-water'),false);
 api.setEditingDay('2026-09-20');
 const editingPast=api.dayEditorHtml('2026-09-20');
 assert.ok(editingPast.includes('data-task'));
 assert.ok(editingPast.includes('data-water'));
 assert.ok(editingPast.includes('day-record'));
 const todayHtml=api.dayEditorHtml('2026-09-23');
 assert.ok(todayHtml.includes('data-task'));
 assert.ok(todayHtml.includes('data-water'));
});

test('fractional hydration earns 25 XP per litre and survives backup round trips',()=>{
 const api=app();api.setToday('2026-09-20');
 for(const [litres,xp] of [[3,75],[3.5,87.5],[3.99,99.75]]){
  assert.equal(api.waterXP('2026-09-20',litres),xp);
  const input=fixture();input.days['2026-09-20'].water=litres;
  assert.equal(backup.parse(backup.serialize(input)).days['2026-09-20'].water,litres);
 }
});

test('backups preserve running and paused timers and ignore removed class focus',()=>{
 const input=fixture(),day=input.days['2026-09-20'];
 day.tasks.class={status:'done',rating:100};
 day.timers={session1:{elapsedMs:12345,startedAt:1791700000000,goal:'Finish chapter 2'},session2:{elapsedMs:3750000,startedAt:null,goal:'Practice'}};
 const restored=backup.parse(backup.serialize(input));
 assert.deepEqual(restored.days['2026-09-20'].timers,day.timers);
 assert.equal('class' in restored.days['2026-09-20'].tasks,false);
 day.timers.session1.elapsedMs=-1;assert.throws(()=>backup.normalizeState(input));
 day.timers.session1.elapsedMs=0;day.timers.session1.goal='x'.repeat(501);assert.throws(()=>backup.normalizeState(input));
});

test('timers use elapsed timestamps, preserve pauses, and format full hours',()=>{
 const api=app(),timer={elapsedMs:1000,startedAt:10000,goal:'Read'};
 assert.equal(api.elapsedTimer(timer,15500),6500);
 api.pauseSessionTimer(timer,15500);
 assert.equal(timer.startedAt,null);
 assert.equal(api.elapsedTimer(timer,999999),6500);
 timer.startedAt=20000;
 assert.equal(api.elapsedTimer(timer,23000),9500);
 assert.equal(api.formatDuration(3723000),'01:02:03');
 assert.equal(api.formatDuration(360000000),'100:00:00');
 assert.equal(api.elapsedTimer({elapsedMs:0,startedAt:5000},4000),0);
});

test('time and focus jointly determine XP, capped at the planned duration',()=>{
 const api=app(),t=api.schedule('2026-10-12').find(t=>t.id==='session1');
 assert.equal(api.plannedDuration(t),7200000);
 for(const [minutes,rating,xp] of [[0,100,0],[30,100,0],[60,100,0],[61,100,200*61/120],[120,50,100],[120,90,180],[180,100,200],[120,0,0]]){
  assert.ok(Math.abs(api.taskXP(t,{status:'done',rating,scoringVersion:1,durationMs:minutes*60000,targetMs:7200000})-xp)<1e-9);
 }
 assert.equal(api.taskXP(t,{status:'done',rating:75}),150);
 assert.equal(api.taskXP(t,{status:'missed',rating:0}),-50);
 assert.equal(api.taskXP(t,null,true),-50);
});
test('duration parsing validates hours minutes and seconds',()=>{
 const api=app();
 for(const value of ['', '1:30','01:60:00','-01:00:00','01:00:60','abc'])assert.equal(api.parseStudyTime(value),null);
 assert.equal(api.parseStudyTime('01:30:15'),5415000);
 assert.equal(api.parseStudyTime('00:00:00'),0);
});
test('all focus sessions use their own scheduled target',()=>{
 const api=app(),tasks=api.schedule('2026-10-11').filter(t=>t.type==='focus');
 assert.deepEqual(Array.from(tasks,t=>api.plannedDuration(t)/60000),[180,150,120,45,180,60]);
 for(const t of tasks)assert.equal(api.taskXP(t,{status:'done',rating:80,scoringVersion:1,durationMs:api.plannedDuration(t)*.75,targetMs:api.plannedDuration(t)}),120);
});
test('new scores survive backup restore and agree with dashboard and history',()=>{
 const api=app(),state=fixture(),day='2026-09-20';
 state.days[day].tasks.session1={status:'done',rating:100,scoringVersion:1,durationMs:5400000,targetMs:7200000};
 const restored=backup.parse(backup.serialize(state));
 assert.deepEqual(restored.days[day].tasks.session1,state.days[day].tasks.session1);
 api.setState(restored);api.setToday(day);
 assert.equal(api.summary(day).xp,270);
 assert.ok(api.dayEditorHtml(day).includes('+150 XP'));
 assert.ok(api.statsHtml(api.summary(day)).includes('--fill:75%'));
 state.days[day].tasks.session1.targetMs=0;assert.throws(()=>backup.normalizeState(state));
});

test('strict halfway threshold holds for every session',()=>{
 const api=app();
 for(const t of api.schedule('2026-10-11').filter(t=>t.type==='focus')){
  const targetMs=api.plannedDuration(t);
  for(const durationMs of [targetMs/2-1000,targetMs/2])assert.equal(api.taskXP(t,{status:'done',rating:100,scoringVersion:1,durationMs,targetMs}),0);
  assert.ok(api.taskXP(t,{status:'done',rating:100,scoringVersion:1,durationMs:targetMs/2+1000,targetMs})>100);
 }
});

test('XP display keeps hundredths and zero-XP check-ins remain counted',()=>{
 const api=app();assert.equal(api.fmt(93.75),'93.75');assert.equal(api.fmt(100.027777),'100.03');assert.equal(api.fmt(100),'100');
 const state=fixture(),day='2026-09-20';state.days[day].tasks.session1={status:'done',rating:100,scoringVersion:1,durationMs:3600000,targetMs:7200000};
 api.setState(state);api.setToday(day);
 const html=api.statsHtml(api.summary(day));assert.ok(html.includes('aria-label="2 of '));assert.equal(api.summary(day).done,2);
});
test('backup rejects unsafe timer values without mutating the input',()=>{
 const state=fixture(),day=state.days['2026-09-20'];
 day.timers={session1:{elapsedMs:1e100,startedAt:null,goal:'Study'}};
 assert.throws(()=>backup.normalizeState(state));assert.equal(day.timers.session1.elapsedMs,1e100);
 day.timers.session1.elapsedMs=0;day.timers.session1.startedAt=1e100;assert.throws(()=>backup.normalizeState(state));
});

test('weekly skips remove only dated sessions, adjust scores, and survive backups',()=>{
 const api=app(),data=backup.normalizeState(fixture());api.setState(data);api.setToday('2026-10-16');
 data.days['2026-10-15']={tasks:{},water:0};const before=api.summary('2026-10-15');
 data.weeklySkips={'2026-10-12':[{day:'2026-10-15',id:'session1'},{day:'2026-10-17',id:'weekend1'}]};
 assert.equal(api.schedule('2026-10-15').some(t=>t.id==='session1'),false);
 assert.equal(api.summary('2026-10-15').max,before.max-200);
 assert.equal(api.summary('2026-10-15').xp,before.xp+50);
 assert.equal(api.schedule('2026-10-16').some(t=>t.id==='session1'),true);
 assert.equal(api.schedule('2026-10-22').some(t=>t.id==='session1'),true);
 assert.equal(api.schedule('2026-10-17').some(t=>t.id==='weekend1'),false);
 assert.deepEqual(backup.parse(backup.serialize(data)).weeklySkips,data.weeklySkips);
 api.setToday('2026-10-15');assert.equal(api.dailyMapItems('weekday').some(t=>t.id==='session1'),false);
});
test('weekly selection enforces two sessions and pauses removed timers without deleting progress',()=>{
 const api=app(),data=backup.normalizeState(fixture()),day=api.currentDay(),week=api.weekFor(day);api.setState(data);
 data.days[day]={water:0,tasks:{session1:{status:'done',rating:75}},timers:{session1:{elapsedMs:10,startedAt:Date.now()-1000,goal:'Keep'}}};
 assert.equal(api.setWeeklySkips(week,[{day,id:'session1'},{day,id:'session2'},{day,id:'session3'}]),false);
 assert.equal(api.setWeeklySkips(week,[{day,id:'wake'}]),false);
 assert.equal(api.setWeeklySkips(week,[{day,id:'session1'},{day,id:'session1'}]),false);
 assert.equal(api.setWeeklySkips(week,[{day,id:'session1'}]),true);
 assert.equal(data.days[day].timers.session1.startedAt,null);
 assert.ok(data.days[day].timers.session1.elapsedMs>=1010);
 assert.equal(data.days[day].tasks.session1.rating,75);
 assert.equal(api.setWeeklySkips(week,[]),true);
 assert.ok(api.schedule(day).some(t=>t.id==='session1'));
});
test('backup rejects invalid weeks, excessive selections, duplicates and unrelated tasks',()=>{
 for(const weeklySkips of [ {'2026-10-13':[]}, {'2026-10-12':[{day:'2026-10-19',id:'session1'}]}, {'2026-10-12':[{day:'2026-10-12',id:'wake'}]}, {'2026-10-12':Array(3).fill({day:'2026-10-12',id:'session1'})}, {'2026-10-12':Array(2).fill({day:'2026-10-12',id:'session1'})}]){
  assert.throws(()=>backup.normalizeState({...fixture(),weeklySkips}));
 }
});
