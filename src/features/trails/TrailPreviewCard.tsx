import React from 'react';
import { Trail } from '../../types/trail';
import { X, Navigation, ChevronLeft, MapPin, Compass, Clock, Heart, CheckCircle2, HelpCircle } from 'lucide-react';

interface TrailPreviewCardProps {
  trail: Trail;
  onClose: () => void;
  onOpenDetails: (trail: Trail) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const TrailPreviewCard: React.FC<TrailPreviewCardProps> = ({
  trail,
  onClose,
  onOpenDetails,
  isFavorite,
  onToggleFavorite
}) => {
  // Navigation: use original link if exists, otherwise free external navigation URL
  const navUrl = trail.wazeUrl || trail.googleMapsUrl || (
    trail.latitude && trail.longitude
      ? `https://ul.waze.com/ul?ll=${trail.latitude},${trail.longitude}&navigate=yes`
      : undefined
  );

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-stone-200/90 p-4 z-20 transition-all animate-in fade-in slide-in-from-bottom-4">
      {/* Close button */}
      <button
        onClick={onClose}
        title="סגור תצוגה מקדימה"
        className="absolute top-3 left-3 p-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-800 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header with region, status, and title */}
      <div className="pr-1 pl-7">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {trail.region && (
            <span className="text-xs font-semibold text-nature-800 bg-nature-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
              <MapPin className="w-3 h-3 text-nature-600" />
              {trail.region}
            </span>
          )}

          {/* Coordinate Status Badge */}
          {trail.locationStatus === 'verified' ? (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="מיקום מאומת (חניון / כתובת)">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              מאומת
            </span>
          ) : trail.locationStatus === 'probable' ? (
            <span className="text-[11px] font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="מיקום שמורה / נקודת עניין משוערת">
              <HelpCircle className="w-3 h-3 text-amber-600" />
              משוער
            </span>
          ) : null}

          {trail.difficulty && (
            <span className="text-xs text-stone-500 font-medium">
              • דרגת קושי {trail.difficulty}
            </span>
          )}
        </div>

        <h3 className="font-bold text-base text-stone-900 leading-snug line-clamp-1">
          {trail.title}
        </h3>

        {trail.subtitle ? (
          <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
            {trail.subtitle}
          </p>
        ) : trail.trailSummary ? (
          <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
            {trail.trailSummary}
          </p>
        ) : null}
      </div>

      {/* Metrics: Distance, Duration, and Near Me Distance */}
      <div className="flex items-center gap-4 text-xs text-stone-600 mt-2.5 px-2 py-1.5 bg-stone-50/80 rounded-xl border border-stone-100">
        {trail.distanceStr ? (
          <div className="flex items-center gap-1" title="אורך המסלול">
            <Compass className="w-3.5 h-3.5 text-nature-600" />
            <span>{trail.distanceStr}</span>
          </div>
        ) : trail.distanceKm ? (
          <div className="flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-nature-600" />
            <span>{trail.distanceKm} ק"מ</span>
          </div>
        ) : null}

        {trail.durationStr && (
          <div className="flex items-center gap-1" title="משך הטיול">
            <Clock className="w-3.5 h-3.5 text-nature-600" />
            <span>{trail.durationStr}</span>
          </div>
        )}

        {trail.distanceFromUserKm !== undefined && (
          <div className="text-blue-700 font-bold mr-auto">
            {trail.distanceFromUserKm} ק"מ ממיקומך
          </div>
        )}
      </div>

      {/* Relevant Category Tags */}
      {trail.categories && trail.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 px-1">
          {trail.categories.slice(0, 4).map((c, i) => (
            <span key={i} className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Action Buttons: View Trail & Navigate */}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-stone-100">
        <button
          onClick={() => onOpenDetails(trail)}
          className="flex-1 py-2 px-3 bg-nature-700 hover:bg-nature-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
        >
          <span>צפה במסלול (View Trail)</span>
          <ChevronLeft className="w-4 h-4" />
        </button>

        {navUrl && (
          <a
            href={navUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="נווט עם Waze / מפות (חינמי / חיצוני)"
            className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Navigation className="w-4 h-4 text-nature-700" />
            <span>נווט</span>
          </a>
        )}

        <button
          onClick={() => onToggleFavorite(trail.id)}
          title={isFavorite ? 'הסר ממועדפים' : 'שמור למועדפים'}
          className={`p-2 rounded-xl border transition-colors ${
            isFavorite
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-stone-50 border-stone-200 text-stone-400 hover:text-stone-700'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};
