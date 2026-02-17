import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Trash2, Edit3, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ConfirmDialog';
import { STATUS_LABELS, formatDate } from '../utils';
import type { Reservation, Vessel, ParkingSpot } from '../types';

export default function Reservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    try {
      setError('');
      const [r, v, sp] = await Promise.all([
        api.getReservations(),
        api.getVessels(),
        api.getSpots(),
      ]);
      setReservations(r);
      setVessels(v);
      setSpots(sp);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הזמנות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reservations.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    return true;
  });

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'מחיקת הזמנה',
      message: 'האם למחוק את ההזמנה? פעולה זו אינה ניתנת לביטול.',
      confirmLabel: 'מחיקה',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteReservation(id);
      toast.success('ההזמנה נמחקה');
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <CalendarDays size={24} /> הזמנות
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
          <CalendarDays size={24} /> הזמנות
        </h1>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
            <Plus size={16} /> הזמנה חדשה
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="completed">הושלם</option>
          <option value="cancelled">בוטל</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-right font-medium">כלי שייט</th>
              <th className="px-4 py-3 text-right font-medium">מקום</th>
              <th className="px-4 py-3 text-right font-medium">תאריך התחלה</th>
              <th className="px-4 py-3 text-right font-medium">תאריך סיום</th>
              <th className="px-4 py-3 text-right font-medium">סטטוס</th>
              {isAdmin && <th className="px-4 py-3 text-right font-medium">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium">{r.vessel?.name || '—'}</td>
                <td className="px-4 py-3">{r.spot?.number || '—'} {r.spot && `(אזור ${r.spot.zone})`}</td>
                <td className="px-4 py-3">{formatDate(r.startDate)}</td>
                <td className="px-4 py-3">{formatDate(r.endDate)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    r.status === 'active' ? 'bg-green-100 text-green-800' :
                    r.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(r); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
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
          <div className="p-8 text-center text-gray-400">לא נמצאו הזמנות</div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <ReservationModal
          reservation={editing}
          vessels={vessels}
          spots={spots.filter((s) => s.status === 'available' || s.id === editing?.spotId)}
          onClose={() => setShowModal(false)}
          onSave={load}
        />
      )}
    </div>
  );
}

function ReservationModal({ reservation, vessels, spots, onClose, onSave }: {
  reservation: Reservation | null;
  vessels: Vessel[];
  spots: ParkingSpot[];
  onClose: () => void;
  onSave: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    vesselId: reservation?.vesselId || (vessels[0]?.id || ''),
    spotId: reservation?.spotId || (spots[0]?.id || ''),
    startDate: reservation?.startDate?.slice(0, 10) || today,
    endDate: reservation?.endDate?.slice(0, 10) || '',
    status: reservation?.status || 'active',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Client-side date validation
    if (form.endDate && form.endDate <= form.startDate) {
      setError('תאריך סיום חייב להיות אחרי תאריך התחלה');
      setSaving(false);
      return;
    }

    try {
      if (reservation) {
        await api.updateReservation(reservation.id, form);
      } else {
        await api.createReservation({
          vesselId: form.vesselId,
          spotId: form.spotId,
          startDate: form.startDate,
          endDate: form.endDate,
        });
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
        <h2 className="text-lg font-bold mb-4">{reservation ? 'עריכת הזמנה' : 'הזמנה חדשה'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כלי שייט</label>
            <select value={form.vesselId} onChange={(e) => setForm({ ...form, vesselId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {vessels.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.registrationNumber})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מקום חניה</label>
            <select value={form.spotId} onChange={(e) => setForm({ ...form, spotId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {spots.map((s) => <option key={s.id} value={s.id}>{s.number} (אזור {s.zone})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך התחלה</label>
              <input type="date" value={form.startDate} min={reservation ? undefined : today} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך סיום</label>
              <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required />
            </div>
          </div>
          {reservation && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'completed' | 'cancelled' })} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="active">פעיל</option>
                <option value="completed">הושלם</option>
                <option value="cancelled">בוטל</option>
              </select>
            </div>
          )}
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שומר...' : reservation ? 'עדכון' : 'יצירה'}
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
