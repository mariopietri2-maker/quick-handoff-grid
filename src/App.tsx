import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import DriverApp from "./pages/DriverApp.tsx";
import DriverProfilePage from "./pages/DriverProfilePage.tsx";
import StoreApp from "./pages/StoreApp.tsx";
import AdminApp from "./pages/AdminApp.tsx";
import SupportApp from "./pages/SupportApp.tsx";
import CustomerApp from "./pages/CustomerApp.tsx";
import RestaurantPage from "./pages/RestaurantPage.tsx";
import CheckoutPage from "./pages/CheckoutPage.tsx";
import OrderTrackingPage from "./pages/OrderTrackingPage.tsx";
import MyOrdersPage from "./pages/MyOrdersPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/order" element={<CustomerApp />} />
              <Route path="/restaurant/:id" element={<RestaurantPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-tracking/:id" element={<OrderTrackingPage />} />
              <Route path="/orders" element={<MyOrdersPage />} />
              <Route path="/driver" element={
                <ProtectedRoute allowedRoles={['driver']}>
                  <DriverApp />
                </ProtectedRoute>
              } />
              <Route path="/driver/profile" element={
                <ProtectedRoute allowedRoles={['driver']}>
                  <DriverProfilePage />
                </ProtectedRoute>
              } />
              <Route path="/store" element={
                <ProtectedRoute allowedRoles={['store']}>
                  <StoreApp />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminApp />
                </ProtectedRoute>
              } />
              <Route path="/support" element={
                <ProtectedRoute allowedRoles={['support']}>
                  <SupportApp />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
