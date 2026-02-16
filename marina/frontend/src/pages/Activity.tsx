import { useState, useEffect, useCallback } from 'react';
import { ScrollText, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { ACTION_LABELS, formatDateTime } from '../utils';
import type { ActivityLog } from '../types';

const PAGE_SIZE = 25;

export default function Activity() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const res = await api.getActivity(PAGE_SIZE, page * PAGE_SIZE);
    setActivities(res.activities);
    setTotal(res.total);
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useSocket({ 'activity:new': () => { if (page === 0) load(); } });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <ScrollText size={24} /> יומן פעילות
      </h1>

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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              {total} רשומות | עמוד {page + 1} מתוך {totalPages}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded border hover:bg-gray-50 disabled:opacity-30"
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
