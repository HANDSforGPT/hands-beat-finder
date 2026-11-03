import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {estimateKey} from './music.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const PORT=Number(process.env.BEAT_FINDER_PORT||58983);
const DATA=process.env.BEAT_FINDER_DATA||path.join(os.homedir(),'Library','Application Support','HANDS Beat Finder');
const FILE=path.join(DATA,'catalog.json');
const MAX_UP=40*1024*1024,MAX_DOWN=150*1024*1024;
export const GENRES=['Trap','Hip-Hop','Drill','R&B','Pop','Afrobeat','House','Electronic','Lo-Fi','Boom Bap','UK Garage','Reggaeton','Ambient','Other'];
export const KEYS=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].flatMap(k=>[k+' major',k+' minor']);
const response=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
const error=(res,code,message)=>response(res,code,{error:message});
const urlOK=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&s.length<2048}catch{return false}};
function readBody(req,max){return new Promise((resolve,reject)=>{let len=0,parts=[];req.on('data',p=>{len+=p.length;if(len>max){reject(Error('Upload too large'));req.destroy()}else parts.push(p)});req.on('end',()=>resolve(Buffer.concat(parts)));req.on('error',reject)})}
export function cleanBeat(b){if(!b||typeof b!=='object')throw Error('Beat details required');for(const key of ['title','producer','genre','key','storeUrl'])if(typeof b[key]!=='string'||!b[key].trim())throw Error('Missing '+key);
if(!GENRES.includes(b.genre)||!KEYS.includes(b.key))throw Error('Invalid genre/key');if(!Number.isInteger(b.bpm)||b.bpm<40||b.bpm>240)throw Error('BPM must be between 40 and 240');
if(!b.storeUrl.startsWith('https://')||![b.storeUrl,b.previewUrl,b.stemsUrl].every(x=>!x||urlOK(x)))throw Error('Invalid link. Store URL must be HTTPS');
return {id:crypto.randomUUID(),title:b.title.trim().slice(0,110),producer:b.producer.trim().slice(0,90),genre:b.genre,key:b.key,bpm:b.bpm,
storeUrl:b.storeUrl,previewUrl:b.previewUrl||'',stemsUrl:b.stemsUrl||'',description:String(b.description||'').slice(0,260),created:Date.now()}}
function readCatalog(){try{const a=JSON.parse(fs.readFileSync(FILE,'utf8'));return Array.isArray(a)?a:[]}catch{return []}}
function writeCatalog(list){fs.mkdirSync(DATA,{recursive:true,mode:0o700});const tmp=FILE+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(list,null,2),{mode:0o600});fs.renameSync(tmp,FILE)}
function ffmpeg(args,{maxBytes=1_500_000,timeout=120000}={}){return new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-nostdin','-loglevel','error',...args],{stdio:['ignore','pipe','pipe']});let buffers=[],count=0,stderr='',settled=false;const fail=e=>{if(settled)return;settled=true;p.kill('SIGKILL');clearTimeout(timer);reject(e)};const timer=setTimeout(()=>fail(Error('Processing timed out')),timeout);
p.stdout.on('data',v=>{count+=v.length;if(count>maxBytes)return fail(Error('Audio too long'));buffers.push(v)});p.stderr.on('data',v=>stderr+=v.toString().slice(0,500));p.on('error',fail);
p.on('close',code=>{if(settled)return;clearTimeout(timer);settled=true;if(code!==0)return reject(Error('Unsupported audio: '+stderr.slice(-180)));resolve(Buffer.concat(buffers))})})}
async function analyze(input){const bytes=await ffmpeg(['-t','45','-i',input,'-map','0:a:0','-ac','1','-ar','11025','-f','s16le','pipe:1']);const samples=new Int16Array(bytes.length/2);for(let i=0;i<samples.length;i++)samples[i]=bytes.readInt16LE(i*2);return estimateKey(samples)}
export function publicIP(ip){if(net.isIP(ip)!==4)return false;const a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&a[1]>=18&&a[1]<=19||a[0]===198&&a[1]===51&&a[2]===100||a[0]===203&&a[1]===0&&a[2]===113)}
async function resolvePublic(raw){if(!urlOK(raw))throw Error('Direct HTTPS audio URL required');const u=new URL(raw);if(u.protocol!=='https:'||u.port&&u.port!=='443'||net.isIP(u.hostname))throw Error('Public HTTPS domain required');
const found=await dns.lookup(u.hostname,{family:4,all:true});if(!found.length||found.some(r=>!publicIP(r.address)))throw Error('Blocked unsafe or private host');return {u,ip:found[0].address}}
async function downloadFile(raw,target,redirects=0){if(redirects>3)throw Error('Too many redirects');const {u,ip}=await resolvePublic(raw);
return new Promise((resolve,reject)=>{const req=https.get(u,{timeout:20000,lookup:(host,opt,cb)=>cb(null,ip,4),headers:{'User-Agent':'HANDS-Beat-Finder/0.1','Accept':'audio/*,application/octet-stream'}},async resp=>{
if([301,302,303,307,308].includes(resp.statusCode)&&resp.headers.location){resp.resume();try{return resolve(await downloadFile(new URL(resp.headers.location,u).href,target,redirects+1))}catch(e){return reject(e)}}
if(resp.statusCode!==200){resp.resume();return reject(Error('Audio host returned '+resp.statusCode))}
const contentType=String(resp.headers['content-type']||'').split(';')[0].toLowerCase();
const directExt=/\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff|aif)$/i.test(u.pathname);
if(!contentType.startsWith('audio/')&&!['application/octet-stream','application/x-flac'].includes(contentType)&&!directExt){resp.resume();return reject(Error('URL points to a page, not a directly downloadable audio file'))}
if(Number(resp.headers['content-length']||0)>MAX_DOWN){resp.resume();return reject(Error('File exceeds 150 MB'))}
let size=0;resp.on('data',p=>{size+=p.length;if(size>MAX_DOWN)resp.destroy(Error('File exceeds 150 MB'))});
try{await pipeline(resp,fs.createWriteStream(target,{flags:'wx',mode:0o600}));resolve()}catch(e){reject(e)}
});req.on('timeout',()=>req.destroy(Error('Download timed out')));req.on('error',reject)})}
async function convert(url,format){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hands-beat-convert-'));const input=path.join(dir,'incoming'),output=path.join(dir,'converted.'+format);
try{await downloadFile(url,input);const args=['-y','-i',input,'-map','0:a:0','-vn','-c:a',format==='mp3'?'libmp3lame':'pcm_s24le'];if(format==='mp3')args.push('-b:a','320k','-id3v2_version','3');args.push('-t','600','-fs','300000000',output);await ffmpeg(args,{maxBytes:1024,timeout:150000});const size=fs.statSync(output).size;if(size>=299000000)throw Error('Converted audio exceeds 300 MB; use a shorter, authorized source');return fs.readFileSync(output)}
finally{fs.rmSync(dir,{recursive:true,force:true})}}
function trusted(req){return ['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(req.headers.origin)&&req.headers['x-beat-finder']==='1'}
export function startServer(){const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');
if(req.method==='GET'&&url.pathname==='/api/health')return response(res,200,{ok:true,version:'0.1.0'});
if(req.method==='GET'&&url.pathname==='/api/beats')return response(res,200,{beats:readCatalog(),genres:GENRES,keys:KEYS});
if(req.method==='GET'&&['/','/index.html'].includes(url.pathname)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; media-src https: 'self'; base-uri 'none'; frame-ancestors 'none'"});return fs.createReadStream(path.join(ROOT,'public/index.html')).pipe(res)}
if(!trusted(req))return error(res,403,'Local interface required');
if(req.method==='POST'&&url.pathname==='/api/beats'){const b=cleanBeat(JSON.parse((await readBody(req,12000)).toString()));const list=readCatalog();list.unshift(b);writeCatalog(list);return response(res,201,{beat:b})}
if(req.method==='POST'&&url.pathname==='/api/import'){const raw=JSON.parse((await readBody(req,250000)).toString());const source=Array.isArray(raw)?raw:raw.beats;if(!Array.isArray(source)||source.length>500)throw Error('Import JSON array or {beats:[]}, maximum 500 records');const added=source.map(cleanBeat),existing=readCatalog(),ids=new Set(existing.map(b=>b.storeUrl+'|'+b.title));let count=0;for(const b of added){const id=b.storeUrl+'|'+b.title;if(!ids.has(id)){existing.unshift(b);ids.add(id);count++}}writeCatalog(existing);return response(res,200,{imported:count,skipped:added.length-count})}
if(req.method==='DELETE'&&url.pathname.startsWith('/api/beats/')){const id=url.pathname.split('/').pop(),list=readCatalog(),next=list.filter(b=>b.id!==id);if(list.length===next.length)return error(res,404,'Not found');writeCatalog(next);return response(res,200,{removed:true})}
if(req.method==='POST'&&url.pathname==='/api/analyze'){const bytes=await readBody(req,MAX_UP);if(!bytes.length)return error(res,400,'Upload a music file');const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hands-beat-key-'));try{const dest=path.join(tmp,'track');fs.writeFileSync(dest,bytes,{mode:0o600});return response(res,200,await analyze(dest))}finally{fs.rmSync(tmp,{recursive:true,force:true})}}
if(req.method==='POST'&&url.pathname==='/api/convert'){const args=JSON.parse((await readBody(req,5000)).toString());if(!args.rights)return error(res,400,'Confirm authorization to download this audio');if(!['mp3','wav'].includes(args.format))return error(res,400,'Choose MP3 or WAV');const audio=await convert(args.url,args.format);res.writeHead(200,{'Content-Type':args.format==='mp3'?'audio/mpeg':'audio/wav','Content-Disposition':'attachment; filename="beat-finder.'+args.format+'"','Content-Length':audio.length,'Cache-Control':'no-store'});return res.end(audio)}
return error(res,404,'Not found')
}catch(e){if(!res.headersSent)return error(res,400,String(e?.message||e).slice(0,230));res.end()}});server.listen(PORT,'127.0.0.1',()=>console.log('Beat Finder listening on http://127.0.0.1:'+PORT));return server}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer();
