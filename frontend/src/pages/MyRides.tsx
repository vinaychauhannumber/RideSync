import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Ride } from "../types";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import {
  Car, Calendar, Users, DollarSign, Search, Trash2, Edit, Copy, Eye,
  SlidersHorizontal, CheckCircle2, AlertCircle, Compass, Zap, HelpCircle, RefreshCw, X, Navigation2
} from "lucide-react";
import { formatDate, formatTime, formatPrice } from "../lib/utils";

// Arrival details calculation
const getArrivalDetails = (dateStr: string, timeStr: string, durationMin: number | null) => {
  if (!durationMin) {
    durationMin = 120; // 2 hour default
  }
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(`${dateStr}T${timeStr}`);
    let arrHours = 0;
    let arrMins = 0;

    if (isNaN(date.getTime())) {
      const depMinutes = hours * 60 + minutes;
      const arrMinutes = depMinutes + durationMin;
      arrHours = Math.floor(arrMinutes / 60) % 24;
      arrMins = arrMinutes % 60;
    } else {
      const arrDate = new Date(date.getTime() + durationMin * 60000);
      arrHours = arrDate.getHours();
      arrMins = arrDate.getMinutes();
    }

    const timeFormatted = `${String(arrHours).padStart(2, "0")}:${String(arrMins).padStart(2, "0")}`;
    const hrs = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    return {
      time: timeFormatted,
      durationText: hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
    };
  } catch (e) {
    return { time: "N/A", durationText: "N/A" };
  }
};

