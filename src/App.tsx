import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { FirstRunIntro } from "./components/onboarding/FirstRunIntro";
import { Onboarding } from "./components/onboarding/Onboarding";
import { useOnboardingStore } from "./stores/onboarding";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";
import { useUsageStore } from "./stores/usage";

export default function App() {
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const completed = useOnboardingStore((s) => s.completed);
  const introSeen = useOnboardingStore((s) => s.introSeen);
  const dismissIntro = useOnboardingStore((s) => s.dismissIntro);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const initAuth = useAuthStore((s) => s.init);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadUsage = useUsageStore((s) => s.load);

  useEffect(() => {
    hydrateOnboarding();
    void loadSettings();
    void initAuth();
    void loadUsage();
  }, [hydrateOnboarding, loadSettings, initAuth, loadUsage]);

  if (!hydrated) {
    return <div className="app-boot" />;
  }

  // First launch only: a short animated splash with a chime that invites the
  // user in. Same full-takeover rule as onboarding below.
  if (!introSeen) {
    return (
      <FirstRunIntro
        onStart={dismissIntro}
        onSkip={() => {
          dismissIntro();
          completeOnboarding();
        }}
      />
    );
  }

  // Full takeover while onboarding — IDE shell not mounted underneath
  // so the redesign is unmistakable and no session chrome peeks through.
  if (!completed) {
    return <Onboarding />;
  }

  return <AppLayout />;
}
