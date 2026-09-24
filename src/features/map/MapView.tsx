import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Trail } from '../../types/trail';
import { MAP_CONFIG, getMapLibreStyleSpec } from '../../config/map';
import { Locate, Layers, ZoomIn, ZoomOut, Compass, MapPin } from 'lucide-react';

interface MapViewProps {
  trails: Trail[];
  selectedTrail: Trail | null;
  onSelectTrail: (trail: Trail) => void;
  userLocation: { lat: number; lng: number } | null;
  onLocateUser: () => void;
  onBoundsChange?: (bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => void;
  filterByBounds?: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  userLocation,
  onLocateUser,
  onBoundsChange,
  filterByBounds = false
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [currentStyle, setCurrentStyle] = useState<string>(MAP_CONFIG.activeStyleId);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapLibreStyleSpec(currentStyle),
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      attributionControl: false
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      mapRef.current = map;
      setupTrailsLayer(map);
      notifyBounds(map);
    });

    const notifyBounds = (m: maplibregl.Map) => {
      if (onBoundsChange) {
        const bounds = m.getBounds();
        onBoundsChange({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast()
        });
      }
    };

    map.on('moveend', () => notifyBounds(map));
    map.on('zoomend', () => notifyBounds(map));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Change style when selected
  const handleStyleChange = (styleKey: string) => {
    setCurrentStyle(styleKey);
    setShowStyleMenu(false);
    if (mapRef.current) {
      mapRef.current.setStyle(getMapLibreStyleSpec(styleKey));
      mapRef.current.once('style.load', () => {
        if (mapRef.current) setupTrailsLayer(mapRef.current);
      });
    }
  };

  // Convert trails with coordinates into GeoJSON
  const trailsGeoJson = useCallback((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = trails
      .filter(t => !t.coordinatesMissing && typeof t.latitude === 'number' && typeof t.longitude === 'number')
      .map(t => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.longitude!, t.latitude!]
        },
        properties: {
          id: t.id,
          title: t.title,
          difficulty: t.difficulty || '',
          distanceKm: t.distanceKm || '',
          region: t.region || '',
          locationStatus: t.locationStatus || 'probable',
          hasWater: t.hasWater ? 'true' : 'false'
        }
      }));

    return {
      type: 'FeatureCollection',
      features
    };
  }, [trails]);

  // Setup clustered source and layers
  const setupTrailsLayer = (map: maplibregl.Map) => {
    const data = trailsGeoJson();

    if (map.getSource('trails-source')) {
      (map.getSource('trails-source') as maplibregl.GeoJSONSource).setData(data);
      return;
    }

    map.addSource('trails-source', {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 45
    });

    // Cluster circles
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'trails-source',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#2e5947', // forest green (<10)
          10,
          '#27473a', // dark emerald (10-30)
          30,
          '#6f473c'  // earth red (>30)
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          19,
          10,
          25,
          30,
          31
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Cluster count text
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'trails-source',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 13
      },
      paint: {
        'text-color': '#ffffff'
      }
    });

    // Unclustered point marker circle
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'trails-source',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'case',
          ['==', ['get', 'hasWater'], 'true'],
          '#0284c7', // water blue
          ['==', ['get', 'locationStatus'], 'verified'],
          '#1b4332', // verified dark green
          '#40916c'  // probable green
        ],
        'circle-radius': [
          'case',
          ['==', ['get', 'locationStatus'], 'verified'],
          9.5,
          8.5
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Click cluster: zoom into cluster
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      if (!features.length) return;
      const clusterId = features[0].properties?.cluster_id;
      const source = map.getSource('trails-source') as maplibregl.GeoJSONSource;
      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coords = (features[0].geometry as GeoJSON.Point).coordinates;
        map.easeTo({
          center: [coords[0], coords[1]],
          zoom: Math.min(zoom + 0.5, 15)
        });
      } catch (err) {
        console.error('Error expanding cluster:', err);
      }
    });

    // Click unclustered trail point: center map and select trail
    map.on('click', 'unclustered-point', (e) => {
      if (!e.features || !e.features.length) return;
      const id = e.features[0].properties?.id;
      const found = trails.find(t => t.id === id);
      if (found) {
        if (found.latitude && found.longitude) {
          map.easeTo({
            center: [found.longitude, found.latitude],
            duration: 600
          });
        }
        onSelectTrail(found);
      }
    });

    // Cursor pointer on hover
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
    });
  };

  // Update GeoJSON when trails list changes
  useEffect(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('trails-source') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(trailsGeoJson());
    }
  }, [trails, trailsGeoJson]);

  // Center on selected trail when changed
  useEffect(() => {
    if (!mapRef.current || !selectedTrail || selectedTrail.coordinatesMissing) return;
    if (selectedTrail.latitude && selectedTrail.longitude) {
      mapRef.current.flyTo({
        center: [selectedTrail.longitude, selectedTrail.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 12.5),
        duration: 1000
      });
    }
  }, [selectedTrail]);

  // Handle user location marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (userLocation) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-xl ring-4 ring-blue-300 ring-opacity-60 animate-pulse';
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  return (
    <div className="relative w-full h-full min-h-[350px]">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Map Controls Floating Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        {/* Style Selector - only display if multiple styles are configured */}
        {Object.entries(MAP_CONFIG.styles).length > 1 && (
          <div className="relative">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              title="החלף סגנון מפה"
              className="p-2.5 bg-white/95 backdrop-blur rounded-xl shadow-md border border-stone-200 text-stone-700 hover:text-nature-700 hover:bg-stone-50 transition-all flex items-center justify-center"
            >
              <Layers className="w-5 h-5" />
            </button>
            {showStyleMenu && (
              <div className="absolute left-0 mt-2 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 w-36 z-20 text-xs">
                {Object.entries(MAP_CONFIG.styles).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => handleStyleChange(key)}
                    className={`w-full text-right px-3 py-2 hover:bg-nature-50 transition-colors flex items-center justify-between ${
                      currentStyle === key ? 'text-nature-700 font-bold bg-nature-50/70' : 'text-stone-700'
                    }`}
                  >
                    <span>{style.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Locate User Button ("Near Me") */}
        <button
          onClick={onLocateUser}
          title="קרוב אליי (מיקום נוכחי)"
          className={`p-2.5 rounded-xl shadow-md border transition-all flex items-center justify-center ${
            userLocation
              ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
              : 'bg-white/95 backdrop-blur text-stone-700 border-stone-200 hover:text-nature-700 hover:bg-stone-50'
          }`}
        >
          <Locate className="w-5 h-5" />
        </button>

        {/* Reset View to Israel */}
        <button
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: MAP_CONFIG.defaultCenter,
                zoom: MAP_CONFIG.defaultZoom,
                duration: 1000
              });
            }
          }}
          title="מרכז ישראל"
          className="p-2.5 bg-white/95 backdrop-blur rounded-xl shadow-md border border-stone-200 text-stone-700 hover:text-nature-700 hover:bg-stone-50 transition-all flex items-center justify-center"
        >
          <Compass className="w-5 h-5" />
        </button>
      </div>

      {/* Zoom In/Out controls bottom right */}
      <div className="absolute bottom-6 left-4 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          title="התקרב"
          className="p-2 bg-white/95 backdrop-blur rounded-lg shadow-md border border-stone-200 text-stone-700 hover:text-nature-700 hover:bg-stone-50"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          title="התרחק"
          className="p-2 bg-white/95 backdrop-blur rounded-lg shadow-md border border-stone-200 text-stone-700 hover:text-nature-700 hover:bg-stone-50"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
