import {collections, BIN_INFO, reminderAt} from './calendar.js';
export async function deliverDue({records, now=new Date(), send, persist, remove, onError=()=>{}}) {
  for (const record of [...records]) {
    let expired=false;
    for (const c of collections.filter(c=>record.preferences.bins.includes(c.bin))) {
      const key=`${c.date}:${c.bin}`;
      const jobs=[{key,due:reminderAt(c,record.preferences.mode,record.preferences.time),payload:{title:`${BIN_INFO[c.bin].name} bin collection tomorrow`,body:`Put your ${c.bin} bin at the kerbside by 7am on ${new Date(c.date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/London'})}.`,tag:key}}];
      if(record.preferences.eveningCheck) jobs.push({key:key+':check',due:reminderAt(c,'evening','19:00'),payload:{title:'Your 7pm bin check',body:`Have you kept the ${c.bin} bin outside? Collection is tomorrow. Please have it at the kerbside by 7am.`,tag:key+':check'}});
      for (const job of jobs) {
        if(record.sent.includes(job.key) || job.due>now || now-job.due>15*60000) continue;
        try {await send(record,job.payload);record.sent.push(job.key);persist();}
        catch(error){
          if([404,410].includes(error.statusCode)){remove(record);persist();expired=true;break;}
          onError(error);
        }
      }
      if(expired) break;
    }
  }
}
