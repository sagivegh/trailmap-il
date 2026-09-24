import fs from 'fs';
import path from 'path';
import { Trail, ContentProvenance } from '../src/types/trail';
import {
  transformTrailContent,
  checkContentSimilarity,
  generateOriginalSummary,
  cleanStartAnchor,
  cleanDifficulty
} from '../src/parser/content-transformer';

interface ContentTransformationReport {
  generatedAt: string;
  totalTrails: number;
  transformedTrails: number;
  trailsWithStructuredFacts: number;
  trailsWithOriginalSummaries: number;
  trailsWithInsufficientInfo: number;
  suspiciousSimilarityMatches: number;
  descriptionsRegenerated: number;
  flaggedTrails: Array<{
    id: string;
    sourceFile: string;
    phrase: string;
    contiguousWords: number;
  }>;
  coordinateCheck: {
    total: number;
    verified: number;
    probable: number;
    missing: number;
    mapped: number;
    verifiedMatch: boolean;
    probableMatch: boolean;
  };
}

async function runTransformation() {
  console.log('🔄 Starting TrailMap Content Transformation...');
  const startTime = Date.now();

  const dataDir = path.join(process.cwd(), 'data');
  const publicDataDir = path.join(process.cwd(), 'public', 'data');
  const markdownDir = path.join(process.cwd(), 'extracted_clean', 'markdown');

  const trailsJsonPath = path.join(dataDir, 'trails.json');
  if (!fs.existsSync(trailsJsonPath)) {
    throw new Error(`trails.json not found at ${trailsJsonPath}`);
  }

  const existingTrails: Trail[] = JSON.parse(fs.readFileSync(trailsJsonPath, 'utf8'));
  console.log(`📂 Loaded ${existingTrails.length} existing trails.`);

  // Verify coordinates prior to transformation
  const preVerified = existingTrails.filter(t => t.locationStatus === 'verified').length;
  const preProbable = existingTrails.filter(t => t.locationStatus === 'probable').length;
  const preMissing = existingTrails.filter(t => t.locationStatus === 'missing').length;
  console.log(`📍 Pre-check coordinates: Verified=${preVerified}, Probable=${preProbable}, Missing=${preMissing}`);

  const transformedTrails: Trail[] = [];
  const provenanceList: Record<string, ContentProvenance> = {};
  const flaggedTrails: ContentTransformationReport['flaggedTrails'] = [];

  let countWithStructuredFacts = 0;
  let countWithOriginalSummaries = 0;
  let countInsufficient = 0;
  let countSuspicious = 0;
  let countRegenerated = 0;

  for (let i = 0; i < existingTrails.length; i++) {
    const trail = existingTrails[i];
    const sourceFilePath = path.join(markdownDir, trail.sourceFile);

    let rawContent = '';
    if (fs.existsSync(sourceFilePath)) {
      rawContent = fs.readFileSync(sourceFilePath, 'utf8');
    } else {
      // Fallback to public/data/raw if exists
      const fallbackPath = path.join(publicDataDir, 'raw', `${trail.id}.md`);
      if (fs.existsSync(fallbackPath)) {
        rawContent = fs.readFileSync(fallbackPath, 'utf8');
      }
    }

    if (!rawContent) {
      console.warn(`⚠️ Warning: source file not found for ${trail.id} (${trail.sourceFile})`);
    }

    let result = transformTrailContent(trail, rawContent, trail.sourceFile);

    // If similarity check flags suspicious overlap, regenerate with pure minimalist template
    if (result.similarity.isSuspicious) {
      countSuspicious++;
      flaggedTrails.push({
        id: trail.id,
        sourceFile: trail.sourceFile,
        phrase: result.similarity.longestMatchedPhrase,
        contiguousWords: result.similarity.maxContiguousWords
      });

      // Stricter regeneration: Minimal factual statement using clean landmarks or empty summary
      const facts = result.transformedTrail.sourceFacts!;
      const minimalSummary = facts.landmarks.length > 0
        ? `מסלול באזור ${facts.region || 'הארץ'}, העובר ב${facts.landmarks.slice(0, 2).join(' וב')}.`
        : '';
      result.transformedTrail.trailSummary = minimalSummary || undefined;
      result.transformedTrail.description = minimalSummary || facts.title;
      countRegenerated++;
    }

    if (result.transformedTrail.sourceFacts) countWithStructuredFacts++;
    if (result.transformedTrail.trailSummary) countWithOriginalSummaries++;
    if (result.isInsufficient) countInsufficient++;

    transformedTrails.push(result.transformedTrail);
    provenanceList[trail.id] = result.provenance;

    if ((i + 1) % 400 === 0 || i === existingTrails.length - 1) {
      console.log(`⏳ Transformed ${i + 1}/${existingTrails.length} trails...`);
    }
  }

  // Verify coordinates post transformation
  const postVerified = transformedTrails.filter(t => t.locationStatus === 'verified').length;
  const postProbable = transformedTrails.filter(t => t.locationStatus === 'probable').length;
  const postMissing = transformedTrails.filter(t => t.locationStatus === 'missing').length;
  const postMapped = postVerified + postProbable;

  console.log(`\n📍 Post-check coordinates: Verified=${postVerified}, Probable=${postProbable}, Missing=${postMissing}, TotalMapped=${postMapped}`);

  if (postVerified !== preVerified || postProbable !== preProbable) {
    throw new Error(`CRITICAL: Coordinate counts changed during transformation! Verified: ${preVerified}->${postVerified}, Probable: ${preProbable}->${postProbable}`);
  }

  // Save transformed datasets
  const trailsJsonDataPath = path.join(dataDir, 'trails.json');
  const trailsJsonPublicPath = path.join(publicDataDir, 'trails.json');
  const provenanceDataPath = path.join(dataDir, 'content-provenance.json');
  const reportPath = path.join(dataDir, 'content-transformation-report.json');

  const trailsJsonStr = JSON.stringify(transformedTrails, null, 2);
  fs.writeFileSync(trailsJsonDataPath, trailsJsonStr, 'utf8');
  fs.writeFileSync(trailsJsonPublicPath, trailsJsonStr, 'utf8');

  fs.writeFileSync(provenanceDataPath, JSON.stringify(provenanceList, null, 2), 'utf8');

  const report: ContentTransformationReport = {
    generatedAt: new Date().toISOString(),
    totalTrails: transformedTrails.length,
    transformedTrails: transformedTrails.length,
    trailsWithStructuredFacts: countWithStructuredFacts,
    trailsWithOriginalSummaries: countWithOriginalSummaries,
    trailsWithInsufficientInfo: countInsufficient,
    suspiciousSimilarityMatches: countSuspicious,
    descriptionsRegenerated: countRegenerated,
    flaggedTrails,
    coordinateCheck: {
      total: transformedTrails.length,
      verified: postVerified,
      probable: postProbable,
      missing: postMissing,
      mapped: postMapped,
      verifiedMatch: postVerified === preVerified,
      probableMatch: postProbable === preProbable
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Content Transformation Complete in ${durationSec}s!`);
  console.log(`📊 Total trails transformed: ${transformedTrails.length}`);
  console.log(`📋 Structured factual data: ${countWithStructuredFacts}`);
  console.log(`✍️ Original summaries generated: ${countWithOriginalSummaries}`);
  console.log(`ℹ️ Insufficient source info: ${countInsufficient}`);
  console.log(`🔍 Suspicious similarity matches: ${countSuspicious}`);
  console.log(`🔄 Descriptions regenerated: ${countRegenerated}`);
  console.log(`💾 Saved to:`);
  console.log(`   - ${trailsJsonDataPath}`);
  console.log(`   - ${trailsJsonPublicPath}`);
  console.log(`   - ${provenanceDataPath}`);
  console.log(`   - ${reportPath}`);
}

runTransformation().catch(err => {
  console.error('Fatal transformation error:', err);
  process.exit(1);
});
