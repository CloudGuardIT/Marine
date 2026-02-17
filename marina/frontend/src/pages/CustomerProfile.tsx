import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, Save } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function CustomerProfile() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password && password !== confirmPassword) {
      toast.error('הסיסמאות אינן תואמות');
      return;
    }
    if (password && password.length < 8) {
      toast.error('הסיסמה חייבת להכיל לפחות 8 תווים');
      return;
    }
    setSaving(true);
    try {
      const data: { name?: string; password?: string } = {};
      if (name !== user?.name) data.name = name;
      if (password) data.password = password;
      await api.updateProfile(data);
      await refreshUser();
      setPassword('');
      setConfirmPassword('');
      toast.success('הפרופיל עודכן בהצלחה');
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="font-bold text-gray-800 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            הגדרות פרופיל
          </h1>
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            חזרה
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                required
                minLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
              <input
                type="tel"
                value={user?.phone || ''}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1">לשינוי מספר טלפון פנה למנהל המערכת</p>
            </div>

            <hr className="my-2" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה חדשה</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="השאר ריק אם לא תרצה לשנות"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                dir="ltr"
                minLength={8}
              />
            </div>
            {password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימות סיסמה</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="הזן שוב"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  dir="ltr"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={logout}
              className="w-full text-center text-sm text-red-600 hover:text-red-800 transition font-medium"
            >
              התנתקות מהמערכת
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
