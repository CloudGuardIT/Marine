import { useState, useEffect, useCallback } from 'react';
import { ParkingSquare, Plus, Edit3, Trash2, Wrench, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ConfirmDialog';
import { useSocket } from '../hooks/useSocket';
import { STATUS_LABELS } from '../utils';
import InteractiveMap from '../components/InteractiveMap';
import type { ParkingSpot, Zone } from '../types';

export default function Spots() {
  const { user } = useAuth();
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneFilter, setZoneFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ParkingSpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      setError('');
      const [sp, z] = await Promise.all([api.getSpots(), api.getZones()]);
      setSpots(sp);
      setZones(z);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת מקומות חניה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'spot:updated': () => load() });

  const filtered = zoneFilter ? spots.filter((s) => s.zone === zoneFilter) : spots;
  const counts = {
    available: spots.filter((s) => s.status === 'available').length,
    occupied: spots.filter((s) => s.status === 'occupied').length,
    reserved: spots.filter((s) => s.status === 'reserved').length,
    maintenance: spots.filter((s) => s.status === 'maintenance').length,
  };

  async function handleDelete(spot: ParkingSpot) {
    if (spot.vessel) {
      toast.error('לא ניתן למחוק מקום תפוס');
      return;
    }
    const ok = await confirm({
      title: 'מחיקת מקום חניה',
      message: `האם למחוק את מקום ${spot.number}?`,
      confirmLabel: 'מחיקה',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteSpot(spot.id);
      toast.success(`מקום ${spot.number} נמחק`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה');
    }
  }

  async function toggleMaintenance(spot: ParkingSpot) {
    const newStatus = spot.status === 'maintenance' ? 'available' : 'maintenance';
    try {
      await api.updateSpot(spot.id, { status: newStatus });
      toast.success(newStatus === 'maintenance' ? `מקום ${spot.number} סומן לתחזוקה` : `מקום ${spot.number} חזר לשירות`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <ParkingSquare size={24} /> מקומות חניה
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
          <ParkingSquare size={24} /> מקומות חניה
        </h1>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
            <Plus size={16} /> הוספת מקום
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

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'פנוי', count: counts.available, color: 'bg-green-100 text-green-800' },
          { label: 'תפוס', count: counts.occupied, color: 'bg-orange-100 text-orange-800' },
          { label: 'שמור', count: counts.reserved, color: 'bg-purple-100 text-purple-800' },
          { label: 'תחזוקה', count: counts.maintenance, color: 'bg-red-100 text-red-800' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-2xl font-bold">{s.count}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <InteractiveMap
          spots={spots}
          zones={zones}
          userRole={user?.role}
          onRemoveVessel={async (vesselId, _spotId) => {
            await api.updateVessel(vesselId, { spotId: null });
            load();
          }}
          onSpotsChanged={load}
          onZonesChanged={load}
        />

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">רשימת מקומות</span>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
              <option value="">כל האזורים</option>
              {zones.map((z) => (
                <option key={z.id} value={z.name}>אזור {z.name}</option>
              ))}
              {/* Fallback for spots without zone records */}
              {[...new Set(spots.map((s) => s.zone))].filter((z) => !zones.find((zn) => zn.name === z)).map((z) => (
                <option key={z} value={z}>אזור {z}</option>
              ))}
            </select>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-right font-medium">מספר</th>
                  <th className="px-4 py-2 text-right font-medium">אזור</th>
                  <th className="px-4 py-2 text-right font-medium">סטטוס</th>
                  <th className="px-4 py-2 text-right font-medium">כלי שייט</th>
                  <th className="px-4 py-2 text-right font-medium">מידות</th>
                  {isAdmin && <th className="px-4 py-2 text-right font-medium">פעולות</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{s.number}</td>
                    <td className="px-4 py-2">{s.zone}</td>
                    <td className="px-4 py-2">
                      <span className={`status-${s.status} text-xs px-2 py-0.5 rounded-full`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500">{s.vessel?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{s.width.toFixed(1)}x{s.length.toFixed(1)} מ׳</td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(s); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="עריכה">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => toggleMaintenance(s)} className={`p-1.5 rounded ${s.status === 'maintenance' ? 'text-yellow-600 hover:text-green-600' : 'text-gray-400 hover:text-yellow-600'}`} title={s.status === 'maintenance' ? 'החזר לשירות' : 'סמן לתחזוקה'}>
                            <Wrench size={15} />
                          </button>
                          <button onClick={() => handleDelete(s)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="מחיקה">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <SpotModal
          spot={editing}
          zones={zones}
          onClose={() => setShowModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

function SpotModal({ spot, zones, onClose, onSave }: {
  spot: ParkingSpot | null;
  zones: Zone[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    number: spot?.number || '',
    zone: spot?.zone || 'A',
    row: spot?.row || 0,
    col: spot?.col || 0,
    width: spot?.width || 3,
    length: spot?.length || 10,
    status: spot?.status || 'available',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        row: Number(form.row),
        col: Number(form.col),
        width: Number(form.width),
        length: Number(form.length),
      };
      if (spot) {
        await api.updateSpot(spot.id, data);
      } else {
        await api.createSpot(data);
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
        <h2 className="text-lg font-bold mb-4">{spot ? 'עריכת מקום חניה' : 'מקום חניה חדש'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר מקום</label>
              <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אזור</label>
              <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                {zones.map((z) => (
                  <option key={z.id} value={z.name}>{z.name}</option>
                ))}
                {zones.length === 0 && (
                  <>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שורה</label>
              <input type="number" min="0" value={form.row} onChange={(e) => setForm({ ...form, row: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">עמודה</label>
              <input type="number" min="0" value={form.col} onChange={(e) => setForm({ ...form, col: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">רוחב (מ׳)</label>
              <input type="number" step="0.1" min="0.1" max="50" value={form.width} onChange={(e) => setForm({ ...form, width: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אורך (מ׳)</label>
              <input type="number" step="0.1" min="0.1" max="100" value={form.length} onChange={(e) => setForm({ ...form, length: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
          </div>
          {spot && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'available' | 'occupied' | 'reserved' | 'maintenance' })} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="available">פנוי</option>
                <option value="maintenance">תחזוקה</option>
              </select>
            </div>
          )}
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שומר...' : spot ? 'עדכון' : 'יצירה'}
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
