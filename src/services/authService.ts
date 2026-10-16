import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types/database';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export const authService = {
  /**
   * Get current authenticated user session
   */
  async getCurrentUser(): Promise<AdminUser | null> {
    if (!isSupabaseConfigured()) {
      // A mock session is development-only; discard stale local sessions in production.
      if (import.meta.env.PROD) {
        localStorage.removeItem('vk_local_admin');
        return null;
      }
      const localAdmin = localStorage.getItem('vk_local_admin');
      if (localAdmin) {
        try {
          return JSON.parse(localAdmin);
        } catch {
          return null;
        }
      }
      return null;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        return null;
      }

      // Query profiles table to get real verified role
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        return {
          id: session.user.id,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || 'Customer User',
          role: 'customer', // strictly customer
        };
      }

      return {
        id: profile.id,
        email: profile.email || session.user.email || '',
        fullName: profile.full_name || 'User',
        role: profile.role,
      };
    } catch {
      return null;
    }
  },

  /**
   * Check if current session is an authorized Admin
   */
  async verifyAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  },

  /**
   * Sign in with Supabase Auth
   * Strictly verifies that authenticated user possesses 'admin' role.
   * NO AUTOMATIC PROMOTION OR FIRST-USER ESCALATION PATHS EXIST.
   */
  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string; user?: AdminUser }> {
    if (!isSupabaseConfigured()) {
      // Fail closed in production. Mock admin sessions are strictly local-development only.
      if (import.meta.env.PROD) {
        return { success: false, error: 'Administrator sign-in is unavailable because Supabase is not configured.' };
      }
      // Local development test mode
      if (email.trim().toLowerCase() === 'admin@vkvastram.com' && password === 'vastram2026') {
        const mockUser: AdminUser = {
          id: 'dev-admin-id',
          email: 'admin@vkvastram.com',
          fullName: 'Store Administrator',
          role: 'admin',
        };
        localStorage.setItem('vk_local_admin', JSON.stringify(mockUser));
        return { success: true, user: mockUser };
      }
      return {
        success: false,
        error: 'Invalid credentials for local test mode.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return { success: false, error: error?.message || 'Authentication failed' };
      }

      // Verify admin role strictly from public.profiles table
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profile || profile.role !== 'admin') {
        // Sign out unauthorized session from client immediately
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Access restricted: This account does not possess administrator privileges.',
        };
      }

      return {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email || email,
          fullName: profile.full_name || 'Administrator',
          role: 'admin',
        },
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network communication error' };
    }
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<void> {
    localStorage.removeItem('vk_local_admin');
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
  },
};
