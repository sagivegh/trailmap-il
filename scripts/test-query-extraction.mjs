import fs from 'fs';

const trails = JSON.parse(fs.readFileSync('data/trails.json', 'utf8'));

export function cleanGpsQuery(raw) {
  if (!raw) return '';
  let q = raw.replace(/\r?\n/g, ' ');
  // remove waze / gmaps boilerplate
  q = q.replace(/לניווט ב-Waze.*/i, '');
  q = q.replace(/לחצ\/י על ניווט.*/i, '');
  q = q.replace(/לנקודת (?:החנייה וההתחלה|החנייה|המוצא|ההתחלה|הסיום|חנייה)[:：]?\s*/g, '');
  q = q.replace(/\*\*/g, '');
  q = q.replace(/^[-–—|:\s]+/, '');
  q = q.replace(/\|.*$/, '');
  q = q.replace(/[.,;]$/, '');
  q = q.replace(/\s+/g, ' ').trim();
  // Filter out non-location text like 'ברכב' or 'ברגל'
  if (q === 'ברכב' || q === 'ברגל' || q.length < 3) return '';
  return q;
}

const cleanedQueries = [];
for (const t of trails.filter(t => t.coordinatesMissing)) {
  const q = cleanGpsQuery(t.gpsName);
  if (q) {
    cleanedQueries.push({ id: t.id, title: t.title, raw: t.gpsName, cleaned: q, region: t.region });
  }
}

console.log('Total unlocated trails with extractable clean GPS query:', cleanedQueries.length);
console.log('\nSample 30 Cleaned GPS queries:');
cleanedQueries.slice(0, 30).forEach((c, idx) => {
  console.log(`${idx + 1}. [${c.cleaned}]`);
});
