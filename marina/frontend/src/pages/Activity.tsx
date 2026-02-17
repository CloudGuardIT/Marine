import { useState, useEffect, useCallback } from 'react';
import { ScrollText, ChevronRight, ChevronLeft, Loader2, RefreshCw, Filter } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { ACTION_LABELS, formatDateTime } from '../utils';
import type { ActivityLog } from '../types';

const PAGE_SIZE = 25;

export default function Activity() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await api.getActivity(PAGE_SIZE, page * PAGE_SIZE, actionFilter || undefined);
      setActivities(res.activities);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת יומן פעילות');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'activity:new': () => { if (page === 0) load(); } });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading && activities.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <ScrollText size={24} /> יומן פעילות
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
        <ScrollText size={24} /> יומן פעילות
      </h1>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span>{error}</span>
          <button onClick={load} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw size={14} /> נסה שוב
          </button>
        </div>
      )}

      {/* Action filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">כל הפעולות</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-right font-medium">זמן</th>
              <th className="px-4 py-3 text-right font-medium">פעולה</th>
              <th className="px-4 py-3 text-right font-medium">פרטים</th>
              <th className="px-4 py-3 text-right font-medium">משתמש</th>
              <th className="px-4 py-3 text-right font-medium">כלי שייט</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {activities.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                    {ACTION_LABELS[a.action] || a.action}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">{a.details || '—'}</td>
                <td className="px-4 py-2.5">{a.user?.name || 'מערכת'}</td>
                <td className="px-4 py-2.5 text-gray-500">{a.vessel?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {activities.length === 0 && <div className="p-8 text-center text-gray-400">אין רשומות</div>}

        {/* Pagination - RTL: Right arrow = previous, Left arrow = next */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              {total} רשומות | עמוד {page + 1} מתוך {totalPages}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30"
                title="הבא"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30"
                title="הקודם"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
