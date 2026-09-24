// Haversine formula to calculate distance between two coordinates in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Center of Israel
export const ISRAEL_CENTER: [number, number] = [35.0, 31.5]; // [lng, lat]
export const ISRAEL_DEFAULT_ZOOM = 7.5;

// Normalize Hebrew text for search (strip niqqud, normalize dashes/quotes)
export function normalizeHebrewText(text: string): string {
  if (!text) return '';
  return text
    // Remove Hebrew vocalization (niqqud)
    .replace(/[\u0591-\u05C7]/g, '')
    // Replace various dashes with standard dash
    .replace(/[–—־]/g, '-')
    // Replace various quotes with standard quote
    .replace(/[“”״]/g, '"')
    .replace(/[‘’׳]/g, "'")
    .toLowerCase()
    .trim();
}

// Basic Hebrew fuzzy match: returns true if target contains all search words or is close
export function fuzzyHebrewMatch(target: string, query: string): boolean {
  if (!query) return true;
  if (!target) return false;

  const normTarget = normalizeHebrewText(target);
  const normQuery = normalizeHebrewText(query);

  if (normTarget.includes(normQuery)) return true;

  const queryWords = normQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return true;

  // All words must match (or match with 1 character typo)
  return queryWords.every(word => {
    if (normTarget.includes(word)) return true;
    if (word.length >= 4) {
      // Check partial substrings
      const prefix = word.slice(0, -1);
      const suffix = word.slice(1);
      if (normTarget.includes(prefix) || normTarget.includes(suffix)) return true;
    }
    return false;
  });
}
