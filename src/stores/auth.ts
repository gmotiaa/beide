import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";

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

export const useAuthStore = create<AuthState>((set) => ({
  ready: false,
  configured: isSupabaseConfigured(),
  session: null,
  user: null,
  error: null,
  loading: false,
  pendingVerifyEmail: null,

  init: async () => {
    const sb = getSupabase();
    if (!sb) {
      set({ ready: true, configured: false, session: null, user: null });
      return;
    }
    const { data } = await sb.auth.getSession();
    set({
      ready: true,
      configured: true,
      session: data.session,
      user: data.session?.user ?? null,
    });
    sb.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      // Reload billing when auth changes (subscription lives in Supabase)
      void import("./usage").then((m) => m.useUsageStore.getState().load());
    });
  },

  signIn: async (email, password) => {
    const sb = getSupabase();
    if (!sb) {
      set({ error: "Supabase не настроен. Добавьте VITE_SUPABASE_* в .env" });
      return false;
    }
    set({ loading: true, error: null });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      set({
        loading: false,
        error:
          error.message === "Failed to fetch"
            ? "Нет сети до Supabase. Перезапусти beide после обновления."
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
        error: "Supabase не настроен. Добавьте VITE_SUPABASE_* в .env",
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
            ? "Нет сети до Supabase. Проверь интернет и перезапусти app."
            : error.message,
      });
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
      set({ error: "Supabase не настроен" });
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
        error: result.error.message || "Неверный код",
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
      set({ error: "Supabase не настроен" });
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
