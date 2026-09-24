import fs from 'fs';
import path from 'path';
import { Trail } from '../src/types/trail';
import { checkContentSimilarity } from '../src/parser/content-transformer';

interface ContentAuditResult {
  generatedAt: string;
  totalAudited: number;
  cleanDescriptions: number;
  flaggedDescriptions: number;
  authorMarkersFound: number;
  violations: Array<{
    id: string;
    title: string;
    sourceFile: string;
    issue: string;
    matchedText: string;
    contiguousWords?: number;
  }>;
}

// Known promotional / authorial markers that MUST NEVER appear in TrailMap descriptions
const FORBIDDEN_AUTHOR_MARKERS = [
  'מסיירים עם',
  'ערן גל-אור',
  'טל נייד',
  '050-4000026',
  'סדרת ספרים',
  'ארץ אהבתי',
  'לצפייה במסלולים נוספים',
  'חוות דעת'
];

export function auditTrailContent(): ContentAuditResult {
  const dataDir = path.join(process.cwd(), 'data');
  const markdownDir = path.join(process.cwd(), 'extracted_clean', 'markdown');
  const trailsPath = path.join(dataDir, 'trails.json');

  if (!fs.existsSync(trailsPath)) {
    throw new Error(`trails.json not found at ${trailsPath}`);
  }

  const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));
  const violations: ContentAuditResult['violations'] = [];

  let cleanCount = 0;
  let flaggedCount = 0;
  let authorMarkersCount = 0;

  for (const trail of trails) {
    const textToCheck = trail.trailSummary || trail.description || '';
    let isFlagged = false;

    // 1. Check for forbidden authorial / promotional markers
    for (const marker of FORBIDDEN_AUTHOR_MARKERS) {
      if (textToCheck.includes(marker)) {
        authorMarkersCount++;
        isFlagged = true;
        violations.push({
          id: trail.id,
          title: trail.title,
          sourceFile: trail.sourceFile,
          issue: 'Forbidden authorial/promotional marker found in description',
          matchedText: marker
        });
      }
    }

    // 2. Check similarity against source markdown
    const sourceFilePath = path.join(markdownDir, trail.sourceFile);
    if (fs.existsSync(sourceFilePath)) {
      const sourceContent = fs.readFileSync(sourceFilePath, 'utf8');
      const sim = checkContentSimilarity(textToCheck, sourceContent);

      if (sim.isSuspicious) {
        isFlagged = true;
        flaggedCount++;
        violations.push({
          id: trail.id,
          title: trail.title,
          sourceFile: trail.sourceFile,
          issue: `Contiguous phrase overlap with source (${sim.maxContiguousWords} words)`,
          matchedText: sim.longestMatchedPhrase,
          contiguousWords: sim.maxContiguousWords
        });
      }
    }

    if (!isFlagged) {
      cleanCount++;
    }
  }

  const result: ContentAuditResult = {
    generatedAt: new Date().toISOString(),
    totalAudited: trails.length,
    cleanDescriptions: cleanCount,
    flaggedDescriptions: flaggedCount,
    authorMarkersFound: authorMarkersCount,
    violations
  };

  const auditReportPath = path.join(dataDir, 'content-audit-report.json');
  fs.writeFileSync(auditReportPath, JSON.stringify(result, null, 2), 'utf8');

  return result;
}

if (process.argv[1] && process.argv[1].endsWith('audit-content-similarity.ts')) {
  console.log('🔍 Running TrailMap Content Similarity Audit...');
  const res = auditTrailContent();

  console.log(`\n=================================================`);
  console.log(`           דוח ביקורת תוכן (CONTENT AUDIT)        `);
  console.log(`=================================================`);
  console.log(`סך כל המסלולים שנבדקו: ${res.totalAudited}`);
  console.log(`מסלולים בעלי ניסוח מקורי ונקי: ${res.cleanDescriptions} (${((res.cleanDescriptions / res.totalAudited) * 100).toFixed(1)}%)`);
  console.log(`חשד לדמיון ניסוחי מעל הרף: ${res.flaggedDescriptions}`);
  console.log(`סממני מחבר או תוכן שיווקי: ${res.authorMarkersFound}`);
  console.log(`=================================================`);

  if (res.violations.length > 0) {
    console.warn(`⚠️ נמצאו ${res.violations.length} מקרים הטעונים שיפור:`);
    res.violations.slice(0, 5).forEach(v => {
      console.warn(`- [${v.id}] ${v.issue}: "${v.matchedText}"`);
    });
  } else {
    console.log(`✅ ביקורת התוכן עברה בהצלחה מלאה! 0 חשדות להעתקה.`);
  }
}
