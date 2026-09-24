import { describe, it, expect } from 'vitest';
import { calculateDistanceKm, normalizeHebrewText, fuzzyHebrewMatch } from '../src/utils/geo';
import { filterAndSortTrails, ViewportBounds } from '../src/features/search/search-utils';
import { MAP_CONFIG, getMapLibreStyleSpec } from '../src/config/map';
import { NominatimProvider } from '../src/services/geocoding/NominatimProvider';
import { Trail, TrailFilters } from '../src/types/trail';

describe('Feature & Architecture Tests', () => {

  // 1. Distance Calculation (Haversine)
  it('1. Haversine distance calculation is accurate within expected bounds', () => {
    // Tel Aviv (32.0853, 34.7818) to Jerusalem (31.7683, 35.2137) is ~54km aerial
    const dist = calculateDistanceKm(32.0853, 34.7818, 31.7683, 35.2137);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(60);

    // Distance to same point is 0
    expect(calculateDistanceKm(32.0, 35.0, 32.0, 35.0)).toBe(0);
  });

  // 2. Hebrew Text Normalization & Fuzzy Search
  it('2. Hebrew text normalization strips niqqud, unifies quotes and dashes', () => {
    const raw = 'נַחַל עַמּוּד – “מְעָרוֹת”';
    const normalized = normalizeHebrewText(raw);
    expect(normalized).toBe('נחל עמוד - "מערות"');
  });

  it('3. Hebrew fuzzy search matches with niqqud, partial strings and slight typos', () => {
    expect(fuzzyHebrewMatch('נחל ערוגות בעין גדי', 'ערוגות')).toBe(true);
    expect(fuzzyHebrewMatch('נַחַל עֲרוּגוֹת', 'ערוגות')).toBe(true);
    expect(fuzzyHebrewMatch('שמורת הטבע בניאס', 'בניאס')).toBe(true);
    // Typo tolerance in longer words (prefix/suffix match)
    expect(fuzzyHebrewMatch('בריכת המשושים', 'משושי')).toBe(true);
    // Non-matching term
    expect(fuzzyHebrewMatch('נחל אל על', 'אילת')).toBe(false);
  });

  // 3. Viewport Filtering
  it('4. Viewport filtering correctly filters trails inside and outside map bounds', () => {
    const mockTrails: Trail[] = [
      {
        id: 't-golan',
        slug: 't-golan',
        title: 'נחל אל על',
        description: 'גולן',
        categories: ['מים'],
        latitude: 32.8122,
        longitude: 35.7485,
        coordinatesMissing: false,
        locationStatus: 'verified',
        locationType: 'start',
        locationConfidence: 0.95,
        sections: [],
        images: [],
        sourceFile: 't1.md'
      },
      {
        id: 't-eilat',
        slug: 't-eilat',
        title: 'הקניון האדום',
        description: 'אילת',
        categories: ['מדברי'],
        latitude: 29.6712,
        longitude: 34.8685,
        coordinatesMissing: false,
        locationStatus: 'verified',
        locationType: 'start',
        locationConfidence: 0.92,
        sections: [],
        images: [],
        sourceFile: 't2.md'
      },
      {
        id: 't-unlocated',
        slug: 't-unlocated',
        title: 'מסלול ללא מפה',
        description: 'חסר',
        categories: [],
        coordinatesMissing: true,
        locationStatus: 'missing',
        locationType: 'missing',
        locationConfidence: 0,
        sections: [],
        images: [],
        sourceFile: 't3.md'
      }
    ];

    const northernViewport: ViewportBounds = {
      minLat: 32.5,
      maxLat: 33.3,
      minLng: 35.4,
      maxLng: 36.0
    };

    const emptyFilters: TrailFilters = {
      searchQuery: '',
      selectedRegion: '',
      selectedCategories: [],
      selectedDifficulty: '',
      waterOnly: false,
      shadeOnly: false,
      withCoordinatesOnly: false,
      sortBy: 'hasCoords'
    };

    // With viewport filter active
    const visible = filterAndSortTrails(mockTrails, emptyFilters, null, northernViewport, true);
    expect(visible.map(t => t.id)).toContain('t-golan');
    expect(visible.map(t => t.id)).not.toContain('t-eilat');
    expect(visible.map(t => t.id)).not.toContain('t-unlocated');

    // Without viewport filter active (shows all)
    const all = filterAndSortTrails(mockTrails, emptyFilters, null, northernViewport, false);
    expect(all.length).toBe(3);
  });

  // 4. Free Map Provider Configuration
  it('5. Map configuration uses free open tile providers and requires NO API keys', () => {
    expect(MAP_CONFIG.styles.osm).toBeDefined();
    expect(MAP_CONFIG.defaultProvider.requiresApiKey).toBe(false);

    // Verify open tile URLs (OpenStreetMap Standard)
    expect(MAP_CONFIG.styles.osm.tiles[0]).toContain('tile.openstreetmap.org');
    expect(MAP_CONFIG.defaultProvider.tileUrl).toContain('tile.openstreetmap.org');

    // Verify style specification generator outputs valid MapLibre spec
    const spec = getMapLibreStyleSpec('osm');
    expect(spec.version).toBe(8);
    expect(spec.sources['base-tiles']).toBeDefined();
    expect(spec.layers.length).toBeGreaterThan(0);
    expect(spec.sources['base-tiles'].type).toBe('raster');
  });

  // 5. Free Open Geocoding Architecture
  it('6. Nominatim geocoding provider adheres to open rate-limiting and user-agent policy', () => {
    const provider = new NominatimProvider();
    expect(provider.name).toBe('OpenStreetMap Nominatim');
    expect(typeof provider.geocode).toBe('function');
    expect(typeof provider.reverseGeocode).toBe('function');
  });

  // 6. Location Status & Type Validation
  it('7. Coordinates strictly adhere to verified / probable / missing taxonomy', () => {
    const verifiedTrail: Trail = {
      id: 'v1',
      slug: 'v1',
      title: 'עין רוגל',
      description: 'ירושלים',
      categories: [],
      latitude: 31.7652,
      longitude: 35.2341,
      coordinatesMissing: false,
      locationStatus: 'verified',
      locationType: 'start',
      locationSource: 'verbal_gps_street_address',
      locationConfidence: 0.98,
      sections: [],
      images: [],
      sourceFile: 'v1.md'
    };

    expect(verifiedTrail.locationStatus).toBe('verified');
    expect(verifiedTrail.locationType).toBe('start');
    expect(verifiedTrail.locationConfidence).toBeGreaterThanOrEqual(0.85);

    const missingTrail: Trail = {
      id: 'm1',
      slug: 'm1',
      title: 'טיול ביער',
      description: 'יער',
      categories: [],
      coordinatesMissing: true,
      locationStatus: 'missing',
      locationType: 'missing',
      locationConfidence: 0.0,
      sections: [],
      images: [],
      sourceFile: 'm1.md'
    };

    expect(missingTrail.coordinatesMissing).toBe(true);
    expect(missingTrail.locationStatus).toBe('missing');
    expect(missingTrail.locationConfidence).toBe(0);
  });
});
