import ErrorBoundary from "@/app/errors/ErrorBoundary";
import AppProviders from "@/app/providers/AppProviders";
import AppRouter from "@/app/routing/AppRouter";

function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
