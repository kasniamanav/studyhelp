import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../../lib/supabase';
import { useUIStore } from '../../store/useUIStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInDemoGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  signInDemoGuest: () => {},
});

const DEMO_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'student.demo@studyai.app',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { full_name: 'Demo Student' },
  created_at: new Date().toISOString(),
} as unknown as User;

const DEMO_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Demo Student',
  theme: 'system',
  default_difficulty: 'medium',
  default_explain_level: 'simple',
  created_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(
    localStorage.getItem('studyai-guest-session') === 'true'
  );
  const { setTheme } = useUIStore();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
        if (data.theme) {
          setTheme(data.theme);
        }
      } else {
        // Fallback profile if row doesn't exist yet
        const defaultProfile: Profile = {
          id: userId,
          display_name: 'Student',
          theme: 'system',
          default_difficulty: 'medium',
          default_explain_level: 'simple',
          created_at: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    // If guest session is flagged in localStorage
    if (localStorage.getItem('studyai-guest-session') === 'true') {
      setUser(DEMO_USER);
      setProfile(DEMO_PROFILE);
      setIsGuest(true);
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('studyai-guest-session') === 'true') return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem('studyai-guest-session');
    setIsGuest(false);
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const signInDemoGuest = () => {
    localStorage.setItem('studyai-guest-session', 'true');
    setUser(DEMO_USER);
    setProfile(DEMO_PROFILE);
    setIsGuest(true);
  };

  const refreshProfile = async () => {
    if (user && !isGuest) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile, signInDemoGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

