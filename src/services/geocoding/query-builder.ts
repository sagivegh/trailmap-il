import { Trail } from '../../types/trail';

export type QueryLevel =
  | 'street_address'
  | 'named_parking'
  | 'named_trailhead'
  | 'nature_reserve_or_park'
  | 'named_landmark'
  | 'settlement_landmark'
  | 'other_specific';

export interface ExtractedQuery {
  primaryQuery: string;
  normalizedQuery: string;
  strippedPrefixQuery?: string;
  level: QueryLevel;
  sourceField: 'gpsName' | 'parking' | 'startPoint' | 'title';
  originalText: string;
  expectedCityOrRegion?: string;
}

// Strictly forbidden vague regions that MUST NEVER be geocoded as trail coordinates
export const VAGUE_REGIONS = new Set([
  'גליל עליון', 'גליל תחתון', 'גליל מערבי', 'הגליל', 'רמת הגולן', 'הגולן',
  'דרום הגולן', 'מרכז הגולן', 'צפון הגולן', 'הכרמל', 'רכס הכרמל', 'חוף הכרמל',
  'עמק יזרעאל', 'עמק חרוד', 'עמק בית שאן', 'עמק המעיינות', 'עמק הירדן',
  'השפלה', 'שפלת יהודה', 'שפלה דרומית', 'הרי יהודה', 'הרי ירושלים', 'פרוזדור ירושלים',
  'מדבר יהודה', 'צפון מדבר יהודה', 'דרום מדבר יהודה',
  'הנגב', 'הנגב הצפוני', 'צפון הנגב', 'הר הנגב', 'הנגב המערבי', 'מרכז הנגב', 'דרום הנגב',
  'הערבה', 'הערבה התיכונה', 'הערבה הדרומית', 'מישור החוף', 'מישור החוף הדרומי',
  'מישור החוף הצפוני', 'השרון', 'גוש דן', 'צפון', 'דרום', 'מרכז', 'ירושלים וסביבתה',
  'בקעת הירדן', 'השומרון', 'בנימין', 'גוש עציון', 'הרי אילת', 'רמות מנשה'
]);

// Non-location boilerplate phrases in Hebrew trail descriptions
export const NON_LOCATION_TERMS = new Set([
  'ברכב', 'ברגל', 'טיול', 'מסלול מים', 'מסלול הליכה', 'תחילה יש לכתוב:', 'מסלול',
  'לניווט לחץ/י כאן', 'לניווט לחצ/י כאן', 'לניווט מדויק למקום החנייה לחצ/י כאן',
  'לניווט ב-waze', 'נקודת מוצא וסיום', 'מעגלי', 'הלוך חזור', 'הלוך וחזור'
]);

export function cleanLocationText(raw?: string): string {
  if (!raw) return '';
  let s = raw.replace(/\r?\n/g, ' ');
  // Remove boilerplate navigation prefixes & postfixes
  s = s.replace(/לניווט ב-Waze.*/i, '');
  s = s.replace(/לחצ\/י על ניווט.*/i, '');
  s = s.replace(/לניווט מדויק למקום החנייה לחצ\/י כאן.*/g, '');
  s = s.replace(/לניווט לחץ\/י כאן.*/g, '');
  s = s.replace(/לנקודת (?:החנייה וההתחלה|החנייה|המוצא|ההתחלה|הסיום|חנייה)[:：]?\s*/g, '');
  s = s.replace(/\*\*/g, '');
  s = s.replace(/^[-–—|:\s]+/, '');
  s = s.replace(/\|.*$/, '');
  s = s.replace(/[.,;]$/, '');
  s = s.replace(/\s+/g, ' ').trim();

  // If text contains something like "חנייה: ..." take the first line
  if (s.includes('חנייה:') || s.includes('חניה:')) {
    s = s.split(/חנייה:|חניה:/)[1].trim();
  }

  // Filter out non-location text or vague regional names
  if (NON_LOCATION_TERMS.has(s.toLowerCase()) || s.length < 3 || VAGUE_REGIONS.has(s)) {
    return '';
  }
  return s;
}

