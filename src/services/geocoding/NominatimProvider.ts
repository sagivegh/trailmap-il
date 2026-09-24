import { GeocodingProvider, GeocodingResult, GeocodingOptions } from './types';
import { LocationType } from '../../types/trail';

const CACHE_KEY_PREFIX = 'trailmap_geo_cache_';
const RATE_LIMIT_DELAY_MS = 1100; // Nominatim requires max 1 request/sec

export interface GeocodingCacheAdapter {
  get(key: string): GeocodingResult | null | undefined;
  set(key: string, result: GeocodingResult | null): void;
}

export class NominatimProvider implements GeocodingProvider {
  readonly name = 'OpenStreetMap Nominatim';
  private lastRequestTime = 0;
  private memoryCache = new Map<string, GeocodingResult | null>();

  constructor(private cacheAdapter?: GeocodingCacheAdapter) {}

  private getCached(query: string): GeocodingResult | null | undefined {
    const norm = query.trim().toLowerCase();
    if (this.memoryCache.has(norm)) {
      return this.memoryCache.get(norm);
    }
    if (this.cacheAdapter) {
      const adapterRes = this.cacheAdapter.get(norm);
      if (adapterRes !== undefined) {
        this.memoryCache.set(norm, adapterRes);
        return adapterRes;
      }
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(CACHE_KEY_PREFIX + norm);
        if (item) {
          const parsed = JSON.parse(item) as GeocodingResult | null;
          this.memoryCache.set(norm, parsed);
          return parsed;
        }
      }
    } catch {
      // localStorage may fail in some environments
    }
    return undefined;
  }

  private setCached(query: string, result: GeocodingResult | null): void {
    const norm = query.trim().toLowerCase();
    this.memoryCache.set(norm, result);
    if (this.cacheAdapter) {
      this.cacheAdapter.set(norm, result);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CACHE_KEY_PREFIX + norm, JSON.stringify(result));
      }
    } catch {
      // Ignore storage quota errors
    }
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async geocode(query: string, options: GeocodingOptions = {}): Promise<GeocodingResult | null> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    // Check cache first - NEVER repeat identical queries
    const cached = this.getCached(cleanQuery);
    if (cached !== undefined) {
      return cached;
    }

    await this.throttle();

    try {
      const limit = options.limit || 3;
      const params = new URLSearchParams({
        q: cleanQuery,
        format: 'json',
        addressdetails: '1',
        countrycodes: options.countryCode || 'il',
        limit: String(limit)
      });

      // Israel bounding box [minLng, minLat, maxLng, maxLat]
      const vb = options.viewbox || [34.1, 29.4, 35.9, 33.4];
      params.append('viewbox', `${vb[0]},${vb[3]},${vb[2]},${vb[1]}`); // [left,top,right,bottom]
      if (options.bounded !== false) {
        params.append('bounded', '1');
      }

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TrailMap-Hiking-IL/1.0 (https://github.com/hiking-il; open source hiking discovery)'
        }
      });

      if (!response.ok) {
        console.warn(`Nominatim geocoding HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        this.setCached(cleanQuery, null);
        return null;
      }

      // Check coordinates validity (Israel bounds)
      const validResults = data.filter((item: any) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        return lat >= 29.4 && lat <= 33.4 && lon >= 34.1 && lon <= 35.9;
      });

      if (validResults.length === 0) {
        this.setCached(cleanQuery, null);
        return null;
      }

      const top = validResults[0];
      const lat = parseFloat(top.lat);
      const lng = parseFloat(top.lon);

      // Ambiguity detection: If multiple results are more than 2.5km apart
      let isAmbiguous = false;
      if (validResults.length > 1) {
        for (let i = 1; i < validResults.length; i++) {
          const lat2 = parseFloat(validResults[i].lat);
          const lon2 = parseFloat(validResults[i].lon);
          const distKm = Math.sqrt(Math.pow((lat - lat2) * 111, 2) + Math.pow((lng - lon2) * 95, 2));
          if (distKm > 2.5) {
            isAmbiguous = true;
            break;
          }
        }
      }

      // Determine location type and reason
      let locationType: LocationType = 'poi';
      let reason = 'Nominatim POI matched';
      let baseConfidence = top.importance ? Math.min(Math.max(top.importance, 0.4), 0.95) : 0.65;

      if (top.type === 'street' || top.type === 'house' || top.class === 'highway') {
        locationType = 'start';
        reason = 'Exact street address found in source';
        baseConfidence = Math.max(baseConfidence, 0.90);
      } else if (top.type === 'parking' || top.class === 'amenity') {
        locationType = 'start';
        reason = 'Named parking lot matched';
        baseConfidence = Math.max(baseConfidence, 0.90);
      } else if (top.type === 'national_park' || top.type === 'nature_reserve' || top.type === 'protected_area') {
        locationType = 'destination';
        reason = 'Named nature reserve matched';
        baseConfidence = Math.max(baseConfidence, 0.90);
      } else if (top.type === 'spring' || top.type === 'water') {
        locationType = 'poi';
        reason = 'Named spring / natural pool matched';
        baseConfidence = Math.max(baseConfidence, 0.85);
      } else if (top.class === 'place') {
        locationType = 'approximate';
        reason = 'Settlement landmark matched';
        baseConfidence = 0.70;
      }

      if (isAmbiguous) {
        reason = 'Multiple ambiguous locations found in search results';
        baseConfidence = Math.min(baseConfidence, 0.55);
      }

      const result: GeocodingResult = {
        latitude: lat,
        longitude: lng,
        displayName: top.display_name,
        confidence: Number(baseConfidence.toFixed(2)),
        locationType,
        provider: this.name,
        resultCount: validResults.length,
        isAmbiguous,
        reason,
        raw: top
      };

      this.setCached(cleanQuery, result);
      return result;
    } catch (err: any) {
      console.warn(`Nominatim geocoding failed for "${cleanQuery}":`, err.message);
      return null;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const cacheKey = `rev_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = this.getCached(cacheKey);
    if (cached !== undefined) {
      return cached ? cached.displayName : null;
    }

    await this.throttle();

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TrailMap-Hiking-IL/1.0'
        }
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  }
}
