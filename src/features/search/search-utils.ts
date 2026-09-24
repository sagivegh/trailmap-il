import { Trail, TrailFilters } from '../../types/trail';
import { calculateDistanceKm, fuzzyHebrewMatch } from '../../utils/geo';

export interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function filterAndSortTrails(
  trails: Trail[],
  filters: TrailFilters,
  userLocation: { lat: number; lng: number } | null,
  viewportBounds?: ViewportBounds | null,
  filterByViewport: boolean = false
): Trail[] {
  // First calculate distanceFromUserKm if userLocation is available
  const prepared = trails.map(t => {
    let dist: number | undefined;
    if (userLocation && t.latitude && t.longitude) {
      dist = calculateDistanceKm(userLocation.lat, userLocation.lng, t.latitude, t.longitude);
    }
    return { ...t, distanceFromUserKm: dist };
  });

  const filtered = prepared.filter(trail => {
    // 1. Text Search across title, description, region, categories, startPoint, endPoint, gpsName
    if (filters.searchQuery) {
      const q = filters.searchQuery.trim();
      const matchTitle = fuzzyHebrewMatch(trail.title, q);
      const matchSubtitle = trail.subtitle ? fuzzyHebrewMatch(trail.subtitle, q) : false;
      const matchDesc = trail.description ? fuzzyHebrewMatch(trail.description, q) : false;
      const matchRegion = trail.region ? fuzzyHebrewMatch(trail.region, q) : false;
      const matchStart = trail.startPoint ? fuzzyHebrewMatch(trail.startPoint, q) : false;
      const matchEnd = trail.endPoint ? fuzzyHebrewMatch(trail.endPoint, q) : false;
      const matchGps = trail.gpsName ? fuzzyHebrewMatch(trail.gpsName, q) : false;
      const matchCat = trail.categories.some(c => fuzzyHebrewMatch(c, q));
      const matchLandmark = trail.sourceFacts?.landmarks
        ? trail.sourceFacts.landmarks.some(lm => fuzzyHebrewMatch(lm, q))
        : false;

      if (
        !matchTitle &&
        !matchSubtitle &&
        !matchDesc &&
        !matchRegion &&
        !matchStart &&
        !matchEnd &&
        !matchGps &&
        !matchCat &&
        !matchLandmark
      ) {
        return false;
      }
    }

    // 2. Region filter
    if (filters.selectedRegion) {
      if (!trail.region || !trail.region.includes(filters.selectedRegion)) {
        return false;
      }
    }

    // 3. Category filters
    if (filters.selectedCategories.length > 0) {
      const hasAllCategories = filters.selectedCategories.every(cat =>
        trail.categories.includes(cat) ||
        (cat === 'מים' && trail.hasWater) ||
        (cat === 'צל' && trail.hasShade)
      );
      if (!hasAllCategories) return false;
    }

    // 4. Difficulty filter
    if (filters.selectedDifficulty) {
      if (filters.selectedDifficulty === 'מאתגרת' || filters.selectedDifficulty === 'קשה') {
        if (!trail.difficulty || (!trail.difficulty.includes('מאתגרת') && !trail.difficulty.includes('קשה'))) {
          return false;
        }
      } else {
        if (!trail.difficulty || !trail.difficulty.includes(filters.selectedDifficulty)) {
          return false;
        }
      }
    }

    // 5. Water filter
    if (filters.waterOnly && !trail.hasWater) {
      return false;
    }

    // 6. Shade filter
    if (filters.shadeOnly && !trail.hasShade) {
      return false;
    }

    // 7. Max Distance (trail walk distance)
    if (filters.maxDistanceKm && trail.distanceKm && trail.distanceKm > filters.maxDistanceKm) {
      return false;
    }

    // 8. Max Duration (trail walk duration)
    if (filters.maxDurationMinutes && trail.durationMinutes && trail.durationMinutes > filters.maxDurationMinutes) {
      return false;
    }

    // 9. Coordinates presence filter
    if (filters.withCoordinatesOnly && trail.coordinatesMissing) {
      return false;
    }

    // 10. Location Status filter ('verified' | 'probable' | 'missing')
    if (filters.locationStatusFilter && filters.locationStatusFilter !== 'all') {
      if (trail.locationStatus !== filters.locationStatusFilter) {
        return false;
      }
    }

    // 11. Near Me Distance Radius Filter (5km, 10km, 25km, 50km, 100km)
    if (filters.maxDistanceRadiusKm && trail.distanceFromUserKm !== undefined) {
      if (trail.distanceFromUserKm > filters.maxDistanceRadiusKm) {
        return false;
      }
    }

    // 12. Viewport Filtering ("Trails in this area")
    if (filterByViewport && viewportBounds) {
      if (trail.coordinatesMissing || !trail.latitude || !trail.longitude) {
        return false; // Skip unlocated trails when filtering by active map viewport
      }
      const buffer = 0.02; // Small buffer around bounds
      const inLat = trail.latitude >= viewportBounds.minLat - buffer && trail.latitude <= viewportBounds.maxLat + buffer;
      const inLng = trail.longitude >= viewportBounds.minLng - buffer && trail.longitude <= viewportBounds.maxLng + buffer;
      if (!inLat || !inLng) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'nearMe': {
        if (a.distanceFromUserKm !== undefined && b.distanceFromUserKm !== undefined) {
          return a.distanceFromUserKm - b.distanceFromUserKm;
        }
        if (a.distanceFromUserKm !== undefined) return -1;
        if (b.distanceFromUserKm !== undefined) return 1;
        return 0;
      }
      case 'distance': {
        const d1 = a.distanceKm ?? 999;
        const d2 = b.distanceKm ?? 999;
        return d1 - d2;
      }
      case 'duration': {
        const d1 = a.durationMinutes ?? 9999;
        const d2 = b.durationMinutes ?? 9999;
        return d1 - d2;
      }
      case 'name': {
        return a.title.localeCompare(b.title, 'he');
      }
      case 'water': {
        if (a.hasWater && !b.hasWater) return -1;
        if (!a.hasWater && b.hasWater) return 1;
        return 0;
      }
      case 'hasCoords': {
        if (!a.coordinatesMissing && b.coordinatesMissing) return -1;
        if (a.coordinatesMissing && !b.coordinatesMissing) return 1;
        return 0;
      }
      default:
        return 0;
    }
  });
}
