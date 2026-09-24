import fs from 'fs';

const trails = JSON.parse(fs.readFileSync('data/trails.json', 'utf8'));

// Inspect the various geographic patterns across unlocated trails
console.log('Total trails:', trails.length);
console.log('Currently unlocated:', trails.filter(t => t.coordinatesMissing).length);

// Extract clues
let withStreetAddress = 0;
let withNamedParking = 0;
let withNamedSpring = 0;
let withNamedReserve = 0;
let withNamedStream = 0;
let withNamedPeakOrHill = 0;
let withNamedJunction = 0;

for (const t of trails.filter(t => t.coordinatesMissing)) {
  const combined = `${t.gpsName || ''} ${t.startPoint || ''} ${t.title} ${t.parking || ''}`;
  
  if (/(?:רחוב|דרך|שד(?:רות)?)\s+[\u0590-\u05FF]+|\b\d+\s*,\s*[\u0590-\u05FF]+/.test(combined)) {
    withStreetAddress++;
  }
  if (/חניון\s+[\u0590-\u05FF]+|מגרש חנייה|רחבת עפר/.test(combined)) {
    withNamedParking++;
  }
  if (/עין\s+[\u0590-\u05FF]+|מעיין\s+[\u0590-\u05FF]+|מעין\s+[\u0590-\u05FF]+|בריכת\s+[\u0590-\u05FF]+/.test(combined)) {
    withNamedSpring++;
  }
  if (/שמורת\s+[\u0590-\u05FF]+|גן לאומי\s+[\u0590-\u05FF]+|יער\s+[\u0590-\u05FF]+/.test(combined)) {
    withNamedReserve++;
  }
  if (/נחל\s+[\u0590-\u05FF]+|ואדי\s+[\u0590-\u05FF]+/.test(combined)) {
    withNamedStream++;
  }
  if (/הר\s+[\u0590-\u05FF]+|גבעת\s+[\u0590-\u05FF]+|מצפה\s+[\u0590-\u05FF]+/.test(combined)) {
    withNamedPeakOrHill++;
  }
  if (/צומת\s+[\u0590-\u05FF]+/.test(combined)) {
    withNamedJunction++;
  }
}

console.log('Clues breakdown in unlocated trails:');
console.log('  • Street addresses / specific street numbers:', withStreetAddress);
console.log('  • Named parking lots / parking areas:', withNamedParking);
console.log('  • Springs / Pools (עין / מעיין / בריכה):', withNamedSpring);
console.log('  • Nature reserves / National Parks / Forests:', withNamedReserve);
console.log('  • Streams / Canyons (נחל / ואדי):', withNamedStream);
console.log('  • Mountains / Hills / Lookouts (הר / גבעה / מצפה):', withNamedPeakOrHill);
console.log('  • Junctions (צומת):', withNamedJunction);
