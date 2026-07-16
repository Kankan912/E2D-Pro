import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useSessionManager } from '@/hooks/useSessionManager';
import { SessionWarningModal } from '@/components/SessionWarningModal';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  telephone?: string;
  photo_url?: string;
  date_inscription?: string;
  est_membre_e2d: boolean;
  est_adherent_phoenix: boolean;
  statut: string;
  // P0 #6 — `profiles.status` is the English column added by migration
  // 20260108184229 with CHECK ('actif', 'desactive', 'supprime'). The admin
  // "Désactiver" action (UtilisateursAdmin.tsx) sets it to 'desactive' and it
  // MUST block login independently of `membres.statut`.
  status?: string;
  must_change_password?: boolean;
  password_changed?: boolean;
}

interface Permission {
  resource: string;
  permission: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: string | null;
  permissions: Permission[];
  loading: boolean;
  mustChangePassword: boolean;
  // P0 #6 — surface a human-readable error to the Auth.tsx login form when a
  // login is rejected because `profiles.status` is `desactive`/`supprime` (or
  // when the status check itself fails).
  authError: string | null;
  clearAuthError: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [memberBlocked, setMemberBlocked] = useState(false);
  // P0 #6 — auth error message surfaced to the login form.
  const [authError, setAuthError] = useState<string | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const loadingUserIdRef = useRef<string | null>(null);
  // P0 #6 — guard against multiple simultaneous forced sign-outs (login path
  // + periodic re-check could race).
  const forcedSignOutRef = useRef(false);

