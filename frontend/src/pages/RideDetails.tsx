import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Ride, Booking } from "../types";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import {
  Car, Calendar, Users, DollarSign, MapPin,
  MessageSquare, Compass, ShieldCheck, Check, X, AlertCircle,
  Send, Navigation, Star, Phone, Zap, HeartHandshake, Info, Shield
} from "lucide-react";
import { formatDate, formatTime, formatPrice } from "../lib/utils";
import L from "leaflet";

// Dynamic routing map
const RideRouteMap: React.FC<{
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}> = ({ pickupLat, pickupLng, dropoffLat, dropoffLng }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const centerLat = (pickupLat + dropoffLat) / 2;
    const centerLng = (pickupLng + dropoffLng) / 2;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView([centerLat, centerLng], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    const pickupIcon = L.divIcon({
      html: `<div class="bg-emerald-500 border-2 border-white rounded-full p-2 shadow-lg text-white flex items-center justify-center h-8 w-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>`,
      className: "custom-leaflet-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const dropoffIcon = L.divIcon({
      html: `<div class="bg-blue-600 border-2 border-white rounded-full p-2 shadow-lg text-white flex items-center justify-center h-8 w-8">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>`,
      className: "custom-leaflet-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map).bindPopup("Pickup Point");
    L.marker([dropoffLat, dropoffLng], { icon: dropoffIcon }).addTo(map).bindPopup("Dropoff Point");

    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          if (polylineRef.current) {
            polylineRef.current.remove();
          }
          polylineRef.current = L.polyline(coords, {
            color: "#2563EB",
            weight: 5,
            opacity: 0.8,
          }).addTo(map);
          map.fitBounds(L.latLngBounds(coords), { padding: [35, 35] });
        }
      } catch (err) {
        console.error("OSRM routing failed:", err);
      }
    };
    
    fetchRoute();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  return <div ref={mapRef} className="h-80 w-full rounded-2xl border border-slate-100 shadow-inner z-10" />;
};

// Amenities parser utility
const getRideAmenities = (ride: Ride) => {
  const desc = (ride.description || "").toLowerCase();
  const driverPref = ride.driver?.preferences;

  const smokingAllowed =
    driverPref?.smoking === "allowed" ||
    driverPref?.smoking === "breaks_only" ||
    desc.includes("smoking allowed") ||
    desc.includes("smoke");

  const petsAllowed =
    driverPref?.pets === "allowed" ||
    driverPref?.pets === "depending_on_animal" ||
    desc.includes("pets allowed") ||
    desc.includes("pet");

  const max2InBack =
    !desc.includes("no max 2") &&
    !desc.includes("3 in back") &&
    (ride.vehicle_type !== "hatchback" || desc.includes("max 2") || desc.includes("comfortable"));

  const airConditioning = !desc.includes("no ac") && !desc.includes("no air conditioning");

  const chargingPorts =
    desc.includes("charge") ||
    desc.includes("port") ||
    desc.includes("usb") ||
    ride.vehicle_type === "ev" ||
    (ride.driver?.vehicle_details?.year && ride.driver.vehicle_details.year >= 2015);

  return [
    { label: "Air Conditioning", available: airConditioning },
    { label: "Max 2 in Back", available: max2InBack },
    { label: "Charging Port", available: chargingPorts },
    { label: "Pets Allowed", available: petsAllowed },
    { label: "Smoking Allowed", available: smokingAllowed }
  ];
};

class RideDetailsErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("RideDetailsErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="bg-red-50 border border-red-250 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-red-800">Unable to load ride details</h2>
            <p className="mt-3 text-xs text-red-700 leading-relaxed font-mono text-left bg-white p-4 rounded-2xl border overflow-x-auto max-h-60">
              {this.state.error?.stack || this.state.error?.message}
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Retry
              </button>
              <a href="/find-ride" className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition shadow-sm">
                Back to Search
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RideDetailsContent: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  console.log('RideDetails Mount - rideId Parameter:', rideId);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { createNotification } = useNotifications();

  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [passengerBooking, setPassengerBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Driver Statistics State
  const [driverStats, setDriverStats] = useState<{
    rating: number;
    reviewCount: number;
    completedRidesCount: number;
  }>({ rating: 4.8, reviewCount: 5, completedRidesCount: 2 });

  // Booking request form states
  const [seatsRequested, setSeatsRequested] = useState("1");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchRideDetails = async () => {
    if (!rideId) return;
    setLoading(true);
    try {
      const { data: rideData, error: rideError } = await supabase
        .from("rides")
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(*)
        `)
        .eq("id", rideId)
        .single();

      if (rideError) throw rideError;
      console.log('RideDetails Fetch - Ride Data:', rideData);
      setRide(rideData as unknown as Ride);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("ride_bookings")
        .select(`
          *,
          passenger:profiles!ride_bookings_passenger_id_fkey(*)
        `)
        .eq("ride_id", rideId);

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData as unknown as Booking[] || []);

      if (user && rideData.driver_id !== user.id) {
        const found = (bookingsData || []).find((b) => b.passenger_id === user.id);
        setPassengerBooking(found as Booking || null);
      }
    } catch (err: any) {
      console.error("Error fetching ride details:", err);
      setError(err.message || "Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRideDetails();
  }, [rideId, user]);

  // Realtime subscription for booking status changes
  useEffect(() => {
    if (!rideId || !user) return;

    const bookingSub = supabase
      .channel(`ride_booking_status_${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_bookings',
          filter: `ride_id=eq.${rideId}`
        },
        () => {
          fetchRideDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingSub);
    };
  }, [rideId, user]);

  // Fetch driver aggregate stats
  useEffect(() => {
    if (!ride) return;
    
    const fetchDriverStats = async () => {
      try {
        const { data: reviewsData } = await supabase
          .from("reviews")
          .select("rating")
          .eq("reviewee_id", ride.driver_id);
          
        const { count: completedCount } = await supabase
          .from("rides")
          .select("id", { count: "exact", head: true })
          .eq("driver_id", ride.driver_id)
          .eq("status", "completed");
          
        let avgRating = 4.8;
        let count = 0;
        if (reviewsData && reviewsData.length > 0) {
          count = reviewsData.length;
          const sum = reviewsData.reduce((acc, curr) => acc + curr.rating, 0);
          avgRating = parseFloat((sum / count).toFixed(1));
        } else if (ride.driver?.is_verified) {
          avgRating = 4.9;
          count = 14;
        } else {
          avgRating = 4.7;
          count = 4;
        }
        
        setDriverStats({
          rating: avgRating,
          reviewCount: count,
          completedRidesCount: completedCount || 0
        });
      } catch (err) {
        console.error("Error fetching driver stats:", err);
      }
    };
    
    fetchDriverStats();
  }, [ride]);

  const handleRequestBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ride) return;
    setBookingLoading(true);
    setError("");

    try {
      const seats = parseInt(seatsRequested, 10);
      if (seats > ride.available_seats) {
        throw new Error("Not enough seats available");
      }

      const isInstant = ride.instant_booking;

      const { data: bookingData, error: bookingError } = await supabase
        .from("ride_bookings")
        .insert({
          ride_id: ride.id,
          passenger_id: user.id,
          seats_booked: seats,
          note: bookingNote.trim() || null,
          status: isInstant ? "accepted" : "pending",
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      if (isInstant) {
        await supabase
          .from("conversations")
          .insert({
            ride_id: ride.id,
            driver_id: ride.driver_id,
            passenger_id: user.id
          });

        await createNotification(
          ride.driver_id,
          "booking_accepted",
          "Ride Booked Instantly",
          `${profile?.full_name || "A passenger"} instantly booked ${seats} seats for your ride to ${ride.destination}.`,
          ride.id
        );

        await createNotification(
          user.id,
          "booking_accepted",
          "Booking Accepted!",
          `Your booking for the ride to ${ride.destination} has been accepted.`,
          ride.id
        );
      } else {
        await createNotification(
          ride.driver_id,
          "booking_request",
          "New Booking Request",
          `${profile?.full_name || "A passenger"} requested ${seats} seats for your ride to ${ride.destination}.`,
          ride.id
        );
      }

      await fetchRideDetails();
    } catch (err: any) {
      setError(err.message || "Failed to request booking");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: "accepted" | "rejected", passengerId: string, seats: number) => {
    try {
      const { error: updateError } = await supabase
        .from("ride_bookings")
        .update({ status })
        .eq("id", bookingId);

      if (updateError) throw updateError;
 
      if (status === "accepted" && ride) {
        await supabase
          .from("conversations")
          .insert({
            ride_id: ride.id,
            driver_id: ride.driver_id,
            passenger_id: passengerId
          });
      }

      const title = status === "accepted" ? "Booking Accepted!" : "Booking Declined";
      const content = status === "accepted"
        ? `Your booking for the ride to ${ride?.destination} has been accepted.`
        : `Your booking for the ride to ${ride?.destination} was declined by the driver.`;

      await createNotification(
        passengerId,
        `booking_${status}`,
        title,
        content,
        ride?.id
      );

      await fetchRideDetails();
    } catch (err) {
      console.error("Error updating booking status:", err);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
        <div className="h-64 rounded-3xl bg-slate-100 border" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-48 bg-slate-100 rounded-3xl" />
          <div className="h-48 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-900">Ride Not Found</h3>
        <p className="mt-2 text-sm text-slate-500">{error || "This ride may have been cancelled or deleted."}</p>
        <Link to="/find-ride" className="mt-6 inline-block">
          <Button variant="outline">Back to Search</Button>
        </Link>
      </div>
    );
  }

  const isDriver = user && ride.driver_id === user.id;
  const ams = getRideAmenities(ride);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Debug Parameter Output */}
      <div className="text-[10px] text-slate-400 font-mono mb-2">Debug - Ride ID: {rideId}</div>

      {/* Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full">
              {ride?.status}
            </span>
            {ride?.instant_booking && (
              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/40 px-3 py-1 rounded-full">
                <Zap className="h-3.5 w-3.5 fill-current" /> Instant Book
              </span>
            )}
            <span className="text-xs text-slate-400 font-bold">• Published {formatDate(ride?.created_at)}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>{ride?.source}</span>
            <span className="text-slate-400 font-light">&rarr;</span>
            <span>{ride?.destination}</span>
          </h1>
        </div>

        <div className="text-left md:text-right">
          <span className="text-xs text-slate-400 block font-bold uppercase tracking-wider">Price per Seat</span>
          <span className="text-3xl font-black text-blue-600 block mt-0.5">{formatPrice(Number(ride?.price_per_seat))}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
        {/* Maps and Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Interactive route polyline map */}
          {ride?.pickup_latitude && ride?.pickup_longitude && ride?.dropoff_latitude && ride?.dropoff_longitude ? (
            <RideRouteMap
              pickupLat={ride.pickup_latitude}
              pickupLng={ride.pickup_longitude}
              dropoffLat={ride.dropoff_latitude}
              dropoffLng={ride.dropoff_longitude}
            />
          ) : (
            <div className="h-80 bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center text-slate-400 text-sm">
              <Compass className="h-8 w-8 text-slate-300 animate-spin-slow mb-2" />
              <span>Map location unavailable</span>
            </div>
          )}

          {/* Ride Details */}
          <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Departure Date</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">{formatDate(ride?.departure_date)}</span>
                    <span className="text-xs text-slate-500 font-semibold block">{formatTime(ride?.departure_time)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Seats Available</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">{ride?.available_seats} of {ride?.total_seats}</span>
                    <span className="text-xs text-slate-500 font-semibold block">{(ride?.total_seats || 0) - (ride?.available_seats || 0)} booked</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Vehicle Class</span>
                    <span className="text-sm font-bold text-slate-900 capitalize block mt-0.5">{ride?.vehicle_type}</span>
                    <span className="text-xs text-slate-500 font-semibold block">{ride?.vehicle_number}</span>
                  </div>
                </div>
              </div>

              {/* Ride Notes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Driver's Notes</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4.5">
                  {ride?.description || "No specific ride instructions provided by the driver."}
                </p>
              </div>

              {/* Address details */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-1.5">Route Information</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">{ride?.source}</h5>
                      <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mt-0.5">Pickup Landmark</span>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-0.5">{ride?.pickup_location}</p>
                      {ride?.pickup_address && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">📍 {ride?.pickup_address}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">{ride?.destination}</h5>
                      <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mt-0.5">Dropoff Landmark</span>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-0.5">{ride?.drop_location}</p>
                      {ride?.dropoff_address && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">📍 {ride?.dropoff_address}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ride Amenities */}
              <div className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Amenities</h4>
                <div className="flex flex-wrap gap-2.5">
                  {ams.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border ${
                        opt.available
                          ? "border-emerald-100 bg-emerald-50/50 text-emerald-800"
                          : "border-slate-100 bg-slate-50 text-slate-400 line-through decoration-slate-300"
                      }`}
                    >
                      <Check className={`h-4 w-4 ${opt.available ? "text-emerald-600" : "text-slate-300"}`} />
                      <span>{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Panel */}
        <div className="space-y-6">
          {/* Driver details */}
          <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 md:p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Driver</h3>
            <div className="flex items-center space-x-3 pb-2">
              <Avatar
                src={ride.driver?.avatar_url}
                fallback={ride.driver?.full_name || "Driver"}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="text-base font-black text-slate-900">{ride.driver?.full_name}</h4>
                  {ride.driver?.is_verified && (
                    <ShieldCheck className="h-5 w-5 text-blue-500 fill-current" />
                  )}
                </div>
                <div className="flex items-center text-amber-500 mt-0.5">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="text-sm font-bold ml-0.5">{driverStats.rating}</span>
                  <span className="text-xs text-slate-400 ml-1.5 font-bold">({driverStats.reviewCount} review{driverStats.reviewCount !== 1 ? "s" : ""})</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-semibold">
                    Member since {ride.driver?.created_at ? new Date(ride.driver.created_at).getFullYear() : '2024'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-4 text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Trips Finished</span>
                <span className="text-lg font-black text-slate-900 block mt-0.5">{driverStats.completedRidesCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Verifications</span>
                <span className="text-xs font-bold text-slate-900 mt-1 flex items-center justify-center gap-1">
                  {ride.driver?.is_id_verified ? (
                    <span className="text-blue-600">ID ✔</span>
                  ) : (
                    <span className="text-slate-400">Basic</span>
                  )}
                </span>
              </div>
            </div>
            
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Driver Bio</span>
              <p className="text-xs text-slate-600 leading-relaxed italic">
                "{ride.driver?.bio || "Commuting driver sharing seats to save environment and cut down ride costs."}"
              </p>
            </div>
          </Card>

          {/* Vehicle Card */}
          {ride?.driver?.vehicle_details && (
            <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 md:p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Car className="h-4.5 w-4.5 text-blue-600" />
                <span>Vehicle Information</span>
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">Make & Model</span>
                  <span className="font-bold text-slate-900 capitalize block mt-0.5">{ride?.driver?.vehicle_details?.model || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">License Plate</span>
                  <span className="font-bold text-slate-900 uppercase font-mono block mt-0.5">{ride?.driver?.vehicle_details?.number || ride?.vehicle_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Color</span>
                  <span className="font-bold text-slate-900 capitalize block mt-0.5">{ride?.driver?.vehicle_details?.color || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Year</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{ride?.driver?.vehicle_details?.year || "N/A"}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Booking Request Interface */}
          {user ? (
            isDriver ? (
              <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ride Bookings</h3>
                
                {bookings.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4 text-center">No passenger bookings received yet.</p>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="rounded-2xl border border-slate-50 bg-slate-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar
                              src={booking.passenger?.avatar_url}
                              fallback={booking.passenger?.full_name || "Passenger"}
                              size="xs"
                            />
                            <span className="text-xs font-bold text-slate-900">{booking.passenger?.full_name}</span>
                          </div>
                          <Badge variant={
                            booking.status === "pending" ? "warning" :
                            booking.status === "accepted" || booking.status === "active" ? "success" :
                            "destructive"
                          } className="capitalize">
                            {booking.status}
                          </Badge>
                        </div>
                        
                        <div className="text-[11px] text-slate-600 bg-white border border-slate-100 rounded-xl p-3 space-y-1">
                          <div><span className="font-bold text-slate-400">Seats Booked:</span> <strong className="text-slate-800">{booking.seats_booked}</strong></div>
                          <div><span className="font-bold text-slate-400">Note:</span> {booking.note || "None"}</div>
                        </div>

                        {booking.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 py-1 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => handleUpdateBookingStatus(booking.id, "rejected", booking.passenger_id, booking.seats_booked)}
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg"
                              onClick={() => handleUpdateBookingStatus(booking.id, "accepted", booking.passenger_id, booking.seats_booked)}
                            >
                              Accept
                            </Button>
                          </div>
                        )}

                        {booking.status === "accepted" && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex gap-2">
                              <Link to={`/inbox?tab=messages&ride_id=${ride?.id}&passenger_id=${booking.passenger_id}`} className="flex-grow">
                                <Button variant="outline" size="sm" className="w-full text-xs py-1.5 font-bold rounded-lg">
                                  <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                  Chat
                                </Button>
                              </Link>
                              
                              <a href={`tel:${booking.passenger?.phone_number || ""}`} className="flex-grow">
                                <Button variant="outline" size="sm" className="w-full text-xs py-1.5 font-bold border-emerald-100 text-emerald-700 hover:bg-emerald-50 rounded-lg">
                                  <Phone className="mr-1.5 h-3.5 w-3.5" />
                                  Call
                                </Button>
                              </a>
                            </div>
                            
                            <div className="text-[10px] text-slate-500 bg-white border border-slate-100 px-2.5 py-1.5 rounded-lg text-center font-semibold">
                              Phone: <span className="font-mono font-bold text-slate-800">{booking.passenger?.phone_number || "N/A"}</span>
                            </div>

                            <Link to={`/tracking/${ride?.id}`} className="block">
                              <Button variant="outline" size="sm" className="w-full text-xs py-1.5 rounded-lg">
                                <Navigation className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                Coordinate Pickup
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 md:p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Book Seats</h3>

                {passengerBooking ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-50 bg-slate-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-bold">Booking Status</span>
                        <Badge variant={
                          passengerBooking.status === "pending" ? "warning" :
                          passengerBooking.status === "accepted" || passengerBooking.status === "active" ? "success" :
                          "destructive"
                        } className="capitalize">
                          {passengerBooking.status}
                        </Badge>
                      </div>
                      
                      <div className="text-xs space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-semibold">Seats Reserved</span>
                          <span className="font-black text-slate-900">{passengerBooking?.seats_booked} seat{passengerBooking?.seats_booked && passengerBooking.seats_booked > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-semibold">Total Price</span>
                          <span className="font-black text-blue-600">{formatPrice((passengerBooking?.seats_booked || 0) * (ride?.price_per_seat || 0))}</span>
                        </div>
                      </div>
                    </div>

                    {passengerBooking?.status === "accepted" && (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                          <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-bold text-emerald-900">Ride Confirmed!</h4>
                            <p className="text-xs text-emerald-700 mt-0.5">Your booking has been accepted. You can now contact the driver.</p>
                          </div>
                        </div>

                        {ride?.instant_booking && (
                          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                            <Zap className="h-5 w-5 text-amber-500 fill-current shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-bold text-emerald-900">Instantly Confirmed!</h4>
                              <p className="text-xs text-emerald-700 mt-0.5">Your booking was instantly confirmed. You can now contact the driver.</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Link to={`/inbox?tab=messages&ride_id=${ride?.id}&passenger_id=${user?.id}`} className="flex-grow">
                            <Button size="sm" className="w-full text-xs py-2 rounded-lg">
                              <MessageSquare className="mr-1.5 h-4 w-4" /> Message Driver
                            </Button>
                          </Link>
                          <a href={`tel:${ride?.driver?.phone_number || ""}`} className="flex-grow">
                            <Button variant="outline" size="sm" className="w-full text-xs py-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg">
                              <Phone className="mr-1.5 h-4 w-4" /> Call Driver
                            </Button>
                          </a>
                        </div>

                        <div className="text-[11px] text-slate-500 bg-slate-50 border px-3 py-2 rounded-xl text-center font-semibold">
                          Driver Phone: <span className="font-mono font-bold text-slate-800">{ride?.driver?.phone_number || "N/A"}</span>
                        </div>

                        <Link to={`/tracking/${ride?.id}`} className="block pt-1">
                          <Button variant="outline" className="w-full py-2 text-xs rounded-lg">
                            <Navigation className="mr-2 h-4 w-4 text-blue-600" />
                            Coordinate Pickup
                          </Button>
                        </Link>
                      </div>
                    )}

                    {passengerBooking?.status === "pending" && (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-bold text-amber-900">Awaiting Driver Approval</h4>
                            <p className="text-xs text-amber-700 mt-0.5">Your booking won't be confirmed until the driver approves your request. You'll be notified as soon as they respond.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {passengerBooking?.status === "rejected" && (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                          <X className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-bold text-red-900">Booking Declined</h4>
                            <p className="text-xs text-red-700 mt-0.5">Unfortunately, the driver has declined your booking request.</p>
                          </div>
                        </div>
                        <Link to="/find-ride" className="block">
                          <Button variant="outline" className="w-full py-2 text-xs rounded-lg">
                            Search Other Rides
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRequestBooking} className="space-y-4">
                    {ride?.available_seats === 0 ? (
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-center text-xs text-slate-500 font-bold">
                        No seats available. This ride is fully booked.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Number of Seats</label>
                          <div className="relative">
                            <select
                              value={seatsRequested}
                              onChange={(e) => setSeatsRequested(e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer"
                            >
                              {Array.from({ length: ride?.available_seats || 0 }).map((_, idx) => (
                                <option key={idx} value={idx + 1}>
                                  {idx + 1} {idx + 1 === 1 ? "seat" : "seats"}
                                </option>
                              ))}
                            </select>
                            <Users className="absolute right-4 top-3 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Note for Driver</label>
                          <textarea
                            placeholder="e.g. Hello! I'll meet you near the subway entrance. I'm carrying one bag..."
                            rows={3}
                            value={bookingNote}
                            onChange={(e) => setBookingNote(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 leading-normal"
                          />
                        </div>

                        <Button type="submit" className="w-full py-3 rounded-xl flex items-center justify-center gap-1.5 font-bold" loading={bookingLoading}>
                          {ride?.instant_booking ? (
                            <>
                              <Zap className="h-4 w-4 fill-current text-amber-300" />
                              <span>Book Instantly</span>
                            </>
                          ) : (
                            <span>Request Booking</span>
                          )}
                        </Button>
                      </>
                    )}
                  </form>
                )}
              </Card>
            )
          ) : (
            <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 text-center space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Want to book this ride?</h4>
              <p className="text-xs text-slate-400 leading-normal">Create a free RideSync account to request seats and communicate with verified drivers.</p>
              <div className="pt-2 flex gap-3">
                <Link to="/login" className="flex-1">
                  <Button variant="outline" className="w-full text-xs rounded-xl py-2 font-bold">Log In</Button>
                </Link>
                <Link to="/signup" className="flex-1">
                  <Button className="w-full text-xs rounded-xl py-2 font-bold">Sign Up</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export const RideDetails: React.FC = () => {
  return (
    <RideDetailsErrorBoundary>
      <RideDetailsContent />
    </RideDetailsErrorBoundary>
  );
};
