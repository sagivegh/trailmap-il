import React, { useState, useEffect } from 'react';
import { Trail } from '../../types/trail';
import {
  MapPin,
  Clock,
  Compass,
  Navigation,
  Heart,
  Droplets,
  Trees,
  Sun,
  ChevronLeft,
  RotateCcw,
  Repeat,
  AlertTriangle
} from 'lucide-react';

interface TrailCardProps {
  trail: Trail;
  isSelected?: boolean;
  isFavorite?: boolean;
  onSelect: (trail: Trail) => void;
  onOpenDetails: (trail: Trail) => void;
  onToggleFavorite: (id: string) => void;
}

// Nature themed gradient placeholder based on trail terrain / region
function getThemedPlaceholder(trail: Trail) {
  if (trail.categories.includes('מדברי') || trail.region?.includes('נגב') || trail.region?.includes('ערבה') || trail.region?.includes('מדבר')) {
    return {
      bg: 'from-amber-600 via-orange-700 to-stone-800',
      icon: <Sun className="w-8 h-8 text-amber-200/80" />,
      badge: 'נוף מדברי'
    };
  }
  if (trail.categories.includes('ירוק') || trail.categories.includes('יער') || trail.categories.includes('פריחה')) {
    return {
      bg: 'from-emerald-600 via-nature-700 to-nature-900',
      icon: <Trees className="w-8 h-8 text-emerald-200/80" />,
      badge: 'טבע ירוק'
    };
  }
  return {
    bg: 'from-stone-700 via-stone-800 to-stone-900',
    icon: <Compass className="w-8 h-8 text-stone-300/80" />,
    badge: 'מסלול טיול'
  };
}

// Difficulty badge styling
function getDifficultyBadge(diff?: string) {
  if (!diff) return null;
  if (diff.includes('קלה')) {
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">קלה</span>;
  }
  if (diff.includes('בינונית')) {
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">בינונית</span>;
  }
  if (diff.includes('קשה') || diff.includes('אתגרי')) {
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-800">מאתגרת</span>;
  }
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-stone-100 text-stone-700">{diff}</span>;
}

