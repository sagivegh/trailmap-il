import fs from 'fs';
import path from 'path';
import { Trail } from '../src/types/trail';
import { cleanText } from '../src/parser/trail-parser';

export interface AuditFlagItem {
  trailId: string;
  trailTitle: string;
  sourceFile: string;
  generatedText: string;
  issueType:
    | 'unsupported_swimming_claim'
    | 'unsupported_water_crossing_claim'
    | 'unsupported_hasWater_field'
    | 'unsupported_shade_claim'
    | 'unsupported_route_type_claim'
    | 'unsupported_4x4_requirement'
    | 'unsupported_high_vehicle_requirement'
    | 'unsupported_fee_claim'
    | 'unsupported_parking_claim'
    | 'unsupported_family_suitability_claim'
    | 'unsupported_accessibility_claim'
    | 'generic_filler_phrase'
    | 'close_sentence_similarity'
    | 'distinctive_wording_retention';
  reason: string;
  supportingSourceFacts?: string;
  recommendedAction: string;
}

export interface Stage2AuditReport {
  generatedAt: string;
  totalTrailsAudited: number;
  totalFlaggedTrails: number;
  totalUnsupportedClaims: number;
  totalGenericFillerOccurrences: number;
  totalCloseSimilarityMatches: number;
  totalStructuredFieldsWithUnsupportedValues: number;
  totalTrailsRequiringRegeneration: number;
  summaryByIssueType: Record<string, number>;
  metrics: {
    averageTokenJaccard: number;
    maxTokenJaccard: number;
    phraseOverlap6PlusWords: number;
    sentenceSimilarityAboveThreshold: number;
    genericFillerSentenceCount: number;
    unsupportedClaimsCount: number;
  };
}

// Hebrew stop words to exclude during content token similarity
const HEBREW_STOP_WORDS = new Set([
  'של', 'את', 'על', 'ב', 'ל', 'מ', 'כ', 'עם', 'זה', 'זו', 'אלה', 'אלו',
  'הוא', 'היא', 'הם', 'הן', 'או', 'אם', 'כי', 'לא', 'כן', 'גם', 'רק',
  'כל', 'בין', 'אל', 'עד', 'מן', 'מה', 'מי', 'איך', 'כיצד', 'היה', 'היתה',
  'היו', 'תהיה', 'יהיה', 'בגלל', 'מפני', 'אשר', 'שבו', 'שבה', 'שבהם', 'כדי'
]);

// Generic filler patterns that add no trail-specific factual information
const GENERIC_FILLER_PATTERNS = [
  { pattern: /המיועד לחובבי טיולים/, name: 'המיועד לחובבי טיולים', reason: 'Generic filler clause adding no factual trail information' },
  { pattern: /המסלול מוגדר עם/, name: 'המסלול מוגדר עם', reason: 'Rigid boilerplate template frame' },
  { pattern: /מאפיינים עיקריים:/, name: 'מאפיינים עיקריים:', reason: 'Boilerplate list intro' },
  { pattern: /ללא הסדרת חניה ייעודית מפורטת/, name: 'ללא הסדרת חניה ייעודית מפורטת', reason: 'Fabricated placeholder for missing parking data' },
  { pattern: /מתאים לרכב פרטי סטנדרטי/, name: 'מתאים לרכב פרטי סטנדרטי', reason: 'Inferred default for unstated vehicle requirements' },
  { pattern: /פרטי ההגעה ונתוני המסלול המלאים מפורטים/, name: 'פרטי ההגעה ונתוני המסלול...', reason: 'Meta-reference filler' }
];

