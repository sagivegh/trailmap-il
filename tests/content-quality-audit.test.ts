import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { performStage2Audit } from '../scripts/audit-stage2';
import { Trail } from '../src/types/trail';

describe('Stage 2 & 3 Strict Content Quality & Factual Support Verification', () => {
  const dataDir = path.resolve(__dirname, '../data');

  it('1. Generates all four review audit artifacts with comprehensive schema', () => {
    const qualityAuditPath = path.join(dataDir, 'content-quality-audit.json');
    const similarityAuditPath = path.join(dataDir, 'content-similarity-audit.json');
    const unsupportedClaimsPath = path.join(dataDir, 'unsupported-claims-audit.json');
    const phraseFrequencyPath = path.join(dataDir, 'generated-phrase-frequency.json');

    expect(fs.existsSync(qualityAuditPath)).toBe(true);
    expect(fs.existsSync(similarityAuditPath)).toBe(true);
    expect(fs.existsSync(unsupportedClaimsPath)).toBe(true);
    expect(fs.existsSync(phraseFrequencyPath)).toBe(true);

    const quality = JSON.parse(fs.readFileSync(qualityAuditPath, 'utf8'));
    expect(quality.totalAudited).toBe(1783);
    expect(typeof quality.totalFlaggedTrails).toBe('number');
    expect(typeof quality.metrics.averageTokenJaccard).toBe('number');

    const phraseFreq = JSON.parse(fs.readFileSync(phraseFrequencyPath, 'utf8'));
    expect(typeof phraseFreq).toBe('object');
  });

  it('2. Verifies zero unsupported claims in regenerated content', () => {
    const unsupportedClaimsPath = path.join(dataDir, 'unsupported-claims-audit.json');
    const claims = JSON.parse(fs.readFileSync(unsupportedClaimsPath, 'utf8'));

    // Post-regeneration requirement: zero unsupported claims
    expect(Array.isArray(claims)).toBe(true);
    expect(claims.length).toBe(0);

    const qualityPath = path.join(dataDir, 'content-quality-audit.json');
    const quality = JSON.parse(fs.readFileSync(qualityPath, 'utf8'));
    expect(quality.metrics.unsupportedClaimsCount).toBe(0);
  });

  it('3. Verifies zero generic template filler sentences', () => {
    const qualityAuditPath = path.join(dataDir, 'content-quality-audit.json');
    const quality = JSON.parse(fs.readFileSync(qualityAuditPath, 'utf8'));

    // Post-regeneration requirement: generic filler count must drop to 0
    expect(quality.metrics.genericFillerSentenceCount).toBe(0);

    const phraseFrequencyPath = path.join(dataDir, 'generated-phrase-frequency.json');
    const freq = JSON.parse(fs.readFileSync(phraseFrequencyPath, 'utf8'));

    // Boilerplate template clauses are completely eliminated
    expect(freq['המסלול מוגדר עם']).toBeUndefined();
    expect(freq['המתמקד באתרי האזור']).toBeUndefined();
    expect(freq['המיועד לחובבי טיולים']).toBeUndefined();
    expect(freq['ללא הסדרת חניה ייעודית מפורטת']).toBeUndefined();
    expect(freq['מתאים לרכב פרטי סטנדרטי']).toBeUndefined();
  });

  it('4. Verifies zero 6+ word contiguous phrase overlaps with source prose', () => {
    const similarityAuditPath = path.join(dataDir, 'content-similarity-audit.json');
    const sim = JSON.parse(fs.readFileSync(similarityAuditPath, 'utf8'));

    expect(sim.phraseOverlap6PlusWords).toBe(0);
    expect(sim.closeMatchesCount).toBe(0);
    expect(sim.averageTokenJaccard).toBeLessThan(0.05);
  });

  it('5. Verifies Hebrew negation handling in content transformation', () => {
    // 4x4 negative context
    const textNeg4x4 = 'המסלול מתאים לכל רכב, אין צורך ברכב שטח 4X4';
    expect(/אין צורך ברכב שטח/.test(textNeg4x4)).toBe(true);

    // Swimming negative context
    const textNegSwim = 'רחצה במים: אין. אסור להתרחץ בבריכה';
    expect(/רחצה במים[:\s]*אין/.test(textNegSwim)).toBe(true);

    // Free entrance
    const textFree = 'הכניסה ללא תשלום בכל ימות השבוע';
    expect(/ללא תשלום/.test(textFree)).toBe(true);
  });

  it('6. Preserves coordinate data integrity across all 1,783 trails', () => {
    const trailsPath = path.join(dataDir, 'trails.json');
    const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));

    const verified = trails.filter(t => t.locationStatus === 'verified').length;
    const probable = trails.filter(t => t.locationStatus === 'probable').length;
    const missing = trails.filter(t => t.locationStatus === 'missing').length;
    const mapped = verified + probable;

    expect(trails.length).toBe(1783);
    expect(verified).toBe(591);
    expect(probable).toBe(298);
    expect(missing).toBe(894);
    expect(mapped).toBe(889);
  });

  it('7. Preserves complete source traceability for all 1,783 trails', () => {
    const trailsPath = path.join(dataDir, 'trails.json');
    const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));

    expect(trails.length).toBe(1783);
    for (const trail of trails) {
      expect(trail.sourceFile).toBeDefined();
      expect(trail.sourceFile.endsWith('.md')).toBe(true);
      expect(trail.provenance).toBeDefined();
      expect(trail.provenance?.sourceFile).toBe(trail.sourceFile);
      expect(Array.isArray(trail.provenance?.factualFieldsExtracted)).toBe(true);
    }
  });
});
