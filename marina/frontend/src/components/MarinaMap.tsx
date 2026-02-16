import { useState } from 'react';
import type { ParkingSpot, Vessel } from '../types';
import { STATUS_LABELS } from '../utils';

interface Props {
  spots: ParkingSpot[];
  vessels?: Vessel[];
  userRole?: string;
  onMoveVessel?: (vesselId: string, newSpotId: string) => void;
}

const ZONE_COLORS: Record<string, string> = {
  A: 'border-blue-300',
  B: 'border-green-300',
  C: 'border-yellow-300',
  D: 'border-purple-300',
};

const ZONE_BG: Record<string, string> = {
  A: 'bg-blue-50',
  B: 'bg-green-50',
  C: 'bg-yellow-50',
  D: 'bg-purple-50',
};

export default function MarinaMap({ spots, userRole, onMoveVessel }: Props) {
  const zones = ['A', 'B', 'C', 'D'];
  const isAdmin = userRole === 'admin' || userRole === 'operator';
  const [dragOverSpotId, setDragOverSpotId] = useState<string | null>(null);
  const [draggingVesselId, setDraggingVesselId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, vesselId: string, vesselName: string) => {
    e.dataTransfer.setData('vesselId', vesselId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingVesselId(vesselId);
    // Set a custom drag image text
    const el = document.createElement('div');
    el.textContent = vesselName;
    el.style.cssText = 'position:absolute;top:-1000px;padding:4px 8px;background:#3b82f6;color:white;border-radius:6px;font-size:12px;';
    document.body.appendChild(el);
    e.dataTransfer.setDragImage(el, 0, 0);
    setTimeout(() => document.body.removeChild(el), 0);
  };

  const handleDragEnd = () => {
    setDraggingVesselId(null);
    setDragOverSpotId(null);
  };

  const handleDragOver = (e: React.DragEvent, spot: ParkingSpot) => {
    if (!isAdmin || !onMoveVessel) return;
    // Only allow drop on available spots
    if (spot.status !== 'available') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSpotId(spot.id);
  };

  const handleDragLeave = () => {
    setDragOverSpotId(null);
  };

  const handleDrop = (e: React.DragEvent, spot: ParkingSpot) => {
    e.preventDefault();
    setDragOverSpotId(null);
    setDraggingVesselId(null);
    if (spot.status !== 'available') return;
    const vesselId = e.dataTransfer.getData('vesselId');
    if (vesselId && onMoveVessel) {
      onMoveVessel(vesselId, spot.id);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800 flex items-center justify-between">
        <span>מפת מעגנה</span>
        {isAdmin && onMoveVessel && (
          <span className="text-xs font-normal text-gray-400">גרור כלי שייט למקום חדש</span>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        {zones.map((zone) => {
          const zoneSpots = spots.filter((s) => s.zone === zone);
          return (
            <div key={zone} className={`rounded-lg border-2 ${ZONE_COLORS[zone]} ${ZONE_BG[zone]} p-3`}>
              <div className="text-sm font-bold text-gray-700 mb-2">אזור {zone}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {zoneSpots.map((spot) => {
                  const isDragOver = dragOverSpotId === spot.id;
                  const isDragging = draggingVesselId && spot.vessel?.id === draggingVesselId;
                  const canDrag = isAdmin && onMoveVessel && spot.status === 'occupied' && spot.vessel;
                  const canDrop = isAdmin && onMoveVessel && spot.status === 'available' && draggingVesselId;

                  return (
                    <div
                      key={spot.id}
                      title={`${spot.number} — ${STATUS_LABELS[spot.status]}${spot.vessel ? ` (${spot.vessel.name})` : ''}`}
                      draggable={!!canDrag}
                      onDragStart={canDrag ? (e) => handleDragStart(e, spot.vessel!.id, spot.vessel!.name) : undefined}
                      onDragEnd={canDrag ? handleDragEnd : undefined}
                      onDragOver={(e) => handleDragOver(e, spot)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, spot)}
                      className={`text-center py-1.5 px-1 rounded text-xs font-medium transition
                        ${isDragOver ? 'bg-blue-200 text-blue-900 border-2 border-blue-400 border-dashed scale-105' :
                          isDragging ? 'opacity-40' :
                          spot.status === 'occupied' ? 'bg-orange-200 text-orange-900' :
                          spot.status === 'available' ? 'bg-white text-green-700 border border-green-200' :
                          spot.status === 'reserved' ? 'bg-purple-200 text-purple-900' :
                          'bg-red-200 text-red-900'}
                        ${canDrag ? 'cursor-grab active:cursor-grabbing' : canDrop ? 'cursor-copy' : 'cursor-default'}`}
                    >
                      <div>{spot.number}</div>
                      {spot.vessel && <div className="text-[10px] truncate opacity-75">{spot.vessel.name}</div>}
                      {isDragOver && !spot.vessel && <div className="text-[10px] text-blue-600">שחרר כאן</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-green-200 inline-block" /> פנוי</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 inline-block" /> תפוס</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200 inline-block" /> שמור</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> תחזוקה</span>
      </div>
    </div>
  );
}
