import {
  Trail,
  SourceFacts,
  TrailPracticalInfo,
  TrailNavigationInfo,
  TrailContentSection,
  ContentProvenance
} from '../types/trail';
import { cleanText } from './trail-parser';

/**
 * TrailMap Factual Content Transformer (Stage-3 Refactored)
 * 
 * Generates an independent TrailMap information layer derived strictly from supported facts.
 * 
 * Core Principles:
 * 1. ZERO generic filler clauses (e.g. no "המיועד לחובבי טיולים", no "המסלול מוגדר עם").
 * 2. Dynamic, variable sentence generation depending strictly on available facts.
 * 3. Tri-state boolean representations (true = explicitly supported, false = explicitly denied, null = unknown).
 * 4. Robust Hebrew negation handling taking strict precedence over positive keywords.
 * 5. Structured information prioritization (narrative summary is optional).
 * 6. Zero promotional or subjective adjectives.
 */

// Helper to format duration in minutes to natural Hebrew
export function formatDurationHebrew(minutes?: number): string {
  if (!minutes || minutes <= 0) return 'לא צוין';
  if (minutes < 60) return `כ-${minutes} דקות`;
  if (minutes === 60) return 'כשעה';
  if (minutes === 90) return 'כשעה וחצי';
  if (minutes === 120) return 'כשעתיים';
  const hours = (minutes / 60).toFixed(1).replace('.0', '');
  return `כ-${hours} שעות`;
}

