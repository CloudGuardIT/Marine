import { Link } from 'react-router-dom';
import { ScrollText, ChevronLeft } from 'lucide-react';
import type { ActivityLog } from '../types';
import { ACTION_LABELS, timeAgo } from '../utils';

interface Props {
  activities: ActivityLog[];
  compact?: boolean;
}

export default function ActivityFeed({ activities, compact }: Props) {
  const items = compact ? activities.slice(0, 8) : activities;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
        <ScrollText size={18} className="text-purple-600" />
        יומן פעילות
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">אין פעילות</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((a) => (
            <div key={a.id} className="px-4 py-2.5 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{ACTION_LABELS[a.action] || a.action}</span>
                  {a.details && <span className="text-gray-400 mr-2">— {a.details}</span>}
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap mr-3">
                  {timeAgo(a.createdAt)}
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {a.user?.name || 'מערכת'}
                {a.vessel && <span> | {a.vessel.name}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {compact && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <Link to="/admin/activity" className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1">
            הצג הכל <ChevronLeft size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
