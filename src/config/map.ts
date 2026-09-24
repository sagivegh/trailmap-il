/**
 * Map Configuration & Provider Abstraction for TrailMap
 * 
 * 100% Keyless, Free and Open Map Architecture
 * 
 * - Map Engine: MapLibre GL JS
 * - Base Tiles: OpenStreetMap Standard (genuinely keyless, public tile source)
 * - requiresApiKey: false
 * 
 * ZERO API keys required:
 * - NO Google Maps API, SDK, Places, Directions, or Geocoding APIs.
 * - NO Mapbox tokens or endpoints.
 * - NO commercial tile provider endpoints, tokens, or authentication.
 */

export interface MapLayerConfig {
  id: string;
  name: string;
  providerName: string;
  tileUrl: string;
  tiles: string[];
  attribution: string;
  maxZoom: number;
  tileSize: number;
  requiresApiKey: boolean;
  type: 'raster' | 'vector';
}

export interface MapConfig {
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  bounds: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
  activeStyleId: string;
  defaultProvider: MapLayerConfig;
  styles: Record<string, MapLayerConfig>;
}

const OSM_STANDARD: MapLayerConfig = {
  id: 'osm',
  name: 'OpenStreetMap',
  providerName: 'OpenStreetMap',
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tiles: [
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  ],
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19,
  tileSize: 256,
  requiresApiKey: false,
  type: 'raster'
};

export const MAP_CONFIG: MapConfig = {
  defaultCenter: [35.0, 31.5],
  defaultZoom: 7.5,
  minZoom: 6,
  maxZoom: 19,
  bounds: {
    minLng: 34.1,
    minLat: 29.4,
    maxLng: 35.9,
    maxLat: 33.4
  },
  activeStyleId: 'osm',
  defaultProvider: OSM_STANDARD,
  styles: {
    osm: OSM_STANDARD
  }
};

/**
 * Returns a MapLibre style JSON specification for a chosen style ID.
 * Defaults to keyless OpenStreetMap Standard raster tiles.
 */
export function getMapLibreStyleSpec(styleId: string = MAP_CONFIG.activeStyleId): any {
  const layerConfig = MAP_CONFIG.styles[styleId] || MAP_CONFIG.defaultProvider;

  return {
    version: 8,
    sources: {
      'base-tiles': {
        type: layerConfig.type,
        tiles: layerConfig.tiles,
        tileSize: layerConfig.tileSize,
        attribution: layerConfig.attribution
      }
    },
    layers: [
      {
        id: 'base-tiles-layer',
        type: 'raster',
        source: 'base-tiles',
        minzoom: 0,
        maxzoom: layerConfig.maxZoom
      }
    ]
  };
}
