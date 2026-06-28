import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../lib/supabase";
import { Ride, Booking, Profile, Payment, Transfer } from "../types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { Avatar } from "../components/ui/Avatar";
import { 
  Car, Calendar, Users, DollarSign, MapPin, 
  Settings, Bell, CheckSquare, MessageSquare, 
  Clock, Navigation, ShieldCheck, Check, X, 
  User, Sparkles, AlertCircle, TrendingUp, Landmark, ChevronRight, XCircle
} from "lucide-react";
import { formatDate, formatTime, formatPrice } from "../lib/utils";

export const Dashboard: React.FC = () => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "rides";

  // Data States
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [driverBookings, setDriverBookings] = useState<Booking[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [transfersList, setTransfersList] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Form States
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gender, setGender] = useState<Profile["gender"]>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  
  // Driver Form States
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("sedan");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch Driver Rides
      const { data: ridesData } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("departure_date", { ascending: false });
      setDriverRides(ridesData as Ride[] || []);

      // Fetch Passenger Bookings
      const { data: bookingsData } = await supabase
        .from("ride_bookings")
        .select(`
          *,
          ride:rides(
            *,
            driver:profiles!rides_driver_id_fkey(*)
          )
        `)
        .eq("passenger_id", user.id)
        .order("created_at", { ascending: false });
      setPassengerBookings(bookingsData as unknown as Booking[] || []);

      // Fetch Payouts / Transfers
      const { data: transfersData } = await supabase
        .from("transfers")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });
      setTransfersList(transfersData as Transfer[] || []);

      // Fetch Payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select(`
          *,
          booking:ride_bookings(
            *,
            ride:rides(
              *,
              driver:profiles!rides_driver_id_fkey(*)
            )
          )
        `)
        .order("created_at", { ascending: false });
      setPaymentsList(paymentsData as unknown as Payment[] || []);

      // Fetch bookings for the driver's rides
      const driverRideIds = (ridesData as Ride[] || []).filter(r => r && r.id).map(r => r.id);
      let driverBookingsData: Booking[] = [];
      if (driverRideIds.length > 0) {
        const { data: bData } = await supabase
          .from("ride_bookings")
          .select(`
            *,
            passenger:profiles!ride_bookings_passenger_id_fkey(*),
            ride:rides(*)
          `)
          .in("ride_id", driverRideIds);
        driverBookingsData = (bData as unknown as Booking[]) || [];
      }
      setDriverBookings(driverBookingsData);

      // Prepopulate profile forms
      if (profile) {
        setFullName(profile.full_name || "");
        setAvatarUrl(profile.avatar_url || "");
        setGender(profile.gender);
        setPhoneNumber(profile.phone_number || "");
        setAge(profile.age ? String(profile.age) : "");
        setBio(profile.bio || "");
        
        if (profile.role === "driver") {
          setLicenseNumber(profile.license_number || "");
          setVehicleType(profile.vehicle_details?.type || "sedan");
          setVehicleModel(profile.vehicle_details?.model || "");
          setVehicleColor(profile.vehicle_details?.color || "");
          setVehicleNumber(profile.vehicle_details?.number || "");
          setVehicleYear(profile.vehicle_details?.year ? String(profile.vehicle_details.year) : "");
        }
      }
    } catch (e) {
      console.error("Error loading dashboard details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, profile?.role]);

  // Handle Profile Update Submission
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError("");

    try {
      const updates: Partial<Profile> = {
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || null,
        gender: gender || null,
        phone_number: phoneNumber.trim() || null,
        age: age ? parseInt(age, 10) : null,
        bio: bio.trim() || null,
      };

      if (profile?.role === "driver") {
        updates.license_number = licenseNumber.trim() || null;
        updates.vehicle_details = {
          type: vehicleType,
          model: vehicleModel.trim(),
          color: vehicleColor.trim(),
          number: vehicleNumber.trim(),
          year: vehicleYear ? parseInt(vehicleYear, 10) : new Date().getFullYear(),
        };
      }

      await updateProfile(updates);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile settings");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-slate-100 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="h-44 bg-slate-100 rounded-2xl" />
          <div className="md:col-span-3 h-96 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner Profile Summary */}
      <div className="mb-8 rounded-3xl bg-slate-900 p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-4 relative z-10">
          <Avatar
            src={profile?.avatar_url}
            fallback={profile?.full_name || "User"}
            size="xl"
            className="ring-4 ring-white/10"
          />
          <div className="text-center md:text-left space-y-1">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h2 className="text-xl font-extrabold">{profile?.full_name}</h2>
              {profile?.is_verified && <ShieldCheck className="h-5 w-5 text-blue-400" />}
            </div>
            <p className="text-xs text-slate-300 font-medium truncate max-w-xs">{user?.email}</p>
            <div className="flex gap-2 pt-1 justify-center md:justify-start">
              <Badge variant="secondary" className="capitalize text-[10px] py-0.5 px-2 bg-slate-800 border-slate-700 text-white">
                {profile?.role} Account
              </Badge>
              {profile?.role === "driver" && (
                <Badge variant="success" className="text-[10px] py-0.5 px-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  Driver Verified
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 relative z-10">
          <Link to="/find-ride">
            <Button size="sm" variant="outline" className="border-slate-800 bg-slate-900 text-white hover:bg-slate-800">
              Find Rides
            </Button>
          </Link>
          {profile?.role === "driver" && (
            <Link to="/create-ride">
              <Button size="sm">Publish Trip</Button>
            </Link>
          )}
        </div>
      </div>

      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={handleTabChange}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 items-start">
          
           {/* Tabs Menu Sidebar */}
           <div className="lg:col-span-1">
             <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white p-3 space-y-1">
               <button
                 onClick={() => handleTabChange("rides")}
                 className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "rides"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                 }`}
               >
                 <Car className="h-4.5 w-4.5" />
                 <span>My Published Rides</span>
               </button>

               <button
                 onClick={() => handleTabChange("bookings")}
                 className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "bookings"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                 }`}
               >
                 <CheckSquare className="h-4.5 w-4.5" />
                 <span>My Bookings</span>
               </button>

               <button
                 onClick={() => handleTabChange("inbox")}
                 className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "inbox"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-955"
                 }`}
               >
                 <span className="flex items-center space-x-2.5">
                   <MessageSquare className="h-4.5 w-4.5" />
                   <span>Inbox</span>
                 </span>
                 {unreadCount > 0 && (
                   <span className="bg-red-500 text-white rounded-full text-[10px] font-bold h-5 w-5 flex items-center justify-center">
                     {unreadCount}
                   </span>
                 )}
               </button>

               <button
                 onClick={() => handleTabChange("transfers")}
                 className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "transfers"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-955"
                 }`}
               >
                 <TrendingUp className="h-4.5 w-4.5" />
                 <span>Transfers</span>
               </button>

               <button
                 onClick={() => handleTabChange("payments")}
                 className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "payments"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-955"
                 }`}
               >
                 <Landmark className="h-4.5 w-4.5" />
                 <span>Payments & refunds</span>
               </button>

               <button
                 onClick={() => handleTabChange("notifications")}
                 className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "notifications"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-955"
                 }`}
               >
                 <span className="flex items-center space-x-2.5">
                   <Bell className="h-4.5 w-4.5" />
                   <span>Notifications</span>
                 </span>
                 {unreadCount > 0 && (
                   <span className="bg-red-500 text-white rounded-full text-[10px] font-bold h-5 w-5 flex items-center justify-center">
                     {unreadCount}
                   </span>
                 )}
               </button>

               <button
                 onClick={() => handleTabChange("settings")}
                 className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                   activeTab === "settings"
                     ? "bg-blue-50 text-blue-600 font-bold"
                     : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                 }`}
               >
                 <Settings className="h-4.5 w-4.5" />
                 <span>Profile Settings</span>
               </button>
             </Card>
           </div>

          {/* Content panel */}
          <div className="lg:col-span-3">
            
            {/* Tab 1: Published Rides (Driver) */}
            <TabsContent value="rides">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">My Published Rides</h3>
                    <p className="text-xs text-slate-500">Rides you published for cost-sharing passenger bookings</p>
                  </div>
                  {profile?.role === "driver" && (
                    <Link to="/create-ride">
                      <Button size="sm">Publish New Ride</Button>
                    </Link>
                  )}
                </div>

                {driverRides.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                    <Car className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-800">No Rides Published</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      You haven't scheduled any carpool trips. Set up a route to begin cost-sharing.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {driverRides.filter(Boolean).map((ride) => (
                      <div key={ride.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-md transition bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={ride.status === "scheduled" ? "info" : "success"} className="capitalize">
                              {ride.status}
                            </Badge>
                            <span className="text-[11px] text-slate-400 font-semibold">{formatDate(ride.departure_date)} @ {formatTime(ride.departure_time)}</span>
                          </div>
                          
                          <h4 className="text-base font-bold text-slate-900">
                            {ride.source} &rarr; {ride.destination}
                          </h4>
                          <span className="text-xs text-slate-500 block">
                            Pickup: {ride.pickup_location}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-50 w-full md:w-auto justify-between md:justify-end">
                          <div className="text-left md:text-right text-xs">
                            <span className="text-slate-400 block font-semibold">Available Seats</span>
                            <span className="text-slate-800 font-bold block">{ride.available_seats} of {ride.total_seats}</span>
                          </div>

                          <div className="flex gap-2">
                            <Link to={`/ride/${ride.id}`}>
                              <Button size="sm" variant="outline">Manage</Button>
                            </Link>
                            
                            {(ride.status === "scheduled" || ride.status === "active") && (
                              <Link to={`/tracking/${ride.id}`}>
                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                                  <Navigation className="mr-1.5 h-3.5 w-3.5" />
                                  Track Trip
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Tab 2: Passenger Bookings */}
            <TabsContent value="bookings">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900">My Passenger Bookings</h3>
                  <p className="text-xs text-slate-500">Bookings you requested for scheduled rides</p>
                </div>

                {passengerBookings.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                    <CheckSquare className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    <h4 className="text-sm font-bold text-slate-800">No Bookings Found</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      You haven't booked any carpools yet. Find a ride to start sharing commuting costs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {passengerBookings.filter(Boolean).map((booking) => {
                      const rideDetail = booking.ride;
                      return (
                        <div key={booking.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-md transition bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                booking.status === "pending" ? "warning" :
                                booking.status === "accepted" || booking.status === "active" ? "success" :
                                "destructive"
                              } className="capitalize">
                                {booking.status}
                              </Badge>
                              {rideDetail && (
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  {formatDate(rideDetail.departure_date)} @ {formatTime(rideDetail.departure_time)}
                                </span>
                              )}
                            </div>
                            
                            {rideDetail && (
                              <h4 className="text-base font-bold text-slate-900">
                                {rideDetail.source} &rarr; {rideDetail.destination}
                              </h4>
                            )}
                            <span className="text-xs text-slate-500 block">
                              Driver: {rideDetail?.driver?.full_name || "Verified Driver"}
                            </span>
                          </div>

                          <div className="flex items-center gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-50 w-full md:w-auto justify-between md:justify-end">
                            <div className="text-left md:text-right text-xs">
                              <span className="text-slate-400 block font-semibold">Total Cost</span>
                              <span className="text-blue-600 font-bold block">
                                {rideDetail ? formatPrice(booking.seats_booked * rideDetail.price_per_seat) : "$0.00"}
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <Link to={`/ride/${booking.ride_id}`}>
                                <Button size="sm" variant="outline">View Ride</Button>
                              </Link>
                              
                              {booking.status === "accepted" && (
                                <Link to={`/tracking/${booking.ride_id}`}>
                                  <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                                    <Navigation className="mr-1.5 h-3.5 w-3.5" />
                                    Track Driver
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Tab 3: Notifications list panel */}
            <TabsContent value="notifications">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Notification Feed</h3>
                    <p className="text-xs text-slate-500">Real-time system, chat, and status updates</p>
                  </div>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-blue-600">
                      Mark all as read
                    </Button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400 italic">
                    No notification history found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.filter(Boolean).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={async () => {
                          await markAsRead(notif.id);
                          if (notif.link_id) {
                            navigate(`/ride/${notif.link_id}`);
                          }
                        }}
                        className={`flex justify-between items-start p-4 rounded-xl border cursor-pointer hover:bg-slate-50 transition ${
                          notif.is_read ? "border-slate-100 bg-white" : "border-blue-100 bg-blue-50/10"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                            {!notif.is_read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
                          </div>
                          <p className="text-xs text-slate-500">{notif.content}</p>
                          <span className="text-[9px] text-slate-400 block">{formatDate(notif.created_at)}</span>
                        </div>

                        {!notif.is_read && (
                          <button className="text-[10px] text-blue-600 font-bold hover:underline">
                            Mark Read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Tab 4: Profile Settings */}
            <TabsContent value="settings">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="mb-6 border-b border-slate-50 pb-4">
                  <h3 className="text-lg font-bold text-slate-900">Profile Settings</h3>
                  <p className="text-xs text-slate-500">Edit your user details, photos, and vehicle registration info</p>
                </div>

                {profileSuccess && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-700 border border-emerald-100 mb-6">
                    <Check className="h-4.5 w-4.5" />
                    <span>Profile settings updated successfully!</span>
                  </div>
                )}

                {profileError && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100 mb-6">
                    <AlertCircle className="h-4.5 w-4.5" />
                    <span>{profileError}</span>
                  </div>
                )}

                <form onSubmit={handleProfileSave} className="space-y-6">
                  {/* General Profile info */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">General Information</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Full Name"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />

                      <Input
                        label="Profile Photo URL"
                        placeholder="Paste image address..."
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                        <select
                          value={gender || ""}
                          onChange={(e) => setGender(e.target.value as Profile["gender"] || null)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none"
                        >
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <Input
                        label="Phone Number"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />

                      <Input
                        label="Age"
                        type="number"
                        min="18"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Personal Biography</label>
                      <textarea
                        placeholder="Tell passenger and drivers about yourself..."
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Driver credentials settings */}
                  {profile?.role === "driver" && (
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Driver registration & Vehicle</h4>
                      
                      <Input
                        label="Driver's License Number"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vehicle Type</label>
                          <select
                            value={vehicleType}
                            onChange={(e) => setVehicleType(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none"
                          >
                            <option value="sedan">Sedan</option>
                            <option value="suv">SUV</option>
                            <option value="hatchback">Hatchback</option>
                            <option value="ev">Electric (EV)</option>
                          </select>
                        </div>

                        <Input
                          label="Model & Make"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="License Plate"
                          value={vehicleNumber}
                          onChange={(e) => setVehicleNumber(e.target.value)}
                        />

                        <Input
                          label="Color"
                          value={vehicleColor}
                          onChange={(e) => setVehicleColor(e.target.value)}
                        />

                        <Input
                          label="Year"
                          type="number"
                          value={vehicleYear}
                          onChange={(e) => setVehicleYear(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" loading={profileSaving}>
                      Save Updates
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>

            {/* Tab 5: Inbox */}
            <TabsContent value="inbox">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900 font-black tracking-tight">Your Conversations</h3>
                  <p className="text-xs text-slate-500">Communicate with your carpooling passengers and drivers</p>
                </div>

                <div className="space-y-6">
                  {/* Passenger Conversations */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">As Passenger Chats</h4>
                    {passengerBookings.filter(b => b && (b.status === "accepted" || b.status === "active" || b.status === "completed")).length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-4 bg-slate-50 border border-dashed rounded-2xl text-center">
                        No passenger chats found. Go book a ride to start messaging!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {passengerBookings.filter(b => b && (b.status === "accepted" || b.status === "active" || b.status === "completed")).map((b) => (
                          <div key={b.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border border-slate-100 rounded-2xl p-4 bg-white hover:bg-slate-50/50 transition gap-4">
                            <div className="flex items-center space-x-3">
                              <Avatar src={b.ride?.driver?.avatar_url} fallback={b.ride?.driver?.full_name || "Driver"} size="md" />
                              <div>
                                <span className="block font-bold text-slate-900 text-sm">{b.ride?.driver?.full_name}</span>
                                <span className="text-xs text-slate-500 font-medium">{b.ride?.source} &rarr; {b.ride?.destination}</span>
                                <span className="text-[10px] text-slate-400 block font-semibold">Travel Date: {formatDate(b.ride?.departure_date || "")}</span>
                              </div>
                            </div>
                            <Link to={`/inbox?tab=messages&ride_id=${b.ride_id}&passenger_id=${user?.id}`} className="w-full sm:w-auto">
                              <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                Open Chat Hub
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Driver Conversations */}
                  <div className="space-y-3 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">As Driver Chats</h4>
                    {driverBookings.filter(b => b && (b.status === "accepted" || b.status === "active" || b.status === "completed")).length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-4 bg-slate-50 border border-dashed rounded-2xl text-center">
                        No passenger bookings found on your published rides.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {driverBookings.filter(b => b && (b.status === "accepted" || b.status === "active" || b.status === "completed")).map((b) => (
                          <div key={b.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center border border-slate-100 rounded-2xl p-4 bg-white hover:bg-slate-50/50 transition gap-4">
                            <div className="flex items-center space-x-3">
                              <Avatar src={b.passenger?.avatar_url} fallback={b.passenger?.full_name || "Passenger"} size="md" />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="block font-bold text-slate-900 text-sm">{b.passenger?.full_name}</span>
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5">Passenger</Badge>
                                </div>
                                <span className="text-xs text-slate-500 font-medium">{b.ride?.source} &rarr; {b.ride?.destination}</span>
                                <span className="text-[10px] text-slate-400 block font-semibold">Travel Date: {formatDate(b.ride?.departure_date || "")}</span>
                              </div>
                            </div>
                            <Link to={`/inbox?tab=messages&ride_id=${b.ride_id}&passenger_id=${b.passenger_id}`} className="w-full sm:w-auto">
                              <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                Chat with Passenger
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Tab 6: Transfers (Earnings) */}
            <TabsContent value="transfers">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 font-black tracking-tight">Transfers & Earnings</h3>
                    <p className="text-xs text-slate-500">View payout transfers completed for your passenger bookings</p>
                  </div>
                  <Badge variant="success" className="py-1 px-3">Payouts Gateway Active</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  {/* Total Paid Out */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left relative overflow-hidden">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Total Earnings Paid Out</span>
                    <span className="text-3xl font-black text-slate-900 mt-1 block">
                      {formatPrice(transfersList.filter(t => t && t.status === "completed").reduce((sum, t) => sum + Number(t.amount), 0))}
                    </span>
                    <span className="text-[9px] text-emerald-600 font-semibold block mt-1.5">✓ All transfers completed successfully</span>
                  </div>

                  {/* Pending payouts */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Pending Payouts</span>
                    <span className="text-3xl font-black text-blue-600 mt-1 block">$0.00</span>
                    <span className="text-[9px] text-slate-400 block mt-1.5">No payouts currently processing</span>
                  </div>

                  {/* Bank detail mockup */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Payout Destination Bank</span>
                      <span className="text-sm font-bold text-slate-900 block mt-1.5">Chase Checking Account</span>
                      <span className="text-xs text-slate-500 block">Routing: ••••5678 | Account: ••••1234</span>
                    </div>
                  </div>
                </div>

                {/* Transfers Table list */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5">Payout Statements</h4>
                {transfersList.length === 0 ? (
                  <div className="text-center py-10 border border-dashed rounded-2xl bg-slate-50/20 text-xs text-slate-400 italic">
                    No payouts have been processed yet. Publish rides to earn seats shares.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-slate-400 uppercase font-bold tracking-wider">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Bank Account</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4 text-right">Payout Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-55 bg-white">
                        {transfersList.filter(Boolean).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-4 font-semibold text-slate-900">{formatDate(t.created_at)}</td>
                            <td className="py-3 px-4 text-slate-500">{t.bank_name} ({t.account_number})</td>
                            <td className="py-3 px-4 font-bold text-slate-950">{formatPrice(Number(t.amount))}</td>
                            <td className="py-3 px-4 text-right">
                              <Badge variant={t.status === "completed" ? "success" : t.status === "pending" ? "warning" : "destructive"}>
                                {t.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Tab 7: Payments & Refunds */}
            <TabsContent value="payments">
              <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl p-6">
                <div className="mb-6 border-b border-slate-50 pb-4">
                  <h3 className="text-lg font-bold text-slate-900 font-black tracking-tight">Payments & Refunds</h3>
                  <p className="text-xs text-slate-500">Manage payment options and view booking transactions history</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Credit Card mockup card */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-44 border border-slate-800">
                    <div className="absolute top-0 right-0 h-32 w-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Default Payment Card</span>
                        <span className="text-base font-bold tracking-widest mt-1 block">Visa Card</span>
                      </div>
                      <span className="text-lg font-black italic">VISA</span>
                    </div>

                    <div className="text-lg font-bold tracking-widest font-mono py-1">
                      •••• •••• •••• 4321
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <div>
                        <span className="text-[8px] block uppercase font-bold tracking-wide">Holder</span>
                        <span className="text-white font-semibold block">{profile?.full_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] block uppercase font-bold tracking-wide">Expires</span>
                        <span className="text-white font-semibold block">12/28</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment manager configuration details */}
                  <div className="border border-slate-100 rounded-3xl p-5 flex flex-col justify-between bg-slate-50/30">
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-slate-800">Secure Billing Details</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Your billing profile is securely synchronized with Stripe. Auto-pay is activated to seamlessly book seats on approved rides.
                      </p>
                    </div>
                    <Button variant="outline" className="w-full text-xs py-2 bg-white mt-4">
                      Update Credit Card Details
                    </Button>
                  </div>
                </div>

                {/* Payments history */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Billing Transaction History</h4>
                {paymentsList.length === 0 ? (
                  <div className="text-center py-10 border border-dashed rounded-2xl bg-slate-50/20 text-xs text-slate-400 italic">
                    No transactions found. Book seats on a ride to generate transaction records.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-slate-400 uppercase font-bold tracking-wider">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Ride Route</th>
                          <th className="py-3 px-4">Payment Method</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 bg-white">
                        {paymentsList.filter(Boolean).map((p) => {
                          const route = p.booking?.ride;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 px-4 font-semibold text-slate-900">{formatDate(p.created_at)}</td>
                              <td className="py-3 px-4 text-slate-800 font-bold">
                                {route ? `${route.source} → ${route.destination}` : "Carpool Booking Fee"}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-medium">{p.payment_method}</td>
                              <td className="py-3 px-4 font-black text-slate-950">{formatPrice(Number(p.amount))}</td>
                              <td className="py-3 px-4">
                                <Badge variant={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "destructive"}>
                                  {p.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {p.status === "paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => alert("Refund claim request submitted to administration for review.")}
                                    className="py-1 px-3 text-[10px]"
                                  >
                                    Claim Refund
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  );
};
