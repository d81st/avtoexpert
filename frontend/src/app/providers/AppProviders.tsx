import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { LocaleProvider } from '@/shared/context/LocaleContext';
import { ThemeProvider } from '@/shared/context/ThemeContext';
import { queryClient } from './queryClient';

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
