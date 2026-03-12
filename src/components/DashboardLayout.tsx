import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { LayoutDashboard, Truck, LogIn, LogOut, Settings as SettingsIcon, Menu, X, ListOrdered } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Live Dashboard', icon: LayoutDashboard, roles: ['admin', 'security', 'operator', 'viewer'] },
    { path: '/register', label: 'Register Truck', icon: Truck, roles: ['admin', 'operator'] },
    { path: '/entry', label: 'Gate Entry', icon: LogIn, roles: ['admin', 'security'] },
    { path: '/queue', label: 'Queue Management', icon: ListOrdered, roles: ['admin', 'operator'] },
    { path: '/exit', label: 'Exit Control', icon: LogOut, roles: ['admin', 'security'] },
    { path: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-indigo-900 text-white p-4 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Truck className="w-6 h-6" />
          VIQ Control
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={clsx(
        "bg-indigo-900 text-indigo-100 w-full md:w-64 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out z-20",
        isMobileMenuOpen ? "block" : "hidden md:flex"
      )}>
        <div className="p-6 hidden md:flex items-center gap-3 font-bold text-xl text-white border-b border-indigo-800">
          <Truck className="w-8 h-8" />
          VIQ Control
        </div>

        <div className="p-4 flex-1">
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4 px-3">
            Menu
          </div>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive 
                      ? "bg-indigo-800 text-white font-medium" 
                      : "hover:bg-indigo-800/50 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-indigo-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-white uppercase">
              {user?.username.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-medium text-white">{user?.username}</div>
              <div className="text-xs text-indigo-300 capitalize">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
