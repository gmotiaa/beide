import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthGate } from "./components/onboarding/AuthGate";
import { FirstRunIntro } from "./components/onboarding/FirstRunIntro";
import { Onboarding } from "./components/onboarding/Onboarding";
import { useOnboardingStore } from "./stores/onboarding";
import { useAgentStore } from "./stores/agent";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";
import { useUsageStore } from "./stores/usage";
import { deliverProviderKey } from "./lib/provider-key";

export default function App() {
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const completed = useOnboardingStore((s) => s.completed);
  const introSeen = useOnboardingStore((s) => s.introSeen);
  const dismissIntro = useOnboardingStore((s) => s.dismissIntro);
  const completeOnboarding = useOnboardingStore((s) => s.complete);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const initAuth = useAuthStore((s) => s.init);
  const authReady = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadUsage = useUsageStore((s) => s.load);

  useEffect(() => {
    hydrateOnboarding();
    void loadSettings();
    // Billing source depends on the restored Supabase session. Running both in
    // parallel briefly selected editable local limits for a signed-in account.
    void (async () => {
      await initAuth();
      await loadUsage();
    })();
  }, [hydrateOnboarding, loadSettings, initAuth, loadUsage]);

  // The provider key lives in Supabase (encrypted) and is delivered once a
  // session exists — main decrypts and arms the model runtime in memory.
  useEffect(() => {
    if (!session) return;
    void deliverProviderKey().then((ok) => {
      if (ok) void useAgentStore.getState().refreshProviders();
    });
  }, [session]);

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

  // The account is mandatory: usage limits and the provider key are served
  // per-account from Supabase. Wait for the session restore before deciding —
  // flashing the gate on every launch would look like a forced re-login.
  if (!authReady) {
    return <div className="app-boot" />;
  }
  if (!session) {
    return <AuthGate />;
  }

  return <AppLayout />;
}
