import React from 'react';
import {
  Compass,
  Search,
  X,
  Heart,
  Database,
  Map as MapIcon,
  List as ListIcon,
  Locate
} from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  favoritesCount: number;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  currentView: 'split' | 'map' | 'list';
  onViewChange: (view: 'split' | 'map' | 'list') => void;
  onNavigateToAdmin: () => void;
  onLocateUser: () => void;
  isLocating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  favoritesCount,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  currentView,
  onViewChange,
  onNavigateToAdmin,
  onLocateUser,
  isLocating
}) => {
  return (
    <header className="bg-nature-900 text-white shadow-md z-30 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 sm:gap-4">
        
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-nature-600 to-emerald-400 flex items-center justify-center shadow-md">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-1 font-sans">
              TrailMap
            </span>
            <span className="hidden sm:inline-block text-[10px] text-nature-300 font-medium tracking-wide">
              מפת מסלולי הטיולים של ישראל
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-lg relative">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nature-300 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="לאן בא לך לטייל? (שם, אזור, מים, מעיין...)"
              className="w-full bg-nature-800/90 hover:bg-nature-800 focus:bg-white text-white focus:text-stone-900 placeholder-stone-300 focus:placeholder-stone-400 text-xs sm:text-sm rounded-2xl pr-10 pl-9 py-2 border border-nature-700 focus:border-nature-500 focus:outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-nature-700/80 text-nature-200 hover:text-white transition-colors"
                title="נקה חיפוש"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Mobile View Toggle (Map vs List) */}
          <div className="flex md:hidden bg-nature-800 p-0.5 rounded-xl border border-nature-700">
            <button
              onClick={() => onViewChange('map')}
              className={`p-1.5 rounded-lg transition-colors ${
                currentView === 'map' ? 'bg-nature-600 text-white' : 'text-nature-300 hover:text-white'
              }`}
              title="תצוגת מפה"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                currentView === 'list' ? 'bg-nature-600 text-white' : 'text-nature-300 hover:text-white'
              }`}
              title="תצוגת רשימה"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Near Me Location Button */}
          <button
            onClick={onLocateUser}
            title="קרוב אליי (אתר את מיקומי)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-nature-800 hover:bg-nature-700 text-nature-100 text-xs font-semibold border border-nature-700 transition-colors"
          >
            <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-blue-400' : ''}`} />
            <span>קרוב אליי</span>
          </button>

          {/* Favorites Button */}
          <button
            onClick={onToggleFavoritesOnly}
            title={showFavoritesOnly ? 'הצג את כל המסלולים' : 'הצג רק מועדפים'}
            className={`p-2 rounded-xl transition-all relative ${
              showFavoritesOnly
                ? 'bg-rose-600 text-white'
                : 'bg-nature-800 hover:bg-nature-700 text-nature-200'
            }`}
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Admin link */}
          <button
            onClick={onNavigateToAdmin}
            title="ניהול נתונים / דוח איכות"
            className="p-2 rounded-xl bg-nature-800 hover:bg-nature-700 text-nature-300 hover:text-white transition-colors"
          >
            <Database className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
