import { GeocodingProvider } from './types';
import { NominatimProvider } from './NominatimProvider';

export * from './types';
export * from './NominatimProvider';

// Default geocoding provider (OpenStreetMap Nominatim, 100% free, no API key required)
export const defaultGeocodingProvider: GeocodingProvider = new NominatimProvider();

let activeProvider: GeocodingProvider = defaultGeocodingProvider;

export function getGeocodingProvider(): GeocodingProvider {
  return activeProvider;
}

export function setGeocodingProvider(provider: GeocodingProvider): void {
  activeProvider = provider;
}
