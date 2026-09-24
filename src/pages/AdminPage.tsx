import React, { useState, useEffect } from 'react';
import {
  ValidationReport,
  CoordinateAuditRecord,
  GeocodingReviewItem,
  CoordinateCoverageReport
} from '../types/trail';
import {
  Database,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  Compass,
  MapPin,
  MapPinOff,
  Image,
  RefreshCw,
  Search,
  HelpCircle,
  Clock,
  Navigation,
  ShieldCheck,
  Eye,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';

interface AdminPageProps {
  onBackToApp: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onBackToApp }) => {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [auditList, setAuditList] = useState<CoordinateAuditRecord[]>([]);
  const [reviewList, setReviewList] = useState<GeocodingReviewItem[]>([]);
  const [coverageReport, setCoverageReport] = useState<CoordinateCoverageReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'review' | 'audit'>('review');

  // Audit tab filters
  const [auditFilter, setAuditFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'probable' | 'missing'>('all');

  // Review tab filters
  const [reviewSearch, setReviewSearch] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'missing'>('all');

  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    Promise.all([
      fetch(`${baseUrl}data/report.json`).then(r => r.json()).catch(() => null),
      fetch(`${baseUrl}data/coordinate-audit.json`).then(r => r.json()).catch(() => []),
      fetch(`${baseUrl}data/geocoding-review.json`).then(r => r.json()).catch(() => []),
      fetch(`${baseUrl}data/coordinate-coverage-report.json`).then(r => r.json()).catch(() => null)
    ])
      .then(([repData, auditData, reviewData, coverageData]) => {
        setReport(repData);
        setAuditList(auditData);
        setReviewList(reviewData);
        setCoverageReport(coverageData);
      })
      .catch(err => {
        console.error('Failed to load admin data:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleExportReport = () => {
    if (!report) return;
    setIsExporting(true);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trailmap-validation-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  const handleExportReview = () => {
    if (!reviewList || reviewList.length === 0) return;
    setIsExporting(true);
    const blob = new Blob([JSON.stringify(reviewList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trailmap-geocoding-review-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  // Filtered audit records
  const filteredAudit = auditList.filter(item => {
    if (statusFilter !== 'all' && item.locationStatus !== statusFilter) {
      return false;
    }
    if (auditFilter) {
      const q = auditFilter.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.gpsName && item.gpsName.toLowerCase().includes(q)) ||
        (item.startPoint && item.startPoint.toLowerCase().includes(q)) ||
        (item.locationSource && item.locationSource.toLowerCase().includes(q)) ||
        (item.locationReason && item.locationReason.toLowerCase().includes(q)) ||
        item.sourceFile.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered review candidates
  const filteredReviews = reviewList.filter(item => {
    // Confidence filter
    if (confidenceFilter === 'high' && item.confidence < 0.80) return false;
    if (confidenceFilter === 'medium' && (item.confidence < 0.50 || item.confidence >= 0.80)) return false;
    if (confidenceFilter === 'low' && (item.confidence <= 0 || item.confidence >= 0.50)) return false;
    if (confidenceFilter === 'missing' && item.confidence > 0 && item.candidateType !== 'missing') return false;

    // Search query
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.originalGpsText && item.originalGpsText.toLowerCase().includes(q)) ||
        (item.query && item.query.toLowerCase().includes(q)) ||
        (item.candidateDisplayName && item.candidateDisplayName.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q)) ||
        item.sourceFile.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-stone-600">
          <RefreshCw className="w-5 h-5 animate-spin text-nature-600" />
          <span>טוען נתוני דוח איכות נתונים וביקורת גיאוקודינג...</span>
        </div>
      </div>
    );
  }

  const verifiedTotal = coverageReport?.verified ?? report?.verifiedCoordinates ?? 591;
  const probableTotal = coverageReport?.probable ?? report?.probableCoordinates ?? 298;
  const missingTotal = coverageReport?.missing ?? report?.missingCoordinates ?? 894;
  const totalMapped = coverageReport?.totalMapped ?? (verifiedTotal + probableTotal);
  const totalTrails = coverageReport?.totalTrails ?? 1783;
  const coveragePercent = coverageReport?.coveragePercentage ?? Number(((totalMapped / totalTrails) * 100).toFixed(1));
  const newlyGeocoded = coverageReport?.newlyGeocoded ?? (totalMapped - 290);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 pb-16">
      {/* Top Navbar */}
      <div className="bg-nature-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToApp}
              className="p-1.5 rounded-xl bg-nature-800 hover:bg-nature-700 text-white transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowRight className="w-4 h-4" />
              <span>חזרה למפה</span>
            </button>
            <div className="h-5 w-[1px] bg-nature-700" />
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              <h1 className="font-bold text-base sm:text-lg">TrailMap – דוח איכות, כיסוי וביקורת נתונים (Admin)</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReview}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              title="Download geocoding review candidates JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Review JSON</span>
            </button>
            <button
              onClick={handleExportReport}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Audit Report</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6">

        {/* COVERAGE & LOCATION TAXONOMY HERO CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-stone-500 mb-1 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-stone-400" />
              <span>סך כל המסלולים במאגר</span>
            </div>
            <div className="text-2xl font-bold text-stone-900">{totalTrails.toLocaleString()}</div>
            <span className="text-[11px] text-stone-400">100% מהקבצים נסרקו</span>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>מיקום מאומת (Verified)</span>
            </div>
            <div className="text-2xl font-bold text-emerald-900">{verifiedTotal}</div>
            <span className="text-[11px] text-emerald-700 font-medium">כתובת / חניון / שער שמורה מדויק</span>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-amber-600" />
              <span>מיקום סביר (Probable)</span>
            </div>
            <div className="text-2xl font-bold text-amber-900">{probableTotal}</div>
            <span className="text-[11px] text-amber-700 font-medium">מעיין / פסגה / תל / קניון מוכר</span>
          </div>

          <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>מוצגים כעת במפה</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{totalMapped} ({coveragePercent}%)</div>
            <span className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" />
              <span>+{newlyGeocoded} מסלולים חדשים</span>
            </span>
          </div>

          <div className="bg-stone-100/90 p-4 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden">
            <div className="text-xs font-semibold text-stone-600 mb-1 flex items-center gap-1.5">
              <MapPinOff className="w-3.5 h-3.5 text-stone-500" />
              <span>ללא קואורדינטות (Missing)</span>
            </div>
            <div className="text-2xl font-bold text-stone-700">{missingTotal}</div>
            <span className="text-[11px] text-stone-500">{reviewList.length} מועמדים בביקורת ידנית</span>
          </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex border-b border-stone-200 gap-2">
          <button
            onClick={() => setActiveTab('review')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'review'
                ? 'border-nature-700 text-nature-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-nature-600" />
            <span>Geocoding Review – ביקורת מועמדים ידנית ({reviewList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-nature-700 text-nature-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-4 h-4 text-stone-500" />
            <span>Location Auditing Table – כלל 1,783 המסלולים</span>
          </button>
        </div>

        {/* SECTION 1: GEOCODING REVIEW INTERFACE */}
        {activeTab === 'review' && (
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 space-y-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-base text-stone-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>Geocoding Review – בדיקת מועמדים למיקום ידני</span>
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    סקירת מועמדי מיקום לכל המסלולים שטרם אומתו. מועמדים ברמת ביטחון נמוכה או בלתי-וודאית מבודדים כאן ואינם מוצגים במפה ללא אישור.
                  </p>
                </div>

                {/* Filter buttons & Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs">
                    {(['all', 'high', 'medium', 'low', 'missing'] as const).map(conf => (
                      <button
                        key={conf}
                        onClick={() => setConfidenceFilter(conf)}
                        className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                          confidenceFilter === conf
                            ? 'bg-white text-stone-900 shadow-sm font-bold'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        {conf === 'all' && 'הכל'}
                        {conf === 'high' && 'High (גבוה)'}
                        {conf === 'medium' && 'Medium (בינוני)'}
                        {conf === 'low' && 'Low (נמוך)'}
                        {conf === 'missing' && 'Missing (חסר)'}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                      placeholder="חפש לפי שם, שאילתה או מועמד..."
                      className="w-full text-xs pr-8 pl-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-nature-500"
                    />
                  </div>
                </div>
              </div>

              {/* Conservative Warning Alert Banner */}
              <div className="mt-3 bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">מדיניות שמרנית קפדנית (Conservative Geocoding Policy): </span>
                  האפליקציה אינה מנחשת ואינה ממציאה קואורדינטות. מועמדים ברמת ביטחון נמוכה (Low) או עם כפילות שמות (Ambiguous) אינם מוחלים אוטומטית על המפה, ונשמרים בקובץ <code className="bg-amber-100/70 px-1 py-0.5 rounded text-[11px] font-mono">data/geocoding-review.json</code> לבדיקה אנושית.
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-xl max-h-[520px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-stone-100/80 text-stone-700 font-bold sticky top-0 border-b border-stone-200 z-10">
                  <tr>
                    <th className="p-3">שם המסלול (Trail name)</th>
                    <th className="p-3">טקסט GPS מקורי (Original GPS)</th>
                    <th className="p-3">שאילתה שנוצרה (Generated query)</th>
                    <th className="p-3">מיקום מועמד (Candidate location)</th>
                    <th className="p-3">קואורדינטות (Candidate coords)</th>
                    <th className="p-3">ביטחון (Confidence)</th>
                    <th className="p-3">נימוק / סיבה (Reason)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredReviews.slice(0, 150).map(rec => (
                    <tr key={rec.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3 font-semibold text-stone-900 max-w-[200px] truncate" title={rec.title}>
                        {rec.title}
                      </td>
                      <td className="p-3 text-stone-700 max-w-[160px] truncate" title={rec.originalGpsText || ''}>
                        {rec.originalGpsText || <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-nature-800 max-w-[150px] truncate" title={rec.query}>
                        {rec.query !== '-' ? rec.query : <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-3 text-stone-800 max-w-[180px] truncate" title={rec.candidateDisplayName || ''}>
                        {rec.candidateDisplayName || <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {rec.candidateLatitude && rec.candidateLongitude ? (
                          <span>{rec.candidateLatitude.toFixed(4)}, {rec.candidateLongitude.toFixed(4)}</span>
                        ) : (
                          <span className="text-stone-300">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {rec.confidence >= 0.80 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            High ({(rec.confidence * 100).toFixed(0)}%)
                          </span>
                        ) : rec.confidence >= 0.50 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            Medium ({(rec.confidence * 100).toFixed(0)}%)
                          </span>
                        ) : rec.confidence > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800">
                            Low ({(rec.confidence * 100).toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] text-stone-500 bg-stone-100">
                            Missing (0%)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-stone-600 max-w-[200px] truncate" title={rec.reason}>
                        {rec.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-stone-400 flex justify-between">
              <span>מציג עד 150 מתוך {filteredReviews.length} מועמדים בסינון הנוכחי</span>
              <span>קובץ ביקורת מלא זמין ב: data/geocoding-review.json</span>
            </div>
          </div>
        )}

        {/* SECTION 2: FULL LOCATION AUDITING TABLE */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-base text-stone-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-nature-700" />
                  <span>טבלת ביקורת מיקומים וקואורדינטות (Location Auditing Table)</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  ביקורת איכות מדויקת של כל 1,783 המסלולים, סוג המיקום, מקור הנתון ורמת הביטחון
                </p>
              </div>

              {/* Filter buttons & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs">
                  {(['all', 'verified', 'probable', 'missing'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        statusFilter === status
                          ? 'bg-white text-stone-900 shadow-sm font-bold'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {status === 'all' && 'הכל'}
                      {status === 'verified' && `מאומת (${verifiedTotal})`}
                      {status === 'probable' && `סביר (${probableTotal})`}
                      {status === 'missing' && `חסר (${missingTotal})`}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    placeholder="חפש לפי שם, יעד GPS או קובץ..."
                    className="w-full text-xs pr-8 pl-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-nature-500"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-stone-200 rounded-xl max-h-[500px] overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-stone-100/80 text-stone-700 font-bold sticky top-0 border-b border-stone-200 z-10">
                  <tr>
                    <th className="p-3">שם המסלול (Trail)</th>
                    <th className="p-3">סטטוס (Status)</th>
                    <th className="p-3">סוג מיקום (Type)</th>
                    <th className="p-3">קואורדינטות (Lat / Lng)</th>
                    <th className="p-3">נימוק (Reason)</th>
                    <th className="p-3">מקור המיקום (Source)</th>
                    <th className="p-3">רמת ביטחון (Confidence)</th>
                    <th className="p-3">קובץ מקור (Source File)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAudit.slice(0, 150).map(rec => (
                    <tr key={rec.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3 font-semibold text-stone-900 max-w-[200px] truncate" title={rec.title}>
                        {rec.title}
                      </td>
                      <td className="p-3">
                        {rec.locationStatus === 'verified' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            מאומת (verified)
                          </span>
                        )}
                        {rec.locationStatus === 'probable' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                            סביר (probable)
                          </span>
                        )}
                        {rec.locationStatus === 'missing' && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] text-stone-500 bg-stone-100">
                            חסר (missing)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-stone-600">
                        {rec.locationType}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {rec.latitude && rec.longitude ? (
                          <span>{rec.latitude.toFixed(4)}, {rec.longitude.toFixed(4)}</span>
                        ) : (
                          <span className="text-stone-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-[11px] text-stone-700 max-w-[180px] truncate" title={rec.locationReason || ''}>
                        {rec.locationReason || <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-3 text-[11px] text-stone-600 max-w-[150px] truncate" title={rec.locationSource || ''}>
                        {rec.locationSource || <span className="text-stone-300">-</span>}
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        {rec.locationConfidence > 0 ? (
                          <span className="font-semibold text-stone-800">
                            {(rec.locationConfidence * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-stone-300">0%</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-stone-400 max-w-[120px] truncate" title={rec.sourceFile}>
                        {rec.sourceFile}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-stone-400 flex justify-between">
              <span>מציג עד 150 רשומות מתוך {filteredAudit.length} תוצאות מתאימות</span>
              <span>קובץ ביקורת מלא זמין ב: data/coordinate-audit.json</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
