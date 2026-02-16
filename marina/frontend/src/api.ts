const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('marina_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('marina_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'שגיאת שרת' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (phone: string, password: string) =>
    request<{ token: string; user: import('./types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
  me: () => request<import('./types').User>('/auth/me'),

  // Vessels
  getVessels: () => request<import('./types').Vessel[]>('/vessels'),
  getVessel: (id: string) => request<import('./types').Vessel>(`/vessels/${id}`),
  createVessel: (data: any) =>
    request<import('./types').Vessel>('/vessels', { method: 'POST', body: JSON.stringify(data) }),
  updateVessel: (id: string, data: any) =>
    request<import('./types').Vessel>(`/vessels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVessel: (id: string) =>
    request<{ success: boolean }>(`/vessels/${id}`, { method: 'DELETE' }),

  // Spots
  getSpots: () => request<import('./types').ParkingSpot[]>('/spots'),

  // Tractor
  getQueue: () => request<import('./types').TractorRequest[]>('/tractor/queue'),
  getRequests: () => request<import('./types').TractorRequest[]>('/tractor'),
  createRequest: (data: { vesselId: string; type: string; priority?: number; notes?: string }) =>
    request<import('./types').TractorRequest>('/tractor', { method: 'POST', body: JSON.stringify(data) }),
  acceptRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/accept`, { method: 'PUT' }),
  completeRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/complete`, { method: 'PUT' }),
  cancelRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/cancel`, { method: 'PUT' }),
  getMyQueuePosition: () =>
    request<import('./types').MyQueuePosition[]>('/tractor/my-position'),

  // Activity
  getActivity: (limit = 50, offset = 0) =>
    request<{ activities: import('./types').ActivityLog[]; total: number }>(
      `/activity?limit=${limit}&offset=${offset}`
    ),

  // Reservations
  getReservations: () => request<import('./types').Reservation[]>('/reservations'),
  createReservation: (data: any) =>
    request<import('./types').Reservation>('/reservations', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getDashboard: () => request<import('./types').DashboardStats>('/reports/dashboard'),
  getVesselsByStatus: () =>
    request<{ status: string; count: number }[]>('/reports/vessels-by-status'),
  getSpotsByZone: () =>
    request<{ zone: string; status: string; count: number }[]>('/reports/spots-by-zone'),
  getActivitySummary: () =>
    request<{ byDay: Record<string, number>; byAction: Record<string, number>; total: number }>(
      '/reports/activity-summary'
    ),
  getTractorStats: () =>
    request<{ total: number; completed: number; pending: number; averageMinutes: number }>(
      '/reports/tractor-stats'
    ),

  // Health
  getHealth: () =>
    request<{ status: string; timestamp: string; workers: import('./types').WorkerStatus[] }>('/health'),

  // Settings (users)
  getUsers: () => request<import('./types').User[]>('/settings/users'),
  getSpotLayout: () => request<import('./types').ParkingSpot[]>('/spots/layout'),
};
