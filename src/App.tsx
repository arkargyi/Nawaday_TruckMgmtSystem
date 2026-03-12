import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User } from './types';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import LiveDashboard from './components/LiveDashboard';
import TruckRegistration from './components/TruckRegistration';
import GateEntry from './components/GateEntry';
import QueueManagement from './components/QueueManagement';
import ExitControl from './components/ExitControl';
import Settings from './components/Settings';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<LiveDashboard />} />
            <Route path="register" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><TruckRegistration /></ProtectedRoute>} />
            <Route path="entry" element={<ProtectedRoute allowedRoles={['admin', 'security']}><GateEntry /></ProtectedRoute>} />
            <Route path="queue" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><QueueManagement /></ProtectedRoute>} />
            <Route path="exit" element={<ProtectedRoute allowedRoles={['admin', 'security']}><ExitControl /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
