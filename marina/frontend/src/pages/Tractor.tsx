import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Truck, Plus, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import TractorQueue from '../components/TractorQueue';
import type { TractorRequest, Vessel } from '../types';
import { STATUS_LABELS, formatDateTime } from '../utils';

export default function Tractor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true' && user?.role === 'admin';
  const [queue, setQueue] = useState<TractorRequest[]>([]);
  const [history, setHistory] = useState<TractorRequest[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const [q, h, v] = await Promise.all([api.getQueue(), api.getRequests(), api.getVessels()]);
    setQueue(q);
    setHistory(h);
    setVessels(v);
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'tractor:created': () => load(), 'tractor:updated': () => load() });

  return (
    <div className="p-6">
      {isPreview && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <span className="text-sm text-amber-800 font-medium">תצוגה מקדימה — תצוגת טרקטור</span>
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-900 font-medium transition"
          >
            חזרה לניהול
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck size={24} /> תור טרקטור
        </h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
          <Plus size={16} /> בקשה חדשה
        </button>
      </div>

      {/* Active Queue */}
      <div className="mb-6">
        <TractorQueue queue={queue} onUpdate={load} />
      </div>

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">היסטוריה</div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-right font-medium">כלי שייט</th>
                <th className="px-4 py-2 text-right font-medium">סוג</th>
                <th className="px-4 py-2 text-right font-medium">מבקש</th>
                <th className="px-4 py-2 text-right font-medium">מפעיל</th>
                <th className="px-4 py-2 text-right font-medium">סטטוס</th>
                <th className="px-4 py-2 text-right font-medium">נוצר</th>
                <th className="px-4 py-2 text-right font-medium">הושלם</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{r.vessel.name}</td>
                  <td className="px-4 py-2">{r.type === 'launch' ? 'השקה' : 'שליפה'}</td>
                  <td className="px-4 py-2">{r.requester.name}</td>
                  <td className="px-4 py-2 text-gray-500">{r.operator?.name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`status-${r.status} text-xs px-2 py-0.5 rounded-full`}>{STATUS_LABELS[r.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{r.completedAt ? formatDateTime(r.completedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && <div className="p-6 text-center text-gray-400">אין היסטוריה</div>}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateRequestModal
          vessels={vessels}
          userRole={user?.role || 'customer'}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

function CreateRequestModal({ vessels, userRole, onClose, onCreated }: {
  vessels: Vessel[];
  userRole: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vesselId, setVesselId] = useState('');
  const [type, setType] = useState<'launch' | 'retrieve'>('launch');
  const [priority, setPriority] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const eligible = vessels.filter((v) =>
    type === 'launch' ? v.status === 'parked' : v.status === 'in_water'
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createRequest({ vesselId, type, priority, notes: notes || undefined });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">בקשת טרקטור חדשה</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
            <select value={type} onChange={(e) => { setType(e.target.value as any); setVesselId(''); }} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="launch">השקה למים</option>
              <option value="retrieve">שליפה מהמים</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כלי שייט</label>
            <select value={vesselId} onChange={(e) => setVesselId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">בחר כלי שייט</option>
              {eligible.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
            </select>
            {eligible.length === 0 && <p className="text-xs text-gray-400 mt-1">אין כלי שייט זמינים לפעולה זו</p>}
          </div>
          {(userRole === 'admin' || userRole === 'operator') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עדיפות (0-10)</label>
              <input type="number" min={0} max={10} value={priority} onChange={(e) => setPriority(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving || !vesselId} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שולח...' : 'שלח בקשה'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
