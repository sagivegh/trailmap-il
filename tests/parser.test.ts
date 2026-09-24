import { describe, it, expect } from 'vitest';
import {
  parseTrailMarkdown,
  parseDistanceKm,
  parseDurationMinutes,
  decodeHtmlEntities
} from '../src/parser/trail-parser';

describe('Trail Parser & Markdown Audit Tests', () => {

  it('1. Parsing of title & HTML entities decoding', () => {
    const markdown = `# שביל ישראל &#8211; קטע 15 מנחל דישון לעין כובס
# שביל ישראל – קטע 15 מנחל דישון לעין כובס

מסלול יפהפה בגליל העליון
`;
    const trail = parseTrailMarkdown(markdown, 'shvil-israel-15.md');
    expect(trail.title).toBe('שביל ישראל – קטע 15 מנחל דישון לעין כובס');
    expect(trail.id).toBe('shvil-israel-15');
    expect(trail.slug).toBe('shvil-israel-15');
  });

  it('2. Parsing of lists, categories, and key metadata fields', () => {
    const markdown = `# נחל אל על
מים
תצפיות
פריחה

מסלול מים מרהיב בדרום רמת הגולן בין המפל השחור למפל הלבן.

## חשוב לדעת
- **נקודת מוצא וסיום:** חניון נחל אל על באבני איתן
- **אזור בארץ:** רמת הגולן
- **דרגת קושי:** בינונית
- **אורך המסלול:** כ-5 קילומטר
- **משך הטיול:** 4-3 שעות
- **רחצה במים:** יש, במפל השחור ובמפל הלבן
- **צל:** יש, תחת עצי אלון ותאנה
- **עומס:** עמוס בשבתות ובחגים
`;
    const trail = parseTrailMarkdown(markdown, 'nahal-el-al.md');

    expect(trail.categories).toContain('מים');
    expect(trail.categories).toContain('תצפיות');
    expect(trail.categories).toContain('פריחה');
    expect(trail.region).toBe('רמת הגולן');
    expect(trail.difficulty).toBe('בינונית');
    expect(trail.startPoint).toBe('חניון נחל אל על באבני איתן');
    expect(trail.distanceKm).toBe(5);
    expect(trail.durationMinutes).toBe(210);
    expect(trail.hasWater).toBe(true);
    expect(trail.hasShade).toBe(true);
    expect(trail.crowdLevel).toBe('עמוס בשבתות ובחגים');
  });

  it('3. Parsing of external navigation links when present', () => {
    const markdown = `# מעיין עין כובס
מעיין צלול ליד צפת

נווט עם waze: https://ul.waze.com/ul?ll=32.965,35.495&navigate=yes
Google Maps: https://www.google.com/maps?q=32.965,35.495
`;
    const trail = parseTrailMarkdown(markdown, 'ein-koves.md');

    expect(trail.wazeUrl).toBe('https://ul.waze.com/ul?ll=32.965,35.495&navigate=yes');
    expect(trail.googleMapsUrl).toBe('https://www.google.com/maps?q=32.965,35.495');
  });

  it('4. Parsing of text-only buttons safely without inventing links or coordinates', () => {
    const markdown = `# סיור בירושלים
נווט עם waze
Google Maps
`;
    const trail = parseTrailMarkdown(markdown, 'jerusalem-tour.md');

    expect(trail.wazeUrl).toBeUndefined();
    expect(trail.googleMapsUrl).toBeUndefined();
    expect(trail.coordinatesMissing).toBe(true);
    expect(trail.locationStatus).toBe('missing');
    expect(trail.locationType).toBe('missing');
    expect(trail.locationConfidence).toBe(0);
  });

  it('5. Trail with missing fields handled gracefully without crashing', () => {
    const markdown = `# מסלול ללא מידע
טקסט קצרצר בלבד ללא שדות מובנים.
`;
    const trail = parseTrailMarkdown(markdown, 'sparse-trail.md');

    expect(trail.title).toBe('מסלול ללא מידע');
    expect(trail.description).toBeDefined();
    expect(trail.region).toBeUndefined();
    expect(trail.distanceKm).toBeUndefined();
    expect(trail.durationMinutes).toBeUndefined();
    expect(trail.difficulty).toBeUndefined();
    expect(trail.coordinatesMissing).toBe(true);
    expect(trail.locationStatus).toBe('missing');
    expect(trail.sections.length).toBeGreaterThanOrEqual(1);
  });

  it('6. Markdown file with unexpected / malformed structure', () => {
    const markdown = `
### תת כותרת מוזרה ללא כותרת ראשית
סתם טקסט בלי מבנה מקובל.
- פריט רשימה לא מזוהה
`;
    const trail = parseTrailMarkdown(markdown, 'malformed-structure.md');

    expect(trail.title).toBe('malformed structure');
    expect(trail.coordinatesMissing).toBe(true);
    expect(trail.locationStatus).toBe('missing');
    expect(trail.sections.length).toBeGreaterThan(0);
  });

  it('7. Numeric parsing of diverse distance and duration formats', () => {
    expect(parseDistanceKm('כ-400 מטר')).toBe(0.4);
    expect(parseDistanceKm('5-4.5 קילומטר')).toBe(4.8);
    expect(parseDistanceKm('כ-3 קילומטר')).toBe(3);
    expect(parseDistanceKm(undefined)).toBeUndefined();

    expect(parseDurationMinutes('כשעה')).toBe(60);
    expect(parseDurationMinutes('כשעתיים')).toBe(120);
    expect(parseDurationMinutes('כחצי שעה')).toBe(30);
    expect(parseDurationMinutes('30-45 דקות')).toBe(38);
    expect(parseDurationMinutes('4-3 שעות')).toBe(210);
    expect(parseDurationMinutes(undefined)).toBeUndefined();
  });
});
