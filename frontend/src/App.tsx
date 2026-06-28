import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { LandingPage } from "./pages/LandingPage";
import { Login } from "./pages/Login";
import { SignUp } from "./pages/SignUp";
import { ResetPassword } from "./pages/ResetPassword";
import { SearchRides } from "./pages/SearchRides";
import { FindRide } from "./pages/FindRide";
import { CreateRide } from "./pages/CreateRide";
import { RideDetails } from "./pages/RideDetails";
import { LiveTracking } from "./pages/LiveTracking";
import { Dashboard } from "./pages/Dashboard";
import { ProfilePage } from "./pages/ProfilePage";
import { Inbox } from "./pages/Inbox";
import { MyRides } from "./pages/MyRides";
import { MyRideDetails } from "./pages/MyRideDetails";
import { AdminDashboard } from "./pages/AdminDashboard";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-10 w-10 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-bold text-slate-500">Securing Session...</span>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-blue-600/10 selection:text-blue-600">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/forgot-password" element={<ResetPassword />} />
              <Route path="/search" element={<Navigate to="/find-ride" replace />} />
              <Route path="/find-ride" element={<FindRide />} />
              <Route path="/rides/search-results" element={<SearchRides />} />
              <Route path="/ride/:rideId" element={<RideDetails />} />
              <Route path="/rides/:rideId" element={<RideDetails />} />

              {/* Protected Routes */}
              <Route
                path="/create-ride"
                element={
                  <ProtectedRoute>
                    <CreateRide />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inbox"
                element={
                  <ProtectedRoute>
                    <Inbox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-rides"
                element={
                  <ProtectedRoute>
                    <MyRides />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-rides/:rideId"
                element={
                  <ProtectedRoute>
                    <MyRideDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tracking/:rideId"
                element={
                  <ProtectedRoute>
                    <LiveTracking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
};
