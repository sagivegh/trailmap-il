import React, { useState, useEffect, useRef } from 'react';
import { Trail } from '../../types/trail';
import {
  X,
  MapPin,
  Clock,
  Compass,
  Navigation,
  Heart,
  Droplets,
  Sun,
  Car,
  Footprints,
  Info,
  ExternalLink,
  Share2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Bus,
  Layers,
  Sparkles
} from 'lucide-react';

interface TrailDetailModalProps {
  trail: Trail;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export const TrailDetailModal: React.FC<TrailDetailModalProps> = ({
  trail,
  onClose,
  isFavorite,
  onToggleFavorite
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'practical' | 'access' | 'source'>('overview');
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Keyboard accessibility: Escape key to close, focus trap, and restore focus on unmount
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the modal or the modal container itself
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [onClose]);

  // Load raw markdown archive on demand only when user requests source archival view
  useEffect(() => {
    if (activeTab === 'source' && !rawContent) {
      setLoadingRaw(true);
      const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      fetch(`${baseUrl}data/raw/${trail.id}.md`)
        .then(res => {
          if (!res.ok) throw new Error('File not found');
          return res.text();
        })
        .then(text => setRawContent(text))
        .catch(err => setRawContent(`שגיאה בטעינת קובץ המקור: ${err.message}`))
        .finally(() => setLoadingRaw(false));
    }
  }, [activeTab, trail.id, rawContent]);

  // Handle Share link
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: trail.title,
          text: trail.trailSummary || trail.title,
          url: window.location.href
        });
      } catch (e) {
        // Ignored
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navUrlWaze = trail.wazeUrl || (
    trail.latitude && trail.longitude
      ? `https://ul.waze.com/ul?ll=${trail.latitude},${trail.longitude}&navigate=yes`
      : undefined
  );

  const navUrlGoogle = trail.googleMapsUrl || (
    trail.latitude && trail.longitude
      ? `https://www.google.com/maps?q=${trail.latitude},${trail.longitude}`
      : undefined
  );

  const practical = trail.practicalInfo;
  const navigation = trail.navigationInfo;
  const sourceFacts = trail.sourceFacts;

  const is4x4 = trail.sourceFacts?.fourByFourRequired === true || trail.fourByFourRequired === true;
  const vehicleReqText = trail.sourceFacts?.vehicleRequirements || trail.navigationInfo?.vehicleRequirements;
  const hasVehicleCaveat = !is4x4 && Boolean(
    vehicleReqText &&
    !vehicleReqText.includes('מתאים לכל רכב') &&
    (vehicleReqText.includes('רכב שטח') || vehicleReqText.includes('רכב פרטי חונה') || vehicleReqText.includes('חניון לילה') || vehicleReqText.includes('רכב גבוה'))
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-trail-title"
        className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-stone-200"
      >
        
        {/* Top Header Bar */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-stone-200/80 z-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {trail.region && (
              <span className="text-xs font-semibold text-nature-800 bg-nature-100 px-2.5 py-1 rounded-xl shrink-0 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {trail.region}
              </span>
            )}
            <h2 id="modal-trail-title" className="text-base sm:text-lg font-bold text-stone-900 truncate">
              {trail.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Share */}
            <button
              onClick={handleShare}
              title="שתף מסלול"
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Favorite */}
            <button
              onClick={() => onToggleFavorite(trail.id)}
              title={isFavorite ? 'הסר ממועדפים' : 'שמור למועדפים'}
              className={`p-2 rounded-xl transition-colors ${
                isFavorite
                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="סגור"
              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* Title & Trail Categories */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 leading-tight">
              {trail.title}
            </h1>
            {trail.subtitle && (
              <p className="text-stone-600 text-sm sm:text-base mt-1.5 font-medium leading-relaxed">
                {trail.subtitle}
              </p>
            )}

            {/* Category Tags */}
            {trail.categories && trail.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {trail.categories.map((c, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-xs bg-stone-100 text-stone-700 font-medium"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Bar & Links */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-stone-600">
              {trail.gpsName ? (
                <div>
                  <span className="font-semibold text-stone-800">יעד GPS לניווט: </span>
                  <span className="text-nature-900 font-mono bg-white px-2 py-0.5 rounded border border-stone-200">
                    {trail.gpsName}
                  </span>
                </div>
              ) : (
                <span>קישורי ניווט מהירים לנקודת ההתחלה</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {navUrlWaze && (
                <a
                  href={navUrlWaze}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Waze</span>
                </a>
              )}

              {navUrlGoogle && (
                <a
                  href={navUrlGoogle}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-nature-700 hover:bg-nature-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Google Maps</span>
                </a>
              )}

              {trail.coordinatesMissing && !navUrlWaze && !navUrlGoogle && (
                <span className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  קואורדינטות טרם הוזנו למסלול זה
                </span>
              )}
            </div>
          </div>

          {/* 4x4 Mandatory Access Warning Banner */}
          {is4x4 && (
            <div
              data-testid="modal-4x4-warning"
              className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3.5 text-amber-950 shadow-sm"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-amber-950">
                  שימו לב: הגישה למסלול זה דורשת רכב שטח (4x4 בלבד)
                </div>
                {vehicleReqText && vehicleReqText !== 'מתאים לכל רכב / רכב פרטי' && (
                  <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-normal">
                    {vehicleReqText}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conditional Vehicle Staging Access Callout */}
          {!is4x4 && hasVehicleCaveat && (
            <div
              data-testid="modal-conditional-vehicle-warning"
              className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-start gap-3.5 text-amber-950 shadow-sm"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-amber-950">
                  הנחיות חניה והגעה ברכב:
                </div>
                <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-normal">
                  {vehicleReqText}
                </p>
              </div>
            </div>
          )}

          {/* Quick Metrics Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Distance */}
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200 flex flex-col justify-center">
              <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                <Compass className="w-3 h-3 text-nature-600" />
                מרחק
              </span>
              <span className="text-sm font-bold text-stone-900 mt-1">
                {practical?.distance || (trail.distanceKm ? `${trail.distanceKm} ק"מ` : 'לא צוין')}
              </span>
            </div>

            {/* Duration */}
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200 flex flex-col justify-center">
              <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-nature-600" />
                משך הטיול
              </span>
              <span className="text-sm font-bold text-stone-900 mt-1">
                {practical?.duration || trail.durationStr || 'לא צוין'}
              </span>
            </div>

            {/* Difficulty */}
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200 flex flex-col justify-center">
              <span className="text-[11px] text-stone-500 font-medium">דרגת קושי</span>
              <span className="text-sm font-bold text-stone-900 mt-1">
                {practical?.difficulty || trail.difficulty || 'רגיל'}
              </span>
            </div>

            {/* Water */}
            <div className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200 flex flex-col justify-center">
              <span className="text-[11px] text-stone-500 font-medium flex items-center gap-1">
                <Droplets className="w-3 h-3 text-sky-600" />
                מקור מים / רחצה
              </span>
              <span className="text-sm font-bold text-stone-900 mt-1 truncate">
                {trail.swimmingAllowed === true
                  ? 'רחצה אפשרית'
                  : trail.swimmingAllowed === false
                  ? (trail.hasWater === true ? 'רחצה אסורה' : 'ללא רחצה')
                  : trail.hasWater === true
                  ? (trail.seasonalWater ? 'מים עונתיים' : 'יש מקור מים')
                  : trail.hasWater === false
                  ? 'מסלול יבש'
                  : 'לא צוין'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-stone-200 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 shrink-0 flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-nature-700 text-nature-800'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sparkles className="w-4 h-4 text-nature-600" />
              <span>סקירה ומסלול</span>
            </button>

            <button
              onClick={() => setActiveTab('practical')}
              className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 shrink-0 flex items-center gap-1.5 ${
                activeTab === 'practical'
                  ? 'border-nature-700 text-nature-800'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Info className="w-4 h-4 text-stone-500" />
              <span>מידע שימושי</span>
            </button>

            <button
              onClick={() => setActiveTab('access')}
              className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 shrink-0 flex items-center gap-1.5 ${
                activeTab === 'access'
                  ? 'border-nature-700 text-nature-800'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Car className="w-4 h-4 text-nature-700" />
              <span>הגעה וחניה</span>
            </button>

            <button
              onClick={() => setActiveTab('source')}
              className={`pb-2.5 px-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 shrink-0 flex items-center gap-1.5 mr-auto ${
                activeTab === 'source'
                  ? 'border-nature-700 text-nature-800'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              <span>מקור הנתונים</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="pt-2">
            
            {/* Tab 1: Overview & Trail Highlights */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                {/* Original TrailMap Summary Card (only if present) */}
                {trail.trailSummary && (
                  <div className="bg-nature-50/50 p-5 rounded-2xl border border-nature-200/70">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-nature-800 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-nature-600" />
                      <span>סקירת המסלול</span>
                    </div>
                    <p className="text-stone-800 text-sm leading-relaxed font-normal">
                      {trail.trailSummary}
                    </p>
                  </div>
                )}

                {/* Landmarks / Points of Interest */}
                {sourceFacts?.landmarks && sourceFacts.landmarks.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                      מוקדי עניין ואתרים לאורך הדרך
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {sourceFacts.landmarks.map((lm, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-nature-50 text-stone-800 text-xs font-medium rounded-xl border border-stone-200 flex items-center gap-1.5 transition-colors"
                        >
                          <MapPin className="w-3 h-3 text-nature-600" />
                          <span>{lm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Structured Content Sections */}
                {trail.contentSections && trail.contentSections.length > 0 && (
                  <div className="space-y-4 pt-2">
                    {trail.contentSections
                      .filter(s => s.id !== 'overview' && s.id !== 'practical-info' && s.id !== 'access-parking')
                      .map((sec, idx) => (
                        <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                          <h3 className="font-bold text-stone-900 text-sm">{sec.title}</h3>
                          {sec.content && (
                            <p className="text-stone-700 text-xs leading-relaxed">{sec.content}</p>
                          )}
                          {sec.items && sec.items.length > 0 && (
                            <ul className="space-y-1 text-xs text-stone-700 pt-1">
                              {sec.items.map((item, itemIdx) => (
                                <li key={itemIdx} className="flex items-start gap-1.5">
                                  <span className="text-nature-600 font-bold">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Practical Information */}
            {activeTab === 'practical' && (
              <div className="space-y-4">
                <div className="bg-stone-50 rounded-2xl border border-stone-200/80 p-5 divide-y divide-stone-200 text-xs">
                  {practical?.distance && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">מרחק הליכה:</span>
                      <span className="text-stone-900 font-bold">{practical.distance}</span>
                    </div>
                  )}
                  {practical?.duration && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">משך זמן משוער:</span>
                      <span className="text-stone-900 font-bold">{practical.duration}</span>
                    </div>
                  )}
                  {practical?.difficulty && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">דרגת קושי:</span>
                      <span className="text-stone-900 font-semibold">{practical.difficulty}</span>
                    </div>
                  )}
                  {practical?.walkingType && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">אופי המסלול:</span>
                      <span className="text-stone-900">{practical.walkingType}</span>
                    </div>
                  )}
                  {practical?.startPoint && (
                    <div className="py-2.5 flex justify-between items-start gap-4">
                      <span className="text-stone-500 font-medium shrink-0">נקודת מוצא:</span>
                      <span className="text-stone-900 text-left font-medium">{practical.startPoint}</span>
                    </div>
                  )}
                  {practical?.endPoint && (
                    <div className="py-2.5 flex justify-between items-start gap-4">
                      <span className="text-stone-500 font-medium shrink-0">נקודת סיום:</span>
                      <span className="text-stone-900 text-left font-medium">{practical.endPoint}</span>
                    </div>
                  )}
                  {practical?.water && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">רחצה במים:</span>
                      <span className="text-stone-900">{practical.water}</span>
                    </div>
                  )}
                  {practical?.shade && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">הצללה:</span>
                      <span className="text-stone-900">{practical.shade}</span>
                    </div>
                  )}
                  {practical?.openingHours && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">שעות פעילות:</span>
                      <span className="text-stone-900">{practical.openingHours}</span>
                    </div>
                  )}
                  {practical?.entryFee && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">דמי כניסה:</span>
                      <span className="text-stone-900">{practical.entryFee}</span>
                    </div>
                  )}
                  {practical?.requiredEquipment && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">ציוד מומלץ:</span>
                      <span className="text-stone-900">{practical.requiredEquipment}</span>
                    </div>
                  )}
                  {practical?.trailMap && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">מפת סימון שבילים:</span>
                      <span className="text-stone-900">{practical.trailMap}</span>
                    </div>
                  )}
                  {practical?.accessibility && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-stone-500 font-medium">נגישות:</span>
                      <span className="text-stone-900">{practical.accessibility}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Access and Parking */}
            {activeTab === 'access' && (
              <div className="space-y-4 text-xs">
                {/* Parking info */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                  <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-nature-700" />
                    <span>חניה והגעה</span>
                  </h3>
                  <p className="text-stone-700 leading-relaxed">
                    {navigation?.parkingLocation || trail.parking || 'לא צוין במקור'}
                  </p>
                </div>

                {/* Road access */}
                {navigation?.roadAccess && (
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                    <h3 className="font-bold text-stone-900 text-sm">כבישי גישה עיקריים</h3>
                    <p className="text-stone-700 leading-relaxed">{navigation.roadAccess}</p>
                  </div>
                )}

                {/* Public transit */}
                {navigation?.publicTransit && (
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                    <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                      <Bus className="w-4 h-4 text-blue-600" />
                      <span>תחבורה ציבורית</span>
                    </h3>
                    <p className="text-stone-700 leading-relaxed">{navigation.publicTransit}</p>
                  </div>
                )}

                {/* Vehicle requirements */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                  <h3 className="font-bold text-stone-900 text-sm">דרישות רכב</h3>
                  <p className="text-stone-700 leading-relaxed">
                    {navigation?.vehicleRequirements || 'לא צוינה מגבלת רכב מיוחדת במקור'}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 4: Provenance & Archival Record */}
            {activeTab === 'source' && (
              <div className="space-y-4">
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-nature-800 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-nature-600" />
                    <span>שקיפות ומקור הנתונים</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed">
                    כל התיאורים והסקירות באפליקציית TrailMap נכתבו מחדש באופן עצמאי על בסיס עובדות בלבד.
                    אין שכפול או פרפרזה של פסקאות המקור.
                  </p>
                  <div className="space-y-1 pt-1 font-mono text-[11px] text-stone-600 bg-white p-3 rounded-xl border border-stone-200">
                    <div>קובץ מקור: {trail.sourceFile}</div>
                    {trail.provenance?.extractedAt && (
                      <div>תאריך עיבוד עובדתי: {new Date(trail.provenance.extractedAt).toLocaleDateString('he-IL')}</div>
                    )}
                    {trail.provenance?.factualFieldsExtracted && (
                      <div>שדות עובדתיים שחולצו: {trail.provenance.factualFieldsExtracted.join(', ')}</div>
                    )}
                  </div>
                </div>

                {/* Archival raw markdown inspector */}
                <div className="space-y-2">
                  <div className="text-xs text-stone-500 font-medium">רשומת מקור ארכיונית (Markdown):</div>
                  {loadingRaw ? (
                    <div className="p-8 text-center text-stone-500 text-xs">טוען רשומת מקור...</div>
                  ) : (
                    <pre className="p-4 bg-stone-900 text-stone-300 font-mono text-xs rounded-2xl overflow-x-auto whitespace-pre-wrap max-h-80 border border-stone-800">
                      {rawContent}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-stone-50 px-5 py-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span className="font-mono text-[11px]">TrailMap ID: {trail.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-stone-300 text-stone-700 font-medium hover:bg-stone-100 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
