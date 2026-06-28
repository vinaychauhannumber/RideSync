import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Starting Pre-Ride Tracking Worker...");
console.log("Polling every 1 minute for rides departing in 10 minutes...");

// Function to simulate sending an email
async function sendEmail(to, subject, body) {
  console.log("\n--------------------------------------------------");
  console.log(`📧 MOCK EMAIL SENT TO: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log("--------------------------------------------------\n");
}

async function checkAndActivateTracking() {
  try {
    const now = new Date();
    // Add 10 minutes to current time
    const targetTime = new Date(now.getTime() + 10 * 60000);

    // Get all scheduled rides
    const { data: rides, error: ridesError } = await supabase
      .from("rides")
      .select("*, driver:profiles!rides_driver_id_fkey(*)")
      .in("status", ["scheduled"]);

    if (ridesError) throw ridesError;

    for (const ride of rides) {
      // Combine departure_date and departure_time
      // Format is usually YYYY-MM-DD and HH:MM:SS
      const departureDateTimeStr = `${ride.departure_date}T${ride.departure_time}`;
      const departureDate = new Date(departureDateTimeStr);

      // Check if departure time is within the next 10 to 11 minutes
      // This prevents triggering multiple times if the cron runs every minute
      const diffMs = departureDate.getTime() - now.getTime();
      const diffMinutes = diffMs / 60000;

      if (diffMinutes > 9 && diffMinutes <= 11) {
        console.log(`Ride ${ride.id} is departing in ~10 minutes. Activating tracking...`);

        // Check if session already exists
        const { data: existingSession } = await supabase
          .from("ride_tracking_sessions")
          .select("*")
          .eq("ride_id", ride.id)
          .single();

        if (existingSession && existingSession.status !== "inactive") {
          console.log(`Session for ride ${ride.id} is already active/pickup.`);
          continue; // Already processed
        }

        // Create or update tracking session to 'pickup' (or active)
        if (existingSession) {
          await supabase
            .from("ride_tracking_sessions")
            .update({ status: "pickup" })
            .eq("ride_id", ride.id);
        } else {
          await supabase.from("ride_tracking_sessions").insert({
            ride_id: ride.id,
            status: "pickup",
            driver_shared: false,
            passenger_shared: false,
            driver_arrived: false,
            passenger_picked_up: false,
          });
        }

        // Fetch accepted bookings
        const { data: bookings } = await supabase
          .from("ride_bookings")
          .select("*, passenger:profiles!ride_bookings_passenger_id_fkey(*)")
          .eq("ride_id", ride.id)
          .eq("status", "accepted");

        const driver = ride.driver;
        const driverEmail = "driver@ridesync.com"; // Mock email or get from auth if possible (Supabase Admin API needed for auth.users, but we use mock)

        // 1. Notify Driver
        await sendEmail(
          driverEmail, // We don't have direct access to email from profiles, using mock
          `Location sharing started for your ride to ${ride.destination}`,
          `Hello ${driver.full_name},\n\nLocation sharing has started. Passengers can now track your live location until pickup.\n\nOpen your dashboard to start sharing.`
        );

        await supabase.from("notifications").insert({
          user_id: driver.id,
          type: "tracking_started",
          title: "Location Sharing Started",
          content: "Location sharing has started for your upcoming ride. Passengers can now track your live location.",
          link_id: ride.id,
        });

        // 2. Notify Passengers
        if (bookings && bookings.length > 0) {
          for (const booking of bookings) {
            const passenger = booking.passenger;
            const passengerEmail = "passenger@ridesync.com"; // Mock

            await sendEmail(
              passengerEmail,
              `Location sharing started for your ride to ${ride.destination}`,
              `Hello ${passenger.full_name},\n\nLocation sharing has started. Driver can now see your live location until pickup.\n\nOpen your booking details to start sharing.`
            );

            await supabase.from("notifications").insert({
              user_id: passenger.id,
              type: "tracking_started",
              title: "Location Sharing Started",
              content: "Location sharing has started for your upcoming ride. The driver can now see your live location.",
              link_id: ride.id,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in tracking worker:", error);
  }
}

// Run immediately once, then every 60 seconds
checkAndActivateTracking();
setInterval(checkAndActivateTracking, 60000);
