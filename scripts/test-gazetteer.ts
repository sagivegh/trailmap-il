import fs from 'fs';
import { ISRAEL_GAZETTEER, lookupGazetteer } from '../src/services/geocoding/gazetteer';
import { buildQueryForTrail } from '../src/services/geocoding/query-builder';
import { Trail } from '../src/types/trail';

const trails: Trail[] = JSON.parse(fs.readFileSync('data/trails.json', 'utf8'));
console.log('Total trails:', trails.length);
console.log('Total gazetteer entries:', Object.keys(ISRAEL_GAZETTEER).length);

let matched = 0;
let verified = 0;
let probable = 0;
const unmatchedQueries: Record<string, number> = {};

for (const t of trails) {
  if (t.locationSource === 'markdown_coordinates') {
    verified++;
    matched++;
    continue;
  }
  const q = buildQueryForTrail(t);
  if (q) {
    const entry = lookupGazetteer(q.primaryQuery) || (q.strippedPrefixQuery ? lookupGazetteer(q.strippedPrefixQuery) : null);
    if (entry) {
      matched++;
      if (entry.status === 'verified') verified++;
      else probable++;
    } else {
      unmatchedQueries[q.primaryQuery] = (unmatchedQueries[q.primaryQuery] || 0) + 1;
    }
  }
}

console.log(`Matched so far: ${matched} (Verified: ${verified}, Probable: ${probable})`);
console.log(`Remaining unlocated: ${trails.length - matched}`);

const sortedUnmatched = Object.entries(unmatchedQueries).sort((a,b) => b[1] - a[1]);
console.log('\nTop 100 unmatched queries:');
sortedUnmatched.slice(0, 100).forEach(([q, c], i) => {
  console.log(`${i+1}. ${q} (${c})`);
});
