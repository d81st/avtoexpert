import ErrorBoundary from "@/app/errors/ErrorBoundary";
import AppProviders from "@/app/providers/AppProviders";
import AppRouter from "@/app/routing/AppRouter";
import { GlobalLoadingOverlay } from "@/components/ui/global-loading-overlay";
import { Toaster } from "@/components/ui/sonner";
import { NavigationWatcher } from "@/shared/loading/useGlobalNavigate";
// Side-effect import: activates the >30s diagnostic watchdog subscription
// once for the lifetime of the app (AC 4.12).
import "@/shared/loading/diagnostic-watchdog";

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        {/*
          The following siblings render inside <BrowserRouter> (provided by
          AppProviders), so <NavigationWatcher /> sees route changes via
          useLocation, and the singleton <Toaster /> and <GlobalLoadingOverlay />
          live above <AppRouter />'s <Routes> — they are not remounted on
          navigation (AC 4.11, 5.2).
        */}
        <GlobalLoadingOverlay />
        <Toaster />
        <NavigationWatcher />
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
