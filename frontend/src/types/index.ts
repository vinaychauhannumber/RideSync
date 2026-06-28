export interface VehicleDetails {
  type: string;
  model: string;
  color: string;
  number: string;
  year: number;
}

export type UserRole = "passenger" | "driver" | "admin";
export type RideStatus = "scheduled" | "active" | "completed" | "cancelled";
export type BookingStatus = "pending" | "accepted" | "rejected" | "cancelled" | "active" | "completed";
export type TrackingStatus = "inactive" | "pickup" | "active" | "completed";

export interface TravelPreferences {
  chatty: "silent" | "comfortable" | "talkative";
  music: "no_music" | "depending_on_mood" | "all_the_time";
  smoking: "no_smoking" | "breaks_only" | "allowed";
  pets: "no_pets" | "depending_on_animal" | "allowed";
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  gender: "male" | "female" | "other" | null;
  phone_number: string | null;
  age: number | null;
  bio: string | null;
  vehicle_details: VehicleDetails | null;
  license_number: string | null;
  is_verified: boolean;
  role: UserRole;
  preferences?: TravelPreferences | null;
  is_id_verified?: boolean;
  is_phone_verified?: boolean;
  vehicles?: VehicleDetails[] | null;
  recent_searches?: { from: string; to: string; date: string; passengers: number }[] | null;
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  driver_id: string;
  source: string;
  destination: string;
  pickup_location: string;
  drop_location: string;
  departure_date: string;
  departure_time: string;
  total_seats: number;
  available_seats: number;
  price_per_seat: number;
  vehicle_type: string;
  vehicle_number: string;
  description: string | null;
  status: RideStatus;
  instant_booking: boolean;
  pickup_address: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_address: string | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  estimated_distance: number | null;
  estimated_duration: number | null;
  created_at: string;
  driver?: Profile;
}

export interface Booking {
  id: string;
  ride_id: string;
  passenger_id: string;
  driver_id?: string;
  seats_booked: number;
  note: string | null;
  status: BookingStatus;
  created_at: string;
  ride?: Ride;
  passenger?: Profile;
  driver?: Profile;
}

export interface Conversation {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  created_at: string;
  ride?: Ride;
  driver?: Profile;
  passenger?: Profile;
  messages?: Message[];
  unread_count?: number;
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: "text" | "coordination";
  read_status: "sent" | "delivered" | "read";
  created_at: string;
  sender?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  link_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  ride_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  experience_rating: number | null;
  safety_rating: number | null;
  punctuality_rating: number | null;
  comment: string | null;
  created_at: string;
  reviewer?: Profile;
  reviewee?: Profile;
}

export interface LiveLocation {
  id: string;
  ride_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface TrackingSession {
  ride_id: string;
  status: TrackingStatus;
  driver_location_lat: number | null;
  driver_location_lng: number | null;
  passenger_location_lat: number | null;
  passenger_location_lng: number | null;
  driver_shared: boolean;
  passenger_shared: boolean;
  driver_arrived: boolean;
  passenger_picked_up: boolean;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  status: "paid" | "pending" | "refunded";
  payment_method: string;
  created_at: string;
  booking?: Booking;
}

export interface Transfer {
  id: string;
  driver_id: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  bank_name: string;
  account_number: string;
  created_at: string;
}
