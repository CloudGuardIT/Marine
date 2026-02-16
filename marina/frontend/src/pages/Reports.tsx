import { useState, useEffect } from 'react';
import { BarChart3, Ship, ParkingSquare, Truck, Activity } from 'lucide-react';
import { api } from '../api';
import { STATUS_LABELS, ACTION_LABELS } from '../utils';

export default function Reports() {
  const [vesselsByStatus, setVesselsByStatus] = useState<{ status: string; count: number }[]>([]);
  const [spotsByZone, setSpotsByZone] = useState<{ zone: string; status: string; count: number }[]>([]);
  const [tractorStats, setTractorStats] = useState<{ total: number; completed: number; pending: number; averageMinutes: number } | null>(null);
  const [activitySummary, setActivitySummary] = useState<{ byDay: Record<string, number>; byAction: Record<string, number>; total: number } | null>(null);

  useEffect(() => {
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
    });
  }, []);

  // Group spots by zone
  const zoneData: Record<string, Record<string, number>> = {};
  spotsByZone.forEach((s) => {
    if (!zoneData[s.zone]) zoneData[s.zone] = {};
    zoneData[s.zone][s.status] = s.count;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <BarChart3 size={24} /> דוחות
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vessels by Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Ship size={18} className="text-blue-600" /> כלי שייט לפי סטטוס
          </h2>
          <div className="space-y-3">
            {vesselsByStatus.map((v) => {
              const max = Math.max(...vesselsByStatus.map((x) => x.count), 1);
              return (
                <div key={v.status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{STATUS_LABELS[v.status] || v.status}</span>
                    <span className="font-bold">{v.count}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        v.status === 'parked' ? 'bg-blue-500' :
                        v.status === 'in_water' ? 'bg-cyan-500' :
                        v.status === 'transit' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(v.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spots by Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <ParkingSquare size={18} className="text-green-600" /> מקומות לפי אזור
          </h2>
          <div className="space-y-4">
            {Object.entries(zoneData).sort().map(([zone, statuses]) => {
              const total = Object.values(statuses).reduce((a, b) => a + b, 0);
              return (
                <div key={zone}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">אזור {zone}</span>
                    <span className="text-gray-500">{total} מקומות</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                    {statuses.available && (
                      <div className="bg-green-400 h-full" style={{ width: `${(statuses.available / total) * 100}%` }} title={`פנוי: ${statuses.available}`} />
                    )}
                    {statuses.occupied && (
                      <div className="bg-orange-400 h-full" style={{ width: `${(statuses.occupied / total) * 100}%` }} title={`תפוס: ${statuses.occupied}`} />
                    )}
                    {statuses.reserved && (
                      <div className="bg-purple-400 h-full" style={{ width: `${(statuses.reserved / total) * 100}%` }} title={`שמור: ${statuses.reserved}`} />
                    )}
                    {statuses.maintenance && (
                      <div className="bg-red-400 h-full" style={{ width: `${(statuses.maintenance / total) * 100}%` }} title={`תחזוקה: ${statuses.maintenance}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tractor Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Truck size={18} className="text-yellow-600" /> סטטיסטיקות טרקטור
          </h2>
          {tractorStats && (
            <div className="grid grid-cols-2 gap-4">
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
          )}
        </div>

        {/* Activity Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Activity size={18} className="text-purple-600" /> סיכום פעילות (7 ימים)
          </h2>
          {activitySummary && (
            <div>
              <div className="text-sm text-gray-500 mb-3">סה״כ: {activitySummary.total} פעולות</div>
              <div className="space-y-2">
                {Object.entries(activitySummary.byAction)
                  .sort(([, a], [, b]) => b - a)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{ACTION_LABELS[action] || action}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
