import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { mobileHomePath, resolveMobileFlavor } from '@/lib/mobileApp';
import { syncRoleForMobileShell } from '@/lib/syncAppRole';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { role: string; full_name: string | null; public_code?: string | null } | null;
  isAdmin: boolean;
  isSupport: boolean;
  isStore: boolean;
  /** Elevated driver (floor lead) — role M */
  isM: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: string,
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ role: string; full_name: string | null; public_code?: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupport, setIsSupport] = useState(false);
  const [isStore, setIsStore] = useState(false);
  const [isM, setIsM] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role, full_name, public_code')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data ? (data as any) : { role: 'customer', full_name: null });

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roleList = (roles ?? []).map((r: any) => r.role);
    setIsAdmin(roleList.includes('admin'));
    setIsSupport(roleList.includes('support'));
    setIsStore(roleList.includes('store'));
    setIsM(roleList.includes('m') || (data as any)?.role === 'm');
  };

  /** Customer app → customer role, Driver app → driver role (Capacitor appId aware). */
  const applyShellRole = async (userId: string) => {
    try {
      await syncRoleForMobileShell();
    } catch {
      /* RoleAccessGate / next login can retry */
    }
    await fetchProfile(userId);
  };

  useEffect(() => {
    // Warm flavor cache early (native appId).
    void resolveMobileFlavor();

    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        await applyShellRole(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // onAuthStateChange must NOT await Supabase calls directly inside the
    // callback — that deadlocks while the SDK commits the auth token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          const userId = nextSession.user.id;
          setTimeout(() => {
            applyShellRole(userId).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsSupport(false);
          setIsStore(false);
          setIsM(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const emailNorm = normalizeEmail(email);
    const attempt = () =>
      supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });

    let { error } = await attempt();
    // Capacitor / flaky mobile networks often surface a raw TypeError "Failed to fetch"
    if (error && /failed to fetch|networkerror|load failed|fetch/i.test(error.message || '')) {
      await new Promise((r) => setTimeout(r, 450));
      ({ error } = await attempt());
    }
    if (error && /failed to fetch|networkerror|load failed/i.test(error.message || '')) {
      return {
        error: new Error(
          'Αποτυχία σύνδεσης με τον διακομιστή. Ελέγξτε το internet και δοκιμάστε ξανά.',
        ),
      };
    }
    // Role sync runs via onAuthStateChange → applyShellRole.
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, _role: string) => {
    const emailNorm = normalizeEmail(email);
    const flavor = await resolveMobileFlavor();
    const redirectPath = mobileHomePath(flavor === 'shared' ? 'customer' : flavor);

    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}${redirectPath}`,
      },
    });

    // Account already exists → try signing in with the same password.
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
        const login = await signIn(emailNorm, password);
        if (!login.error) {
          const { data: cur } = await supabase.auth.getSession();
          if (cur.session?.user) await applyShellRole(cur.session.user.id);
          return { error: null, session: cur.session };
        }
        return {
          error: new Error('Υπάρχει ήδη λογαριασμός με αυτό το email. Ο κωδικός δεν ταιριάζει — δοκιμάστε Σύνδεση ή άλλον κωδικό.'),
          session: null,
        };
      }
      return { error: error as Error, session: null };
    }

    // Autoconfirm should return a session; if not, sign in immediately so the
    // user is never stuck on "check your email" / invalid credentials.
    let session = data.session;
    if (!session) {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });
      if (loginError) {
        return { error: loginError as Error, session: null };
      }
      session = loginData.session;
    }

    if (session?.user) {
      // Assign role from shell: customer app → customer, driver app → driver.
      await applyShellRole(session.user.id);
    }

    return { error: null, session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
    setIsSupport(false);
    setIsStore(false);
    setIsM(false);
  };

  const refreshProfile = async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? user?.id;
    if (uid) await fetchProfile(uid);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, isAdmin, isSupport, isStore, isM, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
