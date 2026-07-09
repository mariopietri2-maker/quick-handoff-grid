import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { role: string; full_name: string | null; public_code?: string | null } | null;
  isAdmin: boolean;
  isSupport: boolean;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; public_code?: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupport, setIsSupport] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name, public_code')
      .eq('user_id', userId)
      .maybeSingle();
    // If profile row doesn't exist yet (e.g. DB trigger lag after signup),
    // set a minimal placeholder so the app isn't stuck on the loading spinner.
    setProfile(data ? (data as any) : { role: 'customer', full_name: null });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    setIsAdmin(roleList.includes('admin'));
    setIsSupport(roleList.includes('support'));
  };

  useEffect(() => {
    let initialised = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsSupport(false);
        }
        setLoading(false);
        initialised = true;
      }
    );

    // Fallback: resolve loading state from initial session check in case
    // onAuthStateChange fires late.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (initialised) return; // onAuthStateChange already handled it
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (!error && data.user) {
      await supabase
        .from('profiles')
        .update({ role: role as any })
        .eq('user_id', data.user.id);
      await fetchProfile(data.user.id);
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setIsSupport(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, isAdmin, isSupport, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