export const TrailCard: React.FC<TrailCardProps> = ({
  trail,
  isSelected,
  isFavorite,
  onSelect,
  onOpenDetails,
  onToggleFavorite
}) => {
  const [showNavWarning, setShowNavWarning] = useState(false);
  const placeholder = getThemedPlaceholder(trail);
  const primaryImage = trail.images && trail.images.length > 0 ? trail.images[0].url : null;

  // Route type (circular vs out-and-back)
  const walkingType = trail.walkingType || trail.practicalInfo?.walkingType || trail.sourceFacts?.walkingType;
  const isCircular = Boolean(walkingType && walkingType.includes('מעגלי'));
  const isOutAndBack = Boolean(walkingType && (walkingType.includes('הלוך') || walkingType.includes('קווי')));

  // 4x4 and vehicle access caveats
  const is4x4 = trail.sourceFacts?.fourByFourRequired === true || trail.fourByFourRequired === true;
  const vehicleReqText = trail.sourceFacts?.vehicleRequirements || trail.navigationInfo?.vehicleRequirements;
  const hasVehicleCaveat = is4x4 || Boolean(
    vehicleReqText &&
    !vehicleReqText.includes('מתאים לכל רכב') &&
    (vehicleReqText.includes('רכב שטח') || vehicleReqText.includes('רכב פרטי חונה') || vehicleReqText.includes('חניון לילה') || vehicleReqText.includes('רכב גבוה'))
  );

  const caveatMessage = is4x4
    ? (vehicleReqText && vehicleReqText !== 'מתאים לכל רכב / רכב פרטי'
        ? `מסלול זה דורש רכב שטח (4x4 בלבד). פירוט גישה: ${vehicleReqText}`
        : 'הגישה למסלול זה דורשת רכב שטח (4x4 בלבד). מעבר לרכב רגיל עלול להוביל לשטח עביר לרכבי שטח בלבד.')
    : vehicleReqText;

  // Escape key listener for navigation warning modal
  useEffect(() => {
    if (!showNavWarning) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowNavWarning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNavWarning]);

  // Navigation link
  const navUrl = trail.wazeUrl || trail.googleMapsUrl || (
    trail.latitude && trail.longitude
      ? `https://ul.waze.com/ul?ll=${trail.latitude},${trail.longitude}&navigate=yes`
      : undefined
  );

  return (
    <div
      onClick={() => onSelect(trail)}
      className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer hover:shadow-lg ${
        isSelected
          ? 'border-nature-600 shadow-md ring-2 ring-nature-500/20'
          : 'border-stone-200/80 hover:border-nature-300'
      }`}
    >
      {/* Top Banner / Image */}
      <div className="relative h-40 w-full overflow-hidden bg-stone-100">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={trail.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${placeholder.bg} flex flex-col items-center justify-center p-4 text-center select-none`}>
            {placeholder.icon}
            <span className="text-white/90 text-xs font-medium mt-1 tracking-wide">{placeholder.badge}</span>
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(trail.id);
          }}
          title={isFavorite ? 'הסר ממועדפים' : 'שמור למועדפים'}
          className={`absolute top-3 left-3 p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
            isFavorite
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-black/30 text-white/90 hover:bg-black/50 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Region, Water, Coordinates & 4x4 Badges */}
        <div className="absolute bottom-2 right-2 flex flex-wrap gap-1.5 items-center">
          {trail.region && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/60 backdrop-blur text-white flex items-center gap-1 shadow-sm">
              <MapPin className="w-3 h-3 text-nature-300" />
              {trail.region}
            </span>
          )}
          {trail.hasWater === true && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-sky-900/90 backdrop-blur text-sky-200 flex items-center gap-1 shadow-sm">
              <Droplets className="w-3 h-3 text-sky-300" />
              {trail.seasonalWater ? 'מים עונתיים' : 'מים'}
            </span>
          )}
          {is4x4 && (
            <span
              data-testid="trail-card-4x4-badge"
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-600/95 backdrop-blur text-white flex items-center gap-1 shadow-sm"
            >
              <AlertTriangle className="w-3 h-3 text-amber-100" />
              4x4 בלבד
            </span>
          )}
          {trail.locationStatus === 'verified' && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-800/90 backdrop-blur text-emerald-200">
              מאומת
            </span>
          )}
          {trail.locationStatus === 'probable' && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-amber-800/80 backdrop-blur text-amber-200">
              משוער
            </span>
          )}
          {trail.coordinatesMissing && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-stone-800/80 backdrop-blur text-stone-300">
              ללא מפה
            </span>
          )}
        </div>

        {/* Distance from user clearly labeled */}
        {trail.distanceFromUserKm !== undefined && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold bg-blue-600/90 backdrop-blur text-white shadow-sm">
            {trail.distanceFromUserKm} ק"מ ממיקומך
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col justify-between flex-grow">
        <div>
          {/* 4x4 Warning pill in card body */}
          {is4x4 && (
            <div className="mb-1.5">
              <span
                data-testid="trail-card-4x4-pill"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
              >
                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                4x4 בלבד
              </span>
            </div>
          )}

          {/* Title */}
          <h3 className="font-bold text-base text-stone-900 group-hover:text-nature-700 transition-colors line-clamp-1">
            {trail.title}
          </h3>

          {/* Subtitle / Description preview */}
          {trail.subtitle && (
            <p className="text-xs text-stone-500 mt-1 line-clamp-1">
              {trail.subtitle}
            </p>
          )}

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-xs text-stone-600">
            {/* Distance */}
            {trail.distanceStr ? (
              <div className="flex items-center gap-1 shrink-0" title="אורך המסלול">
                <Compass className="w-3.5 h-3.5 text-stone-400" />
                <span>{trail.distanceStr}</span>
              </div>
            ) : trail.distanceKm ? (
              <div className="flex items-center gap-1 shrink-0" title="אורך המסלול">
                <Compass className="w-3.5 h-3.5 text-stone-400" />
                <span>{trail.distanceKm} ק"מ</span>
              </div>
            ) : null}

            {/* Duration */}
            {trail.durationStr ? (
              <div className="flex items-center gap-1 shrink-0" title="משך הטיול">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>{trail.durationStr}</span>
              </div>
            ) : null}

            {/* Route Type */}
            {isCircular ? (
              <div className="flex items-center gap-1 shrink-0" title="אופי המסלול: מעגלי" data-testid="route-type-metric">
                <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
                <span>מעגלי</span>
              </div>
            ) : isOutAndBack ? (
              <div className="flex items-center gap-1 shrink-0" title={`אופי המסלול: ${walkingType?.includes('קווי') ? 'קווי' : 'הלוך-חזור'}`} data-testid="route-type-metric">
                <Repeat className="w-3.5 h-3.5 text-stone-400" />
                <span>{walkingType?.includes('קווי') ? 'קווי' : 'הלוך-חזור'}</span>
              </div>
            ) : walkingType ? (
              <div className="flex items-center gap-1 shrink-0" title={`אופי המסלול: ${walkingType}`} data-testid="route-type-metric">
                <Repeat className="w-3.5 h-3.5 text-stone-400" />
                <span>{walkingType}</span>
              </div>
            ) : null}

            {/* Difficulty */}
            {getDifficultyBadge(trail.difficulty)}
          </div>

          {/* Key Category Tags */}
          {trail.categories && trail.categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {trail.categories.slice(0, 3).map((cat, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-[11px] rounded-md transition-colors"
                >
                  {cat}
                </span>
              ))}
              {trail.categories.length > 3 && (
                <span className="text-[10px] text-stone-400 self-center">
                  +{trail.categories.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails(trail);
            }}
            className="flex-1 py-1.5 px-3 rounded-xl bg-nature-50 hover:bg-nature-100 text-nature-800 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
          >
            <span>פתח מסלול</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="trail-card-nav-button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasVehicleCaveat) {
                  e.preventDefault();
                  setShowNavWarning(true);
                }
              }}
              title="נווט עם Waze / מפות"
              className="py-1.5 px-3 rounded-xl bg-stone-100 hover:bg-nature-600 hover:text-white text-stone-700 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>נווט</span>
            </a>
          )}
        </div>
      </div>

      {/* Safe Navigation Confirmation Modal for Caveat Trails */}
      {showNavWarning && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`nav-modal-title-${trail.id}`}
          data-testid="nav-warning-dialog"
          onClick={(e) => {
            e.stopPropagation();
            setShowNavWarning(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-stone-200 text-right space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 id={`nav-modal-title-${trail.id}`} className="text-base font-bold text-stone-900 leading-snug">
                  {is4x4 ? 'שימו לב: נדרש רכב שטח (4x4)' : 'שימו לב: הנחיות הגעה וחניה'}
                </h4>
                <p className="text-xs font-medium text-stone-500 truncate">
                  {trail.title}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 leading-relaxed font-normal">
              {caveatMessage}
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              הניווט ייפתח לנקודת ההתחלה המוגדרת, שעלולה להיות מעבר לקטע עביר לרכב רגיל. אנא ודאו את מקום החניה המתאים לרכבכם לפני היציאה לדרך.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                data-testid="nav-warning-cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNavWarning(false);
                }}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                data-testid="nav-warning-proceed"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNavWarning(false);
                  window.open(navUrl, '_blank', 'noopener,noreferrer');
                }}
                className="px-4 py-2 rounded-xl bg-nature-700 hover:bg-nature-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>הבנתי, המשך לניווט</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
