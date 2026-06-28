import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Car, FileText, CheckCircle2, ChevronRight, AlertCircle, Compass, HelpCircle, Zap, RefreshCw } from "lucide-react";
import L from "leaflet";
import { MapPicker } from "../components/MapPicker";

const RoutePreviewMap: React.FC<{
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  routeGeometry: [number, number][];
}> = ({ pickupLat, pickupLng, dropoffLat, dropoffLng, routeGeometry }) => {
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

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (routeGeometry.length > 0) {
      polylineRef.current = L.polyline(routeGeometry, {
        color: "#2563EB",
        weight: 5,
        opacity: 0.8,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routeGeometry), { padding: [30, 30] });
    }
  }, [routeGeometry]);

  return <div ref={mapRef} className="h-60 w-full animate-fade-in" />;
};

export const CreateRide: React.FC = () => {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get("clone_id");

  // Onboarding states for passengers who want to drive
  const [onboardingMode, setOnboardingMode] = useState(profile?.role !== "driver");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("sedan");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");

  // Ride Form States
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropLocation, setDropLocation] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [totalSeats, setTotalSeats] = useState("3");
  const [pricePerSeat, setPricePerSeat] = useState("15");
  const [description, setDescription] = useState("");
  const [instantBooking, setInstantBooking] = useState(true);
  const [hasReturnRide, setHasReturnRide] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pickup Coordinates and Address
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");

  // Dropoff Coordinates and Address
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");

  // Routing Metrics
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routingLoading, setRoutingLoading] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  useEffect(() => {
    if (!cloneId) return;

    const fetchCloneRide = async () => {
      try {
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("id", cloneId)
          .single();

        if (error) throw error;
        if (data) {
          setSource(data.source || "");
          setDestination(data.destination || "");
          setPickupLocation(data.pickup_location || "");
          setDropLocation(data.drop_location || "");
          setTotalSeats(String(data.total_seats || 3));
          setPricePerSeat(String(Math.round(data.price_per_seat || 15)));
          setDescription(data.description || "");
          setInstantBooking(data.instant_booking ?? true);
          
          setPickupLat(data.pickup_latitude);
          setPickupLng(data.pickup_longitude);
          setPickupAddress(data.pickup_address || "");

          setDropoffLat(data.dropoff_latitude);
          setDropoffLng(data.dropoff_longitude);
          setDropoffAddress(data.dropoff_address || "");
        }
      } catch (err) {
        console.error("Failed to load clone ride details:", err);
      }
    };

    fetchCloneRide();
  }, [cloneId]);

  const handlePickupChange = ({ lat, lng, address }: { lat: number; lng: number; address: string }) => {
    setPickupLat(lat);
    setPickupLng(lng);
    setPickupAddress(address);
    showToast("Pickup location selected successfully.");

    // Auto-fill Starting City and landmark descriptions
    const segments = address.split(",");
    const landmark = segments.slice(0, 2).join(",").trim();
    setPickupLocation(landmark);
    
    // Attempt to extract city from reverse geocoding segments
    if (segments.length >= 3) {
      const citySegment = segments[segments.length - 3]?.trim();
      if (citySegment) setSource(citySegment);
    } else {
      setSource(segments[0]?.trim() || "");
    }
  };

  const handleDropoffChange = ({ lat, lng, address }: { lat: number; lng: number; address: string }) => {
    setDropoffLat(lat);
    setDropoffLng(lng);
    setDropoffAddress(address);
    showToast("Dropoff location selected successfully.");

    const segments = address.split(",");
    const landmark = segments.slice(0, 2).join(",").trim();
    setDropLocation(landmark);

    if (segments.length >= 3) {
      const citySegment = segments[segments.length - 3]?.trim();
      if (citySegment) setDestination(citySegment);
    } else {
      setDestination(segments[0]?.trim() || "");
    }
  };

  // Fetch routing preview using OSRM driving profile
  useEffect(() => {
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      setEstimatedDistance(null);
      setEstimatedDuration(null);
      setRouteGeometry([]);
      return;
    }

    const fetchRoute = async () => {
      setRoutingLoading(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
          const durationMin = Math.round(route.duration / 60);
          
          setEstimatedDistance(distanceKm);
          setEstimatedDuration(durationMin);

          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRouteGeometry(coords);
        }
      } catch (err) {
        console.error("OSRM routing failed:", err);
      } finally {
        setRoutingLoading(false);
      }
    };

    fetchRoute();
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  // Handle Driver Setup
  const handleDriverSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!licenseNumber.trim() || !vehicleModel.trim() || !vehicleNumber.trim()) {
        throw new Error("Please fill in all vehicle and license details.");
      }

      const vehicleDetails = {
        type: vehicleType,
        model: vehicleModel,
        color: vehicleColor,
        number: vehicleNumber,
        year: vehicleYear ? parseInt(vehicleYear, 10) : new Date().getFullYear(),
        driver_license: licenseNumber, // Store inside jsonb to bypass schema cache issue
      };

      await updateProfile({
        role: "driver",
        vehicle_details: vehicleDetails,
      });

      setOnboardingMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to update driver details");
    } finally {
      setLoading(false);
    }
  };

  // Handle Create Ride
  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!user || !profile) throw new Error("Not authenticated");

      // Verify that profile role is driver
      if (profile.role !== "driver") {
        setOnboardingMode(true);
        throw new Error("Please complete driver onboarding first");
      }

      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        throw new Error("Please select exact pickup and dropoff locations on the map.");
      }

      // Default vehicle fields from profile if none specified in form
      const finalVehicleType = vehicleType || profile.vehicle_details?.type || "sedan";
      const finalVehicleNumber = vehicleNumber || profile.vehicle_details?.number || "Unknown";

      if (hasReturnRide) {
        if (!returnDate || !returnTime) {
          throw new Error("Please select departure date and time for your return ride.");
        }
        const outboundDateTime = new Date(`${departureDate}T${departureTime}`);
        const returnDateTime = new Date(`${returnDate}T${returnTime}`);
        if (returnDateTime <= outboundDateTime) {
          throw new Error("Return ride departure must be after the outbound ride departure.");
        }
      }

      // Insert outbound ride into Supabase
      const { data: outboundData, error: insertError } = await supabase
        .from("rides")
        .insert({
          driver_id: user.id,
          source: source.trim(),
          destination: destination.trim(),
          pickup_location: pickupLocation.trim(),
          drop_location: dropLocation.trim(),
          departure_date: departureDate,
          departure_time: departureTime,
          total_seats: parseInt(totalSeats, 10),
          available_seats: parseInt(totalSeats, 10),
          price_per_seat: parseFloat(pricePerSeat),
          vehicle_type: finalVehicleType,
          vehicle_number: finalVehicleNumber,
          description: description.trim() || null,
          status: "scheduled",
          instant_booking: instantBooking,
          pickup_address: pickupAddress,
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLng,
          dropoff_address: dropoffAddress,
          dropoff_latitude: dropoffLat,
          dropoff_longitude: dropoffLng,
          estimated_distance: estimatedDistance,
          estimated_duration: estimatedDuration,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Initialize Outbound Tracking Session
      await supabase.from("ride_tracking_sessions").insert({
        ride_id: outboundData.id,
        status: "inactive",
      });

      // Insert return ride if requested
      if (hasReturnRide) {
        const { data: returnData, error: returnError } = await supabase
          .from("rides")
          .insert({
            driver_id: user.id,
            source: destination.trim(),
            destination: source.trim(),
            pickup_location: dropLocation.trim(),
            drop_location: pickupLocation.trim(),
            departure_date: returnDate,
            departure_time: returnTime,
            total_seats: parseInt(totalSeats, 10),
            available_seats: parseInt(totalSeats, 10),
            price_per_seat: parseFloat(pricePerSeat),
            vehicle_type: finalVehicleType,
            vehicle_number: finalVehicleNumber,
            description: description.trim() || null,
            status: "scheduled",
            instant_booking: instantBooking,
            pickup_address: dropoffAddress,
            pickup_latitude: dropoffLat,
            pickup_longitude: dropoffLng,
            dropoff_address: pickupAddress,
            dropoff_latitude: pickupLat,
            dropoff_longitude: pickupLng,
            estimated_distance: estimatedDistance,
            estimated_duration: estimatedDuration,
          })
          .select()
          .single();

        if (returnError) throw returnError;

        // Initialize Return Tracking Session
        await supabase.from("ride_tracking_sessions").insert({
          ride_id: returnData.id,
          status: "inactive",
        });
      }

      navigate(`/dashboard`);
    } catch (err: any) {
      setError(err.message || "Failed to publish ride");
    } finally {
      setLoading(false);
    }
  };

  if (onboardingMode) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border border-slate-100 shadow-xl bg-white rounded-3xl p-3">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4 animate-bounce">
              <Car className="h-6 w-6" />
            </div>
            <CardTitle>Activate Driver Account</CardTitle>
            <CardDescription>
              To publish rides, you need to verify your driver's license and vehicle registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100 mb-6">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleDriverSetup} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>1. Driver Credentials</span>
                </h4>
                
                <Input
                  label="Driver's License Number"
                  placeholder="e.g. DL-12345678"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </div>

              <div className="space-y-4 pt-2">
                <h4 className="text-sm font-bold text-slate-900 border-b pb-1.5 flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-600" />
                  <span>2. Vehicle Details</span>
                </h4>

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
                    placeholder="e.g. Tesla Model 3"
                    required
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="License Plate Number"
                    placeholder="e.g. 7XYZ89"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                  />

                  <Input
                    label="Color"
                    placeholder="e.g. Metallic Grey"
                    value={vehicleColor}
                    onChange={(e) => setVehicleColor(e.target.value)}
                  />

                  <Input
                    label="Year"
                    type="number"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    placeholder="e.g. 2022"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <Button variant="outline" type="button" onClick={() => navigate(-1)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={loading}>
                  Activate Driver Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Card className="border border-slate-100 shadow-xl bg-white rounded-3xl p-3">
        <CardHeader>
          <CardTitle>Publish a Ride</CardTitle>
          <CardDescription>Set your route, departure details, and price per seat.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100 mb-6">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateRide} className="space-y-6">
            
            {/* Route Setup */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Route Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Starting City"
                  placeholder="e.g. San Francisco"
                  required
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
                
                <Input
                  label="Destination City"
                  placeholder="e.g. Los Angeles"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Pickup Landmark Description"
                  placeholder="e.g. Civic Center BART Station Entrance"
                  required
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                />

                <Input
                  label="Dropoff Landmark Description"
                  placeholder="e.g. Union Station East Plaza"
                  required
                  value={dropLocation}
                  onChange={(e) => setDropLocation(e.target.value)}
                />
              </div>
            </div>

            {/* Exact Pickup & Dropoff Location Section */}
            <div className="space-y-6 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b pb-1">Exact Pickup & Dropoff Location</h3>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pickup Location</h4>
                <MapPicker
                  type="pickup"
                  placeholder="Search pickup location..."
                  enableGeolocation={true}
                  initialValue={pickupLat && pickupLng ? { lat: pickupLat, lng: pickupLng, address: pickupAddress } : null}
                  onChange={handlePickupChange}
                  onShowToast={showToast}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dropoff Location</h4>
                <MapPicker
                  type="dropoff"
                  placeholder="Search dropoff location..."
                  initialValue={dropoffLat && dropoffLng ? { lat: dropoffLat, lng: dropoffLng, address: dropoffAddress } : null}
                  onChange={handleDropoffChange}
                  onShowToast={showToast}
                />
              </div>
            </div>

            {/* Route Preview Section */}
            {pickupLat !== null && pickupLng !== null && dropoffLat !== null && dropoffLng !== null && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Route Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stats Card */}
                  <div className="md:col-span-1 bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col justify-center space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Distance</span>
                      {routingLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded-lg mt-1" />
                      ) : (
                        <span className="text-2xl font-black text-slate-900 block">
                          {estimatedDistance ? `${estimatedDistance} km` : "N/A"}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Estimated Travel Time</span>
                      {routingLoading ? (
                        <div className="h-6 w-24 bg-slate-200 animate-pulse rounded-lg mt-1" />
                      ) : (
                        <span className="text-2xl font-black text-blue-600 block">
                          {estimatedDuration ? `${estimatedDuration} min` : "N/A"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Route Map Card */}
                  <div className="md:col-span-2 relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-inner z-10">
                    <RoutePreviewMap
                      pickupLat={pickupLat}
                      pickupLng={pickupLng}
                      dropoffLat={dropoffLat}
                      dropoffLng={dropoffLng}
                      routeGeometry={routeGeometry}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Setup */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Schedule & Pricing</h4>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Departure Date"
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label="Departure Time"
                    type="time"
                    required
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Total Available Seats"
                  type="number"
                  min="1"
                  max="8"
                  required
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                />

                <Input
                  label="Price per Seat ($)"
                  type="number"
                  min="1"
                  required
                  value={pricePerSeat}
                  onChange={(e) => setPricePerSeat(e.target.value)}
                />
              </div>
            </div>

            {/* Instant Booking Setup */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Instant Booking</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Instant Booking Card */}
                <div
                  onClick={() => setInstantBooking(true)}
                  className={`cursor-pointer rounded-2xl border p-4.5 transition flex flex-col justify-between ${
                    instantBooking
                      ? "border-blue-600 bg-blue-50/10 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className={`h-4.5 w-4.5 ${instantBooking ? "text-blue-600 fill-current" : "text-slate-400"}`} />
                        <span className="text-sm font-bold text-slate-900">Enable Instant Booking</span>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        instantBooking ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                      }`}>
                        {instantBooking && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Passengers can book instantly without waiting for your response.
                    </p>
                  </div>
                  
                  <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3">
                    <div className="flex items-start gap-1.5 text-[10px] text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div><strong className="text-slate-800">More convenience:</strong> No need to review every passenger's request before it expires.</div>
                    </div>
                    <div className="flex items-start gap-1.5 text-[10px] text-slate-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div><strong className="text-slate-800">Get more passengers:</strong> They prefer to get an instant answer.</div>
                    </div>
                  </div>
                </div>

                {/* Manual Review Card */}
                <div
                  onClick={() => setInstantBooking(false)}
                  className={`cursor-pointer rounded-2xl border p-4.5 transition flex flex-col justify-between ${
                    !instantBooking
                      ? "border-blue-600 bg-blue-50/10 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className={`h-4.5 w-4.5 ${!instantBooking ? "text-blue-600" : "text-slate-400"}`} />
                        <span className="text-sm font-bold text-slate-900">Review request manually</span>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        !instantBooking ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                      }`}>
                        {!instantBooking && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      You will review and approve or decline passenger requests manually before they expire.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Trip Setup */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Return Trip</h4>
              <label className="block text-sm font-semibold text-slate-700">Coming back as well? Publish your return ride now!</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Return Trip Card */}
                <div
                  onClick={() => setHasReturnRide(true)}
                  className={`cursor-pointer rounded-2xl border p-4.5 transition ${
                    hasReturnRide
                      ? "border-blue-600 bg-blue-50/10 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <RefreshCw className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">Yes, sure!</span>
                        <span className="text-[11px] text-slate-400 block font-semibold mt-0.5">Let's publish the return trip now</span>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      hasReturnRide ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}>
                      {hasReturnRide && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>

                {/* Outbound Only Card */}
                <div
                  onClick={() => setHasReturnRide(false)}
                  className={`cursor-pointer rounded-2xl border p-4.5 transition ${
                    !hasReturnRide
                      ? "border-blue-600 bg-blue-50/10 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                        <Car className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">I'll publish my return ride later</span>
                        <span className="text-[11px] text-slate-400 block font-semibold mt-0.5">Publish outbound trip only</span>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      !hasReturnRide ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                    }`}>
                      {!hasReturnRide && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Return Trip Schedule Fields */}
              {hasReturnRide && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl animate-fade-in mt-2">
                  <Input
                    label="Return Departure Date"
                    type="date"
                    required={hasReturnRide}
                    min={departureDate || new Date().toISOString().split("T")[0]}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                  <Input
                    label="Return Departure Time"
                    type="time"
                    required={hasReturnRide}
                    value={returnTime}
                    onChange={(e) => setReturnTime(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">Additional Notes</h4>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ride Description / Rules</label>
                <textarea
                  placeholder="e.g. Space for one medium suitcase per person. No eating in car, charging ports available..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 flex gap-4">
              <Button variant="outline" type="button" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 animate-pulse-once" loading={loading}>
                Publish Ride Route
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-5 py-4 text-xs font-bold text-white shadow-2xl border border-slate-800 animate-fade-in animate-scale-up">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
