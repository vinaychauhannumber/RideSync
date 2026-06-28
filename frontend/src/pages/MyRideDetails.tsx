import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
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
  Navigation, Star, Phone, Zap, Info, Shield, Edit2, ChevronLeft
} from "lucide-react";
import { formatDate, formatTime, formatPrice } from "../lib/utils";
import L from "leaflet";

// Leaflet Route Map Component
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

export const MyRideDetails: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createNotification } = useNotifications();

  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Ride Modal States
  const [editModalOpen, setEditModalOpen] = useState(searchParams.get("edit") === "true");
  const [editPrice, setEditPrice] = useState("");
  const [editSeats, setEditSeats] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPickup, setEditPickup] = useState("");
  const [editDropoff, setEditDropoff] = useState("");
  const [saving, setSaving] = useState(false);

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
      setRide(rideData as unknown as Ride);

      // Populate edit states
      setEditPrice(String(Math.round(rideData.price_per_seat)));
      setEditSeats(String(rideData.total_seats));
      setEditDescription(rideData.description || "");
      setEditPickup(rideData.pickup_location);
      setEditDropoff(rideData.drop_location);

      // Fetch Bookings & Passenger info
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("ride_bookings")
        .select(`
          *,
          passenger:profiles!ride_bookings_passenger_id_fkey(*)
        `)
        .eq("ride_id", rideId);

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);
    } catch (err: any) {
      console.error("Error fetching ride:", err);
      setError(err.message || "Failed to load ride details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRideDetails();
  }, [rideId]);

  // Edit Ride Submit handler
  const handleEditRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ride) return;
    setSaving(true);
    setError("");

    try {
      const price = parseFloat(editPrice);
      const seats = parseInt(editSeats, 10);

      // Validate seat limits against already booked seats
      const bookedSeats = ride.total_seats - ride.available_seats;
      if (seats < bookedSeats) {
        throw new Error(`Cannot decrease total seats below already booked passenger count (${bookedSeats} seats booked).`);
      }

      const newAvailable = seats - bookedSeats;

      const { error: updateError } = await supabase
        .from("rides")
        .update({
          price_per_seat: price,
          total_seats: seats,
          available_seats: newAvailable,
          description: editDescription.trim() || null,
          pickup_location: editPickup.trim(),
          drop_location: editDropoff.trim()
        })
        .eq("id", ride.id);

      if (updateError) throw updateError;

      setEditModalOpen(false);
      await fetchRideDetails();
    } catch (err: any) {
      setError(err.message || "Failed to save edits");
    } finally {
      setSaving(false);
    }
  };

  // Booking approval/rejection handler
  const handleUpdateBookingStatus = async (bookingId: string, status: "accepted" | "rejected", passengerId: string, seatsBooked: number) => {
    if (!ride) return;
    try {
      const { error: updateError } = await supabase
        .from("ride_bookings")
        .update({ status })
        .eq("id", bookingId);

      if (updateError) throw updateError;
 
      if (status === "accepted") {
        // Create Supabase conversation record
        await supabase
          .from("conversations")
          .insert({
            ride_id: ride.id,
            driver_id: ride.driver_id,
            passenger_id: passengerId
          });
      }

      // Send verification notification
      const title = status === "accepted" ? "Booking Accepted!" : "Booking Declined";
      const content = status === "accepted"
        ? `Your booking for the ride to ${ride.destination} has been accepted.`
        : `Your booking for the ride to ${ride.destination} was declined by the driver.`;

      await createNotification(
        passengerId,
        `booking_${status}`,
        title,
        content,
        ride.id
      );

      await fetchRideDetails();
    } catch (err) {
      console.error("Booking response error:", err);
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
        <h3 className="text-xl font-bold text-slate-900">Ride details unavailable</h3>
        <p className="mt-2 text-sm text-slate-500">{error || "This ride may have been cancelled or deleted."}</p>
        <Link to="/my-rides" className="mt-6 inline-block">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const ams = getRideAmenities(ride);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Back to list & Header banner */}
      <div className="space-y-4">
        <Link to="/my-rides" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-blue-600 transition">
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Your Rides</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-full">
                {ride.status}
              </span>
              {ride.instant_booking && (
                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-50 border border-amber-200/40 px-2.5 py-1 rounded-full">
                  <Zap className="h-3.5 w-3.5 fill-current" /> Instant Book
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>{ride.source}</span>
              <span className="text-slate-400 font-light">&rarr;</span>
              <span>{ride.destination}</span>
            </h1>
          </div>

          <div className="flex gap-2">
            {ride.status === "scheduled" && (
              <Button onClick={() => setEditModalOpen(true)} className="flex items-center gap-1 text-xs font-bold">
                <Edit2 className="h-4 w-4" />
                <span>Edit Ride Details</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
        {/* Maps and parameters */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leaflet Routing Map */}
          {ride.pickup_latitude && ride.pickup_longitude && ride.dropoff_latitude && ride.dropoff_longitude ? (
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

          {/* Ride Details Card */}
          <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-100 pb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Departure Date</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">{formatDate(ride.departure_date)}</span>
                    <span className="text-xs text-slate-500 font-semibold block">{formatTime(ride.departure_time)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Seats Status</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">{ride.available_seats} / {ride.total_seats} seats free</span>
                    <span className="text-xs text-slate-500 font-semibold block">{ride.total_seats - ride.available_seats} seats booked</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">Pricing per seat</span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">{formatPrice(ride.price_per_seat)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Your Trip Description</h4>
                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-4.5">
                  {ride.description || "No specific ride instructions provided."}
                </p>
              </div>

              {/* Landmarks */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-50 pb-1.5">Route landmarks</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">{ride.source}</h5>
                      <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mt-0.5">Pickup Landmark</span>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-0.5">{ride.pickup_location}</p>
                      {ride.pickup_address && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">📍 {ride.pickup_address}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">{ride.destination}</h5>
                      <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mt-0.5">Dropoff Landmark</span>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-0.5">{ride.drop_location}</p>
                      {ride.dropoff_address && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-normal">📍 {ride.dropoff_address}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Amenities */}
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

        {/* Sidebar Moderation Panel */}
        <div className="space-y-6">
          <Card className="border border-slate-100 shadow-sm bg-white rounded-3xl p-5 md:p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Passenger bookings</h3>

            {bookings.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center leading-relaxed">No bookings received for this trip yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => {
                  const ratingVal = booking.passenger?.is_verified ? "4.9" : "4.7";

                  return (
                    <div key={booking.id} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Avatar
                            src={booking.passenger?.avatar_url}
                            fallback={booking.passenger?.full_name || "Passenger"}
                            size="xs"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block leading-none">{booking.passenger?.full_name}</span>
                            <div className="flex items-center text-amber-500 text-[10px] font-bold mt-1 leading-none">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              <span className="ml-0.5">{ratingVal}</span>
                            </div>
                          </div>
                        </div>

                        <Badge variant={
                          booking.status === "pending" ? "warning" :
                          booking.status === "accepted" || booking.status === "active" ? "success" :
                          "destructive"
                        } className="capitalize shrink-0">
                          {booking.status}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-white border border-slate-100 rounded-xl p-3 space-y-1 font-semibold leading-relaxed">
                        <div>Seats Booked: <strong className="text-slate-800">{booking.seats_booked}</strong></div>
                        {booking.note && (
                          <div className="border-t border-slate-50 pt-1.5 mt-1.5">
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Note</span>
                            <p className="text-slate-600 leading-normal italic mt-0.5">"{booking.note}"</p>
                          </div>
                        )}
                      </div>

                      {/* Pending Actions */}
                      {booking.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 py-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold"
                            onClick={() => handleUpdateBookingStatus(booking.id, "rejected", booking.passenger_id, booking.seats_booked)}
                          >
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-xl font-bold"
                            onClick={() => handleUpdateBookingStatus(booking.id, "accepted", booking.passenger_id, booking.seats_booked)}
                          >
                            Accept
                          </Button>
                        </div>
                      )}

                      {/* Accepted Actions */}
                      {(booking.status === "accepted" || booking.status === "active" || booking.status === "completed") && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="flex gap-2">
                            <Link to={`/inbox?tab=messages&ride_id=${ride.id}&passenger_id=${booking.passenger_id}`} className="flex-grow">
                              <Button variant="outline" size="sm" className="w-full text-[11px] py-1.5 font-bold rounded-xl">
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                                Chat
                              </Button>
                            </Link>
                            
                            <a href={`tel:${booking.passenger?.phone_number || ""}`} className="flex-grow">
                              <Button variant="outline" size="sm" className="w-full text-[11px] py-1.5 font-bold border-emerald-100 text-emerald-700 hover:bg-emerald-50 rounded-xl">
                                <Phone className="mr-1.5 h-3.5 w-3.5" />
                                Call
                              </Button>
                            </a>
                          </div>
                          
                          <div className="text-[10px] text-slate-500 bg-white border border-slate-100 px-2.5 py-1.5 rounded-lg text-center font-bold">
                            Phone: <span className="font-mono text-slate-800">{booking.passenger?.phone_number || "Verified"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Ride Modal Dialog */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 animate-scale-up overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white">
              <div>
                <h3 className="font-black text-slate-900">Edit Ride Details</h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Modify pricing, seats count or notes</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="h-10 w-10 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-800 flex items-center justify-center border border-slate-100 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleEditRide} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Price per Seat (₹)"
                  type="number"
                  min="50"
                  max="5000"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
                
                <Input
                  label="Total Seats"
                  type="number"
                  min="1"
                  max="8"
                  required
                  value={editSeats}
                  onChange={(e) => setEditSeats(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Pickup Landmark"
                  required
                  value={editPickup}
                  onChange={(e) => setEditPickup(e.target.value)}
                />
                
                <Input
                  label="Dropoff Landmark"
                  required
                  value={editDropoff}
                  onChange={(e) => setEditDropoff(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Trip Description</label>
                <textarea
                  placeholder="Notes about suitcase space, AC, charging cables, rules..."
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100 mt-6">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-grow py-2.5 rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={saving}
                  className="flex-grow py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
