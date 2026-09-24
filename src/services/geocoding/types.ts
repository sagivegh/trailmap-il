import { LocationType } from '../../types/trail';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  confidence: number;
  locationType: LocationType;
  provider: string;
  resultCount?: number;
  isAmbiguous?: boolean;
  reason?: string;
  raw?: any;
}

export interface GeocodingOptions {
  countryCode?: string;
  viewbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  bounded?: boolean;
  limit?: number;
}

export interface GeocodingProvider {
  readonly name: string;
  geocode(query: string, options?: GeocodingOptions): Promise<GeocodingResult | null>;
  reverseGeocode(lat: number, lng: number): Promise<string | null>;
}
