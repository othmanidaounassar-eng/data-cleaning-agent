'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, []);

  const logout = async () => {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};