import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Server, Plus, Edit3, Trash2, UserPlus, Loader2, RefreshCw, User as UserIcon } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../components/ConfirmDialog';
import type { User, WorkerStatus } from '../types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל',
  operator: 'מפעיל',
  customer: 'לקוח',
};

export default function Settings() {
  const { user: currentUser, setUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setError('');
    Promise.all([
      api.getUsers(),
      api.getWorkerStatus(),
    ]).then(([u, w]) => {
      setUsers(u);
      setWorkers(w);
    }).catch((err: any) => {
      setError(err.message || 'שגיאה בטעינת הגדרות');
    }).finally(() => {
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  async function handleDeleteUser(u: User) {
    const ok = await confirm({
      title: 'מחיקת משתמש',
      message: `האם למחוק את המשתמש "${u.name}"? כל הנתונים שלו יימחקו.`,
      confirmLabel: 'מחיקה',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      toast.success(`המשתמש "${u.name}" נמחק`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקה');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <SettingsIcon size={24} /> הגדרות
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
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <SettingsIcon size={24} /> הגדרות
      </h1>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={load} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw size={14} /> נסה שוב
          </button>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <UserIcon size={20} className="text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-800">{currentUser?.name}</div>
              <div className="text-sm text-gray-500" dir="ltr">{currentUser?.phone}</div>
            </div>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition"
          >
            <Edit3 size={14} /> עריכת פרופיל
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">משתמשים</span>
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition"
            >
              <UserPlus size={16} /> הוספה
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-right font-medium">שם</th>
                <th className="px-4 py-2 text-right font-medium">טלפון</th>
                <th className="px-4 py-2 text-right font-medium">תפקיד</th>
                <th className="px-4 py-2 text-right font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-500" dir="ltr">{u.phone}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-red-100 text-red-800' :
                      u.role === 'operator' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(u); setShowModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => handleDeleteUser(u)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Workers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800 flex items-center gap-2">
            <Server size={16} /> עובדי רקע (Workers)
          </div>
          <div className="divide-y divide-gray-50">
            {workers.map((w) => (
              <div key={w.name} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${w.running ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-sm">{w.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.running ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {w.running ? 'פעיל' : 'מושבת'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                  <span>הרצות: {w.runCount}</span>
                  <span>שגיאות: {w.errorCount}</span>
                  {w.lastRun && <span>ריצה אחרונה: {new Date(w.lastRun).toLocaleTimeString('he-IL')}</span>}
                </div>
                {w.lastError && <div className="text-xs text-red-500 mt-1">{w.lastError}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {showModal && (
        <UserModal
          user={editing}
          onClose={() => setShowModal(false)}
          onSave={load}
        />
      )}

      {/* Profile Edit Modal */}
      {showProfile && (
        <ProfileModal
          user={currentUser!}
          onClose={() => setShowProfile(false)}
          onSave={(updated) => { setUser(updated); setShowProfile(false); }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSave }: {
  user: User | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    role: user?.role || 'customer',
    password: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (user) {
        const data: any = { name: form.name, phone: form.phone, role: form.role };
        if (form.password) data.password = form.password;
        await api.updateUser(user.id, data);
      } else {
        await api.createUser({
          name: form.name,
          phone: form.phone,
          password: form.password,
          role: form.role,
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
        <h2 className="text-lg font-bold mb-4">{user ? 'עריכת משתמש' : 'משתמש חדש'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required minLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" dir="ltr" required pattern="0\d{8,13}" title="מספר טלפון ישראלי (למשל 0501234567)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'operator' | 'customer' })} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="customer">לקוח</option>
              <option value="operator">מפעיל</option>
              <option value="admin">מנהל</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {user ? 'סיסמה חדשה (השאר ריק לשמירה)' : 'סיסמה'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              dir="ltr"
              required={!user}
              minLength={user ? 0 : 8}
              placeholder={user ? '••••••' : 'לפחות 8 תווים'}
            />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שומר...' : user ? 'עדכון' : 'יצירה'}
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

function ProfileModal({ user, onClose, onSave }: {
  user: User;
  onClose: () => void;
  onSave: (updated: User) => void;
}) {
  const [name, setName] = useState(user.name);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: { name?: string; password?: string } = {};
      if (name !== user.name) data.name = name;
      if (password) data.password = password;
      if (Object.keys(data).length === 0) {
        onClose();
        return;
      }
      const updated = await api.updateProfile(data);
      onSave(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">עריכת פרופיל</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" required minLength={2} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה חדשה (אופציונלי)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              dir="ltr"
              minLength={8}
              placeholder="השאר ריק לשמירה על הסיסמה הנוכחית"
            />
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
              {saving ? 'שומר...' : 'שמור'}
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