function tokenizeContent(text: string): string[] {
  return text
    .replace(/[^\u0590-\u05FF0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2 && !HEBREW_STOP_WORDS.has(w));
}

function calculateJaccard(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function performStage2Audit(): {
  report: Stage2AuditReport;
  qualityAudit: any;
  similarityAudit: any;
  unsupportedClaimsAudit: AuditFlagItem[];
  phraseFrequency: Record<string, number>;
} {
  const dataDir = path.join(process.cwd(), 'data');
  const markdownDir = path.join(process.cwd(), 'extracted_clean', 'markdown');
  const trailsPath = path.join(dataDir, 'trails.json');

  const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));

  const flaggedTrailsSet = new Set<string>();
  const trailsRequiringRegenerationSet = new Set<string>();
  const allFlags: AuditFlagItem[] = [];
  const similarityFlags: AuditFlagItem[] = [];
  const unsupportedFlags: AuditFlagItem[] = [];

  const summaryByIssueType: Record<string, number> = {};
  function recordFlag(item: AuditFlagItem) {
    allFlags.push(item);
    flaggedTrailsSet.add(item.trailId);
    summaryByIssueType[item.issueType] = (summaryByIssueType[item.issueType] || 0) + 1;

    if (item.issueType.startsWith('unsupported_')) {
      unsupportedFlags.push(item);
      trailsRequiringRegenerationSet.add(item.trailId);
    } else if (item.issueType.includes('similarity') || item.issueType.includes('distinctive')) {
      similarityFlags.push(item);
      trailsRequiringRegenerationSet.add(item.trailId);
    } else if (item.issueType === 'generic_filler_phrase') {
      trailsRequiringRegenerationSet.add(item.trailId);
    }
  }

  // Phrase frequency tracker
  const phraseCounts: Record<string, number> = {};
  function trackPhrases(text: string) {
    const words = text.split(/\s+/).map(w => w.trim()).filter(Boolean);
    for (let len = 2; len <= 5; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const p = words.slice(i, i + len).join(' ');
        phraseCounts[p] = (phraseCounts[p] || 0) + 1;
      }
    }
  }

  let totalJaccard = 0;
  let maxJaccard = 0;
  let count6PlusWords = 0;
  let countSentenceSimAboveThreshold = 0;
  let countGenericFiller = 0;

  for (let i = 0; i < trails.length; i++) {
    const trail = trails[i];
    const sourceFilePath = path.join(markdownDir, trail.sourceFile);
    let sourceRaw = '';
    if (fs.existsSync(sourceFilePath)) {
      sourceRaw = fs.readFileSync(sourceFilePath, 'utf8');
    }

    const genSummary = trail.trailSummary || trail.description || '';
    trackPhrases(genSummary);

    // Track phrase frequencies across content sections too
    if (trail.contentSections) {
      for (const sec of trail.contentSections) {
        if (sec.content) trackPhrases(sec.content);
        if (sec.items) sec.items.forEach(it => trackPhrases(it));
      }
    }

    const genTokens = tokenizeContent(genSummary);
    const srcTokens = tokenizeContent(sourceRaw);

    // 1. Normalized Token Jaccard Similarity
    const jaccard = calculateJaccard(genTokens, srcTokens);
    totalJaccard += jaccard;
    if (jaccard > maxJaccard) maxJaccard = jaccard;

    // 2. Exact 6+ word contiguous match
    const genWords = genSummary.replace(/[^\u0590-\u05FF0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const normSrc = sourceRaw.replace(/[^\u0590-\u05FF0-9\s]/g, ' ').replace(/\s+/g, ' ');
    for (let wIdx = 0; wIdx <= genWords.length - 6; wIdx++) {
      const phrase = genWords.slice(wIdx, wIdx + 6).join(' ');
      if (normSrc.includes(phrase)) {
        count6PlusWords++;
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: phrase,
          issueType: 'close_sentence_similarity',
          reason: 'Contiguous 6-word phrase overlap with source',
          supportingSourceFacts: phrase,
          recommendedAction: 'Reconstruct sentence using independent phrasing'
        });
        break;
      }
    }

    // 3. Sentence-level similarity check (Jaccard > 0.45 on content words)
    const genSentences = genSummary.split(/[.?!]/).map(s => s.trim()).filter(s => s.length > 10);
    const srcSentences = sourceRaw
      .split(/[.?!;\n]/)
      .map(s => s.trim().replace(/^[-#*–—\s\d.:]+/, '').trim())
      .filter(s => s.length > 15 && !s.startsWith('http'));

    for (const gSent of genSentences) {
      const gTokens = tokenizeContent(gSent);
      if (gTokens.length < 4) continue;

      let highestSentSim = 0;
      let closestSrcSent = '';

      for (const sSent of srcSentences) {
        const sTokens = tokenizeContent(sSent);
        if (sTokens.length < 4) continue;
        const sim = calculateJaccard(gTokens, sTokens);
        if (sim > highestSentSim) {
          highestSentSim = sim;
          closestSrcSent = sSent;
        }
      }

      if (highestSentSim > 0.45) {
        countSentenceSimAboveThreshold++;
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: gSent,
          issueType: 'close_sentence_similarity',
          reason: `Sentence-level token overlap is ${Math.round(highestSentSim * 100)}% with source sentence`,
          supportingSourceFacts: closestSrcSent.slice(0, 100),
          recommendedAction: 'Rephrase sentence to break structural alignment with source'
        });
      }
    }

    // 4. Generic filler phrase detection
    for (const filler of GENERIC_FILLER_PATTERNS) {
      if (filler.pattern.test(genSummary)) {
        countGenericFiller++;
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: filler.name,
          issueType: 'generic_filler_phrase',
          reason: filler.reason,
          recommendedAction: 'Remove generic filler phrase and state only concrete trail facts'
        });
      }

      if (trail.contentSections) {
        for (const sec of trail.contentSections) {
          if (sec.content && filler.pattern.test(sec.content)) {
            countGenericFiller++;
            recordFlag({
              trailId: trail.id,
              trailTitle: trail.title,
              sourceFile: trail.sourceFile,
              generatedText: `${sec.title}: ${filler.name}`,
              issueType: 'generic_filler_phrase',
              reason: filler.reason,
              recommendedAction: 'Remove generic boilerplate section content'
            });
          }
        }
      }
    }

    // Rule: "אפשרות רחצה" must NOT be claimed unless source explicitly supports bathing/swimming
    const isExplicitRestriction = genSummary.includes('הרחצה במים אסורה') || genSummary.includes('אינה מתאימה לרחצה') || genSummary.includes('אינה מומלצת');
    const claimsSwimming = !isExplicitRestriction && (
      genSummary.includes('אפשרות רחצה') ||
      genSummary.includes('שכשוך במים') ||
      (genSummary.includes('רחצה') && !genSummary.includes('אסורה') && !genSummary.includes('אין')) ||
      (trail.practicalInfo?.water && (trail.practicalInfo.water.includes('רחצה') || trail.practicalInfo.water.includes('שכשוך')) && !trail.practicalInfo.water.includes('אין'))
    );

    if (claimsSwimming) {
      const explicitSwimmingSupport = /רחצה|שכשוך|לטבול|טבילה|שחייה|לשחות/.test(sourceRaw);
      const explicitlyNoSwimming = /אין רחצה|רחצה במים[:\s]*אין|לא רלוונטי|אין כניסה למים|אסור להתרחץ/.test(sourceRaw);

      if (!explicitSwimmingSupport || explicitlyNoSwimming) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: genSummary,
          issueType: 'unsupported_swimming_claim',
          reason: 'Generated text claims "אפשרות רחצה" but source either explicitly denies it or does not support swimming/bathing',
          supportingSourceFacts: explicitlyNoSwimming ? 'Source explicitly states no swimming/bathing' : 'No swimming/bathing terms found in source',
          recommendedAction: 'Remove swimming/bathing claim; mention water only if water feature is explicitly present'
        });
      }
    }

    // Rule: "כולל מעבר במים" must not be inferred from stream or spring
    if (genSummary.includes('מעבר במים')) {
      const explicitCrossing = /מעבר במים|הליכה במים|חציית מים|הליכה בתוך המים/.test(sourceRaw);
      if (!explicitCrossing) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'כולל מעבר במים',
          issueType: 'unsupported_water_crossing_claim',
          reason: 'Generated text claims "כולל מעבר במים" without explicit source support',
          recommendedAction: 'Remove water crossing claim'
        });
      }
    }

    // Rule: hasWater boolean audit
    if (trail.sourceFacts?.hasWater === true) {
      const metaWaterNone = /רחצה במים[:\s]*אין|רחצה במים[:\s]*לא רלוונטי/.test(sourceRaw);
      const noWaterFeatures = !/נחל|מעיין|עין|מפל|בריכ|גב מים|אגם/.test(sourceRaw);
      if (metaWaterNone && noWaterFeatures) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'hasWater = true',
          issueType: 'unsupported_hasWater_field',
          reason: 'hasWater was set to true despite source stating no water/bathing and having no water features',
          supportingSourceFacts: 'Source explicitly states רחצה במים: אין',
          recommendedAction: 'Set hasWater = false'
        });
      }
    }

    // 6. Factual Support Audit: Shade
    if (genSummary.includes('מקטעים מוצלים')) {
      const cleanMeta = sourceRaw.replace(/[*_#]/g, ' ');
      const hasShadeMention = /(?:^|\n)\s*[-*•]*\s*צל\s*:\s*[^\n]*(?:יש|מעט|חלק|חלקי|מוצל|מוצלים|תחת|מלא|הרבה|המון)/.test(cleanMeta);

      if (!hasShadeMention) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'תוואי ההליכה כולל מקטעים מוצלים',
          issueType: 'unsupported_shade_claim',
          reason: 'Source does not explicitly support presence of shade',
          supportingSourceFacts: 'Missing shade metadata',
          recommendedAction: 'Remove shade claim unless explicitly verified in source'
        });
      }
    }

    // 7. Factual Support Audit: Route Type (Circular / One-Way)
    if (genSummary.includes('מעגלי')) {
      const isExplicitlyCircular = /מעגלי/.test(sourceRaw);
      if (!isExplicitlyCircular) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'מסלול הליכה מעגלי',
          issueType: 'unsupported_route_type_claim',
          reason: 'Summary asserts trail is circular ("מעגלי"), but source does not explicitly classify it as circular',
          supportingSourceFacts: 'Source walkingType does not specify מעגלי',
          recommendedAction: 'Use neutral route descriptor without claiming it is circular'
        });
      }
    }

    // 8. Factual Support Audit: Vehicle Requirements (4x4 & High Clearance)
    if (trail.sourceFacts?.fourByFourRequired === true) {
      const negative4x4 = /אין צורך ברכב שטח|מתאים לכל רכב|מתאים לרכב פרטי|ללא רכב שטח|לא נדרש 4X4|לא נדרש רכב שטח/.test(sourceRaw);
      if (negative4x4) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'fourByFourRequired = true',
          issueType: 'unsupported_4x4_requirement',
          reason: 'Source mentions 4X4 in a negative or non-required context ("אין צורך ברכב שטח"), but fourByFourRequired was set to true',
          supportingSourceFacts: 'Source states no 4x4 required',
          recommendedAction: 'Set fourByFourRequired = false'
        });
      }
    }

    if (trail.sourceFacts?.highVehicleRequired === true) {
      const negativeHigh = /אין צורך ברכב גבוה|מתאים לכל רכב|מתאים לרכב פרטי|ללא צורך ברכב גבוה/.test(sourceRaw);
      if (negativeHigh) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'highVehicleRequired = true',
          issueType: 'unsupported_high_vehicle_requirement',
          reason: 'Source states high clearance vehicle is not required, but highVehicleRequired was set to true',
          supportingSourceFacts: 'Source states no high clearance vehicle required',
          recommendedAction: 'Set highVehicleRequired = false'
        });
      }
    }

    // 9. Factual Support Audit: Fees / Price
    if (genSummary.includes('כרוכה בתשלום')) {
      const explicitlyFree = /ללא תשלום|כניסה חופשית|חינם|תשלום[:\s]*אין/.test(sourceRaw);
      const mentionsPayment = /בתשלום|דמי כניסה|כרטיס כניסה/.test(sourceRaw);
      if (explicitlyFree || !mentionsPayment) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: 'הכניסה לאתר כרוכה בתשלום',
          issueType: 'unsupported_fee_claim',
          reason: explicitlyFree ? 'Source explicitly states entrance is free' : 'Source contains no mention of entrance fees',
          supportingSourceFacts: explicitlyFree ? 'תשלום: ללא תשלום' : 'No fee metadata found',
          recommendedAction: 'State entry is free or leave fee statement out if unstated'
        });
      }
    }

    // 10. Factual Support Audit: Parking
    if (trail.navigationInfo?.parkingLocation && trail.navigationInfo.parkingLocation.includes('חניה מסודרת')) {
      const mentionsOfficialParking = /חניה מסודרת|חניון מסודר/.test(sourceRaw);
      if (!mentionsOfficialParking) {
        recordFlag({
          trailId: trail.id,
          trailTitle: trail.title,
          sourceFile: trail.sourceFile,
          generatedText: trail.navigationInfo.parkingLocation,
          issueType: 'unsupported_parking_claim',
          reason: 'Claimed "חניה מסודרת" without explicit source support',
          recommendedAction: 'Refer strictly to the exact parking area named in the source'
        });
      }
    }
  }

  // Filter repeated phrases: keep only phrases that appear >= 10 times across dataset
  const significantPhrases: Record<string, number> = {};
  for (const [p, c] of Object.entries(phraseCounts)) {
    if (c >= 10 && p.length >= 8) {
      significantPhrases[p] = c;
    }
  }

  const avgJaccard = trails.length > 0 ? totalJaccard / trails.length : 0;

  const report: Stage2AuditReport = {
    generatedAt: new Date().toISOString(),
    totalTrailsAudited: trails.length,
    totalFlaggedTrails: flaggedTrailsSet.size,
    totalUnsupportedClaims: unsupportedFlags.length,
    totalGenericFillerOccurrences: countGenericFiller,
    totalCloseSimilarityMatches: similarityFlags.length,
    totalStructuredFieldsWithUnsupportedValues:
      (summaryByIssueType['unsupported_hasWater_field'] || 0) +
      (summaryByIssueType['unsupported_4x4_requirement'] || 0) +
      (summaryByIssueType['unsupported_high_vehicle_requirement'] || 0),
    totalTrailsRequiringRegeneration: trailsRequiringRegenerationSet.size,
    summaryByIssueType,
    metrics: {
      averageTokenJaccard: Number(avgJaccard.toFixed(3)),
      maxTokenJaccard: Number(maxJaccard.toFixed(3)),
      phraseOverlap6PlusWords: count6PlusWords,
      sentenceSimilarityAboveThreshold: countSentenceSimAboveThreshold,
      genericFillerSentenceCount: countGenericFiller,
      unsupportedClaimsCount: unsupportedFlags.length
    }
  };

  // Generate Review Artifacts
  const qualityAudit = {
    generatedAt: report.generatedAt,
    totalAudited: trails.length,
    totalFlaggedTrails: flaggedTrailsSet.size,
    totalTrailsRequiringRegeneration: trailsRequiringRegenerationSet.size,
    metrics: report.metrics,
    summaryByIssueType: report.summaryByIssueType,
    flaggedItems: allFlags
  };

  const similarityAudit = {
    generatedAt: report.generatedAt,
    totalAudited: trails.length,
    closeMatchesCount: similarityFlags.length,
    averageTokenJaccard: report.metrics.averageTokenJaccard,
    maxTokenJaccard: report.metrics.maxTokenJaccard,
    phraseOverlap6PlusWords: count6PlusWords,
    flaggedItems: similarityFlags
  };

  const unsupportedClaimsAudit = unsupportedFlags;

  return {
    report,
    qualityAudit,
    similarityAudit,
    unsupportedClaimsAudit,
    phraseFrequency: significantPhrases
  };
}

