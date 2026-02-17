import { useState, useEffect, useCallback } from 'react';
import { Ship, Plus, Search, Trash2, Edit3, Loader2, RefreshCw, Check, X, Anchor } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ConfirmDialog';
import { useSocket } from '../hooks/useSocket';
import { STATUS_LABELS, VESSEL_TYPES, formatDateTime } from '../utils';
import type { Vessel, ParkingSpot, User } from '../types';

const VESSEL_STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'parked', label: 'חונה', color: 'bg-gray-100 text-gray-700' },
  { value: 'in_water', label: 'במים', color: 'bg-blue-100 text-blue-700' },
  { value: 'maintenance', label: 'תחזוקה', color: 'bg-amber-100 text-amber-700' },
  { value: 'transit', label: 'בהעברה', color: 'bg-purple-100 text-purple-700' },
];

const VESSEL_TYPE_ICONS: Record<string, string> = {
  sailboat: '\u26F5',
  motorboat: '\uD83D\uDEA4',
  jetski: '\uD83C\uDFCD\uFE0F',
  yacht: '\uD83D\uDEE5\uFE0F',
  fishing: '\uD83C\uDFA3',
  other: '\u2693',
};

export default function Vessels() {
  const { user } = useAuth();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vessel | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<{ name: string; type: string; ownerId: string }>({ name: '', type: '', ownerId: '' });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'operator';
  const canEdit = isAdmin || isOperator;

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
    if (typeFilter && v.type !== typeFilter) return false;
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

  function startInlineEdit(v: Vessel) {
    setInlineEditId(v.id);
    setInlineForm({
      name: v.name,
      type: v.type,
      ownerId: v.ownerId,
    });
  }

  function cancelInlineEdit() {
    setInlineEditId(null);
    setInlineForm({ name: '', type: '', ownerId: '' });
  }

  async function saveInlineEdit(vesselId: string) {
    setInlineSaving(true);
    try {
      await api.updateVessel(vesselId, {
        name: inlineForm.name,
        type: inlineForm.type,
        ownerId: inlineForm.ownerId,
      });
      toast.success('כלי שייט עודכן בהצלחה');
      setInlineEditId(null);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון');
    } finally {
      setInlineSaving(false);
    }
  }

  async function quickStatusChange(vesselId: string, newStatus: string) {
    try {
      await api.updateVessel(vesselId, { status: newStatus });
      toast.success(`סטטוס עודכן ל${STATUS_LABELS[newStatus]}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון סטטוס');
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
          <span className="text-sm font-normal text-gray-400 mr-2">({filtered.length})</span>
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
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
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
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
          <option value="">כל הסוגים</option>
          {Object.entries(VESSEL_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{VESSEL_TYPE_ICONS[key]} {label}</option>
          ))}
        </select>
        {(search || statusFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-2 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={14} /> נקה מסננים
          </button>
        )}
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
              {canEdit && <th className="px-4 py-3 text-right font-medium">פעולות</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((v) => (
              <tr key={v.id} className={`hover:bg-gray-50 transition ${inlineEditId === v.id ? 'bg-blue-50/50' : ''}`}>
                {/* Name */}
                <td className="px-4 py-3 font-medium">
                  {inlineEditId === v.id ? (
                    <input
                      value={inlineForm.name}
                      onChange={(e) => setInlineForm({ ...inlineForm, name: e.target.value })}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  ) : (
                    v.name
                  )}
                </td>
                {/* Registration Number */}
                <td className="px-4 py-3 text-gray-500 font-mono text-xs" dir="ltr">{v.registrationNumber}</td>
                {/* Type */}
                <td className="px-4 py-3">
                  {inlineEditId === v.id ? (
                    <select
                      value={inlineForm.type}
                      onChange={(e) => setInlineForm({ ...inlineForm, type: e.target.value })}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {Object.entries(VESSEL_TYPES).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span>{VESSEL_TYPE_ICONS[v.type] || ''}</span>
                      <span>{VESSEL_TYPES[v.type] || v.type}</span>
                    </span>
                  )}
                </td>
                {/* Length */}
                <td className="px-4 py-3">{v.length} מ׳</td>
                {/* Owner */}
                <td className="px-4 py-3">
                  {inlineEditId === v.id && users.length > 0 ? (
                    <select
                      value={inlineForm.ownerId}
                      onChange={(e) => setInlineForm({ ...inlineForm, ownerId: e.target.value })}
                      className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  ) : (
                    v.owner.name
                  )}
                </td>
                {/* Spot */}
                <td className="px-4 py-3">{v.spot?.number || '—'}</td>
                {/* Status - Quick Toggle */}
                <td className="px-4 py-3">
                  {canEdit ? (
                    <select
                      value={v.status}
                      onChange={(e) => quickStatusChange(v.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${VESSEL_STATUS_OPTIONS.find(s => s.value === v.status)?.color || 'bg-gray-100'}`}
                    >
                      {VESSEL_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`status-${v.status} text-xs px-2 py-0.5 rounded-full`}>
                      {STATUS_LABELS[v.status]}
                    </span>
                  )}
                </td>
                {/* Last Launch */}
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {v.lastLaunch ? formatDateTime(v.lastLaunch) : '—'}
                </td>
                {/* Actions */}
                {canEdit && (
                  <td className="px-4 py-3">
                    {inlineEditId === v.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveInlineEdit(v.id)}
                          disabled={inlineSaving}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                          title="שמירה"
                        >
                          {inlineSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        </button>
                        <button
                          onClick={cancelInlineEdit}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                          title="ביטול"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startInlineEdit(v)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition"
                          title="עריכה מהירה"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => { setEditing(v); setShowModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded transition"
                          title="עריכה מלאה"
                        >
                          <Anchor size={15} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(v.id, v.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition"
                            title="מחיקה"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
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
          <MobileVesselCard
            key={v.id}
            vessel={v}
            users={users}
            canEdit={canEdit}
            isAdmin={isAdmin}
            onDelete={() => handleDelete(v.id, v.name)}
            onFullEdit={() => { setEditing(v); setShowModal(true); }}
            onStatusChange={(newStatus) => quickStatusChange(v.id, newStatus)}
            onInlineSave={async (data) => {
              try {
                await api.updateVessel(v.id, data);
                toast.success('כלי שייט עודכן בהצלחה');
                load();
              } catch (err: any) {
                toast.error(err.message || 'שגיאה בעדכון');
              }
            }}
          />
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

/* ---- Mobile Card with inline edit ---- */
function MobileVesselCard({ vessel: v, users, canEdit, isAdmin, onDelete, onFullEdit, onStatusChange, onInlineSave }: {
  vessel: Vessel;
  users: User[];
  canEdit: boolean;
  isAdmin: boolean;
  onDelete: () => void;
  onFullEdit: () => void;
  onStatusChange: (status: string) => void;
  onInlineSave: (data: { name: string; type: string; ownerId: string }) => Promise<void>;
}) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: v.name, type: v.type, ownerId: v.ownerId });
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setForm({ name: v.name, type: v.type, ownerId: v.ownerId });
    setEditMode(true);
  }

  async function save() {
    setSaving(true);
    await onInlineSave(form);
    setSaving(false);
    setEditMode(false);
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border ${editMode ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100'} p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {editMode ? (
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full font-semibold text-gray-800 px-2 py-1 border border-blue-300 rounded text-sm mb-1"
              autoFocus
            />
          ) : (
            <div className="font-semibold text-gray-800">{v.name}</div>
          )}
          <div className="text-xs text-gray-400 font-mono" dir="ltr">{v.registrationNumber}</div>
        </div>
        {canEdit ? (
          <select
            value={v.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={`text-xs px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none ${VESSEL_STATUS_OPTIONS.find(s => s.value === v.status)?.color || 'bg-gray-100'}`}
          >
            {VESSEL_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span className={`status-${v.status} text-xs px-2 py-0.5 rounded-full`}>
            {STATUS_LABELS[v.status]}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
        <div>
          <span className="text-gray-400">סוג: </span>
          {editMode ? (
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="px-1 py-0.5 border border-blue-300 rounded text-xs"
            >
              {Object.entries(VESSEL_TYPES).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          ) : (
            <span>{VESSEL_TYPE_ICONS[v.type] || ''} {VESSEL_TYPES[v.type] || v.type}</span>
          )}
        </div>
        <div><span className="text-gray-400">אורך:</span> {v.length} מ׳</div>
        <div>
          <span className="text-gray-400">בעלים: </span>
          {editMode && users.length > 0 ? (
            <select
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              className="px-1 py-0.5 border border-blue-300 rounded text-xs"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          ) : (
            <span>{v.owner.name}</span>
          )}
        </div>
        <div><span className="text-gray-400">מקום:</span> {v.spot?.number || '—'}</div>
      </div>
      {canEdit && (
        <div className="flex gap-2 border-t border-gray-100 pt-3">
          {editMode ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-green-600 hover:bg-green-50 rounded-lg transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} שמירה
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition"
              >
                <X size={14} /> ביטול
              </button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition">
                <Edit3 size={14} /> עריכה מהירה
              </button>
              <button onClick={onFullEdit} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                <Anchor size={14} /> עריכה מלאה
              </button>
              {isAdmin && (
                <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={14} /> מחיקה
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Full Edit/Create Modal ---- */
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
                {Object.entries(VESSEL_TYPES).map(([k, v]) => <option key={k} value={k}>{VESSEL_TYPE_ICONS[k]} {v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })} className="w-full px-3 py-2 border rounded-lg text-sm">
              {VESSEL_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
