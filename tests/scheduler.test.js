import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverDue} from '../server/scheduler.js';
function record(bins=['blue']) {return {subscription:{},preferences:{bins,mode:'exact',time:'18:00'},sent:[]};}
test('scheduler sends selected bin once and persists successful delivery',async()=>{
 const r=record();let sent=[],saved=0;
 const options={records:[r],now:new Date('2026-11-01T07:01:00Z'),send:async(_,p)=>sent.push(p),persist:()=>saved++,remove:()=>{}};
 await deliverDue(options);await deliverDue(options);
 assert.equal(sent.length,1);assert.equal(saved,1);assert.match(sent[0].body,/blue bin.*Monday 2 November/);assert.deepEqual(r.sent,['2026-11-02:blue']);
});
test('scheduler does not send early, old or unselected reminders',async()=>{
 let calls=0;const base={records:[record(['grey'])],send:async()=>calls++,persist:()=>{},remove:()=>{}};
 await deliverDue({...base,now:new Date('2026-11-01T07:01:00Z')});
 await deliverDue({...base,records:[record()],now:new Date('2026-11-01T06:59:00Z')});
 await deliverDue({...base,records:[record()],now:new Date('2026-11-01T07:16:00Z')});
 assert.equal(calls,0);
});
test('temporary push failure remains eligible for retry',async()=>{
 const r=record();let errors=0;
 await deliverDue({records:[r],now:new Date('2026-11-01T07:01:00Z'),send:async()=>{throw {statusCode:503};},persist:()=>assert.fail('must not mark sent'),remove:()=>assert.fail('must not remove'),onError:()=>errors++});
 assert.equal(errors,1);assert.deepEqual(r.sent,[]);
});
test('expired browser subscription is removed',async()=>{
 const r=record();let removed=false,saved=false;
 await deliverDue({records:[r],now:new Date('2026-11-01T07:01:00Z'),send:async()=>{throw {statusCode:410};},persist:()=>saved=true,remove:sub=>{assert.equal(sub,r);removed=true;}});
 assert.ok(removed&&saved);
});

test('additional 7pm check picks the collection colour and sends once',async()=>{
 const r=record();r.preferences.eveningCheck=true;let payloads=[];
 const options={records:[r],now:new Date('2026-11-01T19:01:00Z'),send:async(_,p)=>payloads.push(p),persist:()=>{},remove:()=>{}};
 await deliverDue(options);await deliverDue(options);
 assert.equal(payloads.length,1);assert.match(payloads[0].body,/Have you kept the blue bin outside\?/);assert.deepEqual(r.sent,['2026-11-02:blue:check']);
});
test('7pm check uses BST and can be disabled independently',async()=>{
 const r=record(['brown']);r.preferences.eveningCheck=true;let calls=0;
 const options={records:[r],now:new Date('2026-07-10T18:01:00Z'),send:async()=>calls++,persist:()=>{},remove:()=>{}};
 await deliverDue(options);assert.equal(calls,1);
 r.sent=[];r.preferences.eveningCheck=false;await deliverDue(options);assert.equal(calls,1);
});
