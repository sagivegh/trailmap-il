import { Trail, TrailSection, TrailImage } from '../types/trail';

// Helper to decode HTML entities
export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Clean and normalize text
export function cleanText(str: string): string {
  return decodeHtmlEntities(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

// Parse numeric distance in km from Hebrew string (e.g. "5-4.5 קילומטר", "כ-400 מטר", "כ-2.8 קילומטר")
export function parseDistanceKm(text?: string): number | undefined {
  if (!text) return undefined;
  const clean = text.replace(/,/g, '.');
  
  // Meter match (e.g. "400 מטר", "כ-200 מ'")
  const meterMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:מטר|מ'|מ\b)/);
  if (meterMatch) {
    const val = parseFloat(meterMatch[1]);
    if (!isNaN(val)) return Number((val / 1000).toFixed(2));
  }
  
  // Kilometer range match (e.g. "5-4.5 קילומטר" or "2-3 ק"מ")
  const rangeMatch = clean.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:קילומטר|ק"מ|קמ)/);
  if (rangeMatch) {
    const v1 = parseFloat(rangeMatch[1]);
    const v2 = parseFloat(rangeMatch[2]);
    if (!isNaN(v1) && !isNaN(v2)) {
      return Number(((v1 + v2) / 2).toFixed(1));
    }
  }

  // Single km match
  const kmMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:קילומטר|ק"מ|קמ)/);
  if (kmMatch) {
    const val = parseFloat(kmMatch[1]);
    if (!isNaN(val)) return val;
  }

  // Any number if word indicates km
  const anyNum = clean.match(/(\d+(?:\.\d+)?)/);
  if (anyNum && (clean.includes('קילומטר') || clean.includes('ק"מ'))) {
    const val = parseFloat(anyNum[1]);
    if (!isNaN(val)) return val;
  }

  return undefined;
}

// Parse numeric duration in minutes from Hebrew string (e.g. "5-4 שעות", "30-45 דקות", "כשעה", "כשעתיים", "יום שלם")
export function parseDurationMinutes(text?: string): number | undefined {
  if (!text) return undefined;
  const clean = text.trim();

  if (clean.includes('כשעתיים') || clean.includes('שעתיים')) return 120;
  if (clean.includes('כשעה וחצי') || clean.includes('שעה וחצי')) return 90;
  if (clean.includes('כשעה') || clean.includes('שעה אחת') || clean.includes('עד שעה')) return 60;
  if (clean.includes('כחצי שעה') || clean.includes('חצי שעה')) return 30;

  // Minutes range: "30-45 דקות"
  const minRange = clean.match(/(\d+)\s*[-–—]\s*(\d+)\s*דק/);
  if (minRange) {
    const m1 = parseInt(minRange[1], 10);
    const m2 = parseInt(minRange[2], 10);
    return Math.round((m1 + m2) / 2);
  }

  // Minutes single: "45 דקות"
  const minSingle = clean.match(/(\d+)\s*דק/);
  if (minSingle) {
    return parseInt(minSingle[1], 10);
  }

  // Hours range: "5-4 שעות" or "2-3 שעות"
  const hoursRange = clean.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*שע/);
  if (hoursRange) {
    const h1 = parseFloat(hoursRange[1]);
    const h2 = parseFloat(hoursRange[2]);
    return Math.round(((h1 + h2) / 2) * 60);
  }

  // Hours single: "3 שעות"
  const hoursSingle = clean.match(/(\d+(?:\.\d+)?)\s*שע/);
  if (hoursSingle) {
    return Math.round(parseFloat(hoursSingle[1]) * 60);
  }

  return undefined;
}

// Helper to extract clean key-value from a line
function extractKeyValue(line: string): { key: string; value: string } | null {
  const m = line.match(/^[-*]?\s*\*\*([^*:：]+)[:：]?\*\*\s*[:：]?\s*(.*)$/);
  if (m) {
    return {
      key: m[1].replace(/\s+/g, ' ').trim(),
      value: m[2].replace(/^[-–—:]\s*/, '').trim()
    };
  }
  return null;
}

// Main parser function
export function parseTrailMarkdown(content: string, filename: string): Trail {
  const rawText = cleanText(content);
  const lines = rawText.split('\n');

  const id = filename.replace(/\.md$/i, '');
  const slug = id;

  let title = '';
  let subtitle = '';
  let description = '';
  const categoriesSet = new Set<string>();
  const sections: TrailSection[] = [];
  const images: TrailImage[] = [];

  // Metadata accumulator
  const meta: Record<string, string> = {};

  // Extract sections first
  let currentSectionTitle = 'מבוא';
  let currentSectionLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headerMatch) {
      if (currentSectionLines.length > 0) {
        const text = currentSectionLines.join('\n').trim();
        if (text) {
          sections.push({
            title: currentSectionTitle,
            content: text
          });
        }
        currentSectionLines = [];
      }
      currentSectionTitle = decodeHtmlEntities(headerMatch[2].trim());
    } else {
      currentSectionLines.push(line);
    }
  }

  if (currentSectionLines.length > 0) {
    const text = currentSectionLines.join('\n').trim();
    if (text) {
      sections.push({
        title: currentSectionTitle,
        content: text
      });
    }
  }

  // Extract title (first or second H1)
  for (const line of lines) {
    if (line.startsWith('# ')) {
      const candidate = decodeHtmlEntities(line.replace(/^#\s+/, '').trim());
      if (candidate) {
        title = candidate;
        // Prefer the clean unicode version without entities if available
        break;
      }
    }
  }
  if (!title) {
    title = id.replace(/-/g, ' ');
  }

  // Analyze top area for Subtitle, Categories, and Description
  // Usually between top and "## חשוב לדעת"
  let inHeaderArea = true;
  const introParagraphs: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 35); i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith('# ')) continue;
    if (l.startsWith('## ') || l.startsWith('- **') || l.includes('חשוב לדעת') || l.includes('במסלול זה')) {
      inHeaderArea = false;
      break;
    }

    // Skip promotional / cross-link lines
    if (
      l.includes('חוות דעת') ||
      l.includes('לצפייה במסלולים נוספים') ||
      l.includes('מסלולי סיור בירושלים') ||
      l.includes('מסלולי טיול בארץ') ||
      l.includes('מסלולי פריחה צבעוניים') ||
      l.includes('מעיינות ו-') ||
      l.includes('ארץ אהבתי') ||
      l.includes('סדרת ספרים')
    ) {
      continue;
    }

    const words = l.split(/\s+/);

    // Known common tags or very short lines are categories
    const isCategory = (
      words.length <= 3 && l.length <= 25 &&
      !l.includes('.') && !l.includes(':') && !l.startsWith('*') && !l.startsWith('-')
    );

    if (isCategory) {
      categoriesSet.add(l);
      continue;
    }

    // First meaningful longer line (more than 3 words or > 20 chars) is subtitle
    if (!subtitle && words.length >= 3 && l.length >= 15 && l.length < 150 && !l.includes(':')) {
      subtitle = l;
      continue;
    }

    // Longer paragraphs are description
    if (l.length > 25 && !l.startsWith('*') && !l.startsWith('-')) {
      introParagraphs.push(l);
    }
  }

  if (introParagraphs.length > 0) {
    description = introParagraphs.join('\n\n');
  }

  // Extract key-value pairs across the document
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const kv = extractKeyValue(line);
    if (kv) {
      // If value is empty, check next line
      let val = kv.value;
      if (!val && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('*') && !nextLine.startsWith('-')) {
          val = nextLine;
        }
      }
      meta[kv.key] = val;
    }
  }

  // Look for "מה לכתוב ב-GPS"
  let gpsName: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/מה (?:לכתוב|כותבים) ב-?GPS/i.test(line)) {
      // Check next 1-4 lines for destination
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const candidate = lines[j].trim();
        if (candidate && !candidate.startsWith('#') && !candidate.includes('waze') && !candidate.includes('WAZE')) {
          // If candidate is a bold key like "**לנקודת החנייה וההתחלה:** עין רוגל"
          const parsed = extractKeyValue(candidate);
          if (parsed && parsed.value) {
            gpsName = parsed.value;
            break;
          } else if (candidate.length > 2 && !candidate.startsWith('- **')) {
            gpsName = candidate.replace(/^\*\*|\*\*$/g, '').trim();
            break;
          }
        }
      }
      if (gpsName) break;
    }
  }

  // Region
  let region = meta['אזור בארץ'] || meta['אזור'] || meta['אזור בארץ '];
  if (region) {
    region = region.replace(/^[-–—:]\s*/, '').trim();
  }

  // Start Point & End Point
  const startPoint = meta['נקודת מוצא וסיום'] ||
    meta['נקודת מוצא'] ||
    meta['נקודת התחלה'] ||
    meta['לנקודת המוצא'] ||
    meta['לנקודת החנייה וההתחלה'] ||
    meta['לנקודת ההתחלה'] ||
    meta['לנקודת החנייה'];

  const endPoint = meta['נקודת סיום'] ||
    meta['לנקודת הסיום'];

  // Walking type
  const walkingType = meta['סוג המסלול'] ||
    meta['אופי המסלול'] ||
    meta['אופי ההליכה'];

  // Difficulty
  const difficulty = meta['דרגת קושי'] ||
    meta['רמת קושי'];

  // Distance & Duration strings
  const distanceStr = meta['אורך המסלול'] ||
    meta['מרחק'] ||
    meta['אורך המסלול '];
  const distanceKm = parseDistanceKm(distanceStr);

  const durationStr = meta['משך הטיול'] ||
    meta['משך המסלול'] ||
    meta['זמן'] ||
    meta['משך הטיול '];
  const durationMinutes = parseDurationMinutes(durationStr);

  // Water & Shade
  const water = meta['רחצה במים'] || meta['מים'];
  const hasWater = Boolean(
    (water && !water.includes('אין') && !water.includes('לא רלוונטי')) ||
    categoriesSet.has('מים') ||
    categoriesSet.has('בריכת מעיין') ||
    categoriesSet.has('מעיינות')
  );

  const shade = meta['צל'];
  const hasShade = Boolean(
    shade && (shade.includes('יש') || shade.includes('מוצל') || shade.includes('תחת עצים')) && !shade.includes('אין')
  );

  // Crowd, Parking, Accessibility, Opening Hours, Price, Trail Map
  const crowdLevel = meta['עומס'];
  const parking = meta['חניה'] || meta['חנייה'] || meta['מקום חניה'];
  const trailMap = meta['מפת סימון שבילים'] || meta['מפת המסלול'];
  const accessibility = meta['מידת ההנגשה'] || meta['נגישות'] || meta['מידת ההנגשה של המסלול'];
  const openingHours = meta['שעות פתיחה'] || meta['שעות וימים מומלצים'] || meta['תשלום ושעות פתיחה'];
  const price = meta['תשלום'] || meta['כניסה'] || meta['מחיר'];

  // Directions & Parking
  let directionsByCar: string | undefined;
  let directionsByFoot: string | undefined;
  let directionsBy4x4: string | undefined;
  let directionsByHighVehicle: string | undefined;
  let additionalInformation: string | undefined;
  let parkingInfo = parking;

  for (const s of sections) {
    const t = s.title;
    const c = s.content;

    if (t.includes('איך מגיעים') || t.includes('הוראות הגעה')) {
      // Check for specific vehicle sections within arrival
      if (c.includes('ברכב שטח') || c.includes('4X4') || c.includes('4x4')) {
        const parts = c.split(/(?=ברכב שטח|4X4|4x4)/);
        directionsByCar = parts[0]?.trim();
        directionsBy4x4 = parts.slice(1).join('\n\n').trim();
      } else if (c.includes('ברכב גבוה')) {
        const parts = c.split(/(?=ברכב גבוה)/);
        directionsByCar = parts[0]?.trim();
        directionsByHighVehicle = parts.slice(1).join('\n\n').trim();
      } else {
        directionsByCar = c.trim();
      }

      // If parking was not in metadata, check for "איפה חונים?"
      if (!parkingInfo && c.includes('איפה חונים')) {
        const pMatch = c.match(/איפה חונים\??\s*([\s\S]*?)(?=(?:בתחבורה ציבורית|מה לכתוב|ברכב|$))/);
        if (pMatch && pMatch[1].trim().length > 5) {
          parkingInfo = pMatch[1].trim().split('\n')[0].trim();
        }
      }
    } else if (t.includes('ברכב שטח') || t.includes('4X4') || t.includes('4x4')) {
      directionsBy4x4 = c;
    } else if (t.includes('ברכב גבוה')) {
      directionsByHighVehicle = c;
    } else if (t.includes('ברכב')) {
      directionsByCar = c;
    } else if (t.includes('מסלול ההליכה') || t.includes('מסלול הסיור') || t.includes('ברגל')) {
      directionsByFoot = (directionsByFoot ? directionsByFoot + '\n\n' : '') + c;
    } else if (t.includes('מעניין לדעת') || t.includes('סיפור קצר') || t.includes('אגדה') || t.includes('לתשומת לבכם')) {
      additionalInformation = (additionalInformation ? additionalInformation + '\n\n' : '') + `### ${t}\n${c}`;
    }
  }

  // If no description from intro, use first section content
  if (!description && sections.length > 0) {
    description = sections[0].content.slice(0, 300);
  }

  // Check URLs
  const gmapUrlMatch = rawText.match(/(https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s)\"'>]+)/i);
  const googleMapsUrl = gmapUrlMatch ? gmapUrlMatch[1] : undefined;

  const wazeUrlMatch = rawText.match(/(https?:\/\/(?:www\.)?(?:waze\.com|ul\.waze\.com)[^\s)\"'>]+)/i);
  const wazeUrl = wazeUrlMatch ? wazeUrlMatch[1] : undefined;

  // Extract images
  const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(rawText)) !== null) {
    images.push({
      alt: imgMatch[1],
      url: imgMatch[2]
    });
  }

  const directImgRegex = /(https?:\/\/[^\s)\"'>]+\.(?:jpg|jpeg|png|webp))/gi;
  let directMatch;
  while ((directMatch = directImgRegex.exec(rawText)) !== null) {
    if (!images.some(img => img.url === directMatch![1])) {
      images.push({
        url: directMatch[1]
      });
    }
  }

  // Coordinates check
  let latitude: number | undefined;
  let longitude: number | undefined;

  const coordMatch = rawText.match(/([23]\d\.\d{4,8})[\s,]+([34]\d\.\d{4,8})/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= 29.0 && lat <= 33.5 && lng >= 34.0 && lng <= 36.0) {
      latitude = lat;
      longitude = lng;
    }
  }

  const coordinatesMissing = !(typeof latitude === 'number' && typeof longitude === 'number');

  return {
    id,
    slug,
    title,
    subtitle: subtitle || undefined,
    description: description || title,
    region: region || undefined,
    categories: Array.from(categoriesSet),
    
    distanceKm,
    durationMinutes,
    distanceStr: distanceStr || undefined,
    durationStr: durationStr || undefined,
    
    difficulty: difficulty || undefined,
    walkingType: walkingType || undefined,
    crowdLevel: crowdLevel || undefined,
    
    startPoint: startPoint || undefined,
    endPoint: endPoint || undefined,
    gpsName: gpsName || undefined,
    
    latitude,
    longitude,
    coordinatesMissing,
    locationStatus: (latitude && longitude) ? 'verified' : 'missing',
    locationType: (latitude && longitude) ? 'start' : 'missing',
    locationSource: (latitude && longitude) ? 'markdown_coordinates' : 'source_markdown',
    locationConfidence: (latitude && longitude) ? 0.95 : 0.0,
    
    googleMapsUrl,
    wazeUrl,
    
    water: water || undefined,
    hasWater,
    shade: shade || undefined,
    hasShade,
    parking: parkingInfo || undefined,
    trailMap: trailMap || undefined,
    accessibility: accessibility || undefined,
    openingHours: openingHours || undefined,
    price: price || undefined,
    
    directionsByCar,
    directionsByFoot,
    directionsBy4x4,
    directionsByHighVehicle,
    additionalInformation,
    
    sections,
    images,
    sourceFile: filename
  };
}
