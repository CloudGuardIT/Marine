import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import StatsBar from '../components/StatsBar';
import TractorQueue from '../components/TractorQueue';
import MarinaMap from '../components/MarinaMap';
import InWaterPanel from '../components/InWaterPanel';
import ActivityFeed from '../components/ActivityFeed';
import { Loader2, RefreshCw, Users, Truck } from 'lucide-react';
import type { DashboardStats, TractorRequest, ParkingSpot, Vessel, ActivityLog } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queue, setQueue] = useState<TractorRequest[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    try {
      setError('');
      const [s, q, sp, v, a] = await Promise.all([
        api.getDashboard(),
        api.getQueue(),
        api.getSpots(),
        api.getVessels(),
        api.getActivity(15),
      ]);
      setStats(s);
      setQueue(q);
      setSpots(sp);
      setVessels(v);
      setActivities(a.activities);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useSocket({
    'tractor:created': () => loadAll(),
    'tractor:updated': () => loadAll(),
    'vessel:updated': () => loadAll(),
    'spot:updated': () => loadAll(),
    'activity:new': () => loadAll(),
  });

  const handleMoveVessel = async (vesselId: string, newSpotId: string) => {
    try {
      await api.updateVessel(vesselId, { spotId: newSpotId });
      toast.success('כלי השייט הועבר בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בהעברת כלי שייט');
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
        <MarinaMap spots={spots} vessels={vessels} userRole={user?.role} onMoveVessel={handleMoveVessel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InWaterPanel vessels={vessels} />
        <ActivityFeed activities={activities} compact />
      </div>
    </div>
  );
}
