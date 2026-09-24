import fs from 'fs';
import path from 'path';
import { Trail, ValidationReport } from '../src/types/trail';

async function validateTrails() {
  console.log('🔍 Starting Data Quality Validation...');

  const trailsPath = path.join(process.cwd(), 'data', 'trails.json');
  if (!fs.existsSync(trailsPath)) {
    throw new Error(`Data file not found at ${trailsPath}. Please run import script first.`);
  }

  const trailsRaw = fs.readFileSync(trailsPath, 'utf8');
  const trails: Trail[] = JSON.parse(trailsRaw);

  const report: ValidationReport = {
    generatedAt: new Date().toISOString(),
    totalTrails: trails.length,
    withTitle: 0,
    withDescription: 0,
    withCoordinates: 0,
    verifiedCoordinates: 0,
    probableCoordinates: 0,
    missingCoordinates: 0,
    coordinatesMissing: 0,
    withGoogleMapsUrl: 0,
    withWazeUrl: 0,
    withImages: 0,
    withDistance: 0,
    withDuration: 0,
    withDifficulty: 0,
    withRegion: 0,
    withStartPoint: 0,
    withEndPoint: 0,
    withGpsName: 0,
    withWater: 0,
    withShade: 0,
    withCarDirections: 0,
    withWalkDirections: 0,
    duplicateIds: [],
    missingTitleFiles: [],
    failedParsingFiles: [],
    irregularFields: [],
    categoriesFound: [],
    regionsFound: []
  };

  const idMap = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  const regionCount = new Map<string, number>();

  for (const t of trails) {
    // ID duplication check
    idMap.set(t.id, (idMap.get(t.id) || 0) + 1);

    // Title
    if (t.title && t.title.trim().length > 0) {
      report.withTitle++;
    } else {
      report.missingTitleFiles.push(t.sourceFile);
    }

    // Description
    if (t.description && t.description.trim().length > 0) {
      report.withDescription++;
    }

    // Coordinates & Status Audit
    if (!t.coordinatesMissing && typeof t.latitude === 'number' && typeof t.longitude === 'number') {
      report.withCoordinates++;
      if (t.locationStatus === 'verified') {
        report.verifiedCoordinates++;
      } else if (t.locationStatus === 'probable') {
        report.probableCoordinates++;
      } else {
        report.probableCoordinates++;
      }
    } else {
      report.coordinatesMissing++;
      report.missingCoordinates++;
    }

    // Maps & Waze URLs (External only, no Google APIs)
    if (t.googleMapsUrl) report.withGoogleMapsUrl++;
    if (t.wazeUrl) report.withWazeUrl++;

    // Images
    if (t.images && t.images.length > 0) report.withImages++;

    // Distance & Duration
    if (t.distanceKm || t.distanceStr) report.withDistance++;
    if (t.durationMinutes || t.durationStr) report.withDuration++;

    // Difficulty
    if (t.difficulty) report.withDifficulty++;

    // Region
    if (t.region) {
      report.withRegion++;
      regionCount.set(t.region, (regionCount.get(t.region) || 0) + 1);
    }

    // Start/End & GPS
    if (t.startPoint) report.withStartPoint++;
    if (t.endPoint) report.withEndPoint++;
    if (t.gpsName) report.withGpsName++;

    // Water & Shade
    if (t.water || t.hasWater) report.withWater++;
    if (t.shade || t.hasShade) report.withShade++;

    // Directions
    if (t.directionsByCar) report.withCarDirections++;
    if (t.directionsByFoot) report.withWalkDirections++;

    // Categories
    if (t.categories && t.categories.length > 0) {
      for (const cat of t.categories) {
        categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
      }
    }

    // Irregular field checks
    if (t.distanceKm && (t.distanceKm < 0 || t.distanceKm > 150)) {
      report.irregularFields.push({
        id: t.id,
        field: 'distanceKm',
        value: String(t.distanceKm),
        reason: 'Unusually high or negative distance value'
      });
    }

    if (t.durationMinutes && (t.durationMinutes < 0 || t.durationMinutes > 1440)) {
      report.irregularFields.push({
        id: t.id,
        field: 'durationMinutes',
        value: String(t.durationMinutes),
        reason: 'Unusually high (>24h) or negative duration value'
      });
    }

    if (t.latitude && (t.latitude < 29.0 || t.latitude > 33.5)) {
      report.irregularFields.push({
        id: t.id,
        field: 'latitude',
        value: String(t.latitude),
        reason: 'Latitude outside bounds of Israel'
      });
    }
  }

  // Record duplicates
  for (const [id, count] of idMap.entries()) {
    if (count > 1) {
      report.duplicateIds.push(id);
    }
  }

  // Categories & Regions summary
  report.categoriesFound = Array.from(categoryCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  report.regionsFound = Array.from(regionCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Write report.json to root and public folder
  const reportPath = path.join(process.cwd(), 'report.json');
  const reportPublicPath = path.join(process.cwd(), 'public', 'data', 'report.json');
  const reportStr = JSON.stringify(report, null, 2);
  fs.writeFileSync(reportPath, reportStr, 'utf8');
  fs.writeFileSync(reportPublicPath, reportStr, 'utf8');

  // Print results
  console.log('\n=================================================');
  console.log('            דוח איכות נתונים (DATA QUALITY REPORT)  ');
  console.log('=================================================');
  console.log(`סך כל המסלולים: ${report.totalTrails}`);
  console.log(`מסלולים עם שם: ${report.withTitle} (${((report.withTitle / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם תיאור: ${report.withDescription} (${((report.withDescription / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם אזור: ${report.withRegion} (${((report.withRegion / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם מרחק: ${report.withDistance} (${((report.withDistance / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם משך טיול: ${report.withDuration} (${((report.withDuration / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם דרגת קושי: ${report.withDifficulty} (${((report.withDifficulty / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם נקודת מוצא: ${report.withStartPoint} (${((report.withStartPoint / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם יעד GPS (מה לכתוב ב-GPS): ${report.withGpsName} (${((report.withGpsName / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם מידע על מים: ${report.withWater} (${((report.withWater / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם מידע על צל: ${report.withShade} (${((report.withShade / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם הוראות הגעה ברכב: ${report.withCarDirections} (${((report.withCarDirections / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם תיאור הליכה: ${report.withWalkDirections} (${((report.withWalkDirections / report.totalTrails) * 100).toFixed(1)}%)`);
  console.log(`מסלולים עם קישור Google Maps: ${report.withGoogleMapsUrl}`);
  console.log(`מסלולים עם קישור Waze: ${report.withWazeUrl}`);
  console.log(`מסלולים עם תמונות: ${report.withImages}`);
  console.log(`מסלולים עם קואורדינטות (על המפה): ${report.withCoordinates}`);
  console.log(`  • קואורדינטות מאומתות (Verified): ${report.verifiedCoordinates}`);
  console.log(`  • קואורדינטות סבירות (Probable): ${report.probableCoordinates}`);
  console.log(`מסלולים ללא קואורדינטות (Missing Coordinates): ${report.missingCoordinates}`);
  console.log(`מסלולים כפולים: ${report.duplicateIds.length}`);
  console.log(`מסלולים ללא שם: ${report.missingTitleFiles.length}`);
  console.log(`שדות עם ערכים חריגים: ${report.irregularFields.length}`);
  console.log('=================================================');
  console.log(`✅ הדוח נשמר בהצלחה אל: ${reportPath} וגם אל ${reportPublicPath}`);
}

validateTrails().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
