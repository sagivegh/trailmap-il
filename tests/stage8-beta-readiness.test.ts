import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { filterAndSortTrails } from '../src/features/search/search-utils';
import { Trail, TrailFilters } from '../src/types/trail';

describe('Stage 8 Beta Readiness Fixes Verification', () => {

  const trailsData: Trail[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../data/trails.json'), 'utf-8')
  );

  const baseFilters: TrailFilters = {
    searchQuery: '',
    selectedRegion: '',
    selectedCategories: [],
    selectedDifficulty: '',
    waterOnly: false,
    shadeOnly: false,
    withCoordinatesOnly: false,
    sortBy: 'name'
  };

  // 1. Difficulty Filter Fix
  describe('1. Difficulty Filter Fix', () => {
    const filterBarPath = path.resolve(__dirname, '../src/features/filters/FilterBar.tsx');
    const filterBarSource = fs.readFileSync(filterBarPath, 'utf-8');
    const searchUtilsPath = path.resolve(__dirname, '../src/features/search/search-utils.ts');
    const searchUtilsSource = fs.readFileSync(searchUtilsPath, 'utf-8');

    it('FilterBar option for challenging trails has value="מאתגרת" and label "קשה / מאתגרת"', () => {
      expect(filterBarSource).toContain('<option value="מאתגרת">קשה / מאתגרת</option>');
    });

    it('search-utils.ts treats both "מאתגרת" and "קשה" as matching challenging trails', () => {
      expect(searchUtilsSource).toContain("filters.selectedDifficulty === 'מאתגרת' || filters.selectedDifficulty === 'קשה'");
    });

    it('filtering by "מאתגרת" returns all 60 challenging trails', () => {
      const results = filterAndSortTrails(trailsData, { ...baseFilters, selectedDifficulty: 'מאתגרת' }, null);
      expect(results.length).toBe(60);
      results.forEach(trail => {
        expect(trail.difficulty).toBe('מאתגרת');
      });
    });

    it('filtering by "קשה" also returns all 60 challenging trails (robust normalization)', () => {
      const results = filterAndSortTrails(trailsData, { ...baseFilters, selectedDifficulty: 'קשה' }, null);
      expect(results.length).toBe(60);
    });

    it('filtering by "קלה" returns exactly 1,216 trails', () => {
      const results = filterAndSortTrails(trailsData, { ...baseFilters, selectedDifficulty: 'קלה' }, null);
      expect(results.length).toBe(1216);
    });

    it('filtering by "בינונית" returns exactly 503 trails', () => {
      const results = filterAndSortTrails(trailsData, { ...baseFilters, selectedDifficulty: 'בינונית' }, null);
      expect(results.length).toBe(503);
    });

    it('filtering with empty string returns all 1,783 trails', () => {
      const results = filterAndSortTrails(trailsData, { ...baseFilters, selectedDifficulty: '' }, null);
      expect(results.length).toBe(1783);
    });
  });

  // 2. Route Type on Trail Cards
  describe('2. Route Type on Trail Cards', () => {
    const cardPath = path.resolve(__dirname, '../src/features/trails/TrailCard.tsx');
    const cardSource = fs.readFileSync(cardPath, 'utf-8');

    it('imports RotateCcw and Repeat icons from lucide-react', () => {
      expect(cardSource).toContain('RotateCcw');
      expect(cardSource).toContain('Repeat');
    });

    it('extracts walkingType from trail, practicalInfo, or sourceFacts', () => {
      expect(cardSource).toContain('trail.walkingType || trail.practicalInfo?.walkingType || trail.sourceFacts?.walkingType');
    });

    it('renders "מעגלי" with RotateCcw icon for circular trails', () => {
      expect(cardSource).toContain('isCircular');
      expect(cardSource).toContain('<RotateCcw');
      expect(cardSource).toContain('<span>מעגלי</span>');
    });

    it('renders "הלוך-חזור" with Repeat icon for out-and-back trails', () => {
      expect(cardSource).toContain('isOutAndBack');
      expect(cardSource).toContain('<Repeat');
      expect(cardSource).toContain('<span>{walkingType?.includes(\'קווי\') ? \'קווי\' : \'הלוך-חזור\'}</span>');
    });

    it('does not invent route type when missing (204 trails with undefined walkingType remain unbadged)', () => {
      const missingWalkingType = trailsData.filter(
        t => !(t.walkingType || t.practicalInfo?.walkingType || t.sourceFacts?.walkingType)
      );
      expect(missingWalkingType.length).toBe(204);

      // Verify the card returns null when walkingType is absent
      expect(cardSource).toContain(': null}');
    });

    it('dataset contains 475 circular and 1,104 out-and-back trails', () => {
      const circular = trailsData.filter(t => (t.walkingType || t.practicalInfo?.walkingType || t.sourceFacts?.walkingType) === 'מעגלי');
      const outAndBack = trailsData.filter(t => (t.walkingType || t.practicalInfo?.walkingType || t.sourceFacts?.walkingType) === 'הלוך-חזור');
      expect(circular.length).toBe(475);
      expect(outAndBack.length).toBe(1104);
      expect(circular.length + outAndBack.length + 204).toBe(1783);
    });
  });

  // 3. 4x4 / Vehicle Warning on Trail Cards & Modal
  describe('3. 4x4 / Vehicle Warning on Trail Cards & Modal', () => {
    const cardPath = path.resolve(__dirname, '../src/features/trails/TrailCard.tsx');
    const cardSource = fs.readFileSync(cardPath, 'utf-8');
    const modalPath = path.resolve(__dirname, '../src/features/trails/TrailDetailModal.tsx');
    const modalSource = fs.readFileSync(modalPath, 'utf-8');

    it('accurately identifies the 27 trails requiring a 4x4 vehicle in dataset', () => {
      const fourByFourTrails = trailsData.filter(
        t => t.sourceFacts?.fourByFourRequired === true || t.fourByFourRequired === true
      );
      expect(fourByFourTrails.length).toBe(27);
    });

    it('TrailCard renders "4x4 בלבד" badge and pill only when is4x4 is true', () => {
      expect(cardSource).toContain('data-testid="trail-card-4x4-badge"');
      expect(cardSource).toContain('data-testid="trail-card-4x4-pill"');
      expect(cardSource).toContain('4x4 בלבד');
      // Must check that is4x4 gates the rendering
      expect(cardSource).toContain('{is4x4 && (');
    });

    it('TrailDetailModal renders prominent 4x4 warning banner near top of modal for 4x4 trails', () => {
      expect(modalSource).toContain('data-testid="modal-4x4-warning"');
      expect(modalSource).toContain('שימו לב: הגישה למסלול זה דורשת רכב שטח (4x4 בלבד)');
      expect(modalSource).toContain('{is4x4 && (');
    });

    it('TrailDetailModal renders conditional staging warning for passenger cars when vehicle caveats exist', () => {
      expect(modalSource).toContain('data-testid="modal-conditional-vehicle-warning"');
      expect(modalSource).toContain('הנחיות חניה והגעה ברכב:');
      expect(modalSource).toContain('!is4x4 && hasVehicleCaveat');
    });

    it('Birkat Tzfira trail triggers conditional vehicle staging callout', () => {
      const birkatTzfira = trailsData.find(t => t.id === 'אל-בריכת-צפירה-שבנחל-צאלים-מסלול-טיול');
      expect(birkatTzfira).toBeDefined();
      expect(birkatTzfira?.sourceFacts?.fourByFourRequired).toBeFalsy();
      expect(birkatTzfira?.sourceFacts?.vehicleRequirements).toContain('1.5 ק"מ');
      expect(birkatTzfira?.sourceFacts?.vehicleRequirements).toContain('חניון לילה נחל צפירה');
    });
  });

  // 4. Safe Card Navigation
  describe('4. Safe Card Navigation', () => {
    const cardPath = path.resolve(__dirname, '../src/features/trails/TrailCard.tsx');
    const cardSource = fs.readFileSync(cardPath, 'utf-8');

    it('intercepts "נווט" click when trail has vehicle caveat', () => {
      expect(cardSource).toContain('hasVehicleCaveat');
      expect(cardSource).toContain('e.preventDefault()');
      expect(cardSource).toContain('setShowNavWarning(true)');
    });

    it('renders accessible confirmation dialog for caveat navigation', () => {
      expect(cardSource).toContain('data-testid="nav-warning-dialog"');
      expect(cardSource).toContain('role="dialog"');
      expect(cardSource).toContain('aria-modal="true"');
      expect(cardSource).toContain('data-testid="nav-warning-cancel"');
      expect(cardSource).toContain('data-testid="nav-warning-proceed"');
      expect(cardSource).toContain('הבנתי, המשך לניווט');
      expect(cardSource).toContain('ביטול');
    });

    it('implements Escape key handler to dismiss navigation warning dialog', () => {
      expect(cardSource).toContain("e.key === 'Escape'");
      expect(cardSource).toContain('setShowNavWarning(false)');
    });

    it('stops click propagation to avoid selecting card or opening details modal accidentally', () => {
      expect(cardSource).toContain('e.stopPropagation()');
    });

    it('proceed button opens navUrl in a new tab when user confirms', () => {
      expect(cardSource).toContain("window.open(navUrl, '_blank', 'noopener,noreferrer')");
    });
  });
});
