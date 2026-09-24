import React, { useState, useEffect } from 'react';
import { Trail } from '../../types/trail';
import { TrailCard } from './TrailCard';
import { ArrowUpDown, AlertCircle, Sparkles, MapPinOff } from 'lucide-react';

interface TrailListProps {
  trails: Trail[];
  selectedTrail: Trail | null;
  onSelectTrail: (trail: Trail) => void;
  onOpenDetails: (trail: Trail) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  sortBy: string;
  onSortChange: (sort: any) => void;
  userLocation: { lat: number; lng: number } | null;
  showMissingCoordsOnly: boolean;
  onToggleMissingCoordsOnly: () => void;
  totalCorpusCount: number;
}

const PAGE_SIZE = 24;

export const TrailList: React.FC<TrailListProps> = ({
  trails,
  selectedTrail,
  onSelectTrail,
  onOpenDetails,
  isFavorite,
  onToggleFavorite,
  sortBy,
  onSortChange,
  userLocation,
  showMissingCoordsOnly,
  onToggleMissingCoordsOnly,
  totalCorpusCount
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination when trails array changes (e.g. after search/filter)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [trails]);

  const visibleTrails = trails.slice(0, visibleCount);
  const hasMore = visibleCount < trails.length;

  return (
    <div className="flex flex-col h-full bg-stone-50/50">
      {/* List Header & Sorting Toolbar */}
      <div className="p-4 bg-white border-b border-stone-200/80 sticky top-0 z-10 shadow-sm flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Results count */}
          <div className="text-xs text-stone-600 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-nature-600" />
            <span>נמצאו <strong>{trails.length}</strong> מסלולים</span>
            <span className="text-stone-400">({totalCorpusCount} במאגר)</span>
          </div>

          {/* Missing Coords Toggle Badge */}
          <button
            onClick={onToggleMissingCoordsOnly}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              showMissingCoordsOnly
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <MapPinOff className="w-3.5 h-3.5 text-amber-600" />
            <span>ללא מיקום במפה</span>
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
          <label className="text-xs text-stone-500 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>מיון לפי:</span>
          </label>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 text-stone-700 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-nature-500 cursor-pointer"
          >
            {userLocation && (
              <option value="nearMe">קרוב אליי (מרחק ממיקומך)</option>
            )}
            <option value="hasCoords">קודם מסלולים עם מפה</option>
            <option value="name">שם המסלול (א-ת)</option>
            <option value="distance">מרחק הליכה</option>
            <option value="duration">משך הטיול</option>
            <option value="water">מסלולים עם מים</option>
          </select>
        </div>
      </div>

      {/* Trail Cards Grid / List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleTrails.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-stone-500 mt-8">
            <AlertCircle className="w-10 h-10 text-stone-300 mb-2" />
            <p className="font-medium text-stone-700">לא נמצאו מסלולים מתאימים</p>
            <p className="text-xs text-stone-400 mt-1 max-w-xs">
              נסה לשנות את מילות החיפוש או לאפס חלק מהמסננים.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3.5">
              {visibleTrails.map(trail => (
                <TrailCard
                  key={trail.id}
                  trail={trail}
                  isSelected={selectedTrail?.id === trail.id}
                  isFavorite={isFavorite(trail.id)}
                  onSelect={onSelectTrail}
                  onOpenDetails={onOpenDetails}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="pt-4 pb-6 flex justify-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-nature-50 hover:text-nature-800 hover:border-nature-300 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>טען עוד מסלולים</span>
                  <span className="text-stone-400 font-normal">
                    ({trails.length - visibleCount} נותרו)
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
