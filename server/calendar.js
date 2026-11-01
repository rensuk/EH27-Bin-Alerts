// Verified against calendar 34 – MONHASAT22026. No holiday overrides.
export const START = '2026-05-01';
export const END = '2027-08-31';
export const BIN_INFO = {
  blue: { name: 'Blue', label: 'Paper & cardboard', items: ['Newspapers and magazines', 'Envelopes and junk mail', 'Cardboard boxes and egg cartons', 'Kitchen and toilet roll tubes'], note: 'Keep everything clean, empty and dry. No plastic bags.' },
  green: { name: 'Green', label: 'Plastics, cans & cartons', items: ['Clean plastic bottles, pots, tubs and trays', 'Empty tins and drinks cans', 'Clean foil and empty aerosols', 'Food and drink cartons', 'Empty plastic carrier, bread and vegetable bags'], note: 'Keep everything clean, empty and dry. Do not bag your recycling.' },
  grey: { name: 'Grey', label: 'Non-recyclable waste', items: ['Nappies and used tissues', 'Crisp packets', 'Greasy pizza boxes', 'Polystyrene and toothpaste tubes'], note: 'Only use this bin for waste that cannot be recycled.' },
  brown: { name: 'Brown', label: 'Food & garden waste', items: ['Fruit and vegetable peelings', 'Meat, fish and bones', 'Tea bags and coffee grounds', 'Bread, dairy and leftovers', 'Garden waste only with a valid permit'], note: 'Food waste goes in loose or in a biodegradable liner. No plastic bags.' }
};
function series(first, interval, bin) {
  const date = new Date(first + 'T12:00:00Z'); const result = [];
  while (date.toISOString().slice(0, 10) <= END) {
    result.push({ date: date.toISOString().slice(0, 10), bin });
    date.setUTCDate(date.getUTCDate() + interval);
  }
  return result;
}
export const collections = [
  ...series('2026-05-02', 14, 'brown'), ...series('2026-05-04', 28, 'green'),
  ...series('2026-05-11', 14, 'grey'), ...series('2026-05-18', 28, 'blue')
].sort((a,b) => a.date.localeCompare(b.date));
export function londonDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/London', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
// Convert local wall time using Intl zone rules, including the BST/GMT boundary.
export function londonTime(date, time) {
  const nominal = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(nominal);
  const hours = Number(parts.find(p=>p.type==='hour').value);
  const minutes = Number(parts.find(p=>p.type==='minute').value);
  const localMinutes = hours * 60 + minutes;
  const utcMinutes = nominal.getUTCHours()*60 + nominal.getUTCMinutes();
  let offset = localMinutes - utcMinutes;
  if(offset < -720) offset += 1440;
  if(offset > 720) offset -= 1440;
  return new Date(nominal.getTime() - offset*60000);
}
export function reminderAt(collection, mode='exact', time='18:00') {
  const deadline = londonTime(collection.date, '07:00');
  if (mode === 'exact') return new Date(deadline.getTime() - 24*3600000);
  const previous = new Date(collection.date+'T12:00:00Z'); previous.setUTCDate(previous.getUTCDate()-1);
  return londonTime(previous.toISOString().slice(0,10), time);
}
