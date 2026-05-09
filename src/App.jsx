import { Toaster } from "@/components/ui/toaster.jsx"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client.js'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound.jsx';
import { AuthProvider, useAuth } from '@/lib/AuthContext.jsx';
import UserNotRegisteredError from '@/components/UserNotRegisteredError.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import { SOSProvider } from '@/lib/SOSContext.jsx';

import Home from '@/pages/Home.jsx';
import SignIn from '@/pages/SignIn.jsx';
import Register from '@/pages/Register.jsx';
import ForgotPassword from '@/pages/ForgotPassword.jsx';
import ResetPassword from '@/pages/ResetPassword.jsx';
import Onboarding from '@/pages/Onboarding.jsx';

// Redirects to onboarding if first-time user
const HomeOrOnboard = () => {
  const done = localStorage.getItem('sos_onboarding_done');
  if (!done) return <Navigate to="/onboarding" replace />;
  return <Home />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Loading SOS...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/sign-in" replace />} />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={
          <SOSProvider>
            <HomeOrOnboard />
          </SOSProvider>
        } />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
