import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Vessels from './pages/Vessels';
import Spots from './pages/Spots';
import Tractor from './pages/Tractor';
import Activity from './pages/Activity';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import CustomerDashboard from './pages/CustomerDashboard';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user } = useAuth();
  if (user?.role === 'customer') return <Navigate to="/customer" replace />;
  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Role-based redirect from root */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRedirect />
          </ProtectedRoute>
        }
      />

      {/* Admin routes with sidebar layout */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="vessels" element={<Vessels />} />
        <Route path="spots" element={<Spots />} />
        <Route path="tractor" element={<Tractor />} />
        <Route path="activity" element={<Activity />} />
        <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
      </Route>

      {/* Customer standalone route */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />

      {/* Tractor standalone route */}
      <Route
        path="/tractor"
        element={
          <ProtectedRoute>
            <Tractor />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
