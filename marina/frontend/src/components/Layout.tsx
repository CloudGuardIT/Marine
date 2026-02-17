import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Ship,
  ParkingSquare,
  Truck,
  ScrollText,
  BarChart3,
  Settings,
  LogOut,
  Anchor,
  Eye,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'לוח בקרה', roles: ['admin', 'operator'] },
  { to: '/admin/vessels', icon: Ship, label: 'כלי שייט', roles: ['admin', 'operator'] },
  { to: '/admin/spots', icon: ParkingSquare, label: 'מקומות חניה', roles: ['admin', 'operator'] },
  { to: '/admin/tractor', icon: Truck, label: 'תור טרקטור', roles: ['admin', 'operator'] },
  { to: '/admin/activity', icon: ScrollText, label: 'יומן פעילות', roles: ['admin', 'operator'] },
  { to: '/admin/reports', icon: BarChart3, label: 'דוחות', roles: ['admin'] },
  { to: '/admin/settings', icon: Settings, label: 'הגדרות', roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-gray-700">
          <Anchor size={24} className="text-blue-400" />
          <span className="font-bold text-lg">מרינה</span>
        </div>

        <nav className="flex-1 py-3 space-y-1 px-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Preview buttons for admin */}
        {user?.role === 'admin' && (
          <div className="px-2 pb-2 space-y-1">
            <div className="text-xs text-gray-500 px-3 mb-1">תצוגה מקדימה</div>
            <button
              onClick={() => navigate('/customer?preview=true')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              <Eye size={18} />
              תצוגת לקוח
            </button>
            <button
              onClick={() => navigate('/tractor?preview=true')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
            >
              <Eye size={18} />
              תצוגת טרקטור
            </button>
          </div>
        )}

        {/* User info & logout */}
        <div className="border-t border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-gray-400">
                {user?.role === 'admin' ? 'מנהל' : user?.role === 'operator' ? 'מפעיל' : 'לקוח'}
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white transition rounded-lg hover:bg-gray-800"
              title="התנתקות"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
