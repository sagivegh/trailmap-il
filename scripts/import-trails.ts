import fs from 'fs';
import path from 'path';
import { parseTrailMarkdown } from '../src/parser/trail-parser';
import { transformTrailContent } from '../src/parser/content-transformer';
import { Trail, GeocodingTodoItem } from '../src/types/trail';

async function importTrails() {
  console.log('🚀 Starting Trail Import Process...');
  const startTime = Date.now();

  const inputDir = path.join(process.cwd(), 'extracted_clean', 'markdown');
  const publicDataDir = path.join(process.cwd(), 'public', 'data');
  const rawMarkdownDir = path.join(publicDataDir, 'raw');
  const rootDataDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(publicDataDir)) fs.mkdirSync(publicDataDir, { recursive: true });
  if (!fs.existsSync(rawMarkdownDir)) fs.mkdirSync(rawMarkdownDir, { recursive: true });
  if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir, { recursive: true });

  if (!fs.existsSync(inputDir)) {
    throw new Error(`Input directory not found: ${inputDir}`);
  }

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.md'));
  console.log(`📁 Found ${files.length} markdown files to parse.`);

  const trails: Trail[] = [];
  const geocodingTodo: GeocodingTodoItem[] = [];
  const parsingErrors: Array<{ file: string; error: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(inputDir, filename);

    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Parse structured trail and transform to original TrailMap architecture
      const rawParsed = parseTrailMarkdown(content, filename);
      const { transformedTrail } = transformTrailContent(rawParsed, content, filename);
      trails.push(transformedTrail);

      // Save raw markdown file for on-demand lazy loading by app
      const rawDestPath = path.join(rawMarkdownDir, `${transformedTrail.id}.md`);
      fs.writeFileSync(rawDestPath, content, 'utf8');

      // If coordinates missing, record in geocoding-todo.json
      if (transformedTrail.coordinatesMissing) {
        geocodingTodo.push({
          id: transformedTrail.id,
          title: transformedTrail.title,
          gpsName: transformedTrail.gpsName,
          startPoint: transformedTrail.startPoint,
          endPoint: transformedTrail.endPoint,
          sourceFile: filename,
          region: transformedTrail.region
        });
      }
    } catch (err: any) {
      console.error(`❌ Error parsing ${filename}:`, err.message);
      parsingErrors.push({ file: filename, error: err.message });
    }

    if ((i + 1) % 250 === 0 || i === files.length - 1) {
      console.log(`⏳ Processed ${i + 1}/${files.length} trails...`);
    }
  }

  // Write output trails.json into public/data/trails.json and data/trails.json
  const trailsJsonPathPublic = path.join(publicDataDir, 'trails.json');
  const trailsJsonPathData = path.join(rootDataDir, 'trails.json');
  const geocodingTodoPath = path.join(rootDataDir, 'geocoding-todo.json');
  const geocodingTodoPublic = path.join(publicDataDir, 'geocoding-todo.json');

  const trailsJsonStr = JSON.stringify(trails, null, 2);
  fs.writeFileSync(trailsJsonPathPublic, trailsJsonStr, 'utf8');
  fs.writeFileSync(trailsJsonPathData, trailsJsonStr, 'utf8');

  const todoJsonStr = JSON.stringify(geocodingTodo, null, 2);
  fs.writeFileSync(geocodingTodoPath, todoJsonStr, 'utf8');
  fs.writeFileSync(geocodingTodoPublic, todoJsonStr, 'utf8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Import Complete in ${durationSec}s!`);
  console.log(`📊 Successfully parsed: ${trails.length} trails`);
  console.log(`📍 Geocoding Todo list: ${geocodingTodo.length} trails saved to data/geocoding-todo.json`);
  console.log(`💾 JSON files written to:`);
  console.log(`   - ${trailsJsonPathPublic}`);
  console.log(`   - ${trailsJsonPathData}`);
  console.log(`   - ${rawMarkdownDir} (${trails.length} individual .md files)`);

  if (parsingErrors.length > 0) {
    console.warn(`⚠️ Encountered ${parsingErrors.length} parsing errors.`);
  }
}

importTrails().catch(err => {
  console.error('Fatal import error:', err);
  process.exit(1);
});
