import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLiveTracking } from "../hooks/useLiveTracking";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../lib/supabase";
import { Ride, Profile } from "../types";
import { MapComponent } from "../components/MapComponent";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { 
  Navigation, MapPin, CheckCircle, Navigation2, Shield, 
  Star, AlertTriangle, CheckSquare, Smile, ShieldCheck, Compass, Users
} from "lucide-react";
import { formatPrice } from "../lib/utils";

export const LiveTracking: React.FC = () => {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createNotification } = useNotifications();

  const [ride, setRide] = useState<Ride | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<Profile | null>(null);
  const [passengerProfiles, setPassengerProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Rating states
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [experienceRating, setExperienceRating] = useState(5);
  const [safetyRating, setSafetyRating] = useState(5);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Determine user role in this ride
  const isDriver = ride && user && ride.driver_id === user.id;
  const roleStr = isDriver ? "driver" : "passenger";

  // Connect to custom live tracking hook
  const {
    driverLocation,
    passengerLocations,
    distances,
    etas,
    session,
    isSharing,
    startSharingLocation,
    stopSharingLocation,
    updateSessionStatus,
    setDriverArrived,
    confirmPickup,
  } = useLiveTracking(rideId || "", roleStr, ride?.driver_id);

  const fetchRideInfo = async () => {
    if (!rideId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rides")
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(*)
        `)
        .eq("id", rideId)
        .single();

      if (error) throw error;
      setRide(data as unknown as Ride);

      // Fetch partner details
      if (data.driver_id === user.id) {
        // Find all accepted passengers for this ride
        const { data: bookingData } = await supabase
          .from("ride_bookings")
          .select("passenger:profiles!ride_bookings_passenger_id_fkey(*)")
          .eq("ride_id", rideId)
          .eq("status", "accepted");

        if (bookingData && bookingData.length > 0) {
          const passengers = bookingData.map(b => b.passenger as unknown as Profile);
          setPassengerProfiles(passengers);
          setPartnerProfile(passengers[0]); // Primary partner for rating UI simplification
        }
      } else {
        setPartnerProfile(data.driver as unknown as Profile);
      }
    } catch (e) {
      console.error("Error loading tracking ride details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRideInfo();
  }, [rideId, user]);

  // Watch for completed status to open rating modal
  useEffect(() => {
    if (session?.status === "completed") {
      stopSharingLocation();
      setRatingModalOpen(true);
    }
  }, [session?.status]);

  // Handle Workflow Button Actions
  const handleDriverArrivedClick = async () => {
    await setDriverArrived();
    if (isDriver) {
      for (const p of passengerProfiles) {
        await createNotification(
          p.id,
          "driver_arrived",
          "Driver Arrived",
          `${ride?.driver?.full_name || "Your driver"} has reached the pickup point.`,
          rideId
        );
      }
    }
  };

  const handleConfirmPickupClick = async () => {
    await confirmPickup();
    if (partnerProfile) {
      await createNotification(
        partnerProfile.id, // driver
        "passenger_picked_up",
        "Pickup Confirmed",
        `Passenger confirmed pickup. Enjoy your journey!`,
        rideId
      );
    }
  };

  const handleStartRideClick = async () => {
    await updateSessionStatus("active");
    if (isDriver) {
      for (const p of passengerProfiles) {
        await createNotification(
          p.id,
          "ride_started",
          "Ride Started",
          `Your ride to ${ride?.destination} has officially started!`,
          rideId
        );
      }
    }
  };

  const handleShareLocationClick = async () => {
    startSharingLocation();

    // Only send the link if we are the driver
    if (isDriver && user) {
      const trackingUrl = `${window.location.origin}/live-tracking/${rideId}`;
      const msgText = `📍 I have started sharing my live location! Track my ride here: ${trackingUrl}`;

      try {
        for (const p of passengerProfiles) {
          // 1. Get or create conversation
          let convId = null;
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("ride_id", rideId)
            .eq("passenger_id", p.id)
            .single();

          if (existingConv) {
            convId = existingConv.id;
          } else {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({ ride_id: rideId, driver_id: user.id, passenger_id: p.id })
              .select("id")
              .single();
            if (newConv) convId = newConv.id;
          }

          // 2. Insert message into inbox
          if (convId) {
            await supabase.from("messages").insert({
              conversation_id: convId,
              sender_id: user.id,
              message: msgText,
              message_type: "coordination"
            });
          }

          // 3. Mock Email Log
          console.log(`[MOCK EMAIL to ${p.full_name}]: ${msgText}`);
        }
        
        // Show success alert to driver
        alert("Live location link sent to passengers' registered email and inbox!");
      } catch (err) {
        console.error("Failed to notify passengers of location share:", err);
      }
    }
  };

  const handleEndRideClick = async () => {
    await updateSessionStatus("completed");
    if (isDriver) {
      for (const p of passengerProfiles) {
        await createNotification(
          p.id,
          "ride_completed",
          "Ride Completed",
          `Your ride to ${ride?.destination} has ended. Please leave a rating!`,
          rideId
        );
      }
    }
  };

  // Submit Rating
  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rideId || !partnerProfile) return;
    setRatingSubmitting(true);

    try {
      const reviewPayload = {
        ride_id: rideId,
        reviewer_id: user.id,
        reviewee_id: partnerProfile.id,
        rating,
        experience_rating: isDriver ? null : experienceRating,
        safety_rating: isDriver ? null : safetyRating,
        punctuality_rating: isDriver ? null : punctualityRating,
        comment: ratingComment.trim() || null,
      };

      const { error } = await supabase.from("reviews").insert(reviewPayload);
      if (error) throw error;

      setRatingModalOpen(false);
      navigate("/dashboard");
    } catch (e) {
      console.error("Error submitting rating review:", e);
      alert("Failed to submit review. Returning to dashboard.");
      navigate("/dashboard");
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 animate-pulse">
        <div className="h-96 rounded-3xl bg-slate-100 border" />
      </div>
    );
  }

  if (!ride || (!partnerProfile && !isDriver) || !session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-900">Tracking Session Unavailable</h3>
        <p className="mt-2 text-sm text-slate-500">
          Tracking is only accessible once a passenger booking has been Accepted by the driver.
        </p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Compass className="h-6 w-6 text-blue-600 animate-spin-slow" />
            <span>Trip Coordination Board</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 capitalize">
            Active tracking for: {ride.source} &rarr; {ride.destination} ({roleStr} view)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-bold uppercase">Trip Status:</span>
          <Badge variant={
            session.status === "inactive" ? "secondary" :
            session.status === "pickup" ? "warning" :
            session.status === "active" ? "success" : "default"
          } className="capitalize py-1 px-3">
            {session.status === "pickup" ? "Approaching Pickup" : session.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tracking Map Display */}
        <div className="lg:col-span-2 space-y-4">
          <MapComponent
            driverLoc={driverLocation}
            passengerLocs={passengerLocations}
            pickupLocName={ride.pickup_location}
            dropLocName={ride.drop_location}
            height="500px"
          />
        </div>

        {/* Live Panel & Workflow Actions */}
        <div className="space-y-6">
          {/* Live Metrics Board */}
          <Card className="border border-slate-100 shadow-lg bg-white rounded-2xl p-5 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live GPS Metrics</h3>
            
            {/* GPS Toggle Sharing Button */}
            <div>
              {isSharing ? (
                <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50" onClick={stopSharingLocation}>
                  <Navigation2 className="mr-1.5 h-4 w-4 rotate-45 text-red-500 animate-pulse" />
                  Stop Sharing GPS
                </Button>
              ) : (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleShareLocationClick}>
                  <Navigation className="mr-1.5 h-4 w-4" />
                  Share My Location
                </Button>
              )}
            </div>

            {/* Distance & ETA Cards per passenger (Driver view) or just driver (Passenger view) */}
            <div className="space-y-3">
              {isDriver ? (
                passengerProfiles.map(p => {
                  const dist = distances[p.id];
                  const eta = etas[p.id];
                  return (
                    <div key={p.id} className="bg-slate-50 border rounded-xl p-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name} className="w-8 h-8 rounded-full border" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {p.full_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1 max-w-[100px]">{p.full_name}</p>
                          <p className="text-[10px] text-slate-500">Passenger</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900">{dist !== undefined ? `${dist} km` : "Offline"}</div>
                        <div className="text-xs font-bold text-blue-600">{eta !== undefined ? `${eta} min ETA` : "--"}</div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="bg-slate-50 border rounded-xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {partnerProfile?.avatar_url ? (
                      <img src={partnerProfile.avatar_url} alt={partnerProfile.full_name} className="w-8 h-8 rounded-full border" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {partnerProfile?.full_name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900">Driver</p>
                      <p className="text-[10px] text-slate-500">{partnerProfile?.full_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">{distances[user?.id || ""] !== undefined ? `${distances[user!.id]} km` : "Offline"}</div>
                    <div className="text-xs font-bold text-blue-600">{etas[user?.id || ""] !== undefined ? `${etas[user!.id]} min ETA` : "--"}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Location Sharing status icons */}
            <div className="space-y-2 border-t border-slate-50 pt-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Driver GPS Broadcast:</span>
                <span className="flex items-center gap-1 font-bold">
                  {session.driver_shared ? (
                    <span className="text-emerald-500 flex items-center gap-1">
                      <ShieldCheck className="h-4.5 w-4.5" /> Broadcasting
                    </span>
                  ) : (
                    <span className="text-slate-400">Offline</span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500">Passengers Broadcasting:</span>
                <span className="flex items-center gap-1 font-bold">
                  <span className="text-slate-900">{Object.keys(passengerLocations).length} Active</span>
                </span>
              </div>
            </div>
          </Card>

          {/* Workflow Stepper Action Buttons */}
          <Card className="border border-slate-100 shadow-lg bg-white rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Workflow Control</h3>

            {/* Stepper Status Indicators */}
            <div className="flex items-center gap-2 pb-2 mb-2 border-b text-[11px] font-semibold text-slate-500">
              <span className={session.driver_arrived ? "text-blue-600 font-bold" : ""}>1. Arrived</span>
              <span>&rarr;</span>
              <span className={session.passenger_picked_up ? "text-blue-600 font-bold" : ""}>2. Picked Up</span>
              <span>&rarr;</span>
              <span className={session.status === "active" ? "text-emerald-500 font-bold" : ""}>3. Transit</span>
            </div>

            {/* Driver Actions */}
            {isDriver && (
              <div className="space-y-3">
                {/* Step 1: Arrived at Pickup */}
                {!session.driver_arrived && (
                  <Button className="w-full py-3 bg-amber-500 hover:bg-amber-600" onClick={handleDriverArrivedClick}>
                    Mark I Have Arrived
                  </Button>
                )}

                {/* Step 2: Passenger Confirm Pickup waiting state */}
                {session.driver_arrived && !session.passenger_picked_up && (
                  <div className="rounded-xl bg-slate-50 p-4 border border-dashed border-slate-200 text-center text-xs text-slate-500 italic">
                    Waiting for Passenger(s) to Confirm Pickup...
                  </div>
                )}

                {/* Step 3: Start Ride when both completed */}
                {session.driver_arrived && session.passenger_picked_up && session.status !== "active" && (
                  <Button className="w-full py-3 bg-blue-600 hover:bg-blue-700" onClick={handleStartRideClick}>
                    Start Ride / Begin Trip Route
                  </Button>
                )}

                {/* Step 4: End Ride during active transit */}
                {session.status === "active" && (
                  <Button variant="destructive" className="w-full py-3" onClick={handleEndRideClick}>
                    End Ride / Complete Route
                  </Button>
                )}
              </div>
            )}

            {/* Passenger Actions */}
            {!isDriver && (
              <div className="space-y-3">
                {/* Passenger waiting for driver arrival */}
                {!session.driver_arrived && (
                  <div className="rounded-xl bg-slate-50 p-4 border border-dashed border-slate-200 text-center text-xs text-slate-500 italic">
                    Waiting for Driver to Reach Pickup Landmark...
                  </div>
                )}

                {/* Step 2: Passenger Confirms Pickup */}
                {session.driver_arrived && !session.passenger_picked_up && (
                  <Button className="w-full py-3 bg-emerald-500 hover:bg-emerald-600" onClick={handleConfirmPickupClick}>
                    Confirm I am In the Vehicle
                  </Button>
                )}

                {/* Ride is started status */}
                {session.passenger_picked_up && session.status !== "active" && session.status !== "completed" && (
                  <div className="rounded-xl bg-slate-50 p-4 border border-dashed border-slate-200 text-center text-xs text-slate-500 italic">
                    Waiting for Driver to Start the Trip...
                  </div>
                )}

                {/* Transit display */}
                {session.status === "active" && (
                  <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100 text-center text-xs text-blue-800 font-bold animate-pulse">
                    Currently in Transit to Destination
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Post-Ride Rating Feedback Modal */}
      <Modal isOpen={ratingModalOpen} onClose={() => navigate("/dashboard")} title="Rate Your Trip Experience">
        <form onSubmit={handleRatingSubmit} className="space-y-5">
          <div className="text-center pb-2">
            <h4 className="text-base font-bold text-slate-900">How was your trip with {partnerProfile?.full_name}?</h4>
            <p className="text-xs text-slate-400 mt-1">Help maintain community standards by leaving review scores.</p>
          </div>

          {/* Primary Star Rating */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 text-center mb-2">Overall Star Rating</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((stars) => (
                <button
                  key={stars}
                  type="button"
                  onClick={() => setRating(stars)}
                  className="p-1 focus:outline-none"
                >
                  <Star className={`h-8 w-8 transition ${
                    stars <= rating ? "text-amber-400 fill-amber-400 scale-110" : "text-slate-200"
                  }`} />
                </button>
              ))}
            </div>
          </div>

          {/* Passenger Feedback Dimensions */}
          {!isDriver && (
            <div className="space-y-4 border-t border-b border-slate-50 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Ride Experience / Comfort</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button key={stars} type="button" onClick={() => setExperienceRating(stars)}>
                      <Star className={`h-4.5 w-4.5 ${stars <= experienceRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Driver Safety & Conduct</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button key={stars} type="button" onClick={() => setSafetyRating(stars)}>
                      <Star className={`h-4.5 w-4.5 ${stars <= safetyRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Punctuality & Timing</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((stars) => (
                    <button key={stars} type="button" onClick={() => setPunctualityRating(stars)}>
                      <Star className={`h-4.5 w-4.5 ${stars <= punctualityRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Comments or Feedback (Optional)</label>
            <textarea
              placeholder="e.g. John was incredibly punctual, car was super clean, and he was an absolute pleasure to chat with!"
              rows={3}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <Button type="submit" className="w-full py-3" loading={ratingSubmitting}>
            Submit Feedback & Return to Dashboard
          </Button>
        </form>
      </Modal>
    </div>
  );
};
