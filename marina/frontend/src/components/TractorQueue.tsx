import { Link } from 'react-router-dom';
import { Truck, Clock, User, ChevronLeft, Play } from 'lucide-react';
import type { TractorRequest } from '../types';
import { STATUS_LABELS, timeAgo } from '../utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api';

interface Props {
  queue: TractorRequest[];
  onUpdate: () => void;
  compact?: boolean;
}

export default function TractorQueue({ queue, onUpdate, compact }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const isStaff = user?.role === 'admin' || user?.role === 'operator';

  async function handleAction(id: string, action: 'accept' | 'start' | 'complete' | 'cancel') {
    try {
      if (action === 'accept') await api.acceptRequest(id);
      else if (action === 'start') await api.startRequest(id);
      else if (action === 'complete') await api.completeRequest(id);
      else await api.cancelRequest(id);
      const labels = { accept: 'הבקשה אושרה', start: 'העבודה החלה', complete: 'הבקשה הושלמה', cancel: 'הבקשה בוטלה' };
      toast.success(labels[action]);
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const items = compact ? queue.slice(0, 5) : queue;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 font-semibold text-gray-800">
          <Truck size={18} className="text-yellow-600" />
          תור טרקטור
          {queue.length > 0 && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">{queue.length}</span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">אין בקשות בתור</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((req) => (
            <div key={req.id} className="px-4 py-3 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${req.status === 'pending' ? 'bg-yellow-400' : req.status === 'accepted' ? 'bg-blue-400' : 'bg-indigo-400'}`} />
                  <div>
                    <div className="font-medium text-sm">
                      {req.vessel.name}
                      <span className="text-gray-400 mx-1">—</span>
                      <span className="text-gray-500">{req.type === 'launch' ? 'השקה' : 'שליפה'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1"><User size={12} />{req.requester.name}</span>
                      <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(req.createdAt)}</span>
                      {req.operator && <span>מפעיל: {req.operator.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-${req.status} text-xs px-2 py-0.5 rounded-full`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                  {isStaff && !compact && (
                    <>
                      {req.status === 'pending' && (
                        <button onClick={() => handleAction(req.id, 'accept')} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">
                          קבל
                        </button>
                      )}
                      {req.status === 'accepted' && (
                        <button onClick={() => handleAction(req.id, 'start')} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 flex items-center gap-1">
                          <Play size={12} /> התחל
                        </button>
                      )}
                      {(req.status === 'accepted' || req.status === 'in_progress') && (
                        <button onClick={() => handleAction(req.id, 'complete')} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">
                          השלם
                        </button>
                      )}
                      {req.status !== 'completed' && req.status !== 'cancelled' && (
                        <button onClick={() => handleAction(req.id, 'cancel')} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-300">
                          בטל
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {compact && queue.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <Link to="/admin/tractor" className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1">
            הצג הכל <ChevronLeft size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
