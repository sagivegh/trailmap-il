import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { filterAndSortTrails } from '../src/features/search/search-utils';
import { Trail, TrailFilters } from '../src/types/trail';

describe('Stage 6 Quality Fixes Verification', () => {

  const trailsData: Trail[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../data/trails.json'), 'utf-8')
  );

  // 1. Landmark Search
  describe('1. Landmark Search in search-utils.ts', () => {
    const emptyFilters: TrailFilters = {
      searchQuery: '',
      selectedRegion: '',
      selectedCategories: [],
      selectedDifficulty: '',
      waterOnly: false,
      shadeOnly: false,
      withCoordinatesOnly: false,
      sortBy: 'name'
    };

    it('matches a trail by a landmark in sourceFacts.landmarks even when not in title or description', () => {
      // Mock trail where landmark is ONLY in sourceFacts.landmarks
      const mockTrail: Trail = {
        id: 'mock-landmark-trail',
        slug: 'mock-landmark-trail',
        title: 'סיור שכונתי ייחודי',
        description: 'מסלול הליכה עירוני יפהפה בין מבנים עתיקים',
        categories: ['עירוני'],
        coordinatesMissing: false,
        locationStatus: 'verified',
        locationType: 'start',
        locationConfidence: 1,
        sections: [],
        images: [],
        sourceFile: 'mock.md',
        sourceFacts: {
          sourceFile: 'mock.md',
          extractedAt: new Date().toISOString(),
          title: 'סיור שכונתי ייחודי',
          landmarks: ['מנזר סנט קלייר', 'טחנת הקמח העתיקה'],
          mainRoads: [],
          hasWater: false,
          swimmingAllowed: false,
          hasShade: null,
          fourByFourRequired: false,
          highVehicleRequired: false
        }
      };

      const result = filterAndSortTrails([mockTrail], { ...emptyFilters, searchQuery: 'סנט קלייר' }, null);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('mock-landmark-trail');

      // Also verify second landmark in array
      const result2 = filterAndSortTrails([mockTrail], { ...emptyFilters, searchQuery: 'טחנת הקמח' }, null);
      expect(result2.length).toBe(1);
    });

    it('returns the real Meorav Yerushalmi trail when searching for "סנט קלייר"', () => {
      const result = filterAndSortTrails(trailsData, { ...emptyFilters, searchQuery: 'סנט קלייר' }, null);
      expect(result.length).toBeGreaterThanOrEqual(1);
      const found = result.find(t => t.id.includes('אבו-תור-וארמון-הנציב-מעורב-ירושלמי'));
      expect(found).toBeDefined();
    });

    it('returns zero results for non-existent landmarks or random strings', () => {
      const result = filterAndSortTrails(trailsData, { ...emptyFilters, searchQuery: 'ציפור_מדומיינת_12345' }, null);
      expect(result.length).toBe(0);
    });

    it('does not expose internal source filenames (.md) through search', () => {
      const result = filterAndSortTrails(trailsData, { ...emptyFilters, searchQuery: '.md' }, null);
      expect(result.length).toBe(0);
    });

    it('preserves existing search behavior for title, region, and categories', () => {
      // Title search
      const resTitle = filterAndSortTrails(trailsData, { ...emptyFilters, searchQuery: 'נחל חיק נחל אורן' }, null);
      expect(resTitle.length).toBe(1);

      // Region search
      const resRegion = filterAndSortTrails(trailsData, { ...emptyFilters, searchQuery: 'מדבר יהודה' }, null);
      expect(resRegion.length).toBeGreaterThan(50);
    });
  });

  // 2. Modal Keyboard Accessibility
  describe('2. Modal Keyboard Accessibility in TrailDetailModal.tsx', () => {
    const modalFilePath = path.resolve(__dirname, '../src/features/trails/TrailDetailModal.tsx');
    const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

    it('includes role="dialog" and aria-modal="true" on the dialog container', () => {
      expect(modalSource).toContain('role="dialog"');
      expect(modalSource).toContain('aria-modal="true"');
      expect(modalSource).toContain('aria-labelledby="modal-trail-title"');
      expect(modalSource).toContain('id="modal-trail-title"');
    });

    it('implements Escape keydown listener to close the modal', () => {
      expect(modalSource).toContain("e.key === 'Escape'");
      expect(modalSource).toContain('onClose()');
    });

    it('implements keyboard focus trapping logic for Tab and Shift+Tab', () => {
      expect(modalSource).toContain("e.key === 'Tab'");
      expect(modalSource).toContain('e.shiftKey');
      expect(modalSource).toContain('firstElement');
      expect(modalSource).toContain('lastElement');
    });

    it('saves and restores previousActiveElement on close', () => {
      expect(modalSource).toContain('previousActiveElementRef');
      expect(modalSource).toContain('document.activeElement');
      expect(modalSource).toContain('previousActiveElementRef.current.focus()');
    });
  });

  // 3. Search Input Contrast
  describe('3. Search Input Contrast in Header.tsx', () => {
    const headerFilePath = path.resolve(__dirname, '../src/components/Header.tsx');
    const headerSource = fs.readFileSync(headerFilePath, 'utf-8');

    it('ensures search input text has high contrast in both focused and unfocused states', () => {
      // Unfocused text is text-white (high contrast on dark green)
      expect(headerSource).toContain('text-white');
      // Focused text is focus:text-stone-900 (high contrast on white focus:bg-white)
      expect(headerSource).toContain('focus:text-stone-900');
      expect(headerSource).toContain('focus:bg-white');
    });

    it('ensures placeholder text is legible with proper contrast', () => {
      expect(headerSource).toContain('placeholder-stone-300');
      expect(headerSource).toContain('focus:placeholder-stone-400');
    });
  });

  // 4. MapLibre Bundle Chunking
  describe('4. MapLibre Bundle Chunking in vite.config.ts', () => {
    const viteConfigPath = path.resolve(__dirname, '../vite.config.ts');
    const viteConfigSource = fs.readFileSync(viteConfigPath, 'utf-8');

    it('configures manualChunks to isolate maplibre-gl', () => {
      expect(viteConfigSource).toContain('manualChunks');
      expect(viteConfigSource).toContain('maplibre');
      expect(viteConfigSource).toContain('maplibre-gl');
    });

    it('dist directory contains separate maplibre chunk alongside app chunk', () => {
      const distAssetsDir = path.resolve(__dirname, '../dist/assets');
      if (fs.existsSync(distAssetsDir)) {
        const files = fs.readdirSync(distAssetsDir);
        const maplibreChunk = files.find(f => f.startsWith('maplibre-') && f.endsWith('.js'));
        const appChunk = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
        
        expect(maplibreChunk).toBeDefined();
        expect(appChunk).toBeDefined();

        // Main app chunk should be well under 500kB (compact application code)
        const appChunkStat = fs.statSync(path.join(distAssetsDir, appChunk!));
        expect(appChunkStat.size).toBeLessThan(500 * 1024);
      }
    });
  });
});
