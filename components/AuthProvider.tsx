'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface User {
  id: string;
  email?: string;
  role?: string;
  aud?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInAnon: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check current user on mount
    const initAuth = async () => {
      try {
        if (!supabase) {
          setLoading(false);
          return;
        }

        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user?.id ? {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role,
          aud: session.user.aud,
        } : null);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user?.id ? {
            id: session.user.id,
            email: session.user.email,
            role: session.user.role,
            aud: session.user.aud,
          } : null);

          // If user just logged in, redirect to home
          if (session?.user) {
            router.refresh();
          }
        });

        setLoading(false);
        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Auth init error:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, [router]);

  const signInAnon = async () => {
    if (!supabase) {
      console.error('Supabase not configured');
      throw new Error('Supabase not configured');
    }

    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign in error:', error);
        throw error;
      }
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          aud: data.user.aud,
        });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    if (!supabase) return;

    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInAnon,
        signOutUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}