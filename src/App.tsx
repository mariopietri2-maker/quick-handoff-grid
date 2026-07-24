import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { ThemeProvider } from "@/hooks/useTheme";
import { I18nProvider } from "@/lib/i18n";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import ConnectionStatus from "@/components/ConnectionStatus";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { MobileAppGate } from "@/components/MobileAppGate";
import RootEntry from "@/components/RootEntry";
import { PushBootstrap } from "@/components/PushBootstrap";
import { PwaManifestSwitcher } from "@/components/PwaManifestSwitcher";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import NativePageTransition from "@/components/NativePageTransition";

// Lazy-load every non-landing route so the initial bundle stays small.
// lazyWithRetry auto-reloads once if a deploy invalidated old chunk hashes.
const AuthPage = lazyWithRetry(() => import("./pages/AuthPage.tsx"));
const DriverApp = lazyWithRetry(() => import("./pages/DriverApp.tsx"));
const DriverProfilePage = lazyWithRetry(() => import("./pages/DriverProfilePage.tsx"));
const StoreProfilePage = lazyWithRetry(() => import("./pages/StoreProfilePage.tsx"));
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage.tsx"));
const StoreApp = lazyWithRetry(() => import("./pages/StoreApp.tsx"));
const AdminApp = lazyWithRetry(() => import("./pages/AdminApp.tsx"));
const SupportApp = lazyWithRetry(() => import("./pages/SupportApp.tsx"));
const MonitorApp = lazyWithRetry(() => import("./pages/MonitorApp.tsx"));
const CustomerApp = lazyWithRetry(() => import("./pages/CustomerApp.tsx"));
const CustomerLayout = lazyWithRetry(() => import("./components/customer/CustomerLayout.tsx"));
const RestaurantPage = lazyWithRetry(() => import("./pages/RestaurantPage.tsx"));
const CheckoutPage = lazyWithRetry(() => import("./pages/CheckoutPage.tsx"));
const OrderTrackingPage = lazyWithRetry(() => import("./pages/OrderTrackingPage.tsx"));
const MyOrdersPage = lazyWithRetry(() => import("./pages/MyOrdersPage.tsx"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound.tsx"));
const LegalPage = lazyWithRetry(() => import("./pages/LegalPage.tsx"));
const DownloadAppPage = lazyWithRetry(() => import("./pages/DownloadAppPage.tsx"));
const PresentationPage = lazyWithRetry(() => import("./pages/PresentationPage.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cost-aware defaults shared across all apps (customer, driver, store,
      // admin, support). Cuts duplicate fetches + auto-retries flaky requests
      // with backoff so a brief network blip doesn't surface as an error.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // resync when the device comes back online
      retry: (failureCount, err: any) => {
        // Don't retry auth / permission errors — they won't get better.
        const status = err?.status ?? err?.code;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (i) => Math.min(1000 * 2 ** i, 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <CartProvider>
                <ConnectionStatus />
                <MaintenanceBanner />
                <Suspense fallback={<RouteFallback />}>
                  <RouteErrorBoundary>
                  <MobileAppGate>
                  <PushBootstrap />
                  <PwaManifestSwitcher />
                  <Routes>
                    <Route path="/" element={<RootEntry />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route element={<CustomerLayout />}>
                      <Route path="/order" element={<CustomerApp />} />
                      <Route path="/orders" element={<MyOrdersPage />} />
                      <Route path="/profile" element={
                        <ProtectedRoute>
                          <ProfilePage />
                        </ProtectedRoute>
                      } />
                    </Route>
                    <Route path="/restaurant/:id" element={<NativePageTransition><RestaurantPage /></NativePageTransition>} />
                    <Route path="/checkout" element={<NativePageTransition><CheckoutPage /></NativePageTransition>} />
                    <Route path="/order-tracking/:id" element={<NativePageTransition><OrderTrackingPage /></NativePageTransition>} />
                    <Route path="/driver" element={
                      <ProtectedRoute allowedRoles={['driver', 'm']}>
                        <DriverApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/driver/profile" element={
                      <ProtectedRoute allowedRoles={['driver', 'm']}>
                        <NativePageTransition><DriverProfilePage /></NativePageTransition>
                      </ProtectedRoute>
                    } />
                    <Route path="/store" element={
                      <ProtectedRoute allowedRoles={['store']}>
                        <StoreApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/store/profile" element={
                      <ProtectedRoute allowedRoles={['store']}>
                        <StoreProfilePage />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin" element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/m" element={
                      <ProtectedRoute allowedRoles={['m']}>
                        <MonitorApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/support" element={
                      <ProtectedRoute allowedRoles={['support']}>
                        <SupportApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/legal/:doc" element={<LegalPage />} />
                    <Route path="/download" element={<DownloadAppPage />} />
                    <Route path="/presentation" element={<PresentationPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </MobileAppGate>
                  </RouteErrorBoundary>
                </Suspense>
              </CartProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
