import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collections, reminderAt, londonDate} from '../server/calendar.js';
// Independently transcribed from the supplied PDF, including the final month.
const printed = {
 '2026-05':{brown:[2,16,30],green:[4],grey:[11,25],blue:[18]},
 '2026-06':{green:[1,29],grey:[8,22],brown:[13,27],blue:[15]},
 '2026-07':{grey:[6,20],brown:[11,25],blue:[13],green:[27]},
 '2026-08':{grey:[3,17,31],brown:[8,22],blue:[10],green:[24]},
 '2026-09':{brown:[5,19],blue:[7],grey:[14,28],green:[21]},
 '2026-10':{brown:[3,17,31],blue:[5],grey:[12,26],green:[19]},
 '2026-11':{blue:[2,30],grey:[9,23],brown:[14,28],green:[16]},
 '2026-12':{grey:[7,21],brown:[12,26],green:[14],blue:[28]},
 '2027-01':{grey:[4,18],brown:[9,23],green:[11],blue:[25]},
 '2027-02':{grey:[1,15],brown:[6,20],green:[8],blue:[22]},
 '2027-03':{grey:[1,15,29],brown:[6,20],green:[8],blue:[22]},
 '2027-04':{brown:[3,17],green:[5],grey:[12,26],blue:[19]},
 '2027-05':{brown:[1,15,29],green:[3,31],grey:[10,24],blue:[17]},
 '2027-06':{grey:[7,21],brown:[12,26],blue:[14],green:[28]},
 '2027-07':{grey:[5,19],brown:[10,24],blue:[12],green:[26]},
 '2027-08':{grey:[2,16,30],brown:[7,21],blue:[9],green:[23]}
};
test('every date and colour matches all 16 printed calendar months',()=>{
 const expected=Object.entries(printed).flatMap(([month,bins])=>Object.entries(bins).flatMap(([bin,days])=>days.map(d=>({date:`${month}-${String(d).padStart(2,'0')}`,bin})))).sort((a,b)=>a.date.localeCompare(b.date));
 assert.equal(expected.length,collections.length);assert.deepEqual(collections,expected);
});
test('collections stop at the source expiry and have no duplicate bin/date',()=>{
 assert.ok(collections.every(c=>c.date>='2026-05-01'&&c.date<='2027-08-31'));
 assert.equal(new Set(collections.map(c=>c.bin+c.date)).size,collections.length);
 assert.equal(collections.at(-1).date,'2027-08-30');
});
test('24-hour reminders are exactly 24 hours before the UK 7am deadline',()=>{
 assert.equal(reminderAt({date:'2026-11-02'},'exact').toISOString(),'2026-11-01T07:00:00.000Z');
 assert.equal(reminderAt({date:'2026-06-01'},'exact').toISOString(),'2026-05-31T06:00:00.000Z');
 // Synthetic Sunday deadline exercises both clock transitions.
 assert.equal(reminderAt({date:'2027-03-28'},'exact').toISOString(),'2027-03-27T06:00:00.000Z');
 assert.equal(reminderAt({date:'2026-10-25'},'exact').toISOString(),'2026-10-24T07:00:00.000Z');
});
test('custom reminder time stays at local wall time over clock changes',()=>{
 assert.equal(reminderAt({date:'2027-03-29'},'evening','18:00').toISOString(),'2027-03-28T17:00:00.000Z');
 assert.equal(reminderAt({date:'2026-10-26'},'evening','18:00').toISOString(),'2026-10-25T18:00:00.000Z');
});
test('date selection uses London day around UTC midnight',()=>assert.equal(londonDate(new Date('2026-06-01T23:30:00Z')),'2026-06-02'));
