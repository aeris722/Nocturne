const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const taskIds=new Set(['wake','workout','journal','meditate','weekend1','weekend2','class','afternoon','session1','session2','session3','swimming']);
function validate(change){
 if(!change||typeof change.key!=='string')return false;
 const {key,value}=change;
 if(/^exam\/[01]$/.test(key))return value&&typeof value.name==='string'&&value.name.length<=60&&typeof value.date==='string'&&(value.date===''||validDate(value.date))&&typeof value.improvements==='string'&&value.improvements.length<=3000;
 if(/^review\//.test(key))return validDate(key.slice(7))&&value&&typeof value.completed==='boolean'&&Array.isArray(value.items)&&value.items.length<=20&&value.items.every(item=>item&&typeof item.id==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(item.id)&&typeof item.mistake==='string'&&item.mistake.length<=500&&typeof item.solution==='string'&&item.solution.length<=1000)&&value.checks&&typeof value.checks==='object'&&!Array.isArray(value.checks)&&Object.entries(value.checks).length<=20&&Object.entries(value.checks).every(([id,checked])=>/^[a-zA-Z0-9-]{1,64}$/.test(id)&&typeof checked==='boolean');
 if(key==='quote')return value&&typeof value.text==='string'&&value.text.length>0&&value.text.length<=240&&typeof value.author==='string'&&value.author.length<=70;
 const match=/^(\d{4}-\d{2}-\d{2})\/(day|water|task\/([a-z0-9]+))$/.exec(key);
 if(!match||isNaN(Date.parse(match[1]))||new Date(match[1]).toISOString().slice(0,10)!==match[1])return false;
 if(match[2]==='day')return value===true;
 if(match[2]==='water')return Number.isInteger(value)&&value>=0&&value<=4;
 if(!taskIds.has(match[3]))return false;
 if(value===null)return true;
 return value&&['done','missed'].includes(value.status)&&Number.isFinite(value.rating)&&value.rating>=0&&value.rating<=100&&(!value.subjects||(Array.isArray(value.subjects)&&value.subjects.length===3&&value.subjects.every(n=>Number.isFinite(n)&&n>=0&&n<=100)));
}
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
function database(env){if(!env.DB)throw new Error('Database unavailable');return env.DB}
export async function handleAPI(request,env){
 const url=new URL(request.url);if(url.pathname!=='/api/state')return json({error:'Not found'},404);
 try{const db=database(env);
 if(request.method==='GET'){const rows=await db.prepare('SELECT key, value FROM records').all();return json({records:(rows.results||[]).map(row=>({key:row.key,value:JSON.parse(row.value)}))})}
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 const body=await request.text();if(body.length>64000)return json({error:'Request too large'},413);
 let input;try{input=JSON.parse(body)}catch{return json({error:'Invalid JSON'},400)}
 if(!Array.isArray(input.changes)||input.changes.length<1||input.changes.length>250||!input.changes.every(validate))return json({error:'Invalid changes'},400);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const locked=input.changes.some(({key})=>{const match=/^(?:review\/)?(\d{4}-\d{2}-\d{2})(?:\/|$)/.exec(key);return match&&match[1]!==today});
 if(locked)return json({error:'Past and future entries are read-only.',code:'entry_locked'},409);
 const statements=input.changes.map(c=>c.value===null?db.prepare('DELETE FROM records WHERE key = ?').bind(c.key):db.prepare('INSERT INTO records (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(c.key,JSON.stringify(c.value)));
 await db.batch(statements);return json({saved:true});
 }catch(error){console.error('Nocturne storage:',error.message);return json({error:'Your progress could not be saved. Please retry.'},503)}
}
