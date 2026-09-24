import fs from 'fs';
import path from 'path';
import {
  Trail,
  CoordinateAuditRecord,
  GeocodingReviewItem,
  CoordinateCoverageReport,
  ValidationReport
} from '../src/types/trail';
import { ISRAEL_GAZETTEER, lookupGazetteer } from '../src/services/geocoding/gazetteer';
import { buildQueryForTrail, VAGUE_REGIONS, NON_LOCATION_TERMS } from '../src/services/geocoding/query-builder';

async function runGeocodeCoverage() {
  console.log('🚀 Running Evidence-Based Coordinate Coverage & Audit Pipeline...');
  const startTime = Date.now();

  const rootDataDir = path.join(process.cwd(), 'data');
  const publicDataDir = path.join(process.cwd(), 'public', 'data');

  const trailsPath = path.join(rootDataDir, 'trails.json');
  const publicTrailsPath = path.join(publicDataDir, 'trails.json');
  const auditPath = path.join(rootDataDir, 'coordinate-audit.json');
  const publicAuditPath = path.join(publicDataDir, 'coordinate-audit.json');
  const reviewPath = path.join(rootDataDir, 'geocoding-review.json');
  const publicReviewPath = path.join(publicDataDir, 'geocoding-review.json');
  const coverageReportPath = path.join(process.cwd(), 'coordinate-coverage-report.json');
  const publicCoverageReportPath = path.join(publicDataDir, 'coordinate-coverage-report.json');
  const todoPath = path.join(rootDataDir, 'geocoding-todo.json');
  const publicTodoPath = path.join(publicDataDir, 'geocoding-todo.json');
  const reportPath = path.join(process.cwd(), 'report.json');
  const publicReportPath = path.join(publicDataDir, 'report.json');

  if (!fs.existsSync(trailsPath)) {
    throw new Error('data/trails.json not found. Run import first.');
  }

  const trails: Trail[] = JSON.parse(fs.readFileSync(trailsPath, 'utf8'));
  console.log(`📊 Processing ${trails.length} total trails...`);

  let verifiedCount = 0;
  let probableCount = 0;
  let missingCount = 0;
  let newlyGeocodedCount = 0;

  const auditRecords: CoordinateAuditRecord[] = [];
  const reviewItems: GeocodingReviewItem[] = [];

  for (const trail of trails) {
    // 1. If trail ALREADY has exact coordinates from markdown text
    if (trail.locationSource === 'markdown_coordinates' && trail.latitude && trail.longitude) {
      trail.locationStatus = 'verified';
      trail.locationType = 'start';
      trail.locationConfidence = 0.95;
      trail.locationReason = 'Exact coordinates parsed from source markdown';
      trail.coordinatesMissing = false;
      verifiedCount++;

      auditRecords.push({
        id: trail.id,
        title: trail.title,
        latitude: trail.latitude,
        longitude: trail.longitude,
        locationStatus: trail.locationStatus,
        locationType: trail.locationType,
        locationSource: trail.locationSource,
        locationConfidence: trail.locationConfidence,
        locationReason: trail.locationReason,
        gpsName: trail.gpsName,
        startPoint: trail.startPoint,
        endPoint: trail.endPoint,
        sourceFile: trail.sourceFile
      });
      continue;
    }

    // 2. Extract query according to hierarchy
    const extracted = buildQueryForTrail(trail);

    if (extracted) {
      // Lookup in verified gazetteer
      const gazetteerMatch =
        lookupGazetteer(extracted.primaryQuery) ||
        (extracted.strippedPrefixQuery ? lookupGazetteer(extracted.strippedPrefixQuery) : null);

      if (gazetteerMatch) {
        trail.latitude = gazetteerMatch.lat;
        trail.longitude = gazetteerMatch.lng;
        trail.coordinatesMissing = false;
        trail.locationStatus = gazetteerMatch.status;
        trail.locationType = gazetteerMatch.type;
        trail.locationSource = `${gazetteerMatch.source} ("${extracted.primaryQuery}")`;
        trail.locationConfidence = gazetteerMatch.confidence;
        trail.locationReason = gazetteerMatch.reason;

        // Navigation external links without Google API SDKs
        if (!trail.wazeUrl) {
          trail.wazeUrl = `https://ul.waze.com/ul?ll=${gazetteerMatch.lat},${gazetteerMatch.lng}&navigate=yes`;
        }
        if (!trail.googleMapsUrl) {
          trail.googleMapsUrl = `https://www.google.com/maps?q=${gazetteerMatch.lat},${gazetteerMatch.lng}`;
        }

        if (gazetteerMatch.status === 'verified') verifiedCount++;
        else probableCount++;
        newlyGeocodedCount++;
      } else {
        // Query extracted but not safely resolved to high-confidence coordinates
        // Conservative policy: DO NOT place on map! Send to manual review dataset.
        trail.locationStatus = 'missing';
        trail.locationType = 'missing';
        trail.coordinatesMissing = true;
        trail.locationConfidence = 0.0;
        trail.locationReason = 'Uncertain or ambiguous POI candidate - requires manual review';
        missingCount++;

        // Generate approximate candidate coordinates for manual reviewer consideration if clue has geographical relevance
        let candidateLat = 31.7767;
        let candidateLng = 35.2345;
        let candidateType = 'approximate';
        let candidateDisplayName = extracted.primaryQuery;
        let confidence = 0.45;
        let reviewReason = 'Multiple possible matches or ambiguous trail clue in source';

        if (trail.region && trail.region.includes('גליל')) {
          candidateLat = 32.95; candidateLng = 35.45;
        } else if (trail.region && trail.region.includes('גולן')) {
          candidateLat = 32.95; candidateLng = 35.75;
        } else if (trail.region && trail.region.includes('נגב')) {
          candidateLat = 30.85; candidateLng = 34.80;
        } else if (trail.region && trail.region.includes('אילת')) {
          candidateLat = 29.55; candidateLng = 34.95;
        } else if (trail.region && trail.region.includes('כרמל')) {
          candidateLat = 32.70; candidateLng = 35.02;
        }

        reviewItems.push({
          id: trail.id,
          title: trail.title,
          originalGpsText: trail.gpsName || trail.parking || trail.startPoint || '-',
          query: extracted.primaryQuery,
          candidateLatitude: candidateLat,
          candidateLongitude: candidateLng,
          candidateDisplayName: candidateDisplayName,
          candidateType: candidateType,
          confidence,
          reason: reviewReason,
          sourceFile: trail.sourceFile
        });
      }
    } else {
      // No query could be extracted (no clue or only vague region)
      trail.locationStatus = 'missing';
      trail.locationType = 'missing';
      trail.coordinatesMissing = true;
      trail.locationConfidence = 0.0;
      trail.locationReason = 'No specific location clues found in source';
      missingCount++;

      reviewItems.push({
        id: trail.id,
        title: trail.title,
        originalGpsText: trail.gpsName || trail.parking || trail.startPoint || '-',
        query: '-',
        candidateDisplayName: 'No location candidate found in source',
        candidateType: 'missing',
        confidence: 0.0,
        reason: 'No specific geographic clues available in dataset',
        sourceFile: trail.sourceFile
      });
    }

    // Keep audit record
    auditRecords.push({
      id: trail.id,
      title: trail.title,
      latitude: trail.latitude,
      longitude: trail.longitude,
      locationStatus: trail.locationStatus,
      locationType: trail.locationType,
      locationSource: trail.locationSource,
      locationConfidence: trail.locationConfidence,
      locationReason: trail.locationReason,
      gpsName: trail.gpsName,
      startPoint: trail.startPoint,
      endPoint: trail.endPoint,
      sourceFile: trail.sourceFile
    });
  }

  const totalMapped = verifiedCount + probableCount;
  const coveragePercentage = Number(((totalMapped / trails.length) * 100).toFixed(1));
  const previouslyMapped = 290;
  const newlyGeocoded = totalMapped - previouslyMapped;

  // Generate coverage report
  const coverageReport: CoordinateCoverageReport = {
    generatedAt: new Date().toISOString(),
    totalTrails: trails.length,
    verified: verifiedCount,
    probable: probableCount,
    missing: missingCount,
    coveragePercentage,
    previouslyMapped,
    newlyGeocoded,
    requiresReview: reviewItems.length,
    totalMapped
  };

  // Update remaining geocoding-todo
  const remainingTodo = trails
    .filter(t => t.coordinatesMissing)
    .map(t => ({
      id: t.id,
      title: t.title,
      gpsName: t.gpsName,
      startPoint: t.startPoint,
      endPoint: t.endPoint,
      sourceFile: t.sourceFile,
      region: t.region
    }));

  // Update validation report
  let validationReport: ValidationReport | null = null;
  if (fs.existsSync(reportPath)) {
    try {
      validationReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      if (validationReport) {
        validationReport.verifiedCoordinates = verifiedCount;
        validationReport.probableCoordinates = probableCount;
        validationReport.missingCoordinates = missingCount;
        validationReport.coordinatesMissing = missingCount;
        validationReport.withCoordinates = totalMapped;
        validationReport.generatedAt = new Date().toISOString();
      }
    } catch {
      // Ignore
    }
  }

  // Write all master and public data files
  fs.writeFileSync(trailsPath, JSON.stringify(trails, null, 2), 'utf8');
  fs.writeFileSync(publicTrailsPath, JSON.stringify(trails, null, 2), 'utf8');

  fs.writeFileSync(auditPath, JSON.stringify(auditRecords, null, 2), 'utf8');
  fs.writeFileSync(publicAuditPath, JSON.stringify(auditRecords, null, 2), 'utf8');

  fs.writeFileSync(reviewPath, JSON.stringify(reviewItems, null, 2), 'utf8');
  fs.writeFileSync(publicReviewPath, JSON.stringify(reviewItems, null, 2), 'utf8');

  fs.writeFileSync(coverageReportPath, JSON.stringify(coverageReport, null, 2), 'utf8');
  fs.writeFileSync(publicCoverageReportPath, JSON.stringify(coverageReport, null, 2), 'utf8');

  fs.writeFileSync(todoPath, JSON.stringify(remainingTodo, null, 2), 'utf8');
  fs.writeFileSync(publicTodoPath, JSON.stringify(remainingTodo, null, 2), 'utf8');

  if (validationReport) {
    fs.writeFileSync(reportPath, JSON.stringify(validationReport, null, 2), 'utf8');
    fs.writeFileSync(publicReportPath, JSON.stringify(validationReport, null, 2), 'utf8');
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Coordinate Coverage Pipeline Completed in ${durationSec}s!`);
  console.log(`=======================================================`);
  console.log(`  • Total Trails:                ${trails.length}`);
  console.log(`  • Verified Coordinates:        ${verifiedCount}`);
  console.log(`  • Probable Coordinates:        ${probableCount}`);
  console.log(`  • Total Trails Visible on Map: ${totalMapped} (${coveragePercentage}%)
  • Missing Coordinates:         ${missingCount}
  • Newly Mapped in this step:   ${newlyGeocoded}
  • Queued for Manual Review:    ${reviewItems.length}`);
  console.log(`=======================================================`);
  console.log(`📁 Files Generated:`);
  console.log(`   - ${coverageReportPath}`);
  console.log(`   - ${reviewPath} (${reviewItems.length} review candidates)`);
  console.log(`   - ${auditPath} (${auditRecords.length} audit records)`);
  console.log(`   - ${trailsPath} (master enriched trails)`);
}

runGeocodeCoverage().catch(err => {
  console.error('Fatal coverage error:', err);
  process.exit(1);
});
