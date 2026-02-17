import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import StatsBar from '../components/StatsBar';
import TractorQueue from '../components/TractorQueue';
import InteractiveMap from '../components/InteractiveMap';
import InWaterPanel from '../components/InWaterPanel';
import ActivityFeed from '../components/ActivityFeed';
import { Loader2, RefreshCw, Users, Truck, Shield, AlertTriangle, LogIn, Ban, Clock } from 'lucide-react';
import type { DashboardStats, TractorRequest, ParkingSpot, Vessel, ActivityLog, Zone } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queue, setQueue] = useState<TractorRequest[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<ActivityLog[]>([]);
  const [securityTotal, setSecurityTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    try {
      setError('');
      const promises: Promise<any>[] = [
        api.getDashboard(),
        api.getQueue(),
        api.getSpots(),
        api.getVessels(),
        api.getActivity(15),
        api.getZones(),
      ];
      // Load security events for admin
      if (user?.role === 'admin') {
        promises.push(api.getSecurityEvents(20));
      }
      const results = await Promise.all(promises);
      setStats(results[0]);
      setQueue(results[1]);
      setSpots(results[2]);
      setVessels(results[3]);
      setActivities(results[4].activities);
      setZones(results[5]);
      if (results[6]) {
        setSecurityEvents(results[6].events);
        setSecurityTotal(results[6].total);
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useSocket({
    'tractor:created': (data: any) => {
      loadAll();
      // Show popup notification to admin/operator
      const vesselName = data?.vessel?.name || 'כלי שייט';
      const requesterName = data?.requester?.name || '';
      const typeLabel = data?.type === 'launch' ? 'השקה' : 'שליפה';
      toast.info(`בקשת טרקטור חדשה: ${typeLabel} — "${vesselName}" (${requesterName})`);
    },
    'tractor:updated': () => loadAll(),
    'vessel:updated': () => loadAll(),
    'spot:updated': () => loadAll(),
    'zone:updated': () => loadAll(),
    'zone:deleted': () => loadAll(),
    'activity:new': () => loadAll(),
    'security:event': (data: any) => {
      loadAll();
      if (data?.action === 'login_failed') {
        toast.error(`ניסיון התחברות נכשל: ${data?.details || ''}`);
      }
    },
  });

  const handleMoveVessel = async (vesselId: string, newSpotId: string) => {
    try {
      await api.updateVessel(vesselId, { spotId: newSpotId });
      toast.success('כלי השייט הועבר בהצלחה');
      loadAll();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעברת כלי שייט');
    }
  };

  const handleRemoveVessel = async (vesselId: string, _spotId: string) => {
    try {
      await api.updateVessel(vesselId, { spotId: null });
      loadAll();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהסרת כלי שייט');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin ml-2" size={20} />
        טוען לוח בקרה...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">לוח בקרה</h1>

        {/* Preview buttons for admin */}
        {user?.role === 'admin' && (
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/customer?preview=true')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm"
            >
              <Users size={16} />
              תצוגת לקוח
            </button>
            <button
              onClick={() => navigate('/tractor?preview=true')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm"
            >
              <Truck size={16} />
              תצוגת טרקטור
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={loadAll} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw size={14} /> נסה שוב
          </button>
        </div>
      )}

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TractorQueue queue={queue} onUpdate={loadAll} compact />
        <InteractiveMap
          spots={spots}
          zones={zones}
          vessels={vessels}
          userRole={user?.role}
          onMoveVessel={handleMoveVessel}
          onRemoveVessel={handleRemoveVessel}
          onSpotsChanged={loadAll}
          onZonesChanged={loadAll}
          compact
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InWaterPanel vessels={vessels} />
        <ActivityFeed activities={activities} compact />
      </div>

      {/* Security Panel — admin only */}
      {user?.role === 'admin' && (
        <SecurityPanel events={securityEvents} total={securityTotal} />
      )}
    </div>
  );
}

const SECURITY_ICONS: Record<string, typeof AlertTriangle> = {
  login_failed: LogIn,
  unauthorized_access: Ban,
  invalid_token: AlertTriangle,
  forbidden_access: Shield,
  rate_limited: Clock,
};

const SECURITY_COLORS: Record<string, string> = {
  login_failed: 'text-red-500',
  unauthorized_access: 'text-orange-500',
  invalid_token: 'text-red-600',
  forbidden_access: 'text-yellow-600',
  rate_limited: 'text-purple-500',
};

const SECURITY_LABELS: Record<string, string> = {
  login_failed: 'התחברות נכשלה',
  unauthorized_access: 'גישה לא מורשית',
  invalid_token: 'טוקן לא תקין',
  forbidden_access: 'ניסיון גישה אסורה',
  rate_limited: 'חריגת קצב בקשות',
};

function SecurityPanel({ events, total }: { events: ActivityLog[]; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? events : events.slice(0, 5);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Shield size={18} className="text-red-500" />
          אבטחה ואירועים
          {total > 0 && (
            <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">עדכון חי</span>
      </div>

      {events.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <Shield size={16} />
          אין אירועי אבטחה
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {shown.map((e) => {
            const Icon = SECURITY_ICONS[e.action] || AlertTriangle;
            const color = SECURITY_COLORS[e.action] || 'text-gray-500';
            const label = SECURITY_LABELS[e.action] || e.action;
            const time = new Date(e.createdAt);
            const timeStr = time.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const dateStr = time.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

            return (
              <div key={e.id} className="px-4 py-2.5 hover:bg-red-50/30 transition">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        e.action === 'login_failed' ? 'bg-red-100 text-red-700' :
                        e.action === 'forbidden_access' ? 'bg-yellow-100 text-yellow-700' :
                        e.action === 'unauthorized_access' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-400">{dateStr} {timeStr}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5 truncate" title={e.details || ''}>
                      {e.details}
                    </div>
                    {e.user && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        משתמש: {e.user.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {events.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 text-sm hover:underline"
          >
            {expanded ? 'הצג פחות' : `הצג עוד (${total} סה"כ)`}
          </button>
        </div>
      )}
    </div>
  );
}
