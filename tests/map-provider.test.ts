import { describe, it, expect } from 'vitest';
import { MAP_CONFIG, getMapLibreStyleSpec } from '../src/config/map';
import * as fs from 'fs';
import * as path from 'path';

describe('Map Provider & Zero API-Key Verification', () => {
  it('default provider requires NO API key', () => {
    expect(MAP_CONFIG.defaultProvider).toBeDefined();
    expect(MAP_CONFIG.defaultProvider.requiresApiKey).toBe(false);
    expect(MAP_CONFIG.defaultProvider.providerName).toBe('OpenStreetMap');
    expect(MAP_CONFIG.defaultProvider.tileUrl).toContain('tile.openstreetmap.org');
  });

  it('all registered map styles require NO API key and have open endpoints', () => {
    const styles = Object.values(MAP_CONFIG.styles);
    expect(styles.length).toBeGreaterThan(0);

    for (const style of styles) {
      expect(style.requiresApiKey).toBe(false);

      // Check all tile URLs for each style
      for (const tileUrl of style.tiles) {
        // Must be HTTP/HTTPS URL
        expect(tileUrl).toMatch(/^https?:\/\//);

        // Must not contain API key parameters
        expect(tileUrl.toLowerCase()).not.toContain('api_key');
        expect(tileUrl.toLowerCase()).not.toContain('apikey');
        expect(tileUrl.toLowerCase()).not.toContain('access_token');
        expect(tileUrl.toLowerCase()).not.toContain('token=');
        expect(tileUrl.toLowerCase()).not.toContain('key=');

        // Must not point to commercial / restricted domains
        expect(tileUrl.toLowerCase()).not.toContain('carto');
        expect(tileUrl.toLowerCase()).not.toContain('mapbox');
        expect(tileUrl.toLowerCase()).not.toContain('googleapis.com');
      }
    }
  });

  it('generated MapLibre style specification is valid and keyless', () => {
    const spec = getMapLibreStyleSpec();
    expect(spec.version).toBe(8);
    expect(spec.sources['base-tiles']).toBeDefined();
    expect(spec.sources['base-tiles'].type).toBe('raster');
    expect(Array.isArray(spec.sources['base-tiles'].tiles)).toBe(true);
    expect(spec.layers.length).toBeGreaterThan(0);
    expect(spec.layers[0].type).toBe('raster');

    // Verify tile URLs in generated spec
    for (const tileUrl of spec.sources['base-tiles'].tiles) {
      expect(tileUrl).toContain('tile.openstreetmap.org');
      expect(tileUrl).not.toContain('key');
      expect(tileUrl).not.toContain('token');
    }
  });

  it('source code in src/config/map.ts contains zero CARTO, Mapbox, or Google API references', () => {
    const mapConfigFile = path.resolve(__dirname, '../src/config/map.ts');
    const content = fs.readFileSync(mapConfigFile, 'utf-8');

    // Assert absence of CARTO terms
    expect(content.toLowerCase()).not.toContain('carto');
    expect(content.toLowerCase()).not.toContain('voyager');
    expect(content.toLowerCase()).not.toContain('cartocdn');
    expect(content.toLowerCase()).not.toContain('cartodb');

    // Assert absence of Mapbox API / tokens
    expect(content.toLowerCase()).not.toContain('mapbox.com');
    expect(content).not.toContain('MAPBOX_TOKEN');

    // Assert absence of Google Maps API key requirements
    expect(content).not.toContain('GOOGLE_MAPS_API_KEY');
    expect(content).not.toContain('maps.googleapis.com');
  });

  it('index.html contains zero external commercial map scripts or Google Maps SDK', () => {
    const indexHtmlFile = path.resolve(__dirname, '../index.html');
    const content = fs.readFileSync(indexHtmlFile, 'utf-8');

    expect(content).not.toContain('maps.googleapis.com');
    expect(content).not.toContain('api.mapbox.com');
    expect(content).not.toContain('cartocdn.com');
  });
});
