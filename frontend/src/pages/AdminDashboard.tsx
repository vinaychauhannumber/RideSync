import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Profile, Ride, Booking } from "../types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { Users, Car, Calendar, ShieldCheck, AlertCircle, TrendingUp, Check, CheckSquare } from "lucide-react";
import { formatDate } from "../lib/utils";

export const AdminDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [ridesList, setRidesList] = useState<Ride[]>([]);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRides: 0,
    totalBookings: 0,
    verifiedDrivers: 0,
  });

  const checkAdminAccess = () => {
    if (!profile || profile.role !== "admin") {
      navigate("/dashboard");
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: usersData, error: usersErr } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (usersErr) throw usersErr;
      const profiles = (usersData as Profile[]) || [];
      setUsersList(profiles);

      // 2. Fetch Rides
      const { data: ridesData, error: ridesErr } = await supabase
        .from("rides")
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(*)
        `)
        .order("departure_date", { ascending: false });
      if (ridesErr) throw ridesErr;
      const rides = (ridesData as unknown as Ride[]) || [];
      setRidesList(rides);

      // 3. Fetch Bookings
      const { data: bookingsData, error: bookingsErr } = await supabase
        .from("ride_bookings")
        .select(`
          *,
          ride:rides(*),
          passenger:profiles!ride_bookings_passenger_id_fkey(*)
        `)
        .order("created_at", { ascending: false });
      if (bookingsErr) throw bookingsErr;
      setBookingsList((bookingsData as unknown as Booking[]) || []);

      // Calculate Stats
      setStats({
        totalUsers: profiles.length,
        totalRides: rides.length,
        totalBookings: bookingsData?.length || 0,
        verifiedDrivers: profiles.filter((p) => p.role === "driver" && p.is_verified).length,
      });
    } catch (e) {
      console.error("Admin data fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: !currentStatus })
        .eq("id", userId);

      if (error) throw error;
      
      // Refresh local list state
      setUsersList((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, is_verified: !currentStatus } : p))
      );
      setStats((prev) => ({
        ...prev,
        verifiedDrivers: prev.verifiedDrivers + (currentStatus ? -1 : 1),
      }));
    } catch (e) {
      console.error("Verification error:", e);
    }
  };

  useEffect(() => {
    checkAdminAccess();
    if (profile?.role === "admin") {
      fetchAdminData();
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
        <div className="h-10 w-44 bg-slate-100 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <span>Admin Portal</span>
          <Badge variant="destructive">SYSTEM ADMIN</Badge>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Platform-wide statistics and driver verification panel</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { title: "Total Users", val: stats.totalUsers, icon: <Users className="h-5 w-5 text-blue-600" /> },
          { title: "Active Route Rides", val: stats.totalRides, icon: <Car className="h-5 w-5 text-cyan-600" /> },
          { title: "Total Booked Seats", val: stats.totalBookings, icon: <CheckSquare className="h-5 w-5 text-emerald-600" /> },
          { title: "Verified Drivers", val: stats.verifiedDrivers, icon: <ShieldCheck className="h-5 w-5 text-amber-600" /> },
        ].map((stat, i) => (
          <Card key={i} className="border border-slate-100 shadow-sm bg-white rounded-2xl p-5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold uppercase">{stat.title}</span>
              <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center border">
                {stat.icon}
              </div>
            </div>
            <p className="text-2xl font-black text-slate-950 mt-2">{stat.val}</p>
          </Card>
        ))}
      </div>

      {/* Driver Verification Management */}
      <Card className="border border-slate-100 shadow-md bg-white rounded-3xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900">User Registrations & Verification</h3>
          <p className="text-xs text-slate-500">Approve licenses and verify driver registrations</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Account Type</th>
                <th className="py-3.5 px-4">License Number</th>
                <th className="py-3.5 px-4">Vehicle Detail</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-50">
              {usersList.map((usr) => (
                <tr key={usr.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <Avatar src={usr.avatar_url} fallback={usr.full_name} size="sm" />
                    <div>
                      <span className="block font-bold text-slate-950">{usr.full_name}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(usr.created_at)}</span>
                    </div>
                  </td>
                  
                  <td className="py-3 px-4 capitalize">
                    <Badge variant={usr.role === "admin" ? "destructive" : usr.role === "driver" ? "info" : "secondary"}>
                      {usr.role}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 font-mono text-xs">
                    {usr.license_number || <span className="text-slate-300">N/A</span>}
                  </td>

                  <td className="py-3 px-4 text-xs">
                    {usr.vehicle_details ? (
                      <span className="capitalize">
                        {usr.vehicle_details.color} {usr.vehicle_details.model} ({usr.vehicle_details.number})
                      </span>
                    ) : (
                      <span className="text-slate-300">No Vehicle</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <Badge variant={usr.is_verified ? "success" : "warning"}>
                      {usr.is_verified ? "Verified" : "Pending Verification"}
                    </Badge>
                  </td>

                  <td className="py-3 px-4 text-right">
                    {usr.role === "driver" && (
                      <Button
                        size="sm"
                        variant={usr.is_verified ? "outline" : "primary"}
                        onClick={() => handleToggleVerification(usr.id, usr.is_verified)}
                        className="py-1 px-3 text-xs"
                      >
                        {usr.is_verified ? "Revoke Approval" : "Approve License"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