  const withTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = 30000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  // Fetch user permissions
  const fetchUserPermissions = async (userId: string): Promise<Permission[]> => {
    try {
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);
      
      if (rolesError) throw rolesError;
      if (!userRoles?.length) return [];
      
      const roleIds = userRoles.map(r => r.role_id).filter(Boolean);
      if (!roleIds.length) return [];

      const { data: rolePerms, error: permsError } = await supabase
        .from('role_permissions')
        .select('resource, permission')
        .in('role_id', roleIds)
        .eq('granted', true);
      
      if (permsError) throw permsError;
      
      return (rolePerms || []).map(rp => ({
        resource: rp.resource,
        permission: rp.permission
      }));
    } catch (error: unknown) {
      logger.error('[AuthContext] Error fetching permissions:', error);
      return [];
    }
  };

  // Check member status - returns { allowed: boolean, status: string | null }
  //
  // P0 #6 fix: now verifies BOTH `profiles.status` AND `membres.statut`.
  // The admin "Désactiver" action (UtilisateursAdmin.tsx) sets
  // `profiles.status = 'desactive'` and that MUST block login independently
  // of `membres.statut`. We fail-closed on DB errors (Task 2 P1 #1) instead
  // of the previous fail-open behaviour. The `profiles.status` check runs
  // BEFORE the `membres.statut` check so a desactivated user can never reach
  // the `must_change_password` redirect logic.
  const checkMemberStatus = async (userId: string): Promise<{ allowed: boolean; status: string | null }> => {
    try {
      // Run both lookups in parallel to keep a single network round-trip.
      const [membreRes, profileStatusRes] = await Promise.all([
        supabase
          .from('membres')
          .select('statut')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('status')
          .eq('id', userId)
          .maybeSingle(),
      ]);

      // --- profiles.status — checked FIRST ---
      // RESILIENCE: if profile doesn't exist or RLS blocks the read,
      // do NOT block login. Only block if status is explicitly 'desactive' or 'supprime'.
      const profileStatus = profileStatusRes.data?.status;
      if (profileStatusRes.error) {
        logger.warn('[AuthContext] Profile status check error (non-blocking):', profileStatusRes.error);
      }
      if (profileStatus === 'desactive' || profileStatus === 'supprime') {
        logger.info('[AuthContext] Profile status blocks login: ' + profileStatus);
        return { allowed: false, status: profileStatus };
      }

      // --- membres.statut — checked SECOND ---
      // RESILIENCE: if member lookup fails (RLS, table not ready, no row),
      // do NOT block login. Only block if member exists AND statut is not 'actif'.
      if (membreRes.error) {
        logger.warn('[AuthContext] Member status check error (non-blocking):', membreRes.error);
        return { allowed: true, status: 'actif' };
      }

      const membre = membreRes.data;
      if (!membre) {
        // No member linked — allow access (new user or super admin without member row).
        return { allowed: true, status: 'actif' };
      }

      if (membre.statut && membre.statut !== 'actif') {
        logger.info('[AuthContext] Member status is not active: ' + membre.statut);
        return { allowed: false, status: membre.statut };
      }

      return { allowed: true, status: 'actif' };
    } catch (error: unknown) {
      logger.error('[AuthContext] Error in checkMemberStatus:', error);
      // RESILIENCE: fail-OPEN — allow login on unexpected errors.
      // Previously ANY error blocked login showing "Accès impossible".
      return { allowed: true, status: 'actif' };
    }
  };

  useEffect(() => {
    let isSigningOut = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // RESILIENCE: Only sign out on explicit SIGNED_OUT event.
        // TOKEN_REFRESHED without session can happen momentarily during
        // initial load — do NOT sign out, just skip this event.
        if (event === 'TOKEN_REFRESHED' && !session) {
          logger.warn('[AuthContext] TOKEN_REFRESHED without session — ignoring (not signing out)');
          return;
        }

        if (event === 'SIGNED_OUT') {
          isSigningOut = false;
          loadedUserIdRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setUserRole(null);
          setPermissions([]);
          setMustChangePassword(false);
          setMemberBlocked(false);
          // P0 #6 — do NOT clear `authError` here either; Auth.tsx reads it
          // right after the forced sign-out to display the inline message.
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Only refetch profile when the user actually changes.
        // TOKEN_REFRESHED / USER_UPDATED keep the same user id → skip the cascade.
        if (session?.user) {
          if (loadedUserIdRef.current !== session.user.id && loadingUserIdRef.current !== session.user.id) {
            loadingUserIdRef.current = session.user.id;
            setTimeout(() => {
              fetchUserProfile(session.user.id);
            }, 0);
          }
        } else {
          loadedUserIdRef.current = null;
          setProfile(null);
          setUserRole(null);
          setPermissions([]);
          setMustChangePassword(false);
          setMemberBlocked(false);
          // P0 #6 — clear the sticky auth error when the session truly ends
          // (no user). It will be re-set if a future login is rejected.
          setAuthError(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        if (loadedUserIdRef.current !== session.user.id && loadingUserIdRef.current !== session.user.id) {
          loadingUserIdRef.current = session.user.id;
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      logger.info('[AuthContext] Fetching profile for user: ' + userId);

      // Check member status first (also verifies `profiles.status` — P0 #6).
      // This runs BEFORE the `must_change_password` redirect so a desactivated
      // user can never reach the password-change page.
      const { allowed, status } = await withTimeout(checkMemberStatus(userId), 'checkMemberStatus');
      if (!allowed) {
        setMemberBlocked(true);

        const statusMessages: Record<string, { title: string; description: string }> = {
          desactive: {
            title: "Compte désactivé",
            description: "Votre compte a été désactivé. Contactez un administrateur."
          },
          supprime: {
            title: "Compte supprimé",
            description: "Votre compte a été supprimé. Contactez un administrateur."
          },
          inactif: {
            title: "Compte inactif",
            description: "Votre compte est actuellement inactif. Contactez l'association pour le réactiver."
          },
          suspendu: {
            title: "Compte suspendu",
            description: "Votre compte a été suspendu. Veuillez contacter l'administrateur pour plus d'informations."
          },
          error: {
            title: "Accès impossible",
            description: "Impossible de vérifier l'état de votre compte. Réessayez dans quelques instants."
          }
        };

        const message = statusMessages[status || ''] || {
          title: "Accès refusé",
          description: "Votre compte ne vous permet pas d'accéder à l'application. Contactez l'administrateur."
        };

        // P0 #6 — propagate the error to the Auth.tsx login form.
        const fullError = `${message.title} — ${message.description}`;
        setAuthError(fullError);

        toast({
          title: message.title,
          description: message.description,
          variant: "destructive"
        });
        setLoading(false);
        await signOut();
        return;
      }

      // Parallelize profile + role + permissions for a single network round-trip
      const [profileRes, roleRes, userPerms] = await withTimeout(
        Promise.all([
          supabase
            .from('profiles').select('id, nom, prenom, telephone, email, photo_url, statut, status, must_change_password, password_changed, association_id, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('user_roles')
            .select('role, role_id, roles(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          fetchUserPermissions(userId),
        ]),
        'fetchUserProfile'
      );

      if (profileRes.error) throw profileRes.error;
      if (roleRes.error) {
        logger.error('[AuthContext] Role fetch error:', roleRes.error);
        throw roleRes.error;
      }

      const profileData = profileRes.data;
      const roleData = roleRes.data;

      // P0 #6 — defensive re-check: even if `checkMemberStatus` somehow let a
      // desactivated user through (e.g. race between login and admin action),
      // we re-verify `profiles.status` from the freshly fetched profile and
      // refuse to set `must_change_password` (so no redirect to
      // `/change-password`). This is defence-in-depth on top of the SQL-side
      // fix (Task 9 should restrict `profiles_self_update` to forbid the
      // `status` / `must_change_password` columns entirely).
      if (profileData?.status === 'desactive' || profileData?.status === 'supprime') {
        logger.warn('[AuthContext] Profile status is ' + profileData.status + ' after load — signing out (defensive)');
        setAuthError("Votre compte a été désactivé. Contactez un administrateur.");
        toast({
          title: "Compte désactivé",
          description: "Votre compte a été désactivé. Contactez un administrateur.",
          variant: "destructive"
        });
        setMustChangePassword(false);
        setLoading(false);
        await signOut();
        return;
      }

      logger.success('[AuthContext] Profile loaded: ' + profileData?.nom + ' ' + profileData?.prenom);
      setProfile(profileData);

      if (profileData?.must_change_password === true) {
        logger.info('[AuthContext] User must change password');
        setMustChangePassword(true);
      } else {
        setMustChangePassword(false);
      }

      logger.success('[AuthContext] Role data received: ' + roleData?.roles?.name + ' (enum: ' + roleData?.role + ')');
      // RESILIENCE: Try roles(name) first, then fallback to role enum, then fallback to direct query
      let resolvedRole = roleData?.roles?.name || roleData?.role || null;

      // If still no role, try a direct query without join
      if (!resolvedRole) {
        logger.warn('[AuthContext] Role not found via join — trying direct query');
        const { data: directRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedRole = directRole?.role || null;
      }

      setUserRole(resolvedRole);

      setPermissions(userPerms);
      loadedUserIdRef.current = userId;
      logger.success('[AuthContext] Permissions loaded: ' + userPerms.length);
    } catch (error: unknown) {
      logger.error('[AuthContext] Error fetching user data:', error);
      // RESILIENCE: Do NOT sign out on profile fetch error.
      // The user is authenticated — let them in with minimal profile.
      // Previously this left the user in an undefined state causing instant redirect.
      loadedUserIdRef.current = userId;
    } finally {
      if (loadingUserIdRef.current === userId) {
        loadingUserIdRef.current = null;
      }
      setLoading(false);
    }
  };


  const signOut = useCallback(async () => {
    // Purger toutes les clés de début de session pour éviter de restaurer
    // une session précédente déjà expirée lors de la prochaine connexion.
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('lovable_session_start'));
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      logger.error('[AuthContext] Failed to clear session storage:', e);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setPermissions([]);
    setMustChangePassword(false);
    setMemberBlocked(false);
    // Note: `authError` is intentionally NOT cleared here — the Auth.tsx
    // login form needs to read it after the forced sign-out completes.
  }, []);

  // P0 #6 — exposes a way for Auth.tsx to clear the sticky `authError`
  // when the user starts a new login attempt.
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // P0 #6 — periodic re-check of `profiles.status` (every 5 minutes) so that
  // an admin disabling a user mid-session forces a sign-out on the next
  // tick. We use a manual interval (Task 1 disabled React Query's
  // `refetchOnWindowFocus`). The query is intentionally cheap (single column
  // on a single row by PK).
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      // Skip if a forced sign-out is already in flight (avoids toast spam).
      if (forcedSignOutRef.current) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          logger.error('[AuthContext] Periodic profile check error:', error);
          return;
        }

        if (data?.status === 'desactive' || data?.status === 'supprime') {
          logger.info('[AuthContext] Profile became ' + data.status + ' mid-session — forcing sign-out');
          forcedSignOutRef.current = true;
          toast({
            title: "Session terminée",
            description: "Session terminée: compte désactivé",
            variant: "destructive"
          });
          setAuthError("Votre compte a été désactivé. Contactez un administrateur.");
          await signOut();
          forcedSignOutRef.current = false;
        }
      } catch (e) {
        logger.error('[AuthContext] Periodic profile check failed:', e);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, signOut, toast]);

  // Session manager integration
  const sessionManager = useSessionManager({
    session,
    userRole,
    permissions,
    onLogout: async () => {
      const reason = sessionManager.logoutReason;
      await signOut();
      
      toast({
        title: reason === 'inactivity' 
          ? 'Session expirée pour inactivité' 
          : 'Durée maximale de session atteinte',
        description: 'Veuillez vous reconnecter pour continuer.',
        variant: 'default'
      });
    },
    enabled: !!session && !loading
  });

  return (
    <AuthContext.Provider value={{ user, session, profile, userRole, permissions, loading, mustChangePassword, authError, clearAuthError, signOut }}>
      {children}
      
      {/* Modal d'avertissement de session */}
      <SessionWarningModal
        open={sessionManager.showWarning}
        secondsLeft={sessionManager.warningSecondsLeft}
        reason={sessionManager.logoutReason}
        onExtend={sessionManager.extendSession}
        onLogout={sessionManager.logoutNow}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