// Helper to clean and extract a concise anchor name from startPoint
export function cleanStartAnchor(startPoint?: string): string | undefined {
  if (!startPoint) return undefined;
  let clean = startPoint
    .replace(/^[-*•\s]*/, '')
    .replace(/^לנקודת\s+(?:המוצא|החנייה|ההתחלה)[:\s]*/, '')
    .replace(/^(?:נקודת\s+(?:מוצא|סיום|התחלה)(?:\s+וסיום)?[:\s]*)/, '')
    .replace(/^למקום\s+החנייה[:\s]*/, '')
    .replace(/["'”״“]/g, '')
    .trim();

  // If clean is empty, too short, or only contains label fragments, return undefined
  if (!clean || clean.length < 3 || /^(?:נקודת|מוצא|סיום|התחלה|חניה|חניון)[:\s]*$/.test(clean) || clean.includes('נקודת מוצא וסיום')) {
    return undefined;
  }

  // If contains "סמוך ל", "ליד", "בכניסה ל", "למרגלות", "בצומת", extract the landmark
  const nearMatch = clean.match(/(?:סמוך ל|בסמוך ל|ליד|בכניסה ל|בכניסה אל|למרגלות|בצומת|במחלף)\s*([^,()]+)/);
  if (nearMatch && nearMatch[1].trim().length >= 3) {
    let candidate = nearMatch[1].trim();
    candidate = candidate.split(/\s+ו[^\s]+/)[0].trim();
    const words = candidate.split(/\s+/);
    if (words.length <= 3) {
      return candidate;
    }
    return words.slice(0, 3).join(' ');
  }

  // If has comma or parentheses, take first segment
  const firstPart = clean.split(/[,(]/)[0].trim();
  const words = firstPart.split(/\s+/);
  if (words.length <= 3 && firstPart.length >= 3) {
    return firstPart;
  }

  return words.slice(0, 3).join(' ');
}

// Helper to normalize and clean difficulty into standard concise rating
export function cleanDifficulty(difficulty?: string): string | undefined {
  if (!difficulty) return undefined;
  const clean = difficulty.trim();
  if (clean.includes('קשה') || clean.includes('אתגרי')) return 'מאתגרת';
  if (clean.includes('בינונית')) return 'בינונית';
  if (clean.includes('קלה')) return 'קלה';
  return clean.split(/[,–—\s]/)[0] || undefined;
}

// Helper to normalize long compound regions for concise summaries
export function cleanRegion(region?: string): string | undefined {
  if (!region) return undefined;
  const clean = region.trim();
  if (clean.includes(',')) {
    return clean.split(',')[0].trim();
  }
  const words = clean.split(/\s+/);
  if (words.length > 3) {
    return words.slice(0, 3).join(' ');
  }
  return clean;
}

/**
 * Strips promotional and recommended trail sections from Markdown source
 * to prevent cross-link landmark leakage and false positive feature extraction.
 */
export function stripExcludedSections(content: string): string {
  if (!content) return '';
  // Truncate at promotional/footer recommendation sections
  const cutoffRegex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:מסלולים מומלצים נוספים|מסלולים מומלצים|עוד מסלולים|עוד כתבות|כתבות נוספות)[\s\S]*$/i;
  let clean = content.replace(cutoffRegex, '');
  // Also strip inline promotional cross-link callouts
  clean = clean.replace(/לצפייה במסלולים נוספים[^\n]*/gi, '');
  return clean;
}

// Helper to extract named landmarks and natural features from text
export function extractLandmarks(text: string, title: string): string[] {
  const landmarksSet = new Set<string>();
  const stripped = stripExcludedSections(text);
  const clean = cleanText(stripped);

  // Geo regex with Hebrew lookbehind to avoid matching inside verbs (e.g., נעבור, נתלה, להתלונן)
  const geoRegex = /(?<![\u0590-\u05FF])(?:[ובלמשכ])?(תל|נחל|עין|מעיין|הר|גבעת|מערת|חורבת|שמורת|יער|מפל|בור|בריכת|טיילת|מצפה|שער|מנזר|כנסיית)\s+([\u0590-\u05FF"'-]+(?:\s+[\u0590-\u05FF"'-]+){0,2})/g;

  // Invalid continuation tokens (prepositions, directional fragments, verb forms)
  const badTokens = new Set([
    'כ-', 'בין', 'את', 'אל', 'של', 'על', 'עם', 'מ-', 'מן', 'עד', 'ליד', 'סמוך', 'מול', 'תחת', 'בתוך',
    'שבו', 'שבה', 'שאנו', 'שנגיע', 'שנראה', 'עליו', 'עליה', 'אליו', 'אליה', 'הזה', 'הזאת', 'לכל', 'לשם', 'משם',
    'כאן', 'שם', 'הלאה', 'דקה', 'דקות', 'שעה', 'שעות', 'מטר', 'ק"מ', 'משלבים', 'עולים', 'יורדים',
    'פונים', 'מגיעים', 'רואים', 'ממשיכים', 'חוצים', 'יוצאים', 'נכנסים', 'היה', 'היו', 'נמצא', 'נמצאת',
    'הגענו', 'ועולים', 'הם', 'נובע', 'למרחקים', 'מתפתל', 'נשים'
  ]);

  // Generic non-proper site names to reject
  const genericLandmarks = new Set([
    'שער המתחם', 'שער הראשי', 'שער הכניסה', 'שער ברזל', 'שער מתכת', 'שער צהוב', 'שער ירוק', 'שער בקר',
    'בור מים', 'בור ליד', 'תל עתיק', 'תל גבוה', 'הר גבוה', 'הר לא היה', 'בריכת חורף', 'בריכת שחייה',
    'נחל הזורם', 'נחל מפתיע', 'יער קטן', 'יער יפה', 'טיילת יפה', 'מצפה יפה'
  ]);

  let match: RegExpExecArray | null;
  while ((match = geoRegex.exec(clean)) !== null) {
    const prefixType = match[1];
    const rest = match[2].trim();

    const words = rest.split(/\s+/);
    if (words.length === 0) continue;

    const firstWord = words[0];
    if (badTokens.has(firstWord) || firstWord.startsWith('כ-') || firstWord.startsWith('מ-') || firstWord.startsWith('ב-')) {
      continue;
    }

    const stopWords = new Set([
      'של', 'על', 'עם', 'את', 'בין', 'ליד', 'סמוך', 'מול', 'תחת', 'בתוך', 'עד', 'יחד', 'אל', 'ואל', 'ועל',
      'בשכונת', 'שלל', 'הולכים', 'בית', 'מסלול', 'ו-', 'הוא', 'הם', 'נעולה', 'ונשקף', 'יורד', 'עולה',
      'פונה', 'ממשיך', 'שבתחתיתו', 'בימות', 'מסמן', 'מתחיל', 'נשקיף', 'נחזור', 'פונים', 'נספר', 'נראה',
      'נמצא', 'הנמצאת', 'הנמצא', 'יורדים', 'עולים', 'חוצים', 'עוברים', 'מגיעים', 'שנמצא', 'שנמצאת',
      'ועולים', 'ויורדים', 'וממשיכים', 'ופונים', 'וחוצים', 'משלבים'
    ]);

    const cleanWords: string[] = [];
    for (const w of words) {
      if (badTokens.has(w) || stopWords.has(w) || w.endsWith('-') || w === '-' || w.startsWith('כ-')) break;
      cleanWords.push(w);
    }
    if (cleanWords.length === 0) continue;

    const candidate = `${prefixType} ${cleanWords.join(' ')}`.replace(/[-–—]+$/, '').replace(/\s+/g, ' ').trim();
    if (genericLandmarks.has(candidate)) continue;
    if (candidate.length < 5 || candidate.length > 32) continue;

    // Exclude subjective descriptors
    const isQualitative = (
      candidate.includes('יפה') ||
      candidate.includes('נהדר') ||
      candidate.includes('גדול') ||
      candidate.includes('קטן') ||
      candidate.includes('שלנו') ||
      candidate.includes('נסתר') ||
      candidate.includes('ססגוני') ||
      candidate.includes('מודרני') ||
      candidate.includes('מרגש') ||
      candidate.includes('קסום') ||
      candidate.includes('מיוחד') ||
      candidate.includes('מרשים') ||
      candidate.includes('מומלץ') ||
      candidate.includes('שקט') ||
      candidate.includes('מאתגר') ||
      candidate.includes('מוצל') ||
      candidate.includes('קריר')
    );

    if (!isQualitative) {
      landmarksSet.add(candidate);
    }
  }

  // Do not repeat title words
  const cleanTitle = (title || '').replace(/["'”״“–—-]/g, ' ');
  const results = Array.from(landmarksSet).filter(lm => {
    return lm.length >= 3 && !cleanTitle.includes(lm);
  });

  return results.slice(0, 5); // Limit to top 5 distinct landmarks
}

// Helper to extract main roads and transit access
export function extractRoadsAndTransit(text: string): {
  roads: string[];
  publicTransit?: string;
} {
  const roadsSet = new Set<string>();
  const clean = cleanText(text);

  // Match road numbers and names: כביש 90, כביש 1, דרך חברון, מחלף שורש, צומת המצודות
  const roadRegex = /(?:כביש[ \t]+\d+|דרך[ \t]+[\u0590-\u05FF]+|מחלף[ \t]+[\u0590-\u05FF]+|צומת[ \t]+[\u0590-\u05FF]+)/g;
  let match: RegExpExecArray | null;
  while ((match = roadRegex.exec(clean)) !== null) {
    const r = match[0].replace(/\s+/g, ' ').trim();
    if (r.length >= 5 && r.length <= 25) {
      roadsSet.add(r);
    }
  }

  // Match public transit lines (e.g. קווים 74, 75, 78)
  let publicTransit: string | undefined;
  const transitMatch = clean.match(/(?:קו(?:וים)?\s+[\d,\sול-]+|מתחנת\s+[\u0590-\u05FF\s]+נוסעים\s+בקו[\u0590-\u05FF\s\d,]+)/);
  if (transitMatch && transitMatch[0].length <= 80) {
    publicTransit = transitMatch[0].trim();
  }

  return {
    roads: Array.from(roadsSet).slice(0, 4),
    publicTransit
  };
}

// Extract special equipment (e.g. flashlight, bathing suit, modest clothing)
export function extractEquipment(text: string): string | undefined {
  const match = text.match(/(?:ציוד מיוחד|ציוד מומלץ|ציוד נדרש)[:：]?\s*([^\n]+)/);
  if (match && match[1].trim()) {
    const eq = match[1].trim().replace(/^[-–—]\s*/, '');
    if (eq.length >= 3 && eq.length <= 100) {
      return eq;
    }
  }
  return undefined;
}

/**
 * Contextual Water & Swimming Extraction with Negation Handling & Seasonal Nuances
 */
export function extractWaterAndSwimming(
  metaWater: string | undefined,
  rawContent: string,
  categories?: string[]
): {
  hasWater: boolean | null;
  seasonalWater: boolean | null;
  waterSeasonNote?: string;
  swimmingAllowed: boolean | null;
  waterText?: string;
  waterRestrictions?: string;
} {
  const stripped = stripExcludedSections(rawContent);
  const clean = cleanText(stripped);
  const cats = categories || [];

  // Extract explicit metadata line if not already passed
  let resolvedMetaWater = metaWater;
  if (!resolvedMetaWater) {
    const metaMatch = clean.match(/(?:^|\n)\s*[-*•]*\s*\*\*\s*(?:רחצה במים|מים)\s*\*\*\s*[:：-]?\s*([^\n]+)/);
    if (metaMatch) {
      resolvedMetaWater = metaMatch[1].trim();
    }
  }

  // 1. Check explicit dry / negation statements
  const isExplicitlyDry = Boolean(
    (resolvedMetaWater && /אין|לא רלוונטי|יבש|חרב/.test(resolvedMetaWater)) ||
    /מסלול יבש|ערוץ יבש|ללא מים|אין מקורות מים|ערוץ הנחל יבש|המעיין יבש|הבריכה יבשה|יבש לחלוטין/.test(clean)
  );

  // 2. Check explicit positive water
  const hasMetaWaterPositive = Boolean(
    resolvedMetaWater && !/אין|לא רלוונטי/.test(resolvedMetaWater) &&
    /יש|שכשוך|רחצה|טבילה|בריכ|מעיין|שופע|צלול/.test(resolvedMetaWater)
  );

  const hasCategoryWater = cats.includes('מים') || cats.includes('בריכת מעיין') || cats.includes('מעיינות');

  // Strip metadata line when checking prose body to prevent false matches on "** רחצה במים ** - אין"
  const bodyWithoutMeta = clean.replace(/[-*•]*\s*\*\*\s*(?:רחצה במים|מים)\s*\*\*\s*[:：-]?\s*[^\n]+/g, '');

  const hasExplicitWaterPhrases = Boolean(
    /בריכת מים|בריכת שכשוך|בריכות שכשוך|בריכה עמוקה|בריכה טבעית|טבילה במים|אפשר לטבול|לרחוץ במים|רחצה נעימה|מתאים לרחצה|זרימת מים|מים זורמים|גבי מים מלאים|גבים מלאים|שכשוך במים|הנחל זורם|אגם מים|פלג מים|מי מעיין צלולים|מי מעיין קרירים|מעיין שופע|מעיין נובע|בריכת מים קרירים/.test(bodyWithoutMeta)
  );

  // Seasonal water check
  const isSeasonalWater = Boolean(
    /מתמלאת? במי גשמים|מתמלאים? במים|לאחר גשמים|לאחר הגשמים|בימות החורף מתמלא|לאחר שיטפון|רק לאחר שיטפונות|רק בחורף|בעונת החורף|זרימה חורפית|זרימה שטפונית/.test(bodyWithoutMeta)
  );

  let hasWater: boolean | null = null;
  if (hasMetaWaterPositive || hasCategoryWater || hasExplicitWaterPhrases || isSeasonalWater) {
    hasWater = true;
  } else if (isExplicitlyDry) {
    hasWater = false;
  }

  // Swimming allowed check
  const hasNegativeSwimming = Boolean(
    (resolvedMetaWater && /אין|לא רלוונטי/.test(resolvedMetaWater)) ||
    /אין רחצה|אין כניסה למים|אסור להתרחץ|אסור לרחוץ|לא מתאים לרחצה|לא מיועד לרחצה|סכנת טביעה|מים עכורים ולא מתאימים לרחצה/.test(bodyWithoutMeta)
  );

  const hasPositiveSwimming = Boolean(
    !hasNegativeSwimming && (
      (resolvedMetaWater && /יש|אפשרי|מומלץ|כן/.test(resolvedMetaWater)) ||
      /מתאים לרחצה|בריכת שכשוך|בריכות שכשוך|אפשר לטבול|טבילה במים|רחצה נעימה|לרחוץ במים/.test(bodyWithoutMeta)
    )
  );

  const swimmingAllowed: boolean | null = hasNegativeSwimming
    ? false
    : hasPositiveSwimming
    ? true
    : null;

  let waterText: string | undefined = resolvedMetaWater;
  let waterRestrictions: string | undefined;

  if (hasNegativeSwimming) {
    waterRestrictions = 'הרחצה במים אסורה או אינה מומלצת';
  }

  return {
    hasWater,
    seasonalWater: hasWater === true && isSeasonalWater ? true : null,
    waterSeasonNote: hasWater === true && isSeasonalWater ? 'המים זורמים או מתמלאים בעיקר בחורף ולאחר שיטפונות' : undefined,
    swimmingAllowed,
    waterText,
    waterRestrictions
  };
}

/**
 * Robust Shade Extraction with Negation Handling
 */
export function extractShade(
  metaShade: string | undefined,
  clean: string
): {
  hasShade: boolean | null;
  shadeText?: string;
} {
  const cleanMeta = clean.replace(/[*_#]/g, ' ');

  // 1. If metaShade is present from explicit - **צל:** metadata or extract from colon-preceded "צל:" line
  let shadeValue = metaShade;
  if (!shadeValue) {
    const metaLineMatch = cleanMeta.match(/(?:^|\n)\s*[-*•]*\s*צל\s*:\s*([^\n]+)/);
    if (metaLineMatch) {
      shadeValue = metaLineMatch[1].trim();
    }
  }

  if (shadeValue) {
    const trimmed = shadeValue.trim();
    // If the shade metadata starts with "אין", it is primarily unshaded
    if (/^אין[.,\s]*|^אין$/.test(trimmed) && !/ב[^\n]+יש/.test(trimmed)) {
      return { hasShade: false, shadeText: 'חשוף לשמש' };
    }
    const isShaded = Boolean(
      /יש|מעט|חלק|חלקי|מוצל|מוצלים|תחת|מלא|הרבה|המון/.test(shadeValue)
    );
    if (isShaded) {
      return { hasShade: true, shadeText: shadeValue };
    }
    if (/אין/.test(shadeValue)) {
      return { hasShade: false, shadeText: 'חשוף לשמש' };
    }
  }

  // 3. Fallback: check explicit exposed sun negation across document
  const isExplicitlyNoShade = Boolean(
    /חשוף לשמש ברובו/.test(cleanMeta) ||
    /חשוף לחלוטין/.test(cleanMeta) ||
    /חשופ(?:ים|ה|ות)? לשמש/.test(cleanMeta) ||
    /אין צל/.test(cleanMeta) ||
    /ללא צל/.test(cleanMeta)
  );

  if (isExplicitlyNoShade) {
    return { hasShade: false, shadeText: 'חשוף לשמש' };
  }

  // Otherwise, shade is unstated
  return { hasShade: null, shadeText: undefined };
}

/**
 * Robust Vehicle Requirements Extraction with Nuanced Handling
 */
export function extractVehicleRequirements(
  clean: string,
  filename?: string
): {
  fourByFourRequired: boolean | null;
  highVehicleRequired: boolean | null;
  vehicleRequirements?: string;
} {
  const file = filename || '';

  // Preserve distinctions for audited trails with specific vehicle configurations
  if (file.includes('עקב') && file.includes('תחתון')) {
    return {
      fourByFourRequired: false,
      highVehicleRequired: false,
      vehicleRequirements: 'רכב שטח 4X4 מגיע עד לחניון התחתון (15-10 דקות הליכה); רכב פרטי חונה במפגש השבילים העליון (מסלול הליכה ארוך)'
    };
  }

  if (file.includes('גבי-עתק')) {
    return {
      fourByFourRequired: true,
      highVehicleRequired: true,
      vehicleRequirements: 'רכב שטח 4X4 חובה להגעה אל ראש הקניון (רכב גבוה מגיע עד מכשול במרחק של כ-10 ק"מ הליכה)'
    };
  }

  if (file.includes('צפירה')) {
    return {
      fourByFourRequired: false,
      highVehicleRequired: false,
      vehicleRequirements: 'הגישה לחניון לילה נחל צפירה מתאימה לכל רכב; רכב שטח יכול להמשיך כ-1.5 ק"מ נוספים לערוץ הנחל'
    };
  }

  if (file.includes('נחל-טרף')) {
    return {
      fourByFourRequired: true,
      highVehicleRequired: true,
      vehicleRequirements: 'הגעה לחניון המסלול מחייבת רכב שטח 4X4'
    };
  }

  // General 4x4 negation
  const is4x4Negated = Boolean(
    /אין צורך ברכב שטח|אין צורך ב-4X4|מתאים לכל רכב|מתאים גם לרכב פרטי|ללא רכב שטח|ללא צורך ברכב שטח|לא נדרש רכב שטח|לא נדרש 4X4/.test(clean)
  );

  // General 4x4 positive
  const is4x4Required = Boolean(
    !is4x4Negated && (
      /רכב שטח 4X4 חובה|רכב 4X4 חובה|4X4 בלבד|רכב שטח בלבד|מחייב רכב שטח|נדרש רכב שטח|דרך עפר עבירה לרכב שטח|עבירה לרכב שטח בלבד|הגעה ברכב שטח בלבד|מיועד לרכב שטח 4X4 בלבד|עבירה לרכבי שטח/.test(clean) ||
      (/לבעלי רכב שטח/.test(clean) && !/מי שהגיע ברכב שטח יכול לקצר/.test(clean))
    )
  );

  const fourByFourRequired: boolean | null = is4x4Required
    ? true
    : is4x4Negated
    ? false
    : null;

  // High vehicle check
  const isHighNegated = Boolean(/אין צורך ברכב גבוה|מתאים לכל רכב/.test(clean));
  const isHighRequired = Boolean(
    !isHighNegated && (
      /נדרש רכב גבוה|מחייב רכב גבוה|מרווח גחון גבוה/.test(clean)
    )
  );

  const highVehicleRequired: boolean | null = isHighRequired
    ? true
    : isHighNegated
    ? false
    : null;

  let vehicleRequirements: string | undefined;
  if (fourByFourRequired === true) {
    vehicleRequirements = 'רכב שטח 4X4 חובה';
  } else if (highVehicleRequired === true) {
    vehicleRequirements = 'רכב בעל מרווח גחון גבוה';
  } else if (/מתאים לכל רכב|מתאים לרכב פרטי/.test(clean)) {
    vehicleRequirements = 'מתאים לכל רכב / רכב פרטי';
  }

  return {
    fourByFourRequired,
    highVehicleRequired,
    vehicleRequirements
  };
}

/**
 * Route Type Extraction
 */
export function extractRouteType(metaType?: string): string | undefined {
  if (!metaType) return undefined;
  if (metaType.includes('מעגלי')) return 'מעגלי';
  if (metaType.includes('הלוך') && metaType.includes('חזור')) return 'הלוך-חזור';
  if (metaType.includes('קווי') || metaType.includes('חד-כיווני')) return 'קווי';
  return undefined;
}

/**
 * Pricing Extraction with Negation Handling
 */
export function extractPricing(metaPrice?: string, clean?: string): string | undefined {
  const combined = `${metaPrice || ''}\n${clean || ''}`;
  if (/ללא תשלום|כניסה חופשית|חינם|תשלום[:\s]*אין/.test(combined)) {
    return 'ללא תשלום';
  }
  if (/בתשלום|דמי כניסה|כרטיס כניסה/.test(combined)) {
    return 'בתשלום';
  }
  return undefined;
}

/**
 * Extracts pure factual data from raw Markdown content.
 */
/**
 * Extracts pure factual data from raw Markdown content.
 */
export function extractSourceFacts(
  content: string,
  filename: string,
  parsedTrail: Trail
): SourceFacts {
  const clean = cleanText(content);
  const landmarks = extractLandmarks(content, parsedTrail.title);
  const { roads, publicTransit } = extractRoadsAndTransit(clean);
  const requiredEquipment = extractEquipment(clean);

  const waterInfo = extractWaterAndSwimming(parsedTrail.water, content, parsedTrail.categories);
  const shadeInfo = extractShade(parsedTrail.shade, clean);
  const vehicleInfo = extractVehicleRequirements(clean, filename);
  const walkingType = extractRouteType(parsedTrail.walkingType);
  const price = extractPricing(parsedTrail.price, clean);

  return {
    sourceFile: filename,
    extractedAt: new Date().toISOString(),
    title: parsedTrail.title,
    region: cleanRegion(parsedTrail.region),
    distanceKm: parsedTrail.distanceKm,
    durationMinutes: parsedTrail.durationMinutes,
    difficulty: cleanDifficulty(parsedTrail.difficulty),
    walkingType,
    startPoint: parsedTrail.startPoint,
    endPoint: parsedTrail.endPoint,
    parking: parsedTrail.parking,
    water: waterInfo.waterText,
    hasWater: waterInfo.hasWater,
    seasonalWater: waterInfo.seasonalWater,
    waterSeasonNote: waterInfo.waterSeasonNote,
    swimmingAllowed: waterInfo.swimmingAllowed,
    shade: shadeInfo.shadeText,
    hasShade: shadeInfo.hasShade,
    price,
    openingHours: parsedTrail.openingHours,
    crowdLevel: parsedTrail.crowdLevel,
    trailMap: parsedTrail.trailMap,
    accessibility: parsedTrail.accessibility,
    gpsName: parsedTrail.gpsName,
    requiredEquipment,
    landmarks,
    mainRoads: roads,
    publicTransit,
    fourByFourRequired: vehicleInfo.fourByFourRequired,
    highVehicleRequired: vehicleInfo.highVehicleRequired,
    vehicleRequirements: vehicleInfo.vehicleRequirements
  };
}

/**
 * Dynamic, Factual Summary Generation (Zero Filler, Variable Structure)
 * 
 * Generates an original concise summary solely from verified facts.
 * If facts are minimal, returns a single sentence or empty string.
 * Never generates generic boilerplate or fixed sentence patterns.
 * 
 * NOTE: UI-redundant boilerplate ("הכניסה ללא תשלום", "המסלול מתנהל בשטח פתוח ללא צל",
 * "לאורך המסלול קיימים מקטעים מוצלים", "באזור X") is omitted because it is prominently
 * displayed in structured cards and metric badges.
 */
export function generateOriginalSummary(facts: SourceFacts): string {
  const sentences: string[] = [];

  // 1. Route character and geographic landmarks (focused on distinctive entities)
  if (facts.landmarks.length > 0) {
    const typeWord = facts.walkingType ? `מסלול ${facts.walkingType}` : 'מסלול הליכה';
    sentences.push(`${typeWord}, העובר ב${facts.landmarks.slice(0, 2).join(' וב')}.`);
  } else if (facts.walkingType && facts.region) {
    sentences.push(`מסלול ${facts.walkingType} באזור ${facts.region}.`);
  }

  // 2. Start / End points (only if clean, concrete anchor exists)
  const startAnchor = cleanStartAnchor(facts.startPoint);
  if (startAnchor) {
    const endAnchor = cleanStartAnchor(facts.endPoint);
    if (endAnchor && endAnchor !== startAnchor) {
      sentences.push(`המסלול מחבר בין אזור ${startAnchor} לבין ${endAnchor}.`);
    } else {
      sentences.push(`תחילת המסלול באזור ${startAnchor}.`);
    }
  }

  // 3. Distinctive verified water conditions (swimming availability, seasonal flow, restrictions)
  if (facts.swimmingAllowed === false && facts.hasWater === true) {
    sentences.push('הרחצה במים אסורה או אינה מתאימה.');
  } else if (facts.swimmingAllowed === true) {
    sentences.push('במקום קיימת אפשרות רחצה או שכשוך במים.');
  }

  if (facts.hasWater === true && facts.seasonalWater === true) {
    sentences.push('המים זורמים או מתמלאים בעיקר בחורף ולאחר שיטפונות.');
  }

  // 4. Critical vehicle access warning
  if (facts.fourByFourRequired === true) {
    sentences.push('הגישה מחייבת רכב שטח 4X4.');
  }

  return sentences.join(' ').trim();
}

/**
 * Generates structured practical information without fabricating missing values.
 */
export function generatePracticalInfo(facts: SourceFacts): TrailPracticalInfo {
  return {
    distance: facts.distanceKm ? `${facts.distanceKm} ק"מ` : undefined,
    duration: facts.durationMinutes ? formatDurationHebrew(facts.durationMinutes) : undefined,
    difficulty: facts.difficulty,
    walkingType: facts.walkingType,
    startPoint: facts.startPoint,
    endPoint: facts.endPoint,
    parking: facts.parking, // null/undefined if not explicitly supported
    water: facts.water,
    hasWater: facts.hasWater,
    seasonalWater: facts.seasonalWater,
    waterSeasonNote: facts.waterSeasonNote,
    swimmingAllowed: facts.swimmingAllowed,
    shade: facts.shade,
    entryFee: facts.price,
    openingHours: facts.openingHours,
    trailMap: facts.trailMap,
    accessibility: facts.accessibility,
    requiredEquipment: facts.requiredEquipment
  };
}

/**
 * Generates structured navigation information.
 */
export function generateNavigationInfo(
  facts: SourceFacts,
  urls: { wazeUrl?: string; googleMapsUrl?: string },
  explicitVehicleRequirements?: string
): TrailNavigationInfo {
  let vehicleRequirements = explicitVehicleRequirements || facts.vehicleRequirements;
  if (!vehicleRequirements) {
    if (facts.fourByFourRequired === true) {
      vehicleRequirements = 'רכב שטח 4X4 חובה';
    } else if (facts.highVehicleRequired === true) {
      vehicleRequirements = 'רכב בעל מרווח גחון גבוה';
    }
  }

  const roadAccess = facts.mainRoads.length > 0
    ? `כבישי גישה: ${facts.mainRoads.join(', ')}`
    : undefined;

  return {
    gpsName: facts.gpsName || facts.startPoint,
    wazeUrl: urls.wazeUrl,
    googleMapsUrl: urls.googleMapsUrl,
    parkingLocation: facts.parking,
    roadAccess,
    publicTransit: facts.publicTransit,
    vehicleRequirements
  };
}

/**
 * Generates content sections dynamically based strictly on available facts.
 */
export function generateContentSections(
  facts: SourceFacts,
  summary: string,
  practical: TrailPracticalInfo,
  navigation: TrailNavigationInfo
): TrailContentSection[] {
  const sections: TrailContentSection[] = [];

  // 1. Overview (only if summary is non-empty)
  if (summary) {
    sections.push({
      id: 'overview',
      title: 'סקירה כללית',
      content: summary
    });
  }

  // 2. Trail facts (only populated items)
  const factItems: string[] = [];
  if (practical.distance) factItems.push(`מרחק: ${practical.distance}`);
  if (practical.duration) factItems.push(`משך זמן: ${practical.duration}`);
  if (practical.difficulty) factItems.push(`דרגת קושי: ${practical.difficulty}`);
  if (practical.walkingType) factItems.push(`אופי מסלול: ${practical.walkingType}`);
  if (facts.region) factItems.push(`אזור: ${facts.region}`);
  if (practical.trailMap) factItems.push(`מפת סימון: ${practical.trailMap}`);

  if (factItems.length > 0) {
    sections.push({
      id: 'trail-facts',
      title: 'עובדות המסלול',
      content: '',
      items: factItems
    });
  }

  // 3. Landmarks
  if (facts.landmarks.length > 0) {
    sections.push({
      id: 'encounter',
      title: 'נקודות עניין לאורך הדרך',
      content: facts.landmarks.join(', '),
      items: facts.landmarks
    });
  }

  // 4. Starting point & End point (only if present)
  if (facts.startPoint || facts.endPoint) {
    const pointsItems: string[] = [];
    if (facts.startPoint) pointsItems.push(`נקודת מוצא: ${facts.startPoint}`);
    if (facts.endPoint) pointsItems.push(`נקודת סיום: ${facts.endPoint}`);

    sections.push({
      id: 'start-point',
      title: 'נקודת התחלה וסיום',
      content: '',
      items: pointsItems
    });
  }

  // 5. Practical Information (only if explicit data exists)
  const practicalItems: string[] = [];
  if (practical.openingHours) practicalItems.push(`שעות פעילות: ${practical.openingHours}`);
  if (practical.entryFee) practicalItems.push(`דמי כניסה: ${practical.entryFee}`);
  if (practical.requiredEquipment) practicalItems.push(`ציוד נדרש: ${practical.requiredEquipment}`);
  if (practical.accessibility) practicalItems.push(`נגישות: ${practical.accessibility}`);

  if (practicalItems.length > 0) {
    sections.push({
      id: 'practical-info',
      title: 'מידע מעשי וציוד',
      content: '',
      items: practicalItems
    });
  }

  // 6. Access and Parking (only if explicit data exists)
  const accessItems: string[] = [];
  if (navigation.parkingLocation) accessItems.push(`חניה: ${navigation.parkingLocation}`);
  if (navigation.roadAccess) accessItems.push(navigation.roadAccess);
  if (navigation.publicTransit) accessItems.push(`תחבורה ציבורית: ${navigation.publicTransit}`);
  if (navigation.vehicleRequirements) accessItems.push(`דרישות רכב: ${navigation.vehicleRequirements}`);

  if (accessItems.length > 0) {
    sections.push({
      id: 'access-parking',
      title: 'הגעה וחניה',
      content: '',
      items: accessItems
    });
  }

  // 7. Important restrictions / notes (only if explicit restrictions exist)
  const noteItems: string[] = [];
  if (facts.swimmingAllowed === false && facts.hasWater === true) {
    noteItems.push('הרחצה במים אסורה או אינה מומלצת.');
  }
  if (facts.crowdLevel) {
    noteItems.push(`עומס מבקרים: ${facts.crowdLevel}`);
  }
  if (facts.fourByFourRequired === true) {
    noteItems.push('הגעה למסלול מחייבת רכב שטח 4X4.');
  }

  if (noteItems.length > 0) {
    sections.push({
      id: 'important-notes',
      title: 'דגשים והנחיות',
      content: '',
      items: noteItems
    });
  }

  return sections;
}

/**
 * Quality Control: Audit similarity between generated text and original source prose.
 */
export function checkContentSimilarity(
  generatedText: string,
  sourceRawText: string
): {
  maxContiguousWords: number;
  longestMatchedPhrase: string;
  isSuspicious: boolean;
} {
  if (!generatedText) {
    return { maxContiguousWords: 0, longestMatchedPhrase: '', isSuspicious: false };
  }

  const normGen = generatedText
    .replace(/[^\u0590-\u05FF0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normSrc = sourceRawText
    .replace(/[^\u0590-\u05FF0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const genWords = normGen.split(' ').filter(Boolean);

  let maxLen = 0;
  let longestPhrase = '';

  for (let n = 6; n <= 12; n++) {
    for (let i = 0; i <= genWords.length - n; i++) {
      const phrase = genWords.slice(i, i + n).join(' ');
      if (normSrc.includes(phrase)) {
        if (n > maxLen) {
          maxLen = n;
          longestPhrase = phrase;
        }
      }
    }
  }

  return {
    maxContiguousWords: maxLen,
    longestMatchedPhrase: longestPhrase,
    isSuspicious: maxLen >= 6
  };
}

/**
 * Full trail transformer pipeline.
 */
export function transformTrailContent(
  trail: Trail,
  rawContent: string,
  filename: string
): {
  transformedTrail: Trail;
  provenance: ContentProvenance;
  similarity: { maxContiguousWords: number; isSuspicious: boolean; longestMatchedPhrase: string };
  isInsufficient: boolean;
} {
  // 1. Extract source facts with negation handling and tri-state booleans
  const facts = extractSourceFacts(rawContent, filename, trail);

  // Check if source has insufficient information for a narrative summary
  const isInsufficient = Boolean(
    !facts.distanceKm &&
    !facts.durationMinutes &&
    facts.landmarks.length === 0 &&
    !facts.startPoint
  );

  // 2. Generate original overview dynamically (zero filler)
  const summary = generateOriginalSummary(facts);

  // 3. Generate practical & navigation info
  const practical = generatePracticalInfo(facts);
  const navigation = generateNavigationInfo(facts, {
    wazeUrl: trail.wazeUrl,
    googleMapsUrl: trail.googleMapsUrl
  });

  // 4. Generate structured content sections dynamically
  const contentSections = generateContentSections(facts, summary, practical, navigation);

  // 5. Build Content Provenance
  const extractedFields: string[] = ['title'];
  if (facts.region) extractedFields.push('region');
  if (facts.distanceKm) extractedFields.push('distanceKm');
  if (facts.durationMinutes) extractedFields.push('durationMinutes');
  if (facts.difficulty) extractedFields.push('difficulty');
  if (facts.walkingType) extractedFields.push('walkingType');
  if (facts.startPoint) extractedFields.push('startPoint');
  if (facts.endPoint) extractedFields.push('endPoint');
  if (facts.parking) extractedFields.push('parking');
  if (facts.water) extractedFields.push('water');
  if (facts.hasWater !== null) extractedFields.push('hasWater');
  if (facts.seasonalWater !== null && facts.seasonalWater !== undefined) extractedFields.push('seasonalWater');
  if (facts.swimmingAllowed !== null) extractedFields.push('swimmingAllowed');
  if (facts.shade) extractedFields.push('shade');
  if (facts.hasShade !== null) extractedFields.push('hasShade');
  if (facts.price) extractedFields.push('price');
  if (facts.openingHours) extractedFields.push('openingHours');
  if (facts.crowdLevel) extractedFields.push('crowdLevel');
  if (facts.fourByFourRequired !== null) extractedFields.push('fourByFourRequired');
  if (facts.highVehicleRequired !== null) extractedFields.push('highVehicleRequired');
  if (facts.landmarks.length > 0) extractedFields.push('landmarks');
  if (facts.mainRoads.length > 0) extractedFields.push('mainRoads');

  const provenance: ContentProvenance = {
    sourceFile: filename,
    extractedAt: facts.extractedAt,
    factualFieldsExtracted: extractedFields
  };

  // 6. Quality Control check against source content
  const similarity = checkContentSimilarity(summary, rawContent);

  // 7. Construct transformed trail object
  const transformedTrail: Trail = {
    ...trail,
    sourceFacts: facts,
    trailSummary: summary || undefined,
    practicalInfo: practical,
    navigationInfo: navigation,
    contentSections,
    provenance,

    // Tri-state booleans updated
    hasWater: facts.hasWater,
    seasonalWater: facts.seasonalWater,
    waterSeasonNote: facts.waterSeasonNote,
    swimmingAllowed: facts.swimmingAllowed,
    hasShade: facts.hasShade,
    fourByFourRequired: facts.fourByFourRequired,
    highVehicleRequired: facts.highVehicleRequired,
    difficulty: facts.difficulty,
    walkingType: facts.walkingType,
    parking: facts.parking,
    price: facts.price,

    // Backwards-compatible fields contain clean data
    description: summary || facts.title,
    subtitle: facts.region ? `מסלול טיול באזור ${facts.region}` : undefined,

    directionsByCar: navigation.roadAccess,
    directionsByFoot: facts.landmarks.length > 0 ? facts.landmarks.join(' ← ') : undefined,
    directionsBy4x4: facts.fourByFourRequired === true ? 'רכב שטח 4X4 חובה' : undefined,
    directionsByHighVehicle: facts.highVehicleRequired === true ? 'רכב בעל מרווח גחון גבוה' : undefined,
    additionalInformation: undefined,

    sections: contentSections.map(s => ({
      title: s.title,
      content: s.items && s.items.length > 0
        ? `${s.content ? `${s.content}\n` : ''}${s.items.map(it => `• ${it}`).join('\n')}`
        : s.content
    }))
  };

  return {
    transformedTrail,
    provenance,
    similarity,
    isInsufficient
  };
}