export function classifyQueryLevel(query: string): QueryLevel {
  // Level 1: Street address
  if (
    /(?:רחוב|שד(?:רות)?|דרך|סמטת)\s+[\u0590-\u05FF]+|\b\d+\s*,\s*[\u0590-\u05FF]+/.test(query) ||
    /,\s*(?:ירושלים|תל אביב|חיפה|באר שבע|פתח תקוה|אודים|ביתר עלית)/.test(query) &&
    /\d/.test(query)
  ) {
    return 'street_address';
  }

  // Level 2: Named parking area
  if (/חניון|חנייה|מגרש חנייה|רחבת עפר|רחבת חניה/.test(query)) {
    return 'named_parking';
  }

  // Level 3: Named trailhead
  if (/שביל|תחילת מסלול|מבואת|גשר|שער/.test(query)) {
    return 'named_trailhead';
  }

  // Level 4: Nature reserve or national park or forest
  if (/גן לאומי|שמורת|שמורה|יער\s+[\u0590-\u05FF]+|פארק\s+[\u0590-\u05FF]+/.test(query)) {
    return 'nature_reserve_or_park';
  }

  // Level 5: Named landmark (springs, streams, mountains, tels, caves, lookouts, ruins)
  if (/עין|מעיין|מעין|בריכת|נחל|הר\s|גבעת|תל\s|מבצר|מצפור|מצפה|בור|מערת|חוף|חורבת|צוק|קניון|מפל/.test(query)) {
    return 'named_landmark';
  }

  // Level 6: Settlement plus landmark
  if (query.includes(',')) {
    return 'settlement_landmark';
  }

  return 'other_specific';
}

export function stripCommonPrefixes(query: string): string {
  let s = query;
  // Remove leading words like "חניון", "חנייה", "רחוב", "שדרות", "שד'"
  s = s.replace(/^(?:חניון|חנייה|מגרש חנייה|רחוב|שדרות|שד'|דרך|סמטת)\s+/g, '');
  return s.trim();
}

/**
 * Constructs the most specific possible geocoding query following the strict hierarchy:
 * 1. Exact street address
 * 2. Named parking area
 * 3. Named trailhead
 * 4. Named nature reserve or park
 * 5. Named landmark (spring, mountain, tel, cave, stream)
 * 6. Settlement plus specific landmark
 *
 * Strict protection: Vague regional names (e.g. "גליל עליון") are completely rejected.
 */
export function buildQueryForTrail(trail: Trail): ExtractedQuery | null {
  // 1. Try GPS name first
  const cleanGps = cleanLocationText(trail.gpsName);
  if (cleanGps) {
    const level = classifyQueryLevel(cleanGps);
    const stripped = stripCommonPrefixes(cleanGps);
    return {
      primaryQuery: cleanGps,
      normalizedQuery: cleanGps.toLowerCase(),
      strippedPrefixQuery: stripped !== cleanGps ? stripped : undefined,
      level,
      sourceField: 'gpsName',
      originalText: trail.gpsName || cleanGps
    };
  }

  // 2. Try parking info
  const cleanParking = cleanLocationText(trail.parking);
  if (cleanParking) {
    const level = classifyQueryLevel(cleanParking);
    const stripped = stripCommonPrefixes(cleanParking);
    return {
      primaryQuery: cleanParking,
      normalizedQuery: cleanParking.toLowerCase(),
      strippedPrefixQuery: stripped !== cleanParking ? stripped : undefined,
      level,
      sourceField: 'parking',
      originalText: trail.parking || cleanParking
    };
  }

  // 3. Try startPoint
  const cleanStart = cleanLocationText(trail.startPoint);
  if (cleanStart) {
    const level = classifyQueryLevel(cleanStart);
    const stripped = stripCommonPrefixes(cleanStart);
    return {
      primaryQuery: cleanStart,
      normalizedQuery: cleanStart.toLowerCase(),
      strippedPrefixQuery: stripped !== cleanStart ? stripped : undefined,
      level,
      sourceField: 'startPoint',
      originalText: trail.startPoint || cleanStart
    };
  }

  // 4. Try extracting landmark from title
  let cleanTitle = trail.title
    .replace(/[:–—].*$/, '')
    .replace(/^אל\s+/, '')
    .replace(/^בין\s+/, '')
    .replace(/^סביב\s+/, '')
    .trim();

  // Remove generic descriptors
  cleanTitle = cleanTitle.replace(/–\s*מסלול טיול.*$/, '').trim();

  if (cleanTitle.length >= 4 && !VAGUE_REGIONS.has(cleanTitle) && !NON_LOCATION_TERMS.has(cleanTitle)) {
    const level = classifyQueryLevel(cleanTitle);
    const stripped = stripCommonPrefixes(cleanTitle);
    return {
      primaryQuery: cleanTitle,
      normalizedQuery: cleanTitle.toLowerCase(),
      strippedPrefixQuery: stripped !== cleanTitle ? stripped : undefined,
      level,
      sourceField: 'title',
      originalText: trail.title
    };
  }

  return null;
}
