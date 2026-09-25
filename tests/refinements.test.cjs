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
 vm.runInContext(source.slice(0,source.indexOf('const glanceButton='))+'\nthis.api={schedule,dailyMapItems,statsHtml,examsHtml,dayEditorHtml,ICONS,setState(value){state=value},setToday(value){today=value;selected=value}};',context);
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
 const input=fixture();input.days['2026-09-20'].water=-1;
 assert.throws(()=>backup.normalizeState(input));
 assert.throws(()=>backup.parse('{'));
});
test('water restore supports the open-ended meter',()=>{
 const input=fixture();input.days['2026-09-20'].water=9;
 assert.equal(backup.normalizeState(input).days['2026-09-20'].water,9);
});
test('Friday scoring schedule remains conditional and respects shortened sessions',()=>{
 const api=app(),friday=api.schedule('2026-09-25'),weekday=api.schedule('2026-09-24'),weekend=api.schedule('2026-09-26');
 assert.equal(friday.find(t=>t.id==='session1').time,'15:30–17:30');
 assert.equal(friday.find(t=>t.id==='swimming').time,'17:30–19:00');
 assert.equal(friday.find(t=>t.id==='session2').time,'19:00–21:30');
 assert.equal(weekday.some(t=>t.id==='swimming'),false);
 assert.equal(weekend.some(t=>t.id==='swimming'),false);
 assert.ok(weekend.some(t=>t.id==='weekend1'));assert.ok(weekend.some(t=>t.id==='weekend2'));
});
test('each map activity has its own defined icon',()=>{
 const api=app();
 for(const mode of ['weekday','weekend']){
  const items=api.dailyMapItems(mode),paths=items.map(item=>api.ICONS[item.icon]);
  assert.ok(paths.every(Boolean),'Every map icon must exist');
  assert.equal(new Set(paths).size,items.length,'No map activities may share an icon');
 }
});
test('weekday map follows the requested morning and lunch sequence, with Friday inline',()=>{
 const api=app(),items=api.dailyMapItems('weekday');
 assert.deepEqual(Array.from(items.slice(0,9),item=>item.name),['Wake up','Freshen up','Workout','Bath','Dry fruits + water','Journal','Meditate','Breakfast','Allen class']);
 assert.equal(items.find(item=>item.name==='Lunch').time,'14:00–14:30');
 assert.equal(items.find(item=>item.name==='Sleep').time,'14:30–15:20');
 assert.ok(items.some(item=>item.name==='Wake up'&&item.time==='15:20'));
 const swim=items.findIndex(item=>item.name==='Swimming');
 assert.ok(swim>items.findIndex(item=>item.id==='session1'));
 assert.ok(swim<items.findIndex(item=>item.id==='session2'));
 assert.equal(items[swim].note,'Only Friday');
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
test('slip check-in appears before hydration with heart icon and exact compact XP label',()=>{
 const api=app(),state=backup.normalizeState(fixture());api.setState(state);api.setToday('2026-09-20');
 const tasks=api.schedule('2026-09-20'),slip=tasks.at(-1);
 assert.equal(slip.id,'slip');
 assert.equal(slip.icon,'slip');
 assert.equal(api.ICONS.slip,api.ICONS.heart);
 const html=api.dayEditorHtml('2026-09-20');
 assert.ok(html.includes('>Slip<'));
 assert.ok(html.includes('<span class="reward">+150</span><span>−37.5</span>'));
 assert.ok(html.indexOf('>Slip<')<html.indexOf('Hydration'));
});
test('water meter starts as a drag drop and caps hydration XP at 100',()=>{
 const api=app(),state=backup.normalizeState(fixture());
 api.setState(state);api.setToday('2026-09-20');
 let html=api.dayEditorHtml('2026-09-20');
 assert.ok(html.includes('data-water-meter'));
 assert.ok(html.includes('type="range"'));
 assert.ok(html.includes('<b>-</b>'));
 state.days['2026-09-20'].water=9;
 html=api.dayEditorHtml('2026-09-20');
 assert.ok(html.includes('value="4"'));
 assert.ok(html.includes('<b>+4</b>'));
 assert.ok(html.includes('>+100 XP<'));
});
test('history shows a read-only summary for past days and an editor for today',()=>{
 const api=app();api.setState(backup.normalizeState(fixture()));api.setToday('2026-09-23');
 const past=api.dayEditorHtml('2026-09-20');
 assert.ok(past.includes('day-record'));
 assert.equal(past.includes('data-task'),false);
 assert.equal(past.includes('data-water'),false);
 const todayHtml=api.dayEditorHtml('2026-09-23');
 assert.ok(todayHtml.includes('data-task'));
 assert.ok(todayHtml.includes('data-water'));
});
