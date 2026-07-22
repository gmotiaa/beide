import { create } from "zustand";

const KEY = "beide.onboarding.v1";

export type OnboardingStep = "welcome" | "features" | "settings" | "account" | "done";

interface OnboardingState {
  completed: boolean;
  step: OnboardingStep;
  hydrated: boolean;
  hydrate: () => void;
  setStep: (step: OnboardingStep) => void;
  complete: () => void;
  reset: () => void;
}

function readCompleted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  step: "welcome",
  hydrated: false,

  hydrate: () => {
    set({ completed: readCompleted(), hydrated: true, step: "welcome" });
  },

  setStep: (step) => set({ step }),

  complete: () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    set({ completed: true, step: "done" });
  },

  reset: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ completed: false, step: "welcome" });
  },
}));
