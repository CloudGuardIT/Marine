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

async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  // Auth
  login: (phone: string, password: string) =>
    request<{ token: string; user: import('./types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),
  register: (data: { name: string; phone: string; password: string }) =>
    request<{ token: string; user: import('./types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
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
  getSpotLayout: () =>
    request<{ spots: import('./types').ParkingSpot[]; zones: Record<string, import('./types').ParkingSpot[]> }>('/spots/layout'),
  createSpot: (data: { number: string; zone: string; row: number; col: number; width?: number; length?: number; status?: string }) =>
    request<import('./types').ParkingSpot>('/spots', { method: 'POST', body: JSON.stringify(data) }),
  updateSpot: (id: string, data: any) =>
    request<import('./types').ParkingSpot>(`/spots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSpot: (id: string) =>
    request<{ success: boolean }>(`/spots/${id}`, { method: 'DELETE' }),

  // Tractor
  getQueue: () => request<import('./types').TractorRequest[]>('/tractor/queue'),
  getRequests: () => request<import('./types').TractorRequest[]>('/tractor'),
  createRequest: (data: { vesselId: string; type: string; priority?: number; notes?: string }) =>
    request<import('./types').TractorRequest>('/tractor', { method: 'POST', body: JSON.stringify(data) }),
  acceptRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/accept`, { method: 'PUT' }),
  startRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/start`, { method: 'PUT' }),
  completeRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/complete`, { method: 'PUT' }),
  cancelRequest: (id: string) =>
    request<import('./types').TractorRequest>(`/tractor/${id}/cancel`, { method: 'PUT' }),
  getMyQueuePosition: () =>
    request<import('./types').MyQueuePosition[]>('/tractor/my-position'),

  // Activity
  getActivity: (limit = 50, offset = 0, action?: string) =>
    request<{ activities: import('./types').ActivityLog[]; total: number }>(
      `/activity?limit=${limit}&offset=${offset}${action ? `&action=${action}` : ''}`
    ),

  // Reservations
  getReservations: () => request<import('./types').Reservation[]>('/reservations'),
  createReservation: (data: { vesselId: string; spotId: string; startDate: string; endDate: string }) =>
    request<import('./types').Reservation>('/reservations', { method: 'POST', body: JSON.stringify(data) }),
  updateReservation: (id: string, data: any) =>
    request<import('./types').Reservation>(`/reservations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReservation: (id: string) =>
    request<{ success: boolean }>(`/reservations/${id}`, { method: 'DELETE' }),

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

  // CSV Exports
  exportVesselsCSV: () => downloadFile('/reports/export/vessels', 'vessels.csv'),
  exportActivityCSV: (days = 7) => downloadFile(`/reports/export/activity?days=${days}`, 'activity.csv'),
  exportTractorCSV: () => downloadFile('/reports/export/tractor', 'tractor.csv'),

  // Health
  getHealth: () =>
    request<{ status: string; timestamp: string; workers: import('./types').WorkerStatus[] }>('/health'),

  // Settings (users)
  getUsers: () => request<import('./types').User[]>('/settings/users'),
  createUser: (data: { name: string; phone: string; password: string; role?: string }) =>
    request<import('./types').User>('/settings/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: { name?: string; phone?: string; role?: string; password?: string }) =>
    request<import('./types').User>(`/settings/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/settings/users/${id}`, { method: 'DELETE' }),
  updateProfile: (data: { name?: string; password?: string }) =>
    request<import('./types').User>('/settings/profile', { method: 'PUT', body: JSON.stringify(data) }),
};
