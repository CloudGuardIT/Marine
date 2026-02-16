export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'operator' | 'customer';
  createdAt: string;
}

export interface Vessel {
  id: string;
  name: string;
  registrationNumber: string;
  length: number;
  type: string;
  ownerId: string;
  owner: Pick<User, 'id' | 'name' | 'phone' | 'role'>;
  spotId: string | null;
  spot: ParkingSpot | null;
  status: 'parked' | 'in_water' | 'maintenance' | 'transit';
  lastLaunch: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface ParkingSpot {
  id: string;
  number: string;
  zone: string;
  row: number;
  col: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  width: number;
  length: number;
  vessel?: Vessel | null;
}

export interface TractorRequest {
  id: string;
  vesselId: string;
  vessel: Vessel;
  requesterId: string;
  requester: Pick<User, 'id' | 'name' | 'phone' | 'role'>;
  operatorId: string | null;
  operator: Pick<User, 'id' | 'name' | 'phone' | 'role'> | null;
  type: 'launch' | 'retrieve';
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  notes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  user: Pick<User, 'id' | 'name' | 'phone' | 'role'> | null;
  vesselId: string | null;
  vessel: Pick<Vessel, 'id' | 'name' | 'registrationNumber'> | null;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  vesselId: string;
  vessel: Vessel;
  spotId: string;
  spot: ParkingSpot;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface MyQueuePosition {
  id: string;
  vesselId: string;
  vesselName: string;
  type: 'launch' | 'retrieve';
  status: 'pending' | 'accepted' | 'in_progress';
  position: number;
  estimatedWait: number;
  createdAt: string;
}

export interface DashboardStats {
  totalVessels: number;
  inWater: number;
  parked: number;
  availableSpots: number;
  totalSpots: number;
  pendingRequests: number;
  todayActivities: number;
}

export interface WorkerStatus {
  name: string;
  running: boolean;
  lastRun: string | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
}
