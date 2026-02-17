import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { STATUS_LABELS, VESSEL_TYPES, timeAgo } from '../utils';
import type { Vessel, MyQueuePosition } from '../types';
import { Ship, Anchor, MapPin, Clock, Loader2, X, ArrowRight } from 'lucide-react';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true' && user?.role === 'admin';
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [activeRequests, setActiveRequests] = useState<MyQueuePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingVessel, setBookingVessel] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [v, pos] = await Promise.all([
        api.getVessels(),
        api.getMyQueuePosition(),
      ]);
      setVessels(v);
      setActiveRequests(pos);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useSocket({
    'tractor:created': () => loadData(),
    'tractor:updated': () => loadData(),
    'vessel:updated': () => loadData(),
    'spot:updated': () => loadData(),
  });

  const getActiveRequest = (vesselId: string) =>
    activeRequests.find((r) => r.vesselId === vesselId);

  const canBook = (vessel: Vessel) => {
    if (vessel.status === 'maintenance' || vessel.status === 'transit') return false;
    if (getActiveRequest(vessel.id)) return false;
    return true;
  };

  const handleBook = async (vessel: Vessel) => {
    const type = vessel.status === 'parked' ? 'launch' : 'retrieve';
    setBookingVessel(vessel.id);
    try {
      await api.createRequest({ vesselId: vessel.id, type });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'שגיאה ביצירת בקשה');
    } finally {
      setBookingVessel(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await api.cancelRequest(requestId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'שגיאה בביטול בקשה');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin ml-2" size={20} />
        טוען...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {isPreview && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-sm text-amber-800 font-medium">תצוגה מקדימה — תצוגת לקוח</span>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium transition"
          >
            חזרה לניהול
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">שלום, {user?.name}</h1>
        <p className="text-gray-500 text-sm mt-1">ניהול כלי השייט שלך</p>
      </div>

      {/* Active Requests Banner */}
      {activeRequests.length > 0 && (
        <div className="space-y-3">
          {activeRequests.map((req) => (
            <div
              key={req.id}
              className={`rounded-xl border-2 p-4 ${
                req.status === 'pending'
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-blue-300 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    req.status === 'pending' ? 'bg-yellow-200' : 'bg-blue-200'
                  }`}>
                    <Clock size={20} className={req.status === 'pending' ? 'text-yellow-700' : 'text-blue-700'} />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">
                      {req.type === 'launch' ? 'השקה' : 'שליפה'} — {req.vesselName}
                    </div>
                    <div className="text-sm text-gray-600">
                      סטטוס: {STATUS_LABELS[req.status]}
                      {req.status === 'pending' && req.position > 0 && (
                        <span className="mr-2 font-bold text-yellow-700">
                          • מיקום בתור: #{req.position}
                        </span>
                      )}
                    </div>
                    {req.status === 'pending' && req.estimatedWait > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        זמן המתנה משוער: ~{req.estimatedWait} דקות
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      נוצר {timeAgo(req.createdAt)}
                    </div>
                  </div>
                </div>
                {req.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(req.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="ביטול בקשה"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vessels Grid */}
      {vessels.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Ship size={48} className="mx-auto mb-3 opacity-50" />
          <p>אין כלי שייט רשומים</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vessels.map((vessel) => {
            const activeReq = getActiveRequest(vessel.id);
            return (
              <div
                key={vessel.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Anchor size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{vessel.name}</div>
                        <div className="text-xs text-gray-400">{vessel.registrationNumber}</div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      vessel.status === 'parked' ? 'bg-green-100 text-green-700' :
                      vessel.status === 'in_water' ? 'bg-blue-100 text-blue-700' :
                      vessel.status === 'transit' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {STATUS_LABELS[vessel.status]}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Ship size={14} className="text-gray-400" />
                      {VESSEL_TYPES[vessel.type] || vessel.type} • {vessel.length} מ׳
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-400" />
                      {vessel.spot
                        ? `מקום ${vessel.spot.number} (אזור ${vessel.spot.zone})`
                        : vessel.status === 'in_water'
                          ? 'במים'
                          : vessel.status === 'transit'
                            ? 'בהעברה'
                            : '—'}
                    </div>
                  </div>

                  {activeReq ? (
                    <div className="text-xs text-center py-2 px-3 rounded-lg bg-gray-100 text-gray-500">
                      {activeReq.status === 'pending' ? 'ממתין בתור' : 'בטיפול'} — {activeReq.type === 'launch' ? 'השקה' : 'שליפה'}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBook(vessel)}
                      disabled={!canBook(vessel) || bookingVessel === vessel.id}
                      className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition ${
                        canBook(vessel)
                          ? vessel.status === 'parked'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {bookingVessel === vessel.id ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 size={14} className="animate-spin" />
                          שולח...
                        </span>
                      ) : vessel.status === 'parked' ? (
                        'הזמן השקה 🚤'
                      ) : vessel.status === 'in_water' ? (
                        'הזמן שליפה ⬆️'
                      ) : (
                        'לא זמין'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
