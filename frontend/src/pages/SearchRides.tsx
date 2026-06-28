import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Ride } from "../types";
import { Card, CardContent } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  Search, MapPin, Calendar, Users, DollarSign, Filter, Star, Info,
  Compass, Zap, ArrowLeftRight, ChevronRight, CheckCircle2, Map, X, SlidersHorizontal, ShieldCheck
} from "lucide-react";
import { formatDate, formatTime, formatPrice } from "../lib/utils";
import L from "leaflet";

// Haversine Distance Helper
const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Arrival time & duration helper
const getArrivalDetails = (dateStr: string, timeStr: string, durationMin: number | null) => {
  if (!durationMin) {
    // Fallback: estimate 2.5 hours if duration not fetched
    durationMin = 150;
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

  return {
    smokingAllowed,
    petsAllowed,
    max2InBack,
    airConditioning,
    chargingPorts,
    instantBooking: ride.instant_booking
  };
};

// Distance radius constants (in km)
const PICKUP_RADIUS_KM = 50;
const DROPOFF_RADIUS_KM = 50;

// Extended ride type with distance metadata for display
interface RideWithDistance extends Ride {
  pickupDistanceKm?: number;
  dropoffDistanceKm?: number;
  matchType?: "exact" | "nearby" | "text";
}

export const SearchRides: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [rawRides, setRawRides] = useState<RideWithDistance[]>([]);
  const [filteredRides, setFilteredRides] = useState<RideWithDistance[]>([]);
  const [loading, setLoading] = useState(false);

  // URL State Extractor
  const fromName = searchParams.get("from") || "";
  const fromLat = parseFloat(searchParams.get("from_lat") || "0");
  const fromLng = parseFloat(searchParams.get("from_lng") || "0");
  const toName = searchParams.get("to") || "";
  const toLat = parseFloat(searchParams.get("to_lat") || "0");
  const toLng = parseFloat(searchParams.get("to_lng") || "0");
  const searchDate = searchParams.get("date") || "";
  const passengerCount = parseInt(searchParams.get("passengers") || "1", 10);

  // Whether we have valid coordinates for geo-search
  const hasFromCoords = fromLat !== 0 && fromLng !== 0;
  const hasToCoords = toLat !== 0 && toLng !== 0;

  // Filter States
  const [sortBy, setSortBy] = useState<string>("earliest");
  
  // Departure times: morning (06-12), afternoon (12-18), evening (18+)
  const [depMorning, setDepMorning] = useState(false);
  const [depAfternoon, setDepAfternoon] = useState(false);
  const [depEvening, setDepEvening] = useState(false);

  // Trust & Safety
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [highlyRatedOnly, setHighlyRatedOnly] = useState(false);

  // Amenities
  const [instantBooking, setInstantBooking] = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [max2InBack, setMax2InBack] = useState(false);
  const [airConditioning, setAirConditioning] = useState(false);
  const [chargingPorts, setChargingPorts] = useState(false);

  // Price Range
  const [maxPrice, setMaxPrice] = useState<number>(5000);

  // Modals & Drawers
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Leaflet map reference inside full screen modal
  const mapModalRef = useRef<HTMLDivElement | null>(null);
  const mapModalInstanceRef = useRef<L.Map | null>(null);

  // Fetch Rides from Database — uses coordinate-based nearby matching
  const fetchRides = async () => {
    setLoading(true);
    try {
      // Base query: get all scheduled rides with enough seats
      let query = supabase
        .from("rides")
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(*)
        `)
        .eq("status", "scheduled")
        .gte("available_seats", passengerCount);

      // Date filter
      if (searchDate) {
        query = query.eq("departure_date", searchDate);
      } else {
        const today = new Date().toISOString().split("T")[0];
        query = query.gte("departure_date", today);
      }

      // If we DON'T have coordinates, fall back to text-based search
      // but use a broader partial match
      if (!hasFromCoords && !hasToCoords) {
        if (fromName) {
          // Extract first word / short city name for broader matching
          const fromShort = fromName.split(",")[0].trim();
          query = query.ilike("source", `%${fromShort}%`);
        }
        if (toName) {
          const toShort = toName.split(",")[0].trim();
          query = query.ilike("destination", `%${toShort}%`);
        }
      }
      // When we have coordinates, do NOT filter by city name at the DB level.
      // We'll fetch all rides for the date and filter by distance client-side.

      const { data, error } = await query;
      if (error) throw error;

      const allRides = (data as unknown as Ride[]) || [];

      // Now apply coordinate-based distance filtering client-side
      if (hasFromCoords || hasToCoords) {
        const nearbyRides: RideWithDistance[] = [];

        for (const ride of allRides) {
          let pickupDist: number | undefined;
          let dropoffDist: number | undefined;
          let pickupMatch = true;
          let dropoffMatch = true;

          // Check pickup distance
          if (hasFromCoords) {
            if (ride.pickup_latitude && ride.pickup_longitude) {
              pickupDist = getHaversineDistance(fromLat, fromLng, ride.pickup_latitude, ride.pickup_longitude);
              pickupMatch = pickupDist <= PICKUP_RADIUS_KM;
            } else {
              // Ride has no coordinates — fall back to text matching on source
              const fromShort = fromName.split(",")[0].trim().toLowerCase();
              pickupMatch = ride.source.toLowerCase().includes(fromShort);
            }
          }

          // Check dropoff distance
          if (hasToCoords) {
            if (ride.dropoff_latitude && ride.dropoff_longitude) {
              dropoffDist = getHaversineDistance(toLat, toLng, ride.dropoff_latitude, ride.dropoff_longitude);
              dropoffMatch = dropoffDist <= DROPOFF_RADIUS_KM;
            } else {
              // Fall back to text matching on destination
              const toShort = toName.split(",")[0].trim().toLowerCase();
              dropoffMatch = ride.destination.toLowerCase().includes(toShort);
            }
          }

          if (pickupMatch && dropoffMatch) {
            const rideWithDist: RideWithDistance = {
              ...ride,
              pickupDistanceKm: pickupDist,
              dropoffDistanceKm: dropoffDist,
              matchType: (pickupDist !== undefined && pickupDist <= 5) || (dropoffDist !== undefined && dropoffDist <= 5)
                ? "exact"
                : "nearby",
            };
            nearbyRides.push(rideWithDist);
          }
        }

        // Sort: exact matches first, then by closest pickup distance
        nearbyRides.sort((a, b) => {
          // Exact matches before nearby
          if (a.matchType === "exact" && b.matchType !== "exact") return -1;
          if (a.matchType !== "exact" && b.matchType === "exact") return 1;
          // Then by pickup distance
          return (a.pickupDistanceKm || 0) - (b.pickupDistanceKm || 0);
        });

        setRawRides(nearbyRides);
      } else {
        // No coordinates — use rides as-is (text-based results)
        setRawRides(allRides.map(r => ({ ...r, matchType: "text" as const })));
      }
    } catch (err) {
      console.error("Error querying rides:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, [searchParams]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...rawRides];

    // Filter by departure times
    if (depMorning || depAfternoon || depEvening) {
      result = result.filter((ride) => {
        const hour = parseInt(ride.departure_time.split(":")[0], 10);
        if (depMorning && hour >= 6 && hour < 12) return true;
        if (depAfternoon && hour >= 12 && hour < 18) return true;
        if (depEvening && hour >= 18) return true;
        return false;
      });
    }

    // Filter by Trust & Safety
    if (verifiedOnly) {
      result = result.filter((ride) => ride.driver?.is_verified);
    }
    if (highlyRatedOnly) {
      // Simple mock rating score check
      result = result.filter((ride) => {
        const rating = ride.driver?.is_verified ? 4.9 : 4.7;
        return rating >= 4.8;
      });
    }

    // Filter by Amenities
    if (instantBooking || smokingAllowed || petsAllowed || max2InBack || airConditioning || chargingPorts) {
      result = result.filter((ride) => {
        const ams = getRideAmenities(ride);
        if (instantBooking && !ams.instantBooking) return false;
        if (smokingAllowed && !ams.smokingAllowed) return false;
        if (petsAllowed && !ams.petsAllowed) return false;
        if (max2InBack && !ams.max2InBack) return false;
        if (airConditioning && !ams.airConditioning) return false;
        if (chargingPorts && !ams.chargingPorts) return false;
        return true;
      });
    }

    // Filter by Max Price
    result = result.filter((ride) => Number(ride.price_per_seat) <= maxPrice);

    // Apply Sorting
    result.sort((a, b) => {
      const ratingA = a.driver?.is_verified ? 4.9 : 4.7;
      const ratingB = b.driver?.is_verified ? 4.9 : 4.7;

      switch (sortBy) {
        case "earliest":
          return (
            new Date(`${a.departure_date}T${a.departure_time}`).getTime() -
            new Date(`${b.departure_date}T${b.departure_time}`).getTime()
          );
        case "price_asc":
          return Number(a.price_per_seat) - Number(b.price_per_seat);
        case "rating_desc":
          return ratingB - ratingA;
        case "duration_asc":
          return (a.estimated_duration || 150) - (b.estimated_duration || 150);
        case "closest_pickup":
          if (fromLat && fromLng && a.pickup_latitude && a.pickup_longitude && b.pickup_latitude && b.pickup_longitude) {
            const distA = getHaversineDistance(fromLat, fromLng, a.pickup_latitude, a.pickup_longitude);
            const distB = getHaversineDistance(fromLat, fromLng, b.pickup_latitude, b.pickup_longitude);
            return distA - distB;
          }
          return 0;
        case "closest_arrival":
          if (toLat && toLng && a.dropoff_latitude && a.dropoff_longitude && b.dropoff_latitude && b.dropoff_longitude) {
            const distA = getHaversineDistance(toLat, toLng, a.dropoff_latitude, a.dropoff_longitude);
            const distB = getHaversineDistance(toLat, toLng, b.dropoff_latitude, b.dropoff_longitude);
            return distA - distB;
          }
          return 0;
        default:
          return 0;
      }
    });

    setFilteredRides(result);
  }, [
    rawRides, sortBy, depMorning, depAfternoon, depEvening, verifiedOnly,
    highlyRatedOnly, instantBooking, smokingAllowed, petsAllowed, max2InBack,
    airConditioning, chargingPorts, maxPrice
  ]);

  // Leaflet map setup in modal
  useEffect(() => {
    if (!mapModalOpen || !mapModalRef.current) return;

    // Noida default center if coords not available
    const centerLat = fromLat || 28.4742;
    const centerLng = fromLng || 77.5040;

    const map = L.map(mapModalRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([centerLat, centerLng], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapModalInstanceRef.current = map;

    // Render markers for all rides
    const markersGroup: L.Marker[] = [];

    filteredRides.forEach((ride) => {
      const lat = ride.pickup_latitude;
      const lng = ride.pickup_longitude;
      if (!lat || !lng) return;

      const markerIcon = L.divIcon({
        html: `
          <div class="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-2.5 py-1.5 rounded-full shadow-lg border border-white flex items-center justify-center whitespace-nowrap animate-scale-up">
            ₹${Math.round(ride.price_per_seat)}
          </div>
        `,
        className: "price-marker-tag",
        iconSize: [50, 24],
        iconAnchor: [25, 12],
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
      
      const popupContent = `
        <div class="p-2 space-y-1.5 text-xs">
          <div class="font-bold text-slate-800">${ride.driver?.full_name || "Driver"}</div>
          <div class="text-slate-500 font-semibold">${ride.source.split(",")[0]} &rarr; ${ride.destination.split(",")[0]}</div>
          <div class="flex items-center gap-2 pt-1">
            <span class="text-blue-600 font-black">₹${ride.price_per_seat}</span>
            <span class="text-slate-400">•</span>
            <span class="text-slate-500">${ride.departure_time.substring(0, 5)}</span>
          </div>
          <a href="/ride/${ride.id}" class="mt-2 block text-center bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg transition" style="color: white !important;">
            View Ride Details
          </a>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersGroup.push(marker);
    });

    if (markersGroup.length > 0) {
      const group = new L.FeatureGroup(markersGroup);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      if (mapModalInstanceRef.current) {
        mapModalInstanceRef.current.remove();
        mapModalInstanceRef.current = null;
      }
    };
  }, [mapModalOpen, filteredRides]);

  // Sidebar filters render block
  const renderSidebarFilters = () => (
    <div className="space-y-6">
      {/* Map Preview Card */}
      <Card className="overflow-hidden border border-slate-100 shadow-sm rounded-2xl bg-white relative">
        <div className="h-28 w-full bg-slate-100 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-cover bg-center filter blur-[1px]" style={{ backgroundImage: "url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/77.3,28.5,10,0/400x120?access_token=mock')" }}></div>
          <div className="absolute inset-0 bg-blue-900/10"></div>
          <Map className="h-8 w-8 text-blue-600 relative z-10 animate-bounce" />
        </div>
        <div className="p-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setMapModalOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-2">
            <Compass className="h-4 w-4 text-blue-500" />
            <span>Show on Map</span>
          </Button>
        </div>
      </Card>

      {/* Sort By */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Sort By</h4>
        <div className="space-y-2 text-sm text-slate-700">
          {[
            { label: "Earliest Departure", val: "earliest" },
            { label: "Lowest Price", val: "price_asc" },
            { label: "Highest Rated Driver", val: "rating_desc" },
            { label: "Shortest Ride", val: "duration_asc" },
            { label: "Closest Pickup Point", val: "closest_pickup" },
            { label: "Closest Arrival Point", val: "closest_arrival" }
          ].map((opt) => (
            <label key={opt.val} className="flex items-center gap-2.5 cursor-pointer py-0.5">
              <input
                type="radio"
                name="sortBy"
                value={opt.val}
                checked={sortBy === opt.val}
                onChange={() => setSortBy(opt.val)}
                className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Departure Time */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Departure Time</h4>
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={depMorning}
              onChange={(e) => setDepMorning(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Morning (06:00 - 12:00)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={depAfternoon}
              onChange={(e) => setDepAfternoon(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Afternoon (12:00 - 18:00)</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={depEvening}
              onChange={(e) => setDepEvening(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Evening (After 18:00)</span>
          </label>
        </div>
      </div>

      {/* Price Slider */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex justify-between items-center mb-2.5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Max Price per Seat</h4>
          <span className="text-sm font-black text-blue-600">₹{maxPrice}</span>
        </div>
        <input
          type="range"
          min="100"
          max="5000"
          step="50"
          value={maxPrice}
          onChange={(e) => setMaxPrice(parseInt(e.target.value, 10))}
          className="w-full accent-blue-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-bold mt-1">
          <span>₹100</span>
          <span>₹5000</span>
        </div>
      </div>

      {/* Trust & Safety */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Trust & Safety</h4>
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Verified Drivers Only</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={highlyRatedOnly}
              onChange={(e) => setHighlyRatedOnly(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Highly Rated Drivers</span>
          </label>
        </div>
      </div>

      {/* Amenities */}
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Amenities</h4>
        <div className="space-y-2.5 text-sm text-slate-700">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={instantBooking}
              onChange={(e) => setInstantBooking(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">⚡ Instant Booking</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={airConditioning}
              onChange={(e) => setAirConditioning(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">AC Available</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={max2InBack}
              onChange={(e) => setMax2InBack(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Max 2 in Back Seat</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={chargingPorts}
              onChange={(e) => setChargingPorts(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Charging Ports</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={petsAllowed}
              onChange={(e) => setPetsAllowed(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Pets Allowed</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={smokingAllowed}
              onChange={(e) => setSmokingAllowed(e.target.checked)}
              className="h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
            />
            <span className="font-semibold text-slate-700">Smoking Allowed</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search Header Info */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-blue-600 font-bold uppercase tracking-wider">
            <span>Find a ride</span>
            <span>&bull;</span>
            <span>{searchDate ? formatDate(searchDate) : "All upcoming"}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <span>{fromName.split(",")[0] || "Everywhere"}</span>
            <span className="text-slate-400 font-light">&rarr;</span>
            <span>{toName.split(",")[0] || "Everywhere"}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-semibold">
            {filteredRides.length} ride{filteredRides.length !== 1 ? "s" : ""} available &bull; {passengerCount} Passenger{passengerCount > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 transition"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
          </button>
          
          <Link to="/find-ride" className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 transition flex items-center justify-center gap-1">
            <Search className="h-3.5 w-3.5" />
            <span>Modify Search</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4 items-start">
        {/* Sidebar Filters - Desktop */}
        <div className="hidden md:block lg:col-span-1 sticky top-20 bg-white border border-slate-100 rounded-3xl p-5 shadow-sm max-h-[85vh] overflow-y-auto">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-4 border-b border-slate-50 pb-2">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>Refine Route</span>
          </h3>
          {renderSidebarFilters()}
        </div>

        {/* Results list */}
        <div className="lg:col-span-3 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-48 rounded-3xl bg-slate-100/70 animate-pulse border border-slate-100" />
            ))
          ) : filteredRides.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-slate-200 rounded-3xl bg-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-6">
                <Compass className="h-8 w-8 animate-spin-slow" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">No rides found nearby</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-sm">
                {hasFromCoords || hasToCoords
                  ? `We searched within ${PICKUP_RADIUS_KM} km of your pickup and ${DROPOFF_RADIUS_KM} km of your dropoff. Try a different date, fewer passengers, or a broader search.`
                  : "No carpools match your search. Try adjusting your filters, date, or search terms."
                }
              </p>
              <div className="mt-6 flex gap-4">
                <Button variant="outline" onClick={() => {
                  setDepMorning(false);
                  setDepAfternoon(false);
                  setDepEvening(false);
                  setVerifiedOnly(false);
                  setHighlyRatedOnly(false);
                  setInstantBooking(false);
                  setAirConditioning(false);
                  setChargingPorts(false);
                  setPetsAllowed(false);
                  setSmokingAllowed(false);
                  setMax2InBack(false);
                  setMaxPrice(5000);
                }}>
                  Clear Filters
                </Button>
                <Link to="/find-ride">
                  <Button>New Search</Button>
                </Link>
              </div>
            </Card>
          ) : (
            filteredRides.map((ride) => {
              const ratingScore = ride.driver?.is_verified ? "4.9" : "4.7";
              const totalTrips = ride.driver?.is_verified ? "28" : "6";
              const ams = getRideAmenities(ride);

              // Calculate arrival details
              const arr = getArrivalDetails(ride.departure_date, ride.departure_time, ride.estimated_duration);

              return (
                <Card key={ride.id} className="overflow-hidden border border-slate-100 hover:border-blue-100 hover:shadow-lg hover:-translate-y-0.5 transition duration-300 rounded-3xl bg-white">
                  <Link to={`/ride/${ride.id}`} className="block">
                    {/* Nearby match indicator */}
                    {ride.matchType === "nearby" && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-6 py-2 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Nearby Match</span>
                        {ride.pickupDistanceKm !== undefined && (
                          <span className="text-[10px] font-semibold text-emerald-600 ml-auto">Pickup ~{Math.round(ride.pickupDistanceKm)} km from your search</span>
                        )}
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        
                        {/* Timeline route block */}
                        <div className="flex-grow flex items-center justify-between gap-4 max-w-xl">
                          
                          {/* Departure Point */}
                          <div className="w-28 text-left shrink-0">
                            <span className="text-xl font-black text-slate-900 block">{formatTime(ride.departure_time)}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate">{ride.source.split(",")[0]}</span>
                            {ride.pickupDistanceKm !== undefined && ride.pickupDistanceKm > 0 && (
                              <span className="text-[9px] font-semibold text-emerald-600 block mt-0.5">~{Math.round(ride.pickupDistanceKm)} km away</span>
                            )}
                          </div>

                          {/* Visual line connecting */}
                          <div className="flex-grow flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-mono font-bold">{arr.durationText}</span>
                            <div className="w-full flex items-center gap-1.5 my-1.5">
                              <div className="h-2 w-2 rounded-full border-2 border-emerald-500 bg-white"></div>
                              <div className="flex-grow h-[1px] border-t border-dashed border-slate-300"></div>
                              <div className="h-2 w-2 rounded-full border-2 border-blue-500 bg-white"></div>
                            </div>
                            {ride.instant_booking && (
                              <span className="flex items-center gap-0.5 text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200/40 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                <Zap className="h-2.5 w-2.5 fill-current" /> Instant
                              </span>
                            )}
                          </div>

                          {/* Arrival Point */}
                          <div className="w-28 text-right shrink-0">
                            <span className="text-xl font-black text-slate-900 block">{arr.time}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5 truncate">{ride.destination.split(",")[0]}</span>
                            {ride.dropoffDistanceKm !== undefined && ride.dropoffDistanceKm > 0 && (
                              <span className="text-[9px] font-semibold text-blue-600 block mt-0.5">~{Math.round(ride.dropoffDistanceKm)} km away</span>
                            )}
                          </div>

                        </div>

                        {/* Pricing Block */}
                        <div className="flex flex-row md:flex-col md:items-end justify-between items-center border-t md:border-t-0 pt-4 md:pt-0 border-slate-50 gap-4 md:text-right">
                          <div>
                            <span className="text-3xl font-black text-slate-900 block">₹{Math.round(ride.price_per_seat)}</span>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">per seat</span>
                          </div>
                          
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-500 font-semibold">
                            {ride.available_seats} seat{ride.available_seats !== 1 ? "s" : ""} left
                          </div>
                        </div>

                      </div>

                      {/* Bottom row: driver profiles, safety badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="flex items-center space-x-3">
                          <Avatar
                            src={ride.driver?.avatar_url}
                            fallback={ride.driver?.full_name || "Driver"}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-slate-900">{ride.driver?.full_name}</span>
                              {ride.driver?.is_verified && (
                                <ShieldCheck className="h-4.5 w-4.5 text-blue-500 fill-current" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="flex items-center text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-current" />
                                <span className="text-xs font-bold ml-0.5">{ratingScore}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">&bull; {totalTrips} rides driven</span>
                            </div>
                          </div>
                        </div>

                        {/* Amenities Quick Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ams.airConditioning && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">AC</span>
                          )}
                          {ams.max2InBack && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Max 2 Back</span>
                          )}
                          {ams.chargingPorts && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">USB Charger</span>
                          )}
                          {ams.petsAllowed && (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Pets OK</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <span className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center">
                            <span>View Ride</span>
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>

                    </CardContent>
                  </Link>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Show on Map Modal Overlay */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden relative border border-slate-100">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Mapped Routes</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Showing {filteredRides.length} available pickup points</p>
              </div>
              <button
                onClick={() => setMapModalOpen(false)}
                className="h-10 w-10 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-800 flex items-center justify-center transition border border-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="flex-grow relative bg-slate-50">
              <div ref={mapModalRef} className="absolute inset-0 z-0 h-full w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Filter Slide-In */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm h-full flex flex-col overflow-hidden animate-slide-in">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900">Filters</h3>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="h-9 w-9 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 flex items-center justify-center transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <div className="flex-grow p-5 overflow-y-auto">
              {renderSidebarFilters()}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                Apply & View Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
