import { create } from "zustand";

const KEY = "beide.onboarding.v1";
const INTRO_KEY = "beide.intro.v1";

export type OnboardingStep =
  | "welcome"
  | "features"
  | "settings"
  | "account"
  | "ready"
  | "done";

interface OnboardingState {
  completed: boolean;
  /** First-run splash already played — kept apart from `completed` so the
   *  animation runs once even if onboarding itself is skipped. */
  introSeen: boolean;
  step: OnboardingStep;
  hydrated: boolean;
  hydrate: () => void;
  setStep: (step: OnboardingStep) => void;
  dismissIntro: () => void;
  complete: () => void;
  reset: () => void;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  introSeen: false,
  step: "welcome",
  hydrated: false,

  hydrate: () => {
    const completed = readFlag(KEY);
    set({
      completed,
      // An install that finished onboarding before this splash existed must
      // not get the splash retroactively.
      introSeen: readFlag(INTRO_KEY) || completed,
      hydrated: true,
      step: "welcome",
    });
  },

  setStep: (step) => set({ step }),

  dismissIntro: () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    set({ introSeen: true });
  },

  complete: () => {
    try {
      localStorage.setItem(KEY, "1");
      localStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    set({ completed: true, introSeen: true, step: "done" });
  },

  reset: () => {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(INTRO_KEY);
    } catch {
      /* ignore */
    }
    set({ completed: false, introSeen: false, step: "welcome" });
  },
}));