export const MyRides: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Role Tab State
  const [roleTab, setRoleTab] = useState<"driver" | "passenger">("driver");

  // Sync roleTab with URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roleParam = params.get("role");
    if (roleParam === "driver" || roleParam === "passenger") {
      setRoleTab(roleParam);
    }
  }, [location.search]);

  // Statistics
  const [stats, setStats] = useState({
    published: 0,
    upcoming: 0,
    completed: 0,
    passengers: 0,
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"upcoming" | "active" | "completed" | "cancelled">("upcoming");
  const [instantBookingFilter, setInstantBookingFilter] = useState(false);

  // Cancellation Modal States
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchMyRides = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (roleTab === "driver") {
        const { data, error: ridesError } = await supabase
          .from("rides")
          .select(`
            *,
            ride_bookings(
              id,
              seats_booked,
              status,
              passenger:profiles!ride_bookings_passenger_id_fkey(full_name, avatar_url)
            )
          `)
          .eq("driver_id", user.id)
          .order("departure_date", { ascending: true })
          .order("departure_time", { ascending: true });

        if (ridesError) throw ridesError;

        const rideList = data || [];
        setRides(rideList);

        // Aggregate Stats
        const published = rideList.length;
        const upcoming = rideList.filter((r) => r.status === "scheduled").length;
        const completed = rideList.filter((r) => r.status === "completed").length;

        let passengers = 0;
        rideList.forEach((r) => {
          const bookings = r.ride_bookings || [];
          bookings.forEach((b: any) => {
            if (b.status === "accepted" || b.status === "completed" || b.status === "active") {
              passengers += b.seats_booked;
            }
          });
        });

        setStats({ published, upcoming, completed, passengers });
      } else {
        // Fetch as passenger (bookings)
        const { data, error: bookingsError } = await supabase
          .from("ride_bookings")
          .select(`
            *,
            ride:rides(
              *,
              driver:profiles!rides_driver_id_fkey(full_name, avatar_url)
            )
          `)
          .eq("passenger_id", user.id);

        if (bookingsError) throw bookingsError;

        const mappedRides = (data || []).map((booking: any) => ({
          ...booking.ride,
          booking_id: booking.id,
          booking_status: booking.status,
          seats_booked: booking.seats_booked,
          ride_bookings: [booking] // For UI compatibility
        }));

        mappedRides.sort((a, b) => {
          const dateA = new Date(`${a.departure_date}T${a.departure_time}`);
          const dateB = new Date(`${b.departure_date}T${b.departure_time}`);
          return dateA.getTime() - dateB.getTime();
        });

        setRides(mappedRides);

        const published = mappedRides.length; // "Booked"
        const upcoming = mappedRides.filter(r => r.booking_status === "pending" || r.booking_status === "accepted").length;
        const completed = mappedRides.filter(r => r.booking_status === "completed" || r.status === "completed").length;
        
        let passengers = 0; // Number of seats booked by this user
        mappedRides.forEach(r => {
          if (r.booking_status === "accepted" || r.booking_status === "completed" || r.booking_status === "active") {
            passengers += r.seats_booked;
          }
        });

        setStats({ published, upcoming, completed, passengers });
      }
    } catch (err: any) {
      console.error("Error fetching published rides:", err);
      setError(err.message || "Failed to load your rides");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRides();
  }, [user, roleTab]);

  // Cancel handler (handles both driver cancelling ride and passenger cancelling booking)
  const handleCancelRide = async () => {
    if (!selectedRideId) return;
    setCancelling(true);
    try {
      if (roleTab === "driver") {
        const { error: cancelError } = await supabase
          .from("rides")
          .update({ status: "cancelled" })
          .eq("id", selectedRideId);

        if (cancelError) throw cancelError;

        await supabase
          .from("ride_bookings")
          .update({ status: "cancelled" })
          .eq("ride_id", selectedRideId)
          .eq("status", "pending");
      } else {
        // Cancel booking
        if (selectedBookingId) {
          const { error: cancelBookingError } = await supabase
            .from("ride_bookings")
            .update({ status: "cancelled" })
            .eq("id", selectedBookingId);
          if (cancelBookingError) throw cancelBookingError;
        }
      }

      setCancelModalOpen(false);
      setSelectedRideId(null);
      setSelectedBookingId(null);
      await fetchMyRides();
    } catch (err: any) {
      console.error("Cancel ride error:", err);
      alert(err.message || "Failed to cancel ride/booking");
    } finally {
      setCancelling(false);
    }
  };

  // Filter rides list
  const filteredRides = rides.filter((ride) => {
    // Tab filter
    if (roleTab === "driver") {
      const status = ride.status;
      if (activeTab === "upcoming" && status !== "scheduled") return false;
      if (activeTab === "active" && status !== "active") return false;
      if (activeTab === "completed" && status !== "completed") return false;
      if (activeTab === "cancelled" && status !== "cancelled") return false;
    } else {
      const status = ride.booking_status;
      if (activeTab === "upcoming" && status !== "pending" && status !== "accepted") return false;
      // If ride is active and booking is accepted
      if (activeTab === "active" && ride.status !== "active") return false; 
      if (activeTab === "completed" && status !== "completed" && ride.status !== "completed") return false;
      if (activeTab === "cancelled" && status !== "cancelled" && status !== "rejected" && ride.status !== "cancelled") return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchSource = ride.source.toLowerCase().includes(query);
      const matchDest = ride.destination.toLowerCase().includes(query);
      if (!matchSource && !matchDest) return false;
    }

    // Instant Booking checkbox
    if (instantBookingFilter && !ride.instant_booking) return false;

    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Rides</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track all your carpool journeys</p>
        </div>

        {/* Role Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setRoleTab("driver")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition ${
              roleTab === "driver"
                ? "bg-white text-blue-600 shadow-sm border border-slate-200/60"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            As a Publisher (Driver)
          </button>
          <button
            onClick={() => setRoleTab("passenger")}
            className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition ${
              roleTab === "passenger"
                ? "bg-white text-emerald-600 shadow-sm border border-slate-200/60"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            As a Passenger (Rider)
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: roleTab === "driver" ? "Published Rides" : "Booked Rides", val: stats.published, desc: "Total created" },
          { label: "Upcoming", val: stats.upcoming, desc: "Scheduled trips" },
          { label: "Completed", val: stats.completed, desc: "Finished trips" },
          { label: roleTab === "driver" ? "Total Passengers" : "Seats Booked", val: stats.passengers, desc: "Accepted seats" }
        ].map((stat, idx) => (
          <Card key={idx} className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">{stat.label}</span>
            <span className="text-3xl font-black text-slate-900 block mt-1.5">{stat.val}</span>
            <span className="text-[10px] text-slate-400 font-semibold block mt-1">{stat.desc}</span>
          </Card>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        {/* Tabs */}
        <div className="flex border border-slate-200 bg-slate-100/50 p-1.5 rounded-2xl gap-1 overflow-x-auto self-start">
          {[
            { id: "upcoming", label: "Upcoming" },
            { id: "active", label: "Active" },
            { id: "completed", label: "Completed" },
            { id: "cancelled", label: "Cancelled" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative flex-grow sm:w-60">
            <Input
              placeholder="Search by city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 py-2 text-xs rounded-xl border-slate-200"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          </div>

          {/* Instant checkbox */}
          <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs text-slate-700 font-bold cursor-pointer hover:border-slate-300 transition shrink-0 select-none">
            <input
              type="checkbox"
              checked={instantBookingFilter}
              onChange={(e) => setInstantBookingFilter(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span>⚡ Instant Booking</span>
          </label>
        </div>
      </div>

      {/* Rides List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-44 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      ) : filteredRides.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-slate-200 rounded-3xl bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 mb-6">
            <Car className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            {searchQuery.trim() || instantBookingFilter
              ? "No matching rides found"
              : `You have no ${activeTab} rides as a ${roleTab}`}
          </h3>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            {searchQuery.trim() || instantBookingFilter
              ? "Try modifying your search query or clear filters to see your list."
              : roleTab === "driver" 
                ? "Help other commuters save travel costs by sharing your empty car seats."
                : "Search and book a ride to start your journey."}
          </p>
          <div className="mt-6 flex gap-3">
            {roleTab === "driver" ? (
              <Link to="/create-ride">
                <Button className="px-6 py-2.5 font-bold rounded-xl shadow-lg bg-blue-600 hover:bg-blue-700">Publish a Ride</Button>
              </Link>
            ) : (
              <Link to="/find-ride">
                <Button className="px-6 py-2.5 font-bold rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700">Find a Ride</Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRides.map((ride) => {
            const arr = getArrivalDetails(ride.departure_date, ride.departure_time, ride.estimated_duration);
            const totalBookings = ride.ride_bookings || [];
            
            // Sum of accepted passenger seats
            const acceptedSeats = totalBookings
              .filter((b: any) => b.status === "accepted" || b.status === "completed" || b.status === "active")
              .reduce((sum: number, b: any) => sum + b.seats_booked, 0);

            // Sum of pending seats
            const pendingCount = totalBookings.filter((b: any) => b.status === "pending").length;

            // Determine badge status to show
            let statusBadge = ride.status;
            let statusVariant = "info";
            
            if (roleTab === "passenger") {
              statusBadge = ride.booking_status;
              if (ride.status === "cancelled") {
                statusBadge = "ride cancelled";
              }
              statusVariant = 
                statusBadge === "accepted" || statusBadge === "completed" ? "success" :
                statusBadge === "pending" ? "warning" : "destructive";
            } else {
               statusVariant = ride.status === "scheduled" || ride.status === "active" ? "info" : ride.status === "completed" ? "success" : "destructive";
               if (ride.status === "scheduled") statusBadge = "published";
            }

            return (
              <Card key={ride.id} className="overflow-hidden border border-slate-100 hover:border-slate-200 hover:shadow-md transition duration-200 rounded-3xl bg-white">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    
                    {/* Route Details */}
                    <div className="flex-1 space-y-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusVariant as any} className="capitalize py-1 px-3">
                          {statusBadge}
                        </Badge>
                        {ride.status === "active" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            <Navigation2 className="h-3 w-3" /> Live Tracking
                          </span>
                        )}
                        {ride.instant_booking && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-800 bg-amber-50 border border-amber-200/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            <Zap className="h-3 w-3 fill-current" /> Instant Book
                          </span>
                        )}
                        {roleTab === "driver" && pendingCount > 0 && (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full animate-pulse">
                            {pendingCount} Request{pendingCount !== 1 ? "s" : ""} Pending
                          </span>
                        )}
                      </div>

                      {/* Visual Timeline */}
                      <div className="flex items-center justify-between gap-4 max-w-lg">
                        <div className="text-left shrink-0">
                          <span className="text-lg font-black text-slate-900 block">{formatTime(ride.departure_time)}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate max-w-[120px]">{ride.source.split(",")[0]}</span>
                        </div>

                        <div className="flex-grow flex flex-col items-center">
                          <span className="text-[10px] text-slate-400 font-mono font-bold">{arr.durationText}</span>
                          <div className="w-full flex items-center gap-1.5 my-1">
                            <div className="h-2 w-2 rounded-full border-2 border-slate-300 bg-white"></div>
                            <div className="flex-grow h-[1px] border-t border-dashed border-slate-300"></div>
                            <div className="h-2 w-2 rounded-full border-2 border-slate-300 bg-white"></div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-slate-900 block">{arr.time}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate max-w-[120px]">{ride.destination.split(",")[0]}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats & Pricing */}
                    <div className="flex flex-wrap lg:flex-col lg:items-end justify-between items-center gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-50 text-right">
                      <div className="flex gap-4 items-center">
                        {roleTab === "driver" ? (
                          <>
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Vehicle</span>
                              <span className="text-xs font-bold text-slate-700 block mt-0.5 capitalize">{ride.vehicle_type}</span>
                            </div>
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Seats Reserved</span>
                              <span className="text-xs font-bold text-slate-700 block mt-0.5">{acceptedSeats} / {ride.total_seats} booked</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Driver</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {ride.driver?.avatar_url && (
                                  <img src={ride.driver.avatar_url} className="w-4 h-4 rounded-full" alt="driver" />
                                )}
                                <span className="text-xs font-bold text-slate-700 capitalize">{ride.driver?.full_name?.split(' ')[0]}</span>
                              </div>
                            </div>
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Your Seats</span>
                              <span className="text-xs font-bold text-slate-700 block mt-0.5">{ride.seats_booked} booked</span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex gap-4 items-center lg:mt-2">
                        <div>
                          <span className="text-2xl font-black text-slate-900 block">₹{Math.round(ride.price_per_seat * (roleTab === "passenger" ? ride.seats_booked : 1))}</span>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">
                            {roleTab === "passenger" ? "total price" : "per seat"}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-wrap gap-2.5">
                      <span>Date: <strong className="text-slate-600">{formatDate(ride.departure_date)}</strong></span>
                      {roleTab === "driver" && (
                        <>
                          <span>&bull;</span>
                          <span>Earn up to: <strong className="text-emerald-600">₹{Math.round(ride.price_per_seat * ride.total_seats)}</strong></span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <Link to={roleTab === "driver" ? `/my-rides/${ride.id}` : `/ride/${ride.id}`} className="flex-1 sm:flex-none">
                        <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1 text-xs rounded-xl">
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          <span>View Details</span>
                        </Button>
                      </Link>

                      {(ride.status === "active" || ride.status === "scheduled") && (
                        <Link to={`/live-tracking/${ride.id}`} className="flex-1 sm:flex-none">
                          <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1 text-xs rounded-xl border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
                            <Navigation2 className="h-3.5 w-3.5" />
                            <span>Live Tracking</span>
                          </Button>
                        </Link>
                      )}

                      {roleTab === "driver" && ride.status === "scheduled" && (
                        <Link to={`/my-rides/${ride.id}?edit=true`} className="flex-grow sm:flex-none">
                          <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit Ride</span>
                          </Button>
                        </Link>
                      )}

                      {roleTab === "driver" && (
                        <Link to={`/create-ride?clone_id=${ride.id}`} className="flex-1 sm:flex-none">
                          <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50">
                            <Copy className="h-3.5 w-3.5" />
                            <span>Duplicate</span>
                          </Button>
                        </Link>
                      )}

                      {roleTab === "driver" && ride.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRideId(ride.id);
                            setCancelModalOpen(true);
                          }}
                          className="flex-grow sm:flex-none rounded-xl border-red-100 text-red-500 hover:bg-red-50 text-xs flex items-center justify-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Cancel Ride</span>
                        </Button>
                      )}

                      {roleTab === "passenger" && (ride.booking_status === "pending" || ride.booking_status === "accepted") && ride.status === "scheduled" && (
                         <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           setSelectedBookingId(ride.booking_id);
                           setCancelModalOpen(true);
                         }}
                         className="flex-grow sm:flex-none rounded-xl border-red-100 text-red-500 hover:bg-red-50 text-xs flex items-center justify-center gap-1"
                       >
                         <Trash2 className="h-3.5 w-3.5" />
                         <span>Cancel Booking</span>
                       </Button>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 space-y-4 animate-scale-up">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Cancel this {roleTab === "driver" ? "trip" : "booking"}?</h3>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                {roleTab === "driver" 
                  ? "Are you sure you want to cancel this ride? All pending bookings will be declined and accepted passengers will be notified." 
                  : "Are you sure you want to cancel your seat booking? The driver will be notified."}
                {" "}This action cannot be undone.
              </p>
            </div>
            <div className="pt-2 flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelModalOpen(false);
                  setSelectedRideId(null);
                  setSelectedBookingId(null);
                }}
                className="flex-1 py-2 text-xs font-bold rounded-xl"
              >
                No, Keep It
              </Button>
              <Button
                onClick={handleCancelRide}
                loading={cancelling}
                className="flex-1 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 rounded-xl"
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
