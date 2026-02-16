import { Ship, Waves, ParkingSquare, Truck, Activity } from 'lucide-react';
import type { DashboardStats } from '../types';

interface Props {
  stats: DashboardStats | null;
}

export default function StatsBar({ stats }: Props) {
  if (!stats) return <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">{Array.from({length:5}).map((_,i)=><div key={i} className="h-24 bg-white rounded-xl"/>)}</div>;

  const cards = [
    { label: 'כלי שייט', value: stats.totalVessels, icon: Ship, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'במים', value: stats.inWater, icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'מקומות פנויים', value: `${stats.availableSpots}/${stats.totalSpots}`, icon: ParkingSquare, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'בקשות ממתינות', value: stats.pendingRequests, icon: Truck, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'פעולות היום', value: stats.todayActivities, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">{card.label}</div>
              <div className="text-2xl font-bold mt-1">{card.value}</div>
            </div>
            <div className={`p-2.5 rounded-lg ${card.bg}`}>
              <card.icon size={22} className={card.color} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
