import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Zone, ParkingSpot } from '../types';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { Edit3, Save, Trash2, MapPin, Search, Maximize2, Minimize2, Pentagon, RectangleHorizontal, MousePointer, X, Map, PenTool, Undo2, Eraser, Minus, Lock, Unlock, Anchor } from 'lucide-react';

// Fix Leaflet default icon issue with bundlers
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Default center - marina location
const DEFAULT_CENTER: [number, number] = [32.828936, 35.516309];
const DEFAULT_ZOOM = 17;

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  occupied: '#f97316',
  reserved: '#a855f7',
  maintenance: '#ef4444',
};

const STATUS_LABELS_HE: Record<string, string> = {
  available: 'פנוי',
  occupied: 'תפוס',
  reserved: 'שמור',
  maintenance: 'תחזוקה',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function createSpotIcon(status: string, label: string, isSelected: boolean): L.DivIcon {
  const color = STATUS_COLORS[status] || '#6b7280';
  const border = isSelected ? '3px solid #2563eb' : '2px solid white';
  const size = isSelected ? 34 : 28;
  return L.divIcon({
    className: 'spot-marker',
    html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:${border};
      display:flex;align-items:center;justify-content:center;
      font-size:9px;font-weight:700;color:white;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      cursor:pointer;
    ">${escapeHtml(label)}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props {
  spots: ParkingSpot[];
  zones: Zone[];
  vessels?: any[];
  userRole?: string;
  onMoveVessel?: (vesselId: string, newSpotId: string) => void;
  onRemoveVessel?: (vesselId: string, spotId: string) => void;
  onSpotsChanged?: () => void;
  onZonesChanged?: () => void;
  compact?: boolean;
}

type DrawMode = 'none' | 'polygon' | 'rectangle' | 'spot' | 'delete-spot' | 'freehand';
type MapMode = 'map' | 'canvas';

// Freehand drawing types
interface FreehandStroke {
  points: [number, number][];
  color: string;
  weight: number;
}

const FREEHAND_STORAGE_KEY = 'marina-freehand-drawings';

function loadFreehandStrokes(): FreehandStroke[] {
  try {
    const saved = localStorage.getItem(FREEHAND_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveFreehandStrokes(strokes: FreehandStroke[]) {
  localStorage.setItem(FREEHAND_STORAGE_KEY, JSON.stringify(strokes));
}

// Canvas tile layer - white background for free drawing mode
function CanvasBackground() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.backgroundColor = '#f8fafc';
    return () => { container.style.backgroundColor = ''; };
  }, [map]);
  return null;
}

// Grid overlay for canvas mode
function GridOverlay() {
  const map = useMap();
  useEffect(() => {
    const gridLayer = L.layerGroup();
    const updateGrid = () => {
      gridLayer.clearLayers();
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      // Adjust grid density based on zoom
      const step = zoom >= 18 ? 0.0005 : zoom >= 16 ? 0.001 : zoom >= 14 ? 0.005 : 0.01;
      const south = Math.floor(bounds.getSouth() / step) * step;
      const north = Math.ceil(bounds.getNorth() / step) * step;
      const west = Math.floor(bounds.getWest() / step) * step;
      const east = Math.ceil(bounds.getEast() / step) * step;
      for (let lat = south; lat <= north; lat += step) {
        L.polyline([[lat, west], [lat, east]], { color: '#e2e8f0', weight: 1, opacity: 0.5 }).addTo(gridLayer);
      }
      for (let lng = west; lng <= east; lng += step) {
        L.polyline([[south, lng], [north, lng]], { color: '#e2e8f0', weight: 1, opacity: 0.5 }).addTo(gridLayer);
      }
    };
    gridLayer.addTo(map);
    updateGrid();
    map.on('moveend zoomend', updateGrid);
    return () => {
      map.off('moveend zoomend', updateGrid);
      map.removeLayer(gridLayer);
    };
  }, [map]);
  return null;
}

// Parse coordinates from Google Maps URL or plain coordinate text
function parseGoogleMapsCoords(input: string): [number, number] | null {
  // Try plain coordinate pair like "32.828936, 35.516309" or "32.828936,35.516309"
  const coordPairMatch = input.match(/^[\s]*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)[\s]*$/);
  if (coordPairMatch) {
    const lat = parseFloat(coordPairMatch[1]);
    const lng = parseFloat(coordPairMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  // Try @lat,lng pattern (common in Google Maps URLs)
  const atMatch = input.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  // Try search/lat,+lng or search/lat,lng pattern
  const searchMatch = input.match(/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/);
  if (searchMatch) {
    const lat = parseFloat(searchMatch[1]);
    const lng = parseFloat(searchMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  // Try place/.../@lat,lng pattern
  const placeMatch = input.match(/place\/[^@]*@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  // Try query parameter q=lat,lng
  const qMatch = input.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
  }

  return null;
}

function isGoogleMapsUrl(input: string): boolean {
  return input.includes('google.com/maps') || input.includes('maps.app.goo.gl') || input.includes('goo.gl/maps');
}

// Search location component
function SearchControl({ onSearch }: { onSearch: (latlng: [number, number], name: string) => void }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      // Check if it's a coordinate pair or Google Maps URL
      const coords = parseGoogleMapsCoords(trimmed);
      if (coords) {
        onSearch(coords, `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`);
        setSearching(false);
        return;
      }

      // If it's a Google Maps URL but we couldn't parse coords, try fetching redirect for short URLs
      if (isGoogleMapsUrl(trimmed)) {
        // Can't follow redirects from browser due to CORS, just notify user
        setSearching(false);
        return;
      }

      // Otherwise use Nominatim search
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        onSearch([parseFloat(data[0].lat), parseFloat(data[0].lon)], data[0].display_name);
      }
    } catch { /* ignore */ }
    setSearching(false);
  };

  return (
    <div className="flex gap-1">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="חפש מיקום או הדבק קישור Google Maps..."
        className="px-2 py-1 border rounded text-xs w-56"
        dir="rtl"
      />
      <button onClick={handleSearch} disabled={searching} className="p-1 bg-white border rounded hover:bg-gray-50 text-gray-600">
        <Search size={14} />
      </button>
    </div>
  );
}

// Component that flies the map to a position
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [map, center, zoom]);
  return null;
}

// Polygon drawing via clicks
function PolygonDrawer({ onComplete }: { onComplete: (points: [number, number][]) => void }) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const map = useMap();

  useMapEvents({
    click(e) {
      setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
  });

  // Draw lines between points
  useEffect(() => {
    if (points.length < 2) return;
    const polyline = L.polyline(points, { color: '#3B82F6', weight: 2, dashArray: '6,6' }).addTo(map);
    // Also draw preview polygon if 3+ points
    let polygon: L.Polygon | null = null;
    if (points.length >= 3) {
      polygon = L.polygon(points, { color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.15, weight: 2, dashArray: '6,6' }).addTo(map);
    }
    return () => {
      map.removeLayer(polyline);
      if (polygon) map.removeLayer(polygon);
    };
  }, [points, map]);

  // Draw point markers
  useEffect(() => {
    const markers = points.map((p, i) =>
      L.circleMarker(p, {
        radius: 6,
        color: '#2563eb',
        fillColor: i === 0 ? '#22c55e' : '#3B82F6',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
    );
    return () => markers.forEach((m) => map.removeLayer(m));
  }, [points, map]);

  // Complete polygon on double-click or clicking first point
  useEffect(() => {
    if (points.length < 3) return;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const dist = map.latLngToLayerPoint(L.latLng(firstPoint)).distanceTo(
      map.latLngToLayerPoint(L.latLng(lastPoint))
    );
    // Auto-complete if close to first point
    if (points.length > 3 && dist < 15) {
      const finalPoints = points.slice(0, -1); // remove the close-click
      onComplete(finalPoints);
    }
  }, [points, map, onComplete]);

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[500] bg-white rounded-lg shadow-lg px-4 py-2 text-sm border border-blue-200" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="text-blue-700 font-medium">
          {points.length === 0 && 'לחץ על המפה להתחיל לצייר אזור'}
          {points.length === 1 && 'לחץ להוסיף נקודה שנייה'}
          {points.length === 2 && 'לחץ להוסיף נקודה שלישית'}
          {points.length >= 3 && `${points.length} נקודות — לחץ קרוב לנקודה הראשונה (ירוקה) לסגור`}
        </span>
        {points.length >= 3 && (
          <button
            onClick={() => onComplete(points)}
            className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            סיים ({points.length} נקודות)
          </button>
        )}
        {points.length > 0 && (
          <button
            onClick={() => setPoints((prev) => prev.slice(0, -1))}
            className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
          >
            בטל אחרון
          </button>
        )}
      </div>
    </div>
  );
}

// Rectangle drawing via 2 clicks
function RectangleDrawer({ onComplete }: { onComplete: (points: [number, number][]) => void }) {
  const [corner1, setCorner1] = useState<[number, number] | null>(null);
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const map = useMap();

  useMapEvents({
    click(e) {
      if (!corner1) {
        setCorner1([e.latlng.lat, e.latlng.lng]);
      } else {
        const c2: [number, number] = [e.latlng.lat, e.latlng.lng];
        onComplete([
          [corner1[0], corner1[1]],
          [corner1[0], c2[1]],
          [c2[0], c2[1]],
          [c2[0], corner1[1]],
        ]);
      }
    },
    mousemove(e) {
      if (corner1) {
        setPreview([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  // Draw preview rectangle
  useEffect(() => {
    if (!corner1 || !preview) return;
    const bounds = L.latLngBounds(corner1, preview);
    const rect = L.rectangle(bounds, { color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.15, weight: 2, dashArray: '6,6' }).addTo(map);
    return () => { map.removeLayer(rect); };
  }, [corner1, preview, map]);

  // Draw corner1 marker
  useEffect(() => {
    if (!corner1) return;
    const marker = L.circleMarker(corner1, { radius: 6, color: '#2563eb', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }).addTo(map);
    return () => { map.removeLayer(marker); };
  }, [corner1, map]);

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[500] bg-white rounded-lg shadow-lg px-4 py-2 text-sm border border-blue-200" dir="rtl">
      <span className="text-blue-700 font-medium">
        {!corner1 ? 'לחץ על פינה ראשונה של המלבן' : 'לחץ על הפינה הנגדית'}
      </span>
    </div>
  );
}

// Spot placer with click
function SpotPlacer({ zones, spots, onPlace }: {
  zones: Zone[];
  spots: ParkingSpot[];
  onPlace: (latlng: [number, number], zone: Zone) => void;
}) {
  useMapEvents({
    click(e) {
      const latlng: [number, number] = [e.latlng.lat, e.latlng.lng];
      for (const zone of zones) {
        if (pointInPolygon(latlng, zone.polygon)) {
          onPlace(latlng, zone);
          return;
        }
      }
    },
  });

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[500] bg-white rounded-lg shadow-lg px-4 py-2 text-sm border border-green-200" dir="rtl">
      <span className="text-green-700 font-medium">
        לחץ בתוך אזור כדי להציב מקום חניה חדש
      </span>
    </div>
  );
}

// Delete spot on click
function SpotDeleter({ onDelete }: { onDelete: (spot: ParkingSpot) => void }) {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[500] bg-white rounded-lg shadow-lg px-4 py-2 text-sm border border-red-200" dir="rtl">
      <span className="text-red-700 font-medium">
        לחץ על מקום חניה (עיגול) כדי למחוק אותו
      </span>
    </div>
  );
}

// Freehand drawing component
function FreehandDrawer({ strokes, onStrokeComplete, penColor, penWeight }: {
  strokes: FreehandStroke[];
  onStrokeComplete: (stroke: FreehandStroke) => void;
  penColor: string;
  penWeight: number;
}) {
  const map = useMap();
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<[number, number][]>([]);
  const currentLineRef = useRef<L.Polyline | null>(null);
  const layerGroupRef = useRef<L.LayerGroup>(L.layerGroup());

  // Render saved strokes
  useEffect(() => {
    const group = layerGroupRef.current;
    group.clearLayers();
    strokes.forEach((stroke) => {
      L.polyline(stroke.points, {
        color: stroke.color,
        weight: stroke.weight,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1,
      }).addTo(group);
    });
    group.addTo(map);
    return () => { map.removeLayer(group); };
  }, [strokes, map]);

  // Handle drawing interactions
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = 'crosshair';

    // Disable map dragging during freehand draw
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left click only
      map.dragging.disable();
      isDrawingRef.current = true;
      const latlng = map.containerPointToLatLng(L.point(e.offsetX, e.offsetY));
      currentPointsRef.current = [[latlng.lat, latlng.lng]];
      currentLineRef.current = L.polyline([[latlng.lat, latlng.lng]], {
        color: penColor,
        weight: penWeight,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1,
      }).addTo(map);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current || !currentLineRef.current) return;
      const latlng = map.containerPointToLatLng(L.point(e.offsetX, e.offsetY));
      currentPointsRef.current.push([latlng.lat, latlng.lng]);
      currentLineRef.current.addLatLng([latlng.lat, latlng.lng]);
    };

    const onMouseUp = () => {
      if (!isDrawingRef.current) return;
      map.dragging.enable();
      isDrawingRef.current = false;
      if (currentLineRef.current) {
        map.removeLayer(currentLineRef.current);
        currentLineRef.current = null;
      }
      if (currentPointsRef.current.length >= 2) {
        onStrokeComplete({
          points: currentPointsRef.current,
          color: penColor,
          weight: penWeight,
        });
      }
      currentPointsRef.current = [];
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);

    // Touch support
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      map.dragging.disable();
      isDrawingRef.current = true;
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const latlng = map.containerPointToLatLng(L.point(touch.clientX - rect.left, touch.clientY - rect.top));
      currentPointsRef.current = [[latlng.lat, latlng.lng]];
      currentLineRef.current = L.polyline([[latlng.lat, latlng.lng]], {
        color: penColor,
        weight: penWeight,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1,
      }).addTo(map);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDrawingRef.current || !currentLineRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const latlng = map.containerPointToLatLng(L.point(touch.clientX - rect.left, touch.clientY - rect.top));
      currentPointsRef.current.push([latlng.lat, latlng.lng]);
      currentLineRef.current.addLatLng([latlng.lat, latlng.lng]);
    };

    const onTouchEnd = () => {
      onMouseUp();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.style.cursor = '';
      map.dragging.enable();
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mouseleave', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      if (currentLineRef.current) {
        map.removeLayer(currentLineRef.current);
      }
    };
  }, [map, penColor, penWeight, onStrokeComplete]);

  return null;
}