if (process.argv[1] && process.argv[1].endsWith('audit-stage2.ts')) {
  console.log('🔬 Executing Strict Stage-2 TrailMap Content & Factual Support Audit...');
  const { report, qualityAudit, similarityAudit, unsupportedClaimsAudit, phraseFrequency } = performStage2Audit();

  const dataDir = path.join(process.cwd(), 'data');
  fs.writeFileSync(path.join(dataDir, 'content-quality-audit.json'), JSON.stringify(qualityAudit, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'content-similarity-audit.json'), JSON.stringify(similarityAudit, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'unsupported-claims-audit.json'), JSON.stringify(unsupportedClaimsAudit, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'generated-phrase-frequency.json'), JSON.stringify(phraseFrequency, null, 2), 'utf8');

  console.log(`\n=============================================================`);
  console.log(`     STAGE-2 STRICT CONTENT & FACTUAL AUDIT REPORT           `);
  console.log(`=============================================================`);
  console.log(`Total trails audited: ${report.totalTrailsAudited}`);
  console.log(`Total flagged trails: ${report.totalFlaggedTrails}`);
  console.log(`Total unsupported claims: ${report.totalUnsupportedClaims}`);
  console.log(`Total generic filler sentences: ${report.totalGenericFillerOccurrences}`);
  console.log(`Total close similarity matches: ${report.totalCloseSimilarityMatches}`);
  console.log(`Structured fields with unsupported values: ${report.totalStructuredFieldsWithUnsupportedValues}`);
  console.log(`Total trails requiring regeneration: ${report.totalTrailsRequiringRegeneration}`);
  console.log(`-------------------------------------------------------------`);
  console.log(`Breakdown by issue type:`);
  for (const [k, v] of Object.entries(report.summaryByIssueType)) {
    console.log(`  • ${k}: ${v}`);
  }
  console.log(`-------------------------------------------------------------`);
  console.log(`Similarity Metrics:`);
  console.log(`  • Average content token Jaccard: ${report.metrics.averageTokenJaccard}`);
  console.log(`  • Maximum token Jaccard: ${report.metrics.maxTokenJaccard}`);
  console.log(`  • 6+ word contiguous overlaps: ${report.metrics.phraseOverlap6PlusWords}`);
  console.log(`  • Sentences with token Jaccard > 0.45: ${report.metrics.sentenceSimilarityAboveThreshold}`);
  console.log(`=============================================================`);
  console.log(`Artifacts generated in data/:`);
  console.log(`  - content-quality-audit.json`);
  console.log(`  - content-similarity-audit.json`);
  console.log(`  - unsupported-claims-audit.json`);
  console.log(`  - generated-phrase-frequency.json`);
}
