import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import {BIN_INFO, END} from './calendar.js';
import {deliverDue} from './scheduler.js';
const dataDir = path.resolve(process.env.DATA_DIR || '.data');
fs.mkdirSync(dataDir, {recursive:true,mode:0o700});
const keyFile = path.join(dataDir,'vapid.json');
let keys;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) keys = {publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY};
else if (fs.existsSync(keyFile)) keys=JSON.parse(fs.readFileSync(keyFile,'utf8'));
else { keys=webpush.generateVAPIDKeys(); fs.writeFileSync(keyFile,JSON.stringify(keys),{mode:0o600}); }
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://example.com/eh27-bins', keys.publicKey, keys.privateKey);
const storeFile=path.join(dataDir,'subscriptions.json');
let subscriptions=fs.existsSync(storeFile)?JSON.parse(fs.readFileSync(storeFile,'utf8')):[];
function save() { fs.writeFileSync(storeFile+'.tmp',JSON.stringify(subscriptions),{mode:0o600}); fs.renameSync(storeFile+'.tmp',storeFile); }
const allowedBins=Object.keys(BIN_INFO);
const validPrefs=p=>p && typeof p.eveningCheck==='boolean' && Array.isArray(p.bins) && p.bins.length>0 && p.bins.length<=4 && p.bins.every(b=>allowedBins.includes(b)) && ['exact','evening'].includes(p.mode) && /^((0[7-9])|(1\d)|(2[0-2])):[0-5]\d$/.test(p.time);
function validSubscription(s) {
  if(!s || typeof s.endpoint!=='string' || !s.keys || typeof s.keys.p256dh!=='string' || typeof s.keys.auth!=='string') return false;
  try {
    const u=new URL(s.endpoint);
    // Only known browser push services; never allow arbitrary server-side destinations.
    return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)$/.test(u.hostname) &&
      /^[A-Za-z0-9_-]{80,100}={0,2}$/.test(s.keys.p256dh) && /^[A-Za-z0-9_-]{20,30}={0,2}$/.test(s.keys.auth);
  } catch {return false;}
}
async function send(record, payload) { return webpush.sendNotification(record.subscription, JSON.stringify(payload),{TTL:3600,timeout:10000}); }
let running=false;
export async function tick(now=new Date()) {
  if(running) return; running=true;
  try {
    await deliverDue({records:subscriptions,now,send,persist:save,remove:record=>{subscriptions=subscriptions.filter(r=>r!==record);},onError:error=>console.error('Reminder delivery failed',error.statusCode || 'network error')});
  } finally {running=false;}
}
const limits=new Map();
function json(res,status,data) {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req) {
  let text=''; for await(const chunk of req) {text+=chunk; if(text.length>16384) throw Error('Request too large');} return JSON.parse(text);
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','same-origin');
  if(url.pathname.startsWith('/api/')) {
    if(req.method==='GET' && url.pathname==='/api/config') return json(res,200,{publicKey:keys.publicKey,calendarEnd:END});
    if(req.method==='GET' && url.pathname==='/api/health') return json(res,200,{ok:true,calendarEnd:END});
    if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
    const expected=process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
    if(req.headers.origin!==expected) return json(res,403,{error:'Unrecognised request origin'});
    const ip=req.socket.remoteAddress;
    const limit=limits.get(ip) || {count:0,start:Date.now()};
    if(Date.now()-limit.start>60000) {limit.count=0;limit.start=Date.now();}
    limit.count++; limits.set(ip,limit);
    if(limit.count>30) return json(res,429,{error:'Too many requests. Try again in a minute.'});
    try {
      const data=await body(req);
      if(!validSubscription(data.subscription)) return json(res,400,{error:'Invalid browser push subscription'});
      const endpoint=data.subscription.endpoint;
      // Possession of endpoint alone is insufficient to change another subscription.
      const existing=subscriptions.find(r=>r.subscription.endpoint===endpoint);
      if(existing && (existing.subscription.keys.auth!==data.subscription.keys.auth || existing.subscription.keys.p256dh!==data.subscription.keys.p256dh)) return json(res,403,{error:'Subscription keys do not match'});
      if(url.pathname==='/api/unsubscribe') { subscriptions=subscriptions.filter(r=>r.subscription.endpoint!==endpoint);save();return json(res,200,{ok:true}); }
      if(url.pathname==='/api/test') {
        await send({subscription:data.subscription},{title:'You’re all set • EH27 Bins',body:'This is a test reminder. Your collection alerts will appear here.',tag:'eh27-test'});
        return json(res,200,{ok:true});
      }
      if(url.pathname==='/api/subscribe') {
        if(!validPrefs(data.preferences)) return json(res,400,{error:'Invalid reminder preferences'});
        if(!existing && subscriptions.length>=10000) return json(res,503,{error:'Subscriptions are currently full'});
        if(existing) existing.preferences=data.preferences;
        else subscriptions.push({subscription:data.subscription,preferences:data.preferences,sent:[]});
        save(); return json(res,200,{ok:true});
      }
      return json(res,404,{error:'Not found'});
    } catch(error) {return json(res,400,{error:error.statusCode?'Push service rejected this request. Try enabling reminders again.':'Unable to process request. Please try again.'});}
  }
  if(req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405);return res.end();}
  const root=path.resolve('dist');
  let decoded;
  try {decoded=decodeURIComponent(url.pathname);} catch {res.writeHead(400);return res.end('Invalid path');}
  let file=path.resolve(root,'.'+decoded);
  if(!file.startsWith(root+path.sep) && file!==root) {res.writeHead(403);return res.end();}
  if(!fs.existsSync(file) || fs.statSync(file).isDirectory()) file=path.join(root,'index.html');
  if(!fs.existsSync(file)) {res.writeHead(503);return res.end('Build the app with npm run build first.');}
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.pdf':'application/pdf','.png':'image/png','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control',file.includes('/assets/')?'public, max-age=31536000, immutable':'no-cache');
  if(req.method==='HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('EH27 Bins server listening on port '+(process.env.PORT || 3000)));
const interval=setInterval(()=>tick().catch(()=>console.error('Scheduler failed')),60000);
interval.unref();tick().catch(()=>console.error('Scheduler failed'));
setInterval(()=>{for(const [ip,l] of limits) if(Date.now()-l.start>60000) limits.delete(ip);},60000).unref();