// Render saved strokes when NOT in freehand mode
function StrokeRenderer({ strokes }: { strokes: FreehandStroke[] }) {
  const map = useMap();
  useEffect(() => {
    const group = L.layerGroup();
    strokes.forEach((stroke) => {
      L.polyline(stroke.points, {
        color: stroke.color,
        weight: stroke.weight,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1,
      }).addTo(group);
    });
    group.addTo(map);
    return () => { map.removeLayer(group); };
  }, [strokes, map]);
  return null;
}

// Control map interactions (lock/unlock)
function MapInteractionController({ locked }: { locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (locked) {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if ((map as any).tap) (map as any).tap.disable();
    } else {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      if ((map as any).tap) (map as any).tap.enable();
    }
  }, [locked, map]);
  return null;
}

export default function InteractiveMap({
  spots,
  zones,
  userRole,
  onMoveVessel,
  onRemoveVessel,
  onSpotsChanged,
  onZonesChanged,
  compact,
}: Props) {
  const isAdmin = userRole === 'admin';
  const toast = useToast();
  const [editMode, setEditMode] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('map');
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [viewLocked, setViewLocked] = useState(false);
  const [unparkSpot, setUnparkSpot] = useState<ParkingSpot | null>(null);

  // Zone creation modal
  const [newZonePolygon, setNewZonePolygon] = useState<[number, number][] | null>(null);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneColor, setNewZoneColor] = useState('#3B82F6');
  const [showNewZoneModal, setShowNewZoneModal] = useState(false);
  const [savingZone, setSavingZone] = useState(false);

  // Edit zone polygon
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingPolygon, setEditingPolygon] = useState<[number, number][] | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<number | null>(null);

  // Freehand drawing state
  const [freehandStrokes, setFreehandStrokes] = useState<FreehandStroke[]>(() => loadFreehandStrokes());
  const [penColor, setPenColor] = useState('#1e40af');
  const [penWeight, setPenWeight] = useState(3);

  const containerRef = useRef<HTMLDivElement>(null);

  // Click-to-move vessel logic
  const handleSpotClick = useCallback(
    async (spot: ParkingSpot) => {
      if (editMode) {
        if (drawMode === 'delete-spot') {
          if (spot.vessel) {
            toast.error('לא ניתן למחוק מקום תפוס');
            return;
          }
          try {
            await api.deleteSpot(spot.id);
            toast.success(`מקום ${spot.number} נמחק`);
            onSpotsChanged?.();
          } catch (err: any) {
            toast.error(err.message || 'שגיאה במחיקה');
          }
          return;
        }
        // In edit mode with select tool, show unpark popup for occupied spots
        if (drawMode === 'none' && spot.status === 'occupied' && spot.vessel && onRemoveVessel) {
          setUnparkSpot(spot);
        }
        return;
      }

      if (!selectedSpot) {
        if (spot.status === 'occupied' && spot.vessel && isAdmin && onMoveVessel) {
          setSelectedSpot(spot);
        }
        return;
      }

      if (spot.status === 'available' && onMoveVessel && selectedSpot.vessel) {
        await onMoveVessel(selectedSpot.vessel.id, spot.id);
        setSelectedSpot(null);
      } else {
        setSelectedSpot(null);
      }
    },
    [selectedSpot, editMode, drawMode, isAdmin, onMoveVessel, onRemoveVessel, toast, onSpotsChanged]
  );

  // Draw completed - show naming modal
  const handleDrawComplete = useCallback((polygon: [number, number][]) => {
    setNewZonePolygon(polygon);
    setShowNewZoneModal(true);
    setDrawMode('none');
  }, []);

  // Save new zone
  const saveNewZone = async () => {
    if (!newZonePolygon || !newZoneName.trim()) return;
    setSavingZone(true);
    try {
      await api.createZone({
        name: newZoneName.trim(),
        color: newZoneColor,
        polygon: newZonePolygon,
      });
      toast.success(`אזור "${newZoneName}" נוצר בהצלחה`);
      setShowNewZoneModal(false);
      setNewZonePolygon(null);
      setNewZoneName('');
      setNewZoneColor('#3B82F6');
      onZonesChanged?.();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה ביצירת אזור');
    } finally {
      setSavingZone(false);
    }
  };

  // Place spot
  const handlePlaceSpot = useCallback(
    async (latlng: [number, number], zone: Zone) => {
      const zoneSpots = spots.filter((s) => s.zoneId === zone.id || s.zone === zone.name);
      const nextNum = zoneSpots.length + 1;
      const spotNumber = `${zone.name}${nextNum.toString().padStart(2, '0')}`;

      try {
        await api.createSpot({
          number: spotNumber,
          zone: zone.name,
          row: 0,
          col: nextNum - 1,
          lat: latlng[0],
          lng: latlng[1],
          zoneId: zone.id,
        } as any);
        toast.success(`מקום ${spotNumber} נוצר באזור ${zone.name}`);
        onSpotsChanged?.();
      } catch (err: any) {
        toast.error(err.message || 'שגיאה ביצירת מקום');
      }
    },
    [spots, toast, onSpotsChanged]
  );

  // Delete zone
  const handleDeleteZone = async (zone: Zone) => {
    const zoneSpots = spots.filter((s) => s.zoneId === zone.id || s.zone === zone.name);
    if (zoneSpots.length > 0) {
      toast.error(`לא ניתן למחוק אזור "${zone.name}" - יש בו ${zoneSpots.length} מקומות חניה. מחק אותם קודם`);
      return;
    }
    try {
      await api.deleteZone(zone.id);
      toast.success(`אזור "${zone.name}" נמחק`);
      onZonesChanged?.();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה במחיקת אזור');
    }
  };

  // Update zone polygon (drag vertex)
  const handleUpdateZonePolygon = async (zone: Zone, newPolygon: [number, number][]) => {
    try {
      await api.updateZone(zone.id, { polygon: newPolygon });
      onZonesChanged?.();
    } catch (err: any) {
      toast.error(err.message || 'שגיאה בעדכון אזור');
    }
  };

  // Search handler
  const handleSearch = (latlng: [number, number], _name: string) => {
    setFlyTarget({ center: latlng, zoom: 17 });
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  const height = fullscreen ? 'h-screen' : compact ? 'h-[400px]' : 'h-[500px]';
  const containerClass = fullscreen
    ? 'fixed inset-0 z-[900] bg-white flex flex-col'
    : 'bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden';

  const ZONE_COLORS_PRESETS = ['#3B82F6', '#22C55E', '#EAB308', '#A855F7', '#EF4444', '#06B6D4', '#F97316', '#EC4899'];

  return (
    <div ref={containerRef} className={containerClass}>
      {/* Header toolbar */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-sm">מפת מעגנה</span>
          {selectedSpot && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              נבחר: {selectedSpot.number} — לחץ על מקום פנוי להעברה
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <SearchControl onSearch={handleSearch} />}
          {isAdmin && (
            <button
              onClick={() => setMapMode(mapMode === 'map' ? 'canvas' : 'map')}
              className={`flex items-center gap-1 p-1.5 rounded text-xs font-medium transition ${
                mapMode === 'canvas' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={mapMode === 'map' ? 'מצב ציור חופשי' : 'מפה אמיתית'}
            >
              {mapMode === 'map' ? <PenTool size={14} /> : <Map size={14} />}
            </button>
          )}
          <button
            onClick={() => setViewLocked(!viewLocked)}
            className={`p-1.5 rounded transition ${
              viewLocked ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={viewLocked ? 'שחרר מפה' : 'נעל מפה'}
          >
            {viewLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button onClick={toggleFullscreen} className="p-1.5 bg-gray-100 rounded hover:bg-gray-200 text-gray-600" title={fullscreen ? 'צמצם' : 'הגדל'}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setEditMode(!editMode);
                setDrawMode('none');
                setSelectedSpot(null);
                setEditingZone(null);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition ${
                editMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {editMode ? <><Save size={12} /> סיום עריכה</> : <><Edit3 size={12} /> עריכת מפה</>}
            </button>
          )}
        </div>
      </div>

      {/* Edit mode toolbar */}
      {editMode && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 flex-shrink-0 flex-wrap" dir="rtl">
          <span className="text-xs font-medium text-blue-800 ml-2">כלים:</span>

          <button
            onClick={() => setDrawMode(drawMode === 'none' ? 'none' : 'none')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'none' ? 'bg-white text-gray-800 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-blue-100'
            }`}
          >
            <MousePointer size={12} /> בחירה
          </button>

          <div className="w-px h-5 bg-blue-200" />

          <span className="text-xs text-blue-600">אזורים:</span>
          <button
            onClick={() => setDrawMode(drawMode === 'rectangle' ? 'none' : 'rectangle')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'rectangle' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
            }`}
          >
            <RectangleHorizontal size={12} /> צייר מלבן
          </button>
          <button
            onClick={() => setDrawMode(drawMode === 'polygon' ? 'none' : 'polygon')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'polygon' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
            }`}
          >
            <Pentagon size={12} /> צייר מצולע
          </button>

          <div className="w-px h-5 bg-blue-200" />

          <span className="text-xs text-blue-600">מקומות:</span>
          <button
            onClick={() => setDrawMode(drawMode === 'spot' ? 'none' : 'spot')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'spot' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-green-100 border border-gray-200'
            }`}
          >
            <MapPin size={12} /> הצב מקום
          </button>
          <button
            onClick={() => setDrawMode(drawMode === 'delete-spot' ? 'none' : 'delete-spot')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'delete-spot' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-red-100 border border-gray-200'
            }`}
          >
            <Trash2 size={12} /> מחק מקום
          </button>

          <div className="w-px h-5 bg-blue-200" />

          <span className="text-xs text-blue-600">ציור:</span>
          <button
            onClick={() => setDrawMode(drawMode === 'freehand' ? 'none' : 'freehand')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
              drawMode === 'freehand' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-indigo-100 border border-gray-200'
            }`}
          >
            <PenTool size={12} /> עט חופשי
          </button>

          {drawMode === 'freehand' && (
            <>
              {/* Color picker */}
              <div className="flex items-center gap-1">
                {['#1e40af', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#000000'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setPenColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition ${penColor === c ? 'border-gray-800 scale-125' : 'border-gray-300'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                />
              </div>

              {/* Stroke width */}
              <div className="flex items-center gap-1">
                <Minus size={10} className="text-gray-400" />
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={penWeight}
                  onChange={(e) => setPenWeight(Number(e.target.value))}
                  className="w-16 h-4 accent-indigo-600"
                />
                <span className="text-xs text-gray-500 w-4">{penWeight}</span>
              </div>

              {/* Undo */}
              <button
                onClick={() => {
                  setFreehandStrokes((prev) => {
                    const next = prev.slice(0, -1);
                    saveFreehandStrokes(next);
                    return next;
                  });
                }}
                disabled={freehandStrokes.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 disabled:opacity-30"
              >
                <Undo2 size={12} /> בטל
              </button>

              {/* Clear all */}
              <button
                onClick={() => {
                  setFreehandStrokes([]);
                  saveFreehandStrokes([]);
                }}
                disabled={freehandStrokes.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white text-red-600 hover:bg-red-50 border border-gray-200 disabled:opacity-30"
              >
                <Eraser size={12} /> נקה הכל
              </button>
            </>
          )}

          {/* Zone list for editing/deleting */}
          {zones.length > 0 && (
            <>
              <div className="w-px h-5 bg-blue-200" />
              <span className="text-xs text-blue-600">אזורים קיימים:</span>
              {zones.map((z) => (
                <div key={z.id} className="flex items-center gap-1 bg-white rounded px-2 py-0.5 border border-gray-200 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                  <span className="font-medium">{z.name}</span>
                  <span className="text-gray-400">({spots.filter((s) => s.zoneId === z.id || s.zone === z.name).length})</span>
                  <button
                    onClick={() => handleDeleteZone(z)}
                    className="text-red-400 hover:text-red-600 mr-0.5"
                    title="מחק אזור"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Map */}
      <div className={fullscreen ? 'flex-1 relative' : `${height} relative`}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          doubleClickZoom={drawMode === 'none'}
        >
          <MapInteractionController locked={viewLocked && !editMode} />
          {mapMode === 'map' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <>
              <CanvasBackground />
              <GridOverlay />
            </>
          )}

          {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}

          {/* Zone polygons */}
          {zones.map((zone) => (
            <Polygon
              key={zone.id}
              positions={zone.polygon.map(([lat, lng]) => [lat, lng] as [number, number])}
              pathOptions={{
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.15,
                weight: editMode ? 3 : 2,
              }}
            >
              <Tooltip direction="center" permanent className="zone-label">
                <span style={{ fontWeight: 700, fontSize: '14px', color: zone.color }}>{zone.name}</span>
              </Tooltip>
            </Polygon>
          ))}

          {/* Zone vertex markers in edit mode */}
          {editMode && drawMode === 'none' && zones.map((zone) => {
            const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(zone.color) ? zone.color : '#6b7280';
            return zone.polygon.map((point, idx) => (
              <Marker
                key={`${zone.id}-v-${idx}`}
                position={point}
                icon={L.divIcon({
                  className: 'spot-marker',
                  html: `<div style="width:10px;height:10px;background:${safeColor};border:2px solid white;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3);cursor:move;"></div>`,
                  iconSize: [10, 10],
                  iconAnchor: [5, 5],
                })}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const newPos = e.target.getLatLng();
                    const newPolygon = [...zone.polygon] as [number, number][];
                    newPolygon[idx] = [newPos.lat, newPos.lng];
                    handleUpdateZonePolygon(zone, newPolygon);
                  },
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <span className="text-xs">גרור לשינוי צורת אזור {zone.name}</span>
                </Tooltip>
              </Marker>
            ));
          })}

          {/* Spot markers */}
          {spots.map((spot) => {
            if (!spot.lat || !spot.lng) return null;
            const isSelected = selectedSpot?.id === spot.id;
            const label = spot.number.replace(/^[A-Z]+/, '');
            const isDraggable = editMode && drawMode === 'none';
            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                icon={createSpotIcon(spot.status, label, isSelected)}
                draggable={isDraggable}
                eventHandlers={{
                  click: () => handleSpotClick(spot),
                  dragend: isDraggable ? async (e) => {
                    const newPos = e.target.getLatLng();
                    try {
                      await api.updateSpot(spot.id, { lat: newPos.lat, lng: newPos.lng });
                      toast.success(`מקום ${spot.number} הוזז בהצלחה`);
                      onSpotsChanged?.();
                    } catch (err: any) {
                      toast.error(err.message || 'שגיאה בהזזת מקום');
                      onSpotsChanged?.(); // refresh to revert position
                    }
                  } : undefined,
                }}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  <div className="text-center" dir="rtl">
                    <div className="font-bold">{spot.number}</div>
                    <div className="text-xs">{STATUS_LABELS_HE[spot.status]}</div>
                    {spot.vessel && <div className="text-xs text-gray-600">{spot.vessel.name}</div>}
                    {editMode && drawMode === 'delete-spot' && !spot.vessel && (
                      <div className="text-xs text-red-600 font-medium">לחץ למחיקה</div>
                    )}
                    {isDraggable && (
                      <div className="text-xs text-blue-600 font-medium">גרור להזזה</div>
                    )}
                  </div>
                </Tooltip>
              </Marker>
            );
          })}

          {/* Drawing modes */}
          {drawMode === 'polygon' && <PolygonDrawer onComplete={handleDrawComplete} />}
          {drawMode === 'rectangle' && <RectangleDrawer onComplete={handleDrawComplete} />}
          {drawMode === 'spot' && <SpotPlacer zones={zones} spots={spots} onPlace={handlePlaceSpot} />}
          {drawMode === 'delete-spot' && <SpotDeleter onDelete={() => {}} />}

          {/* Freehand drawing */}
          {drawMode === 'freehand' ? (
            <FreehandDrawer
              strokes={freehandStrokes}
              penColor={penColor}
              penWeight={penWeight}
              onStrokeComplete={(stroke) => {
                setFreehandStrokes((prev) => {
                  const next = [...prev, stroke];
                  saveFreehandStrokes(next);
                  return next;
                });
              }}
            />
          ) : (
            freehandStrokes.length > 0 && <StrokeRenderer strokes={freehandStrokes} />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex gap-4 text-xs text-gray-500 border-t border-gray-100 flex-shrink-0">
        {Object.entries(STATUS_LABELS_HE).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {label}
          </span>
        ))}
        {!editMode && isAdmin && onMoveVessel && (
          <span className="text-gray-400 mr-auto">לחץ על כלי שייט ואז על מקום פנוי להעברה</span>
        )}
        {editMode && (
          <span className="text-blue-500 mr-auto">מצב עריכה — השתמש בכלים למעלה</span>
        )}
      </div>

      {/* Unpark Vessel Popup */}
      {unparkSpot && unparkSpot.vessel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={() => setUnparkSpot(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-3 flex items-center gap-2">
              <Anchor size={18} className="text-orange-500" />
              הסרת כלי שייט ממקום
            </h3>
            <div className="text-sm text-gray-600 mb-4">
              <p>כלי שייט: <span className="font-semibold text-gray-800">{unparkSpot.vessel.name}</span></p>
              <p>מקום: <span className="font-semibold text-gray-800">{unparkSpot.number}</span></p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await onRemoveVessel!(unparkSpot.vessel!.id, unparkSpot.id);
                    toast.success(`"${unparkSpot.vessel!.name}" הוסר ממקום ${unparkSpot.number}`);
                    setUnparkSpot(null);
                  } catch (err: any) {
                    toast.error(err.message || 'שגיאה בהסרה');
                  }
                }}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 text-sm font-medium"
              >
                הסר כלי שייט
              </button>
              <button
                onClick={() => setUnparkSpot(null)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Zone Name Modal */}
      {showNewZoneModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]" onClick={() => { setShowNewZoneModal(false); setNewZonePolygon(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">אזור חדש</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם האזור</label>
                <input
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="למשל: A, B, דרום, צפון..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">צבע</label>
                <div className="flex gap-2 mb-2">
                  {ZONE_COLORS_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewZoneColor(c)}
                      className={`w-8 h-8 rounded-lg border-2 transition ${newZoneColor === c ? 'border-gray-800 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={newZoneColor}
                  onChange={(e) => setNewZoneColor(e.target.value)}
                  className="w-full h-8 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveNewZone}
                  disabled={savingZone || !newZoneName.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {savingZone ? 'שומר...' : 'צור אזור'}
                </button>
                <button
                  onClick={() => { setShowNewZoneModal(false); setNewZonePolygon(null); }}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple point-in-polygon using ray casting
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
