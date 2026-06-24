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

    // Reconcile the role the user selected at signup. Because email
    // confirmation is required, there is no session at signup time, so the
    // role chosen then cannot be written (RLS blocks it). We stash it in the
    // user's auth metadata and apply it here on the first authenticated load,
    // but only while the profile is still on the default 'customer' role so we
    // never override a role an admin set later.
    let resolved = data as any;
    const { data: userData } = await supabase.auth.getUser();
    const desiredRole = userData?.user?.user_metadata?.signup_role as string | undefined;
    if (
      desiredRole &&
      resolved &&
      resolved.role === 'customer' &&
      desiredRole !== 'customer'
    ) {
      const { data: updated } = await supabase
        .from('profiles')
        .update({ role: desiredRole as any })
        .eq('user_id', userId)
        .select('role, full_name, public_code')
        .maybeSingle();
      if (updated) resolved = updated;
    }
    setProfile(resolved as any);

    // Check admin & support roles from user_roles table
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    setIsAdmin(roleList.includes('admin'));
    setIsSupport(roleList.includes('support'));
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Store both the display name and the chosen role in auth metadata.
      // The role is applied to the profile on first authenticated login
      // (see fetchProfile) because there is no session yet at signup.
      options: { data: { full_name: fullName, signup_role: role } },
    });

    if (!error && data.user && data.session) {
      // Only runs when email confirmation is disabled (session exists immediately).
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
