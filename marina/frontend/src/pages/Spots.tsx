import { useState, useEffect, useCallback } from 'react';
import { ParkingSquare } from 'lucide-react';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { STATUS_LABELS } from '../utils';
import MarinaMap from '../components/MarinaMap';
import type { ParkingSpot } from '../types';

export default function Spots() {
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [zoneFilter, setZoneFilter] = useState('');

  const load = useCallback(async () => {
    setSpots(await api.getSpots());
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <ParkingSquare size={24} /> מקומות חניה
      </h1>

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
        <MarinaMap spots={spots} />

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800">רשימת מקומות</span>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} className="border rounded-lg px-2 py-1 text-sm">
              <option value="">כל האזורים</option>
              <option value="A">אזור A</option>
              <option value="B">אזור B</option>
              <option value="C">אזור C</option>
              <option value="D">אזור D</option>
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
                    <td className="px-4 py-2 text-gray-400 text-xs">{s.width.toFixed(1)}×{s.length.toFixed(1)} מ׳</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
