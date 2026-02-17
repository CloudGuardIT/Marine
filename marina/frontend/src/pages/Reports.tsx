import { useState, useEffect } from 'react';
import { BarChart3, Ship, ParkingSquare, Truck, Activity, Loader2, RefreshCw, Download } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { STATUS_LABELS, ACTION_LABELS } from '../utils';
import DonutChart from '../components/DonutChart';

const VESSEL_STATUS_COLORS: Record<string, string> = {
  parked: '#3b82f6',
  in_water: '#06b6d4',
  transit: '#eab308',
  maintenance: '#ef4444',
};

const SPOT_STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  occupied: '#f97316',
  reserved: '#a855f7',
  maintenance: '#ef4444',
};

export default function Reports() {
  const [vesselsByStatus, setVesselsByStatus] = useState<{ status: string; count: number }[]>([]);
  const [spotsByZone, setSpotsByZone] = useState<{ zone: string; status: string; count: number }[]>([]);
  const [tractorStats, setTractorStats] = useState<{ total: number; completed: number; pending: number; averageMinutes: number } | null>(null);
  const [activitySummary, setActivitySummary] = useState<{ byDay: Record<string, number>; byAction: Record<string, number>; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const toast = useToast();

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api.getVesselsByStatus(),
      api.getSpotsByZone(),
      api.getTractorStats(),
      api.getActivitySummary(),
    ]).then(([vs, sz, ts, as_]) => {
      setVesselsByStatus(vs);
      setSpotsByZone(sz);
      setTractorStats(ts);
      setActivitySummary(as_);
    }).catch((err: any) => {
      setError(err.message || 'שגיאה בטעינת דוחות');
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  async function handleExport(type: 'vessels' | 'activity' | 'tractor') {
    setExporting(type);
    try {
      if (type === 'vessels') await api.exportVesselsCSV();
      else if (type === 'activity') await api.exportActivityCSV(7);
      else await api.exportTractorCSV();
      toast.success('הקובץ הורד בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בייצוא');
    } finally {
      setExporting('');
    }
  }

  // Group spots overall for donut
  const spotTotals: Record<string, number> = {};
  spotsByZone.forEach((s) => {
    spotTotals[s.status] = (spotTotals[s.status] || 0) + s.count;
  });

  // Group spots by zone for stacked bars
  const zoneData: Record<string, Record<string, number>> = {};
  spotsByZone.forEach((s) => {
    if (!zoneData[s.zone]) zoneData[s.zone] = {};
    zoneData[s.zone][s.status] = s.count;
  });

  // Tractor completion rate
  const completionRate = tractorStats && tractorStats.total > 0
    ? Math.round((tractorStats.completed / tractorStats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <BarChart3 size={24} /> דוחות
        </h1>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 className="animate-spin ml-2" size={20} />
          טוען דוחות...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 size={24} /> דוחות
        </h1>
        <div className="flex gap-2">
          <div className="relative group">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition shadow-sm"
            >
              <Download size={16} /> ייצוא CSV
            </button>
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-10 min-w-[160px]">
              <button onClick={() => handleExport('vessels')} disabled={!!exporting} className="w-full text-right px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                <Ship size={14} /> כלי שייט
              </button>
              <button onClick={() => handleExport('tractor')} disabled={!!exporting} className="w-full text-right px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                <Truck size={14} /> בקשות טרקטור
              </button>
              <button onClick={() => handleExport('activity')} disabled={!!exporting} className="w-full text-right px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2">
                <Activity size={14} /> יומן פעילות
              </button>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition shadow-sm"
          >
            <RefreshCw size={16} /> רענון
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={load} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw size={14} /> נסה שוב
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vessels by Status - Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Ship size={18} className="text-blue-600" /> כלי שייט לפי סטטוס
          </h2>
          <div className="flex justify-center">
            <DonutChart
              segments={vesselsByStatus.map((v) => ({
                label: STATUS_LABELS[v.status] || v.status,
                value: v.count,
                color: VESSEL_STATUS_COLORS[v.status] || '#94a3b8',
              }))}
              centerValue={vesselsByStatus.reduce((sum, v) => sum + v.count, 0)}
              centerLabel="סה״כ"
            />
          </div>
        </div>

        {/* Spots by Status - Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <ParkingSquare size={18} className="text-green-600" /> מקומות חניה לפי סטטוס
          </h2>
          <div className="flex justify-center">
            <DonutChart
              segments={Object.entries(spotTotals).map(([status, count]) => ({
                label: STATUS_LABELS[status] || status,
                value: count,
                color: SPOT_STATUS_COLORS[status] || '#94a3b8',
              }))}
              centerValue={Object.values(spotTotals).reduce((a, b) => a + b, 0)}
              centerLabel="סה״כ מקומות"
            />
          </div>
        </div>

        {/* Spots by Zone - Stacked Bars */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <ParkingSquare size={18} className="text-purple-600" /> תפוסה לפי אזור
          </h2>
          <div className="space-y-4">
            {Object.entries(zoneData).sort().map(([zone, statuses]) => {
              const total = Object.values(statuses).reduce((a, b) => a + b, 0);
              const occupied = (statuses.occupied || 0) + (statuses.reserved || 0);
              const occupancyPct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              return (
                <div key={zone}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">אזור {zone}</span>
                    <span className="text-gray-500">{occupancyPct}% תפוסה ({total} מקומות)</span>
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex">
                    {statuses.occupied && (
                      <div className="bg-orange-400 h-full transition-all" style={{ width: `${(statuses.occupied / total) * 100}%` }} title={`תפוס: ${statuses.occupied}`} />
                    )}
                    {statuses.reserved && (
                      <div className="bg-purple-400 h-full transition-all" style={{ width: `${(statuses.reserved / total) * 100}%` }} title={`שמור: ${statuses.reserved}`} />
                    )}
                    {statuses.maintenance && (
                      <div className="bg-red-400 h-full transition-all" style={{ width: `${(statuses.maintenance / total) * 100}%` }} title={`תחזוקה: ${statuses.maintenance}`} />
                    )}
                    {statuses.available && (
                      <div className="bg-green-400 h-full transition-all" style={{ width: `${(statuses.available / total) * 100}%` }} title={`פנוי: ${statuses.available}`} />
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(zoneData).length === 0 && <div className="text-gray-400 text-sm text-center py-4">אין נתונים</div>}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-gray-500 justify-center">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> תפוס</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> שמור</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> תחזוקה</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> פנוי</span>
          </div>
        </div>

        {/* Tractor Stats - Enhanced */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Truck size={18} className="text-yellow-600" /> סטטיסטיקות טרקטור
          </h2>
          {tractorStats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">{tractorStats.total}</div>
                  <div className="text-xs text-gray-500">סה״כ בקשות</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{tractorStats.completed}</div>
                  <div className="text-xs text-gray-500">הושלמו</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">{tractorStats.pending}</div>
                  <div className="text-xs text-gray-500">ממתינות</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">{tractorStats.averageMinutes}</div>
                  <div className="text-xs text-gray-500">דקות ממוצע</div>
                </div>
              </div>
              {/* Completion Rate Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">אחוז השלמה</span>
                  <span className="font-bold text-gray-800">{completionRate}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${completionRate >= 80 ? 'bg-green-500' : completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm text-center py-4">אין נתונים</div>
          )}
        </div>

        {/* Activity Summary - Enhanced with mini bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Activity size={18} className="text-purple-600" /> סיכום פעילות (7 ימים)
          </h2>
          {activitySummary ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily activity bar chart */}
              <div>
                <div className="text-sm text-gray-500 mb-3">פעילות יומית</div>
                <div className="flex items-end gap-1 h-32">
                  {(() => {
                    const days = Object.entries(activitySummary.byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
                    const maxVal = Math.max(...days.map(([, v]) => v), 1);
                    return days.map(([day, count]) => {
                      const dayLabel = new Date(day).toLocaleDateString('he-IL', { weekday: 'short' });
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-xs text-gray-500 font-medium">{count}</div>
                          <div
                            className="w-full bg-blue-500 rounded-t-md transition-all min-h-[4px]"
                            style={{ height: `${(count / maxVal) * 100}%` }}
                            title={`${day}: ${count} פעולות`}
                          />
                          <div className="text-[10px] text-gray-400">{dayLabel}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* By action type */}
              <div>
                <div className="flex justify-between text-sm text-gray-500 mb-3">
                  <span>לפי סוג פעולה</span>
                  <span className="font-medium text-gray-700">סה״כ: {activitySummary.total}</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(activitySummary.byAction)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([action, count]) => {
                      const pct = activitySummary.total > 0 ? (count / activitySummary.total) * 100 : 0;
                      return (
                        <div key={action}>
                          <div className="flex justify-between items-center text-sm mb-0.5">
                            <span className="text-gray-600">{ACTION_LABELS[action] || action}</span>
                            <span className="text-xs font-medium text-gray-500">{count}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm text-center py-4">אין נתונים</div>
          )}
        </div>
      </div>
    </div>
  );
}
