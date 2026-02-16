export type UserRole = 'admin' | 'operator' | 'customer';
export type VesselStatus = 'parked' | 'in_water' | 'maintenance' | 'transit';
export type SpotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type SpotZone = 'A' | 'B' | 'C' | 'D';
export type TractorRequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type TractorRequestType = 'launch' | 'retrieve';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt: string;
}

export interface Vessel {
  id: string;
  name: string;
  registrationNumber: string;
  length: number;
  type: string;
  ownerId: string;
  owner?: User;
  spotId: string | null;
  spot?: ParkingSpot | null;
  status: VesselStatus;
  lastLaunch: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface ParkingSpot {
  id: string;
  number: string;
  zone: SpotZone;
  row: number;
  col: number;
  status: SpotStatus;
  width: number;
  length: number;
  vesselId: string | null;
  vessel?: Vessel | null;
}

export interface TractorRequest {
  id: string;
  vesselId: string;
  vessel?: Vessel;
  requesterId: string;
  requester?: User;
  operatorId: string | null;
  operator?: User | null;
  type: TractorRequestType;
  status: TractorRequestStatus;
  priority: number;
  notes: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  user?: User | null;
  vesselId: string | null;
  vessel?: Vessel | null;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  vesselId: string;
  vessel?: Vessel;
  spotId: string;
  spot?: ParkingSpot;
  startDate: string;
  endDate: string;
  status: string;
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

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
