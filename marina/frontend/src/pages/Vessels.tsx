import { useState, useEffect, useCallback } from 'react';
import { Ship, Plus, Search, Trash2, Edit3, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ConfirmDialog';
import { useSocket } from '../hooks/useSocket';
import { STATUS_LABELS, VESSEL_TYPES, formatDateTime } from '../utils';
import type { Vessel, ParkingSpot, User } from '../types';

export default function Vessels() {
  const { user } = useAuth();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      setError('');
      const [v, sp] = await Promise.all([api.getVessels(), api.getSpots()]);
      setVessels(v);
      setSpots(sp);
      if (isAdmin) {
        try { setUsers(await api.getUsers()); } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת כלי שייט');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'vessel:updated': () => load(), 'spot:updated': () => load() });

  const filtered = vessels.filter((v) => {
    if (search && !v.name.includes(search) && !v.registrationNumber.includes(search)) return false;
    if (statusFilter && v.status !== statusFilter) return false;
    return true;
  });

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: 'מחיקת כלי שייט',
      message: `האם למחוק את "${name}"? פעולה זו אינה ניתנת לביטול.`,
      confirmLabel: 'מחיקה',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteVessel(id);
      toast.success(`"${name}" נמחק בהצלחה`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <Ship size={24} /> כלי שייט
        </h1>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 className="animate-spin ml-2" size={20} />
          טוען...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Ship size={24} /> כלי שייט
        </h1>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
            <Plus size={16} /> הוספת כלי שייט
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={load} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw size={14} /> נסה שוב
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="חיפוש שם או מספר רישוי..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">כל הסטטוסים</option>
          <option value="parked">חונה</option>
          <option value="in_water">במים</option>
          <option value="transit">בהעברה</option>
          <option value="maintenance">תחזוקה</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hidden lg:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-right font-medium">שם</th>
              <th className="px-4 py-3 text-right font-medium">מספר רישוי</th>
              <th className="px-4 py-3 text-right font-medium">סוג</th>
              <th className="px-4 py-3 text-right font-medium">אורך</th>
              <th className="px-4 py-3 text-right font-medium">בעלים</th>
              <th className="px-4 py-3 text-right font-medium">מקום</th>
              <th className="px-4 py-3 text-right font-medium">סטטוס</th>
              <th className="px-4 py-3 text-right font-medium">השקה אחרונה</th>
              {isAdmin && <th className="px-4 py-3 text-right font-medium">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs" dir="ltr">{v.registrationNumber}</td>
                <td className="px-4 py-3">{VESSEL_TYPES[v.type] || v.type}</td>
                <td className="px-4 py-3">{v.length} מ׳</td>
                <td className="px-4 py-3">{v.owner.name}</td>
                <td className="px-4 py-3">{v.spot?.number || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`status-${v.status} text-xs px-2 py-0.5 rounded-full`}>
                    {STATUS_LABELS[v.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {v.lastLaunch ? formatDateTime(v.lastLaunch) : '—'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(v); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleDelete(v.id, v.name)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">לא נמצאו כלי שייט</div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map((v) => (
          <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-gray-800">{v.name}</div>
                <div className="text-xs text-gray-400 font-mono" dir="ltr">{v.registrationNumber}</div>
              </div>
              <span className={`status-${v.status} text-xs px-2 py-0.5 rounded-full`}>
                {STATUS_LABELS[v.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              <div><span className="text-gray-400">סוג:</span> {VESSEL_TYPES[v.type] || v.type}</div>
              <div><span className="text-gray-400">אורך:</span> {v.length} מ׳</div>
              <div><span className="text-gray-400">בעלים:</span> {v.owner.name}</div>
              <div><span className="text-gray-400">מקום:</span> {v.spot?.number || '—'}</div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => { setEditing(v); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Edit3 size={14} /> עריכה
                </button>
                <button onClick={() => handleDelete(v.id, v.name)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={14} /> מחיקה
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">לא נמצאו כלי שייט</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <VesselModal
          vessel={editing}
          spots={spots.filter((s) => s.status === 'available' || s.id === editing?.spotId)}
          users={users}
          onClose={() => setShowModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

function VesselModal({ vessel, spots, users, onClose, onSave }: {
  vessel: Vessel | null;
  spots: ParkingSpot[];
  users: User[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: vessel?.name || '',
    registrationNumber: vessel?.registrationNumber || '',
    length: vessel?.length || 0,
    type: vessel?.type || 'motorboat',
    ownerId: vessel?.ownerId || (users[0]?.id || ''),
    spotId: vessel?.spotId || '',
    status: vessel?.status || 'parked',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = { ...form, length: Number(form.length), spotId: form.spotId || null };
      if (vessel) {
        await api.updateVessel(vessel.id, data);
      } else {
        await api.createVessel(data);
      }
      onSave();
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
        <h2 className="text-lg font-bold mb-4">{vessel ? 'עריכת כלי שייט' : 'כלי שייט חדש'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מספר רישוי</label>
            <input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אורך (מ׳)</label>
              <input type="number" step="0.1" min="0.5" max="100" value={form.length} onChange={(e) => setForm({ ...form, length: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סוג</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                {Object.entries(VESSEL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">בעלים</label>
            <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'מנהל' : u.role === 'operator' ? 'מפעיל' : 'לקוח'})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מקום חניה</label>
            <select value={form.spotId} onChange={(e) => setForm({ ...form, spotId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">ללא</option>
              {spots.map((s) => <option key={s.id} value={s.id}>{s.number} (אזור {s.zone})</option>)}
            </select>
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שומר...' : vessel ? 'עדכון' : 'יצירה'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
