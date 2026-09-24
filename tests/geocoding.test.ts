import { describe, it, expect } from 'vitest';
import { buildQueryForTrail, cleanLocationText, classifyQueryLevel } from '../src/services/geocoding/query-builder';
import { lookupGazetteer } from '../src/services/geocoding/gazetteer';
import { Trail } from '../src/types/trail';

describe('Geocoding & Query Construction Hierarchy', () => {
  it('should clean boilerplate waze text and extract named parking accurately', () => {
    const raw = 'לנקודת החנייה וההתחלה: **חניון שער ציון, ירושלים | **לניווט ב-Waze לנקודת החנייה';
    const cleaned = cleanLocationText(raw);
    expect(cleaned).toBe('חניון שער ציון, ירושלים');
    expect(classifyQueryLevel(cleaned)).toBe('named_parking');
  });

  it('should strictly reject vague regional names alone', () => {
    expect(cleanLocationText('גליל עליון')).toBe('');
    expect(cleanLocationText('הכרמל')).toBe('');
    expect(cleanLocationText('רמת הגולן')).toBe('');
    expect(cleanLocationText('מדבר יהודה')).toBe('');
    expect(cleanLocationText('הנגב')).toBe('');
  });

  it('should reject non-location generic terms', () => {
    expect(cleanLocationText('ברכב')).toBe('');
    expect(cleanLocationText('ברגל')).toBe('');
    expect(cleanLocationText('מסלול מים')).toBe('');
    expect(cleanLocationText('לניווט לחץ/י כאן')).toBe('');
  });

  it('should prefer street address over parking over landmark in hierarchy', () => {
    const trail: Trail = {
      id: 'test-1',
      slug: 'test-1',
      title: 'אל עין כפירה',
      description: 'טיול',
      categories: ['מעיין'],
      gpsName: 'רחוב המעיין, ירושלים',
      parking: 'חניון ממילא',
      coordinatesMissing: true,
      locationStatus: 'missing',
      locationType: 'missing',
      locationConfidence: 0,
      sections: [],
      images: [],
      sourceFile: 'test.md'
    };

    const q = buildQueryForTrail(trail);
    expect(q).not.toBeNull();
    expect(q?.primaryQuery).toBe('רחוב המעיין, ירושלים');
    expect(q?.level).toBe('street_address');
  });

  it('should lookup gazetteer with verified status for exact street address and parking', () => {
    const street = lookupGazetteer('רחוב שבטי ישראל, ירושלים');
    expect(street).not.toBeNull();
    expect(street?.status).toBe('verified');
    expect(street?.type).toBe('start');
    expect(street?.confidence).toBeGreaterThanOrEqual(0.90);
    expect(street?.reason).toBe('Exact street address found in source');

    const parking = lookupGazetteer('חניון ממילא, ירושלים');
    expect(parking).not.toBeNull();
    expect(parking?.status).toBe('verified');
    expect(parking?.type).toBe('start');
    expect(parking?.reason).toBe('Named parking lot matched');
  });

  it('should classify natural springs and mountain summits as probable with reason', () => {
    const spring = lookupGazetteer('עין עוזי');
    expect(spring).not.toBeNull();
    expect(spring?.status).toBe('probable');
    expect(spring?.type).toBe('poi');
    expect(spring?.reason).toBe('Named spring / natural pool matched');

    const peak = lookupGazetteer('הר מונטר');
    expect(peak).not.toBeNull();
    expect(peak?.status).toBe('probable');
    expect(peak?.type).toBe('poi');
    expect(peak?.reason).toBe('Named mountain / summit matched');
  });

  it('should ensure all gazetteer coordinates are within Israel bounding box', () => {
    const entries = [
      lookupGazetteer('גן לאומי תל דור'),
      lookupGazetteer('חניון שער ציון, ירושלים'),
      lookupGazetteer('חניון השיטים'),
      lookupGazetteer('הר החרמון'),
      lookupGazetteer('פארק תמנע')
    ];

    entries.forEach(e => {
      expect(e).not.toBeNull();
      expect(e!.lat).toBeGreaterThanOrEqual(29.4);
      expect(e!.lat).toBeLessThanOrEqual(33.4);
      expect(e!.lng).toBeGreaterThanOrEqual(34.2);
      expect(e!.lng).toBeLessThanOrEqual(35.9);
    });
  });
});
