import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { LiveLocation, TrackingSession } from "../types";

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return parseFloat(d.toFixed(2));
}

export function estimateETA(distanceKm: number): number {
  // Assume average speed in city carpooling is 40 km/h (1.5 minutes per km)
  return Math.ceil(distanceKm * 1.5);
}

export const useLiveTracking = (rideId: string, role: "driver" | "passenger", driverId?: string) => {
  const { user } = useAuth();
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  // Store passenger locations in a record mapped by user_id
  const [passengerLocations, setPassengerLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const fetchSession = async () => {
    if (!rideId) return;
    try {
      const { data, error } = await supabase
        .from("ride_tracking_sessions")
        .select("*")
        .eq("ride_id", rideId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // If no tracking session exists, initialize one
          const { data: newSession, error: createError } = await supabase
            .from("ride_tracking_sessions")
            .insert({
              ride_id: rideId,
              status: "inactive",
              driver_shared: false,
              passenger_shared: false,
              driver_arrived: false,
              passenger_picked_up: false,
            })
            .select()
            .single();

          if (createError) throw createError;
          setSession(newSession);
        } else {
          throw error;
        }
      } else {
        setSession(data);
      }
    } catch (err) {
      console.error("Error fetching tracking session:", err);
    }
  };

  const fetchLocations = async () => {
    if (!rideId || !driverId) return;
    try {
      const { data, error } = await supabase
        .from("live_locations")
        .select("*")
        .eq("ride_id", rideId);

      if (error) throw error;

      const pLocs: Record<string, { lat: number; lng: number }> = {};
      let dLoc = null;

      data.forEach((loc) => {
        if (loc.user_id === driverId) {
          dLoc = { lat: loc.latitude, lng: loc.longitude };
        } else {
          pLocs[loc.user_id] = { lat: loc.latitude, lng: loc.longitude };
        }
      });

      if (dLoc) setDriverLocation(dLoc);
      setPassengerLocations(pLocs);
    } catch (err) {
      console.error("Error fetching live locations:", err);
    }
  };

  const updateLocationInDb = async (lat: number, lng: number) => {
    if (!user || !rideId) return;
    try {
      // Upsert into live_locations
      const { error: locationError } = await supabase
        .from("live_locations")
        .upsert(
          {
            ride_id: rideId,
            user_id: user.id,
            latitude: lat,
            longitude: lng,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ride_id,user_id" }
        );

      if (locationError) throw locationError;

      // Also update shared flags in ride_tracking_sessions
      const updateData: Partial<TrackingSession> = {};
      if (role === "driver") {
        updateData.driver_shared = true;
      } else {
        updateData.passenger_shared = true;
      }

      await supabase
        .from("ride_tracking_sessions")
        .update(updateData)
        .eq("ride_id", rideId);
    } catch (err) {
      console.error("Error updating location in db:", err);
    }
  };

  const startSharingLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsSharing(true);

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      if (role === "driver") {
        setDriverLocation({ lat: latitude, lng: longitude });
      } else {
        setPassengerLocations(prev => ({ ...prev, [user!.id]: { lat: latitude, lng: longitude } }));
      }
      updateLocationInDb(latitude, longitude);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error("Error watching geolocation:", error);
      setIsSharing(false);
    };

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    });
  };

  const stopSharingLocation = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsSharing(false);
    
    // Set share status as false in DB
    try {
      const updateData: Record<string, boolean> = {};
      if (role === "driver") {
        updateData.driver_shared = false;
      } else {
        updateData.passenger_shared = false;
      }
      await supabase
        .from("ride_tracking_sessions")
        .update(updateData)
        .eq("ride_id", rideId);
    } catch (e) {
      console.error("Error updates tracking share status:", e);
    }
  };

  const updateSessionStatus = async (status: TrackingSession["status"]) => {
    if (!rideId) return;
    try {
      const { error } = await supabase
        .from("ride_tracking_sessions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("ride_id", rideId);

      if (error) throw error;
      
      // Also update ride table status if changing to active or completed
      if (status === "active") {
        await supabase.from("rides").update({ status: "active" }).eq("id", rideId);
      } else if (status === "completed") {
        await supabase.from("rides").update({ status: "completed" }).eq("id", rideId);
        // Mark bookings for this ride as completed too
        await supabase.from("ride_bookings").update({ status: "completed" }).eq("ride_id", rideId).eq("status", "active");
      }
    } catch (err) {
      console.error("Error updating session status:", err);
    }
  };

  const setDriverArrived = async () => {
    try {
      const { error } = await supabase
        .from("ride_tracking_sessions")
        .update({ driver_arrived: true, status: "pickup" })
        .eq("ride_id", rideId);
      if (error) throw error;
    } catch (err) {
      console.error("Error setting driver arrived:", err);
    }
  };

  const confirmPickup = async () => {
    try {
      const { error } = await supabase
        .from("ride_tracking_sessions")
        .update({ passenger_picked_up: true })
        .eq("ride_id", rideId);
      if (error) throw error;
    } catch (err) {
      console.error("Error setting passenger picked up:", err);
    }
  };

  useEffect(() => {
    if (!rideId) return;

    fetchSession();

    // Subscribe to session changes
    const sessionSub = supabase
      .channel(`public:ride_tracking_sessions:ride_id=eq.${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ride_tracking_sessions",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          setSession(payload.new as TrackingSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionSub);
    };
  }, [rideId]);

  useEffect(() => {
    if (!rideId || !driverId) return;

    fetchLocations();

    // Subscribe to live locations changes
    const locSub = supabase
      .channel(`public:live_locations:ride_id=eq.${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_locations",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const loc = payload.new as LiveLocation;
          if (loc) {
            if (loc.user_id === driverId) {
              setDriverLocation({ lat: loc.latitude, lng: loc.longitude });
            } else {
              setPassengerLocations((prev) => ({
                ...prev,
                [loc.user_id]: { lat: loc.latitude, lng: loc.longitude }
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(locSub);
    };
  }, [rideId, driverId]);

  useEffect(() => {
    return () => {
      stopSharingLocation();
    };
  }, []); // Cleanup sharing on unmount

  // Calculate distance & ETA for each passenger
  const distances: Record<string, number> = {};
  const etas: Record<string, number> = {};

  if (driverLocation) {
    Object.keys(passengerLocations).forEach(userId => {
      const pLoc = passengerLocations[userId];
      const dist = getDistance(driverLocation.lat, driverLocation.lng, pLoc.lat, pLoc.lng);
      distances[userId] = dist;
      etas[userId] = estimateETA(dist);
    });
  }

  return {
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
  };
};
