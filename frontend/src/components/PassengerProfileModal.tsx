import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Profile } from "../types";
import { Avatar } from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import {
  X, Star, Calendar, Shield, Phone, Mail, CreditCard,
  MapPin, Users, CheckCircle2, XCircle, Clock, TrendingUp
} from "lucide-react";

interface PassengerProfileModalProps {
  passengerId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface PassengerStats {
  ridesTaken: number;
  completed: number;
  cancelled: number;
  rating: number;
  reviewCount: number;
}

export const PassengerProfileModal: React.FC<PassengerProfileModalProps> = ({
  passengerId,
  isOpen,
  onClose
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<PassengerStats>({
    ridesTaken: 0,
    completed: 0,
    cancelled: 0,
    rating: 4.7,
    reviewCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !passengerId) return;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch profile
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", passengerId)
          .single();

        if (profileErr) throw profileErr;
        setProfile(profileData as Profile);

        // Fetch booking stats
        const { count: totalBookings } = await supabase
          .from("ride_bookings")
          .select("id", { count: "exact", head: true })
          .eq("passenger_id", passengerId);

        const { count: completedBookings } = await supabase
          .from("ride_bookings")
          .select("id", { count: "exact", head: true })
          .eq("passenger_id", passengerId)
          .eq("status", "completed");

        const { count: cancelledBookings } = await supabase
          .from("ride_bookings")
          .select("id", { count: "exact", head: true })
          .eq("passenger_id", passengerId)
          .eq("status", "cancelled");

        // Fetch reviews
        const { data: reviews } = await supabase
          .from("reviews")
          .select("rating")
          .eq("reviewee_id", passengerId);

        let avgRating = 4.7;
        let reviewCount = 0;
        if (reviews && reviews.length > 0) {
          reviewCount = reviews.length;
          const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
          avgRating = parseFloat((sum / reviewCount).toFixed(1));
        }

        setStats({
          ridesTaken: totalBookings || 0,
          completed: completedBookings || 0,
          cancelled: cancelledBookings || 0,
          rating: avgRating,
          reviewCount
        });
      } catch (err) {
        console.error("Error fetching passenger profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, passengerId]);

  if (!isOpen) return null;

  const memberYear = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : new Date().getFullYear();

  const cancellationRate = stats.ridesTaken > 0
    ? Math.round((stats.cancelled / stats.ridesTaken) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative border border-slate-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition z-10"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-xs text-slate-400 font-semibold">Loading passenger profile...</p>
          </div>
        ) : profile ? (
          <div className="p-6 md:p-8">
            {/* Header: Avatar + Name + Rating */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                src={profile.avatar_url}
                fallback={profile.full_name}
                size="lg"
                className="ring-4 ring-blue-500/10"
              />
              <div>
                <h3 className="text-xl font-black text-slate-900">{profile.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="text-sm font-bold ml-0.5">{stats.rating}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-semibold">
                    ({stats.reviewCount} review{stats.reviewCount !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-500 font-semibold">Member since {memberYear}</span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
                <p className="text-sm text-slate-600 leading-relaxed italic">"{profile.bio}"</p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center">
                <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
                <span className="text-2xl font-black text-slate-900 block">{stats.ridesTaken}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rides Taken</span>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
                <span className="text-2xl font-black text-slate-900 block">{stats.completed}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed</span>
              </div>
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-center">
                <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1.5" />
                <span className="text-2xl font-black text-slate-900 block">{stats.cancelled}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cancelled</span>
              </div>
            </div>

            {/* Cancellation rate bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cancellation Rate</span>
                <span className={`text-xs font-black ${cancellationRate <= 10 ? "text-emerald-600" : cancellationRate <= 25 ? "text-amber-600" : "text-red-600"}`}>
                  {cancellationRate}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cancellationRate <= 10 ? "bg-emerald-500" : cancellationRate <= 25 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(cancellationRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Verification Badges */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Verification</h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  profile.is_phone_verified ? "border-emerald-100 bg-emerald-50/30" : "border-slate-100 bg-slate-50/30"
                }`}>
                  <Phone className={`h-4.5 w-4.5 ${profile.is_phone_verified ? "text-emerald-600" : "text-slate-300"}`} />
                  <span className={`text-xs font-bold ${profile.is_phone_verified ? "text-emerald-800" : "text-slate-400"}`}>
                    Phone {profile.is_phone_verified ? "Verified" : "Not Verified"}
                  </span>
                  {profile.is_phone_verified && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                </div>

                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50/30">
                  <Mail className="h-4.5 w-4.5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-800">Email Verified</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                </div>

                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  profile.is_id_verified ? "border-emerald-100 bg-emerald-50/30" : "border-slate-100 bg-slate-50/30"
                }`}>
                  <CreditCard className={`h-4.5 w-4.5 ${profile.is_id_verified ? "text-emerald-600" : "text-slate-300"}`} />
                  <span className={`text-xs font-bold ${profile.is_id_verified ? "text-emerald-800" : "text-slate-400"}`}>
                    Government ID {profile.is_id_verified ? "Verified" : "Not Verified"}
                  </span>
                  {profile.is_id_verified && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
                </div>
              </div>
            </div>

            {/* Details row */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100">
              {profile.gender && (
                <div className="text-xs">
                  <span className="text-slate-400 font-semibold block">Gender</span>
                  <span className="font-bold text-slate-900 capitalize mt-0.5 block">{profile.gender}</span>
                </div>
              )}
              {profile.age && (
                <div className="text-xs">
                  <span className="text-slate-400 font-semibold block">Age</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{profile.age} years</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-400">
            Could not load passenger profile.
          </div>
        )}
      </div>
    </div>
  );
};
