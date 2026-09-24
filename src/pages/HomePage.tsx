import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Trail, TrailFilters } from '../types/trail';
import { Header } from '../components/Header';
import { FilterBar } from '../features/filters/FilterBar';
import { MapView } from '../features/map/MapView';
import { TrailList } from '../features/trails/TrailList';
import { TrailPreviewCard } from '../features/trails/TrailPreviewCard';
import { TrailDetailModal } from '../features/trails/TrailDetailModal';
import { filterAndSortTrails, ViewportBounds } from '../features/search/search-utils';
import { useFavorites } from '../utils/favorites';
import { ChevronUp, ChevronDown, ListFilter, RefreshCw, ScanEye } from 'lucide-react';

interface HomePageProps {
  onNavigateToAdmin: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigateToAdmin }) => {
  const [allTrails, setAllTrails] = useState<Trail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // Selection state
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [detailTrail, setDetailTrail] = useState<Trail | null>(null);
  const [previewTrail, setPreviewTrail] = useState<Trail | null>(null);

  // View state & Viewport filtering
  const [currentView, setCurrentView] = useState<'split' | 'map' | 'list'>('split');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showMissingCoordsOnly, setShowMissingCoordsOnly] = useState(false);

  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [filterByViewport, setFilterByViewport] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<TrailFilters>({
    searchQuery: '',
    selectedRegion: '',
    selectedCategories: [],
    selectedDifficulty: '',
    waterOnly: false,
    shadeOnly: false,
    withCoordinatesOnly: false,
    sortBy: 'hasCoords'
  });

  // Load trails on mount
  useEffect(() => {
    setLoading(true);
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    fetch(`${baseUrl}data/trails.json`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trails database');
        return res.json();
      })
      .then((data: Trail[]) => {
        setAllTrails(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute dynamic categories and regions from real data
  const { availableRegions, availableCategories } = useMemo(() => {
    const regMap = new Map<string, number>();
    const catMap = new Map<string, number>();

    for (const t of allTrails) {
      if (t.region) {
        regMap.set(t.region, (regMap.get(t.region) || 0) + 1);
      }
      if (t.categories) {
        for (const c of t.categories) {
          catMap.set(c, (catMap.get(c) || 0) + 1);
        }
      }
    }

    const availableRegions = Array.from(regMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const availableCategories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { availableRegions, availableCategories };
  }, [allTrails]);

  // Handle User Geolocation ("Near Me" only on explicit button click)
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('שירות מיקום אינו נתמך בדפדפן זה');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setUserLocation(coords);
        setIsLocating(false);
        // Automatically switch sort to nearMe
        setFilters(prev => ({ ...prev, sortBy: 'nearMe' }));
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        setIsLocating(false);
        alert('לא ניתן היה לקבל את מיקומך. ודא כי הרשאת המיקום מאושרת בדפדפן.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Viewport bounds change callback
  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    setViewportBounds(bounds);
  }, []);

  // Filter & sort trails with viewport support
  const filteredTrails = useMemo(() => {
    let source = allTrails;

    if (showFavoritesOnly) {
      source = source.filter(t => favorites.includes(t.id));
    }

    if (showMissingCoordsOnly) {
      source = source.filter(t => t.coordinatesMissing);
    }

    return filterAndSortTrails(source, filters, userLocation, viewportBounds, filterByViewport);
  }, [allTrails, filters, userLocation, showFavoritesOnly, showMissingCoordsOnly, favorites, viewportBounds, filterByViewport]);

  // Marker click on map
  const handleMarkerSelect = (trail: Trail) => {
    setSelectedTrail(trail);
    setPreviewTrail(trail);
  };

  // Trail selection from list
  const handleListTrailSelect = (trail: Trail) => {
    setSelectedTrail(trail);
    if (!trail.coordinatesMissing) {
      setPreviewTrail(trail);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-nature-700 flex items-center justify-center shadow-lg mb-4 animate-bounce">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-stone-800">טוען את TrailMap...</h2>
        <p className="text-xs text-stone-500 mt-1">1,783 מסלולי טיול בישראל נטענים למפה</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-lg font-bold text-rose-700">שגיאה בטעינת הנתונים</h2>
        <p className="text-xs text-stone-600 mt-1">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-xl bg-nature-700 text-white text-xs font-semibold"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-stone-100">
      
      {/* App Header */}
      <Header
        searchQuery={filters.searchQuery}
        onSearchChange={(q) => setFilters(prev => ({ ...prev, searchQuery: q }))}
        favoritesCount={favorites.length}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => setShowFavoritesOnly(prev => !prev)}
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        onNavigateToAdmin={onNavigateToAdmin}
        onLocateUser={handleLocateUser}
        isLocating={isLocating}
      />

      {/* Dynamic Filter Bar */}
      <FilterBar
        filters={filters}
        onChange={(updated) => setFilters(prev => ({ ...prev, ...updated }))}
        availableRegions={availableRegions}
        availableCategories={availableCategories}
        onReset={() => {
          setFilters({
            searchQuery: '',
            selectedRegion: '',
            selectedCategories: [],
            selectedDifficulty: '',
            waterOnly: false,
            shadeOnly: false,
            withCoordinatesOnly: false,
            sortBy: 'hasCoords',
            maxDistanceRadiusKm: undefined
          });
          setShowFavoritesOnly(false);
          setShowMissingCoordsOnly(false);
          setFilterByViewport(false);
        }}
        totalFilteredCount={filteredTrails.length}
        userLocation={userLocation}
        filterByViewport={filterByViewport}
        onToggleFilterByViewport={() => setFilterByViewport(prev => !prev)}
      />

      {/* Main Responsive Body */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* DESKTOP SPLIT VIEW: Trail List Sidebar */}
        <div
          className={`w-full md:w-[480px] lg:w-[520px] xl:w-[560px] h-full shrink-0 border-l border-stone-200 z-10 bg-white transition-transform duration-300 ${
            currentView === 'map' ? 'hidden md:flex flex-col' : 'flex flex-col'
          }`}
        >
          <TrailList
            trails={filteredTrails}
            selectedTrail={selectedTrail}
            onSelectTrail={handleListTrailSelect}
            onOpenDetails={(trail) => setDetailTrail(trail)}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            sortBy={filters.sortBy}
            onSortChange={(sortBy) => setFilters(prev => ({ ...prev, sortBy }))}
            userLocation={userLocation}
            showMissingCoordsOnly={showMissingCoordsOnly}
            onToggleMissingCoordsOnly={() => setShowMissingCoordsOnly(prev => !prev)}
            totalCorpusCount={allTrails.length}
          />
        </div>

        {/* MAP CONTAINER (center on desktop, full screen on mobile) */}
        <div
          className={`flex-1 h-full relative ${
            currentView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          <MapView
            trails={filteredTrails}
            selectedTrail={selectedTrail}
            onSelectTrail={handleMarkerSelect}
            userLocation={userLocation}
            onLocateUser={handleLocateUser}
            onBoundsChange={handleBoundsChange}
            filterByBounds={filterByViewport}
          />

          {/* Floating Preview Card on Map */}
          {previewTrail && (
            <TrailPreviewCard
              trail={previewTrail}
              onClose={() => setPreviewTrail(null)}
              onOpenDetails={(trail) => setDetailTrail(trail)}
              isFavorite={isFavorite(previewTrail.id)}
              onToggleFavorite={toggleFavorite}
            />
          )}

          {/* MOBILE BOTTOM SHEET TOGGLE (Collapsed State) */}
          <div className="md:hidden absolute bottom-4 right-4 left-4 z-20 pointer-events-none">
            {!previewTrail && (
              <button
                onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
                className="pointer-events-auto w-full py-2.5 px-4 rounded-2xl bg-nature-900/95 backdrop-blur text-white text-xs font-bold shadow-xl flex items-center justify-between border border-nature-700/50"
              >
                <div className="flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-emerald-400" />
                  <span>הצג רשימת מסלולים ({filteredTrails.length})</span>
                </div>
                {mobileSheetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* MOBILE BOTTOM SHEET MODAL (Expanded State) */}
        {mobileSheetOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex flex-col justify-end">
            <div className="bg-white rounded-t-3xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
              <div className="p-3.5 bg-stone-100 flex items-center justify-between border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-nature-700" />
                  <span className="font-bold text-xs text-stone-800">
                    רשימת מסלולים ({filteredTrails.length})
                  </span>
                </div>
                <button
                  onClick={() => setMobileSheetOpen(false)}
                  className="px-3 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold"
                >
                  סגור
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TrailList
                  trails={filteredTrails}
                  selectedTrail={selectedTrail}
                  onSelectTrail={(t) => {
                    handleListTrailSelect(t);
                    setMobileSheetOpen(false);
                  }}
                  onOpenDetails={(trail) => {
                    setDetailTrail(trail);
                    setMobileSheetOpen(false);
                  }}
                  isFavorite={isFavorite}
                  onToggleFavorite={toggleFavorite}
                  sortBy={filters.sortBy}
                  onSortChange={(sortBy) => setFilters(prev => ({ ...prev, sortBy }))}
                  userLocation={userLocation}
                  showMissingCoordsOnly={showMissingCoordsOnly}
                  onToggleMissingCoordsOnly={() => setShowMissingCoordsOnly(prev => !prev)}
                  totalCorpusCount={allTrails.length}
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FULL TRAIL DETAIL MODAL (Full State) */}
      {detailTrail && (
        <TrailDetailModal
          trail={detailTrail}
          onClose={() => setDetailTrail(null)}
          isFavorite={isFavorite(detailTrail.id)}
          onToggleFavorite={toggleFavorite}
        />
      )}

    </div>
  );
};
