import {createServer} from 'node:http';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleAPI} from '../server/api.js';
mkdirSync('.local',{recursive:true});const db=new DatabaseSync('.local/preview.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql'))){if(!db.prepare('SELECT name FROM migrations WHERE name=?').get(file)){db.exec(readFileSync('drizzle/'+file,'utf8'));db.prepare('INSERT INTO migrations(name) VALUES (?)').run(file)}}
const binding={prepare(sql){return{args:[],bind(...args){this.args=args;return this},async all(){return{results:db.prepare(sql).all(...this.args)}},run(){return db.prepare(sql).run(...this.args)}}},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>s.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};
const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/icon.svg':['icon.svg','image/svg+xml']};
createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:4173');if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});const response=await handleAPI(request,{DB:binding});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return}const asset=assets[url.pathname];if(!asset){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'content-type':asset[1]+'; charset=utf-8','cache-control':'no-cache'});res.end(readFileSync('dist/'+asset[0]))}catch(e){res.writeHead(500);res.end('Preview unavailable')}}).listen(4173,'127.0.0.1',()=>console.log('Nocturne ready: http://127.0.0.1:4173/'));
