import { Waves, Clock } from 'lucide-react';
import type { Vessel } from '../types';
import { timeAgo, VESSEL_TYPES } from '../utils';

interface Props {
  vessels: Vessel[];
}

export default function InWaterPanel({ vessels }: Props) {
  const inWater = vessels.filter((v) => v.status === 'in_water');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">
        <Waves size={18} className="text-cyan-600" />
        כלי שייט במים
        <span className="bg-cyan-100 text-cyan-800 text-xs px-2 py-0.5 rounded-full">{inWater.length}</span>
      </div>
      {inWater.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">אין כלי שייט במים</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {inWater.map((v) => (
            <div key={v.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{v.name}</div>
                <div className="text-xs text-gray-400">
                  {VESSEL_TYPES[v.type] || v.type} | {v.owner.name}
                </div>
              </div>
              {v.lastLaunch && (
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} />
                  {timeAgo(v.lastLaunch)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
