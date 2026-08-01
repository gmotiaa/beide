import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import i18n from "../i18n";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { useUsageStore } from "./usage";

export type SignUpResult =
  | { ok: true; needsVerification: boolean; email: string }
  | { ok: false };

interface AuthState {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  loading: boolean;
  /** Email waiting for OTP after register */
  pendingVerifyEmail: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  /**
   * Public sign-up (sends confirmation email when Supabase requires it).
   * Does not use admin auto-confirm so OTP flow works.
   */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  verifyEmailOtp: (email: string, token: string) => Promise<boolean>;
  resendSignupOtp: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  clearPendingVerify: () => void;
}

/** Kept outside the store so a re-init can drop the previous listener. */
let authSubscription: { unsubscribe: () => void } | null = null;
let authInitGeneration = 0;

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  configured: isSupabaseConfigured(),
  session: null,
  user: null,
  error: null,
  loading: false,
  pendingVerifyEmail: null,

  init: async () => {
    const generation = ++authInitGeneration;
    const isCurrent = () => generation === authInitGeneration;
    authSubscription?.unsubscribe();
    authSubscription = null;
    set({ ready: false });
    try {
      const sb = getSupabase();
      if (!sb) {
        if (isCurrent()) {
          set({ configured: false, session: null, user: null });
        }
        return;
      }
      const { data } = await sb.auth.getSession();
      if (!isCurrent()) return;
      set({
        configured: true,
        session: data.session,
        user: data.session?.user ?? null,
      });
      const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
        if (!isCurrent()) return;
        set({ session, user: session?.user ?? null });
        // Reload billing when auth changes (subscription lives in Supabase)
        void useUsageStore.getState().load(Boolean(session));
      });
      authSubscription = listener.subscription;
    } catch (e) {
      if (isCurrent()) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      // Always flip `ready` — otherwise the onboarding account step spins forever.
      if (isCurrent()) set({ ready: true });
    }
  },

  signIn: async (email, password) => {
    const sb = getSupabase();
    if (!sb) {
      set({ error: i18n.t("auth.notConfigured") });
      return false;
    }
    set({ loading: true, error: null });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      set({
        loading: false,
        error:
          error.message === "Failed to fetch"
            ? i18n.t("auth.network")
            : error.message,
      });
      return false;
    }
    set({
      loading: false,
      session: data.session,
      user: data.user,
      error: null,
      pendingVerifyEmail: null,
    });
    return true;
  },

  signUp: async (email, password) => {
    const sb = getSupabase();
    if (!sb) {
      set({
        loading: false,
        error: i18n.t("auth.notConfigured"),
      });
      return { ok: false };
    }

    set({ loading: true, error: null });
    const trimmed = email.trim();

    // Public signup so Supabase can email a 6-digit / token code when confirm is on
    const { data, error } = await sb.auth.signUp({
      email: trimmed,
      password,
      options: {
        data: { app: "beide" },
      },
    });

    if (error) {
      set({
        loading: false,
        error:
          error.message === "Failed to fetch"
            ? i18n.t("auth.network")
            : error.message,
      });
      return { ok: false };
    }

    // Enumeration-safe response for an already-confirmed email: Supabase
    // returns a fake user with no error and empty identities. Treating it as
    // "waiting for OTP" parked the user on a code screen where no code ever
    // arrives — tell them to sign in instead.
    if (!data.session && data.user && data.user.identities?.length === 0) {
      set({ loading: false, error: i18n.t("auth.emailExists") });
      return { ok: false };
    }

    // Immediate session = email confirm disabled on project
    if (data.session) {
      set({
        loading: false,
        session: data.session,
        user: data.user,
        error: null,
        pendingVerifyEmail: null,
      });
      return { ok: true, needsVerification: false, email: trimmed };
    }

    // User created, waiting for email OTP
    set({
      loading: false,
      session: null,
      user: data.user,
      error: null,
      pendingVerifyEmail: trimmed,
    });
    return { ok: true, needsVerification: true, email: trimmed };
  },

  verifyEmailOtp: async (email, token) => {
    const sb = getSupabase();
    if (!sb) {
      set({ error: i18n.t("auth.notConfigured") });
      return false;
    }
    set({ loading: true, error: null });
    const code = token.trim();

    // Try signup confirmation first, then email type (template-dependent)
    let result = await sb.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "signup",
    });

    if (result.error) {
      result = await sb.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
    }

    if (result.error) {
      set({
        loading: false,
        error: result.error.message || i18n.t("auth.invalidCode"),
      });
      return false;
    }

    set({
      loading: false,
      session: result.data.session,
      user: result.data.user,
      error: null,
      pendingVerifyEmail: null,
    });
    return true;
  },

  resendSignupOtp: async (email) => {
    const sb = getSupabase();
    if (!sb) {
      set({ error: i18n.t("auth.notConfigured") });
      return false;
    }
    set({ loading: true, error: null });
    const { error } = await sb.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    if (error) {
      set({ loading: false, error: error.message });
      return false;
    }
    set({ loading: false, error: null });
    return true;
  },

  signOut: async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    set({ session: null, user: null, pendingVerifyEmail: null });
  },

  clearError: () => set({ error: null }),

  clearPendingVerify: () => set({ pendingVerifyEmail: null }),
}));
