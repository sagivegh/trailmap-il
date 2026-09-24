import React from 'react';
import { TrailFilters } from '../../types/trail';
import {
  Droplet,
  Sun,
  RotateCcw,
  Locate,
  ScanEye,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface FilterBarProps {
  filters: TrailFilters;
  onChange: (updated: Partial<TrailFilters>) => void;
  availableRegions: Array<{ name: string; count: number }>;
  availableCategories: Array<{ name: string; count: number }>;
  onReset: () => void;
  totalFilteredCount: number;
  userLocation: { lat: number; lng: number } | null;
  filterByViewport: boolean;
  onToggleFilterByViewport: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  availableRegions,
  availableCategories,
  onReset,
  totalFilteredCount,
  userLocation,
  filterByViewport,
  onToggleFilterByViewport
}) => {
  // Top real categories from the dataset
  const topCategories = [
    'מים',
    'תצפיות',
    'פריחה',
    'ירוק',
    'מדברי',
    'מסלול למשפחות',
    'עתיקות',
    'אתגרי',
    'מערות'
  ];

  const radiusOptions = [5, 10, 25, 50, 100];

  const hasActiveFilters =
    Boolean(filters.searchQuery) ||
    Boolean(filters.selectedRegion) ||
    Boolean(filters.selectedDifficulty) ||
    filters.selectedCategories.length > 0 ||
    filters.waterOnly ||
    filters.shadeOnly ||
    filters.withCoordinatesOnly ||
    Boolean(filters.maxDistanceRadiusKm) ||
    filterByViewport;

  const toggleCategory = (cat: string) => {
    const exists = filters.selectedCategories.includes(cat);
    const updated = exists
      ? filters.selectedCategories.filter(c => c !== cat)
      : [...filters.selectedCategories, cat];
    onChange({ selectedCategories: updated });
  };

  return (
    <div className="bg-white border-b border-stone-200 px-4 py-2 shadow-sm space-y-1.5">
      {/* Primary Scrollable Filter Row */}
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        
        {/* "Trails in this area" (Viewport Filter) */}
        <button
          onClick={onToggleFilterByViewport}
          title="הצג רק מסלולים הנראים כעת במפה"
          className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            filterByViewport
              ? 'bg-nature-700 text-white border-nature-800 shadow-sm ring-2 ring-nature-400/40'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <ScanEye className="w-3.5 h-3.5" />
          <span>מסלולים באזור זה</span>
        </button>

        {/* Region Dropdown */}
        <select
          value={filters.selectedRegion}
          onChange={(e) => onChange({ selectedRegion: e.target.value })}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-nature-500 shrink-0 ${
            filters.selectedRegion
              ? 'bg-nature-50 border-nature-500 text-nature-800 font-bold'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <option value="">כל האזורים</option>
          {availableRegions.slice(0, 30).map(r => (
            <option key={r.name} value={r.name}>
              {r.name} ({r.count})
            </option>
          ))}
        </select>

        {/* Difficulty Dropdown */}
        <select
          value={filters.selectedDifficulty}
          onChange={(e) => onChange({ selectedDifficulty: e.target.value })}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-nature-500 shrink-0 ${
            filters.selectedDifficulty
              ? 'bg-nature-50 border-nature-500 text-nature-800 font-bold'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <option value="">כל דרגות הקושי</option>
          <option value="קלה">קלה</option>
          <option value="בינונית">בינונית</option>
          <option value="מאתגרת">קשה / מאתגרת</option>
        </select>

        {/* Water Quick Toggle */}
        <button
          onClick={() => onChange({ waterOnly: !filters.waterOnly })}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all shrink-0 flex items-center gap-1 ${
            filters.waterOnly
              ? 'bg-sky-600 text-white border-sky-700 shadow-sm font-bold'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <Droplet className="w-3.5 h-3.5" />
          <span>רחצה במים</span>
        </button>

        {/* Shade Quick Toggle */}
        <button
          onClick={() => onChange({ shadeOnly: !filters.shadeOnly })}
          className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all shrink-0 flex items-center gap-1 ${
            filters.shadeOnly
              ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm font-bold'
              : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>מוצל</span>
        </button>

        <div className="h-5 w-[1px] bg-stone-200 shrink-0 mx-0.5" />

        {/* Popular Category Pills */}
        {topCategories.map(cat => {
          const isSelected = filters.selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all shrink-0 ${
                isSelected
                  ? 'bg-nature-700 text-white border-nature-800 shadow-sm font-bold'
                  : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              {cat}
            </button>
          );
        })}

        {/* Reset button if active filters */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            title="נקה את כל המסננים"
            className="text-xs px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors shrink-0 flex items-center gap-1 font-semibold"
          >
            <RotateCcw className="w-3 h-3" />
            <span>איפוס</span>
          </button>
        )}
      </div>

      {/* Secondary Row: Distance Radius Pills (When Near Me / User Location is active) */}
      {userLocation && (
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 text-xs text-stone-600 pt-0.5 border-t border-stone-100 overflow-x-auto no-scrollbar">
          <span className="font-semibold text-blue-700 shrink-0 flex items-center gap-1">
            <Locate className="w-3 h-3" />
            רדיוס ממיקומך:
          </span>
          <button
            onClick={() => onChange({ maxDistanceRadiusKm: undefined })}
            className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
              !filters.maxDistanceRadiusKm
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            הכל
          </button>
          {radiusOptions.map(r => (
            <button
              key={r}
              onClick={() => onChange({ maxDistanceRadiusKm: r })}
              className={`px-2.5 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                filters.maxDistanceRadiusKm === r
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              עד {r} ק"מ
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
