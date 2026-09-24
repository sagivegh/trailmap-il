import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { Trail } from '../src/types/trail';
import {
  transformTrailContent,
  checkContentSimilarity,
  extractLandmarks,
  cleanStartAnchor,
  cleanDifficulty,
  cleanRegion
} from '../src/parser/content-transformer';

describe('TrailMap Content Transformation & Copyright Compliance', () => {
  const dataDir = path.resolve(__dirname, '../data');
  const trailsPath = path.join(dataDir, 'trails.json');
  const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));

  it('1. All 1,783 trails have structured factual data and original summaries', () => {
    expect(trails.length).toBe(1783);

    for (const trail of trails) {
      expect(trail.sourceFacts).toBeDefined();
      expect(trail.sourceFacts?.sourceFile).toBe(trail.sourceFile);
      expect(typeof trail.trailSummary).toBe('string');
      expect(trail.trailSummary.length).toBeGreaterThan(15);
      expect(trail.practicalInfo).toBeDefined();
      expect(trail.navigationInfo).toBeDefined();
      expect(Array.isArray(trail.contentSections)).toBe(true);
      expect(trail.contentSections!.length).toBeGreaterThan(0);
      expect(trail.provenance).toBeDefined();
      expect(trail.provenance?.sourceFile).toBe(trail.sourceFile);
    }
  });

  it('2. Zero forbidden authorial or promotional markers exist in trail descriptions', () => {
    const forbidden = [
      'מסיירים עם',
      'ערן גל-אור',
      '050-4000026',
      'סדרת ספרים',
      'ארץ אהבתי',
      'לצפייה במסלולים נוספים',
      'חוות דעת'
    ];

    for (const trail of trails) {
      const text = `${trail.trailSummary} ${trail.description}`;
      for (const phrase of forbidden) {
        expect(text).not.toContain(phrase);
      }
    }
  });

  it('3. Content similarity check confirms zero suspicious phrase overlap across all trails', () => {
    const reportPath = path.join(dataDir, 'content-audit-report.json');
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    expect(report.totalAudited).toBe(1783);
    expect(report.flaggedDescriptions).toBe(0);
    expect(report.authorMarkersFound).toBe(0);
    expect(report.cleanDescriptions).toBe(1783);
  });

  it('4. Coordinate data integrity is 100% preserved during transformation', () => {
    const verified = trails.filter(t => t.locationStatus === 'verified').length;
    const probable = trails.filter(t => t.locationStatus === 'probable').length;
    const missing = trails.filter(t => t.locationStatus === 'missing').length;
    const totalMapped = verified + probable;

    expect(verified).toBe(591);
    expect(probable).toBe(298);
    expect(missing).toBe(894);
    expect(totalMapped).toBe(889);
  });

  it('5. Helper functions extract clean atomic facts without sentence copying', () => {
    // cleanStartAnchor
    const rawStart = 'רחבת עפר לצד כביש 85, סמוך לצומת כפר חנניה';
    const cleanAnchor = cleanStartAnchor(rawStart);
    expect(cleanAnchor).toBe('צומת כפר חנניה');

    // cleanDifficulty
    const rawDiff = 'קלה, הכניסה לניקבת המעיין מאתגרת';
    expect(cleanDifficulty(rawDiff)).toBe('קלה');

    // cleanRegion
    const rawRegion = 'רמת הגולן, אצבע הגליל והגליל העליון';
    expect(cleanRegion(rawRegion)).toBe('רמת הגולן');
  });

  it('6. Water extraction adheres to tri-state semantics and seasonal water nuances', () => {
    const waterTrueTrails = trails.filter(t => t.hasWater === true);
    const waterFalseTrails = trails.filter(t => t.hasWater === false);
    const waterNullTrails = trails.filter(t => t.hasWater === null || t.hasWater === undefined);
    const seasonalWaterTrails = trails.filter(t => t.seasonalWater === true);

    // hasWater is no longer universally true
    expect(waterTrueTrails.length).toBeGreaterThan(500);
    expect(waterTrueTrails.length).toBeLessThan(1400);
    expect(waterFalseTrails.length).toBeGreaterThan(500);
    expect(seasonalWaterTrails.length).toBeGreaterThan(50);

    // Dry trail examples
    const drySample = trails.find(t => t.sourceFile.includes('אבל-בית-מעכה-חצבים'));
    expect(drySample).toBeDefined();
    expect(drySample?.hasWater).toBe(false);

    // Seasonal water example
    const seasonalSample = trails.find(t => t.sourceFile.includes('גבי-עתק'));
    expect(seasonalSample).toBeDefined();
    expect(seasonalSample?.hasWater).toBe(true);
    expect(seasonalSample?.seasonalWater).toBe(true);
  });

  it('7. Vehicle requirements safely handle unknown access and preserve specific 4x4 distinctions', () => {
    // Dangerous fallback must never exist in dataset or UI logic
    for (const trail of trails) {
      if (trail.navigationInfo?.vehicleRequirements) {
        expect(trail.navigationInfo.vehicleRequirements).not.toBe('מתאים לרכב פרטי סטנדרטי');
      }
    }

    // Specific trail distinction tests
    const atek = trails.find(t => t.sourceFile.includes('גבי-עתק'));
    expect(atek).toBeDefined();
    expect(atek?.fourByFourRequired).toBe(true);
    expect(atek?.navigationInfo?.vehicleRequirements).toContain('4X4');

    const tzfira = trails.find(t => t.sourceFile.includes('צפירה'));
    expect(tzfira).toBeDefined();
    expect(tzfira?.navigationInfo?.vehicleRequirements).toContain('לכל רכב');

    const akav = trails.find(t => t.sourceFile.includes('עקב') && t.sourceFile.includes('תחתון'));
    expect(akav).toBeDefined();
    expect(akav?.navigationInfo?.vehicleRequirements).toContain('חניון');
  });

  it('8. Landmark extraction eliminates grammatical fragments and promotional cross-link leakage', () => {
    const badFragments = ['בור כ-', 'בור בין', 'בור את', 'תל אל מכתש', 'בור של', 'תל כ-', 'ועולים', 'משלבים'];

    for (const trail of trails) {
      const lms = trail.sourceFacts?.landmarks || [];
      for (const lm of lms) {
        expect(lm).not.toBe('תל אל');
        for (const bad of badFragments) {
          expect(lm).not.toContain(bad);
        }
      }

      // Check cross-link leakage into urban Jerusalem trails
      if (trail.region === 'ירושלים') {
        expect(lms).not.toContain('שמורת פורה');
      }
    }
  });

  it('9. Narrative summaries exclude boilerplate repetition', () => {
    const forbiddenBoilerplate = [
      'הכניסה ללא תשלום.',
      'לאורך המסלול קיימים מקטעים מוצלים.',
      'המסלול מתנהל בשטח פתוח ללא צל.'
    ];

    for (const trail of trails) {
      const summary = trail.trailSummary || '';
      for (const phrase of forbiddenBoilerplate) {
        expect(summary).not.toContain(phrase);
      }
    }
  });
});
