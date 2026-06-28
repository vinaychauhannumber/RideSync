import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { 
  User, Car, Check, AlertCircle, MessageSquare, Phone, Mail, Lock, MapPin, 
  CreditCard, HelpCircle, LogOut, X, ChevronRight, TrendingUp, Landmark, Plus, 
  Trash2, Music, Smile, Ban, PawPrint, Star, Shield, ShieldCheck, ChevronDown, CheckCircle2,
  FileText, ShieldAlert, Sparkles, BellRing
} from "lucide-react";

export const ProfilePage: React.FC = () => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"about_you" | "account">("about_you");
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);

  // Profile fields state
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  
  // Loading indicators
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modals state
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [isEditPreferencesOpen, setIsEditPreferencesOpen] = useState(false);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);

  // Preference fields state
  const [prefChatty, setPrefChatty] = useState<"silent" | "comfortable" | "talkative">("comfortable");
  const [prefMusic, setPrefMusic] = useState<"no_music" | "depending_on_mood" | "all_the_time">("depending_on_mood");
  const [prefSmoking, setPrefSmoking] = useState<"no_smoking" | "breaks_only" | "allowed">("no_smoking");
  const [prefPets, setPrefPets] = useState<"no_pets" | "depending_on_animal" | "allowed">("depending_on_animal");

  // Multi-vehicle state
  const [vehiclesList, setVehiclesList] = useState<any[]>([]);
  const [vehType, setVehType] = useState("sedan");
  const [vehModel, setVehModel] = useState("");
  const [vehColor, setVehColor] = useState("");
  const [vehNumber, setVehNumber] = useState("");
  const [vehYear, setVehYear] = useState("");

  // ID Verification simulator state
  const [idVerifyOpen, setIdVerifyOpen] = useState(false);
  const [idVerifyStep, setIdVerifyStep] = useState<"idle" | "uploading" | "scanning" | "completed">("idle");
  const [selectedDocType, setSelectedDocType] = useState("passport");

  // Phone OTP Verification simulator state
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false);
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<"idle" | "sending" | "otp_challenge" | "completed">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");

  // Ratings mockup state
  const reviewsList = [
    { id: 1, author: "Aman Gupta", rating: 5, comment: "Vinay was super friendly and drove extremely safely. The car was spotless. Highly recommend!", date: "2026-06-20T12:00:00Z" },
    { id: 2, author: "Sneha Reddy", rating: 5, comment: "Great company! Had a wonderful chat about photography and travel. 10/10 experience.", date: "2026-06-18T16:30:00Z" },
    { id: 3, author: "Rahul Verma", rating: 4, comment: "Punctual, friendly and comfortable driving. Will join again.", date: "2026-06-14T09:45:00Z" }
  ];

  // Saved passengers mockup state
  const [savedPassengers, setSavedPassengers] = useState<any[]>([
    { id: 1, name: "Aman Gupta", rating: 4.8, trips: 3, avatar: "" },
    { id: 2, name: "Sneha Reddy", rating: 4.9, trips: 2, avatar: "" }
  ]);
  const [newPassengerName, setNewPassengerName] = useState("");

  // Address search mockup state
  const [addressSearch, setAddressSearch] = useState("");
  const [addressResult, setAddressResult] = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  // Communications toggles mockup state
  const [commEmails, setCommEmails] = useState(true);
  const [commSms, setCommSms] = useState(false);
  const [commPush, setCommPush] = useState(true);

  // Password reset mockup state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  // Account closure mockup state
  const [closeReason, setCloseReason] = useState("");
  const [closeConfirm, setCloseConfirm] = useState(false);

  // Sync profile details on mount
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setAvatarUrl(profile.avatar_url || "");
      setBio(profile.bio || "");
      setAge(profile.age ? String(profile.age) : "");
      setGender(profile.gender || "");
      setPhone(profile.phone_number || "");
      setLicenseNumber(profile.license_number || "");
      
      // Load preferences from JSON
      if (profile.preferences) {
        setPrefChatty(profile.preferences.chatty || "comfortable");
        setPrefMusic(profile.preferences.music || "depending_on_mood");
        setPrefSmoking(profile.preferences.smoking || "no_smoking");
        setPrefPets(profile.preferences.pets || "depending_on_animal");
      }
      
      // Load vehicles
      if (profile.vehicles && Array.isArray(profile.vehicles)) {
        setVehiclesList(profile.vehicles);
      } else if (profile.vehicle_details) {
        // Fallback for legacy database field
        setVehiclesList([profile.vehicle_details]);
      }
    }
  }, [profile]);

  // Handle profile edit form submission
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl || null,
        bio: bio || null,
        age: age ? Number(age) : null,
        gender: (gender as any) || null,
        phone_number: phone || null,
        license_number: licenseNumber || null
      });
      setSuccessMessage("Personal details updated successfully!");
      setIsEditDetailsOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile details");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle preferences update
  const handleSavePreferences = async () => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const prefs = {
        chatty: prefChatty,
        music: prefMusic,
        smoking: prefSmoking,
        pets: prefPets
      };
      await updateProfile({
        preferences: prefs
      });
      setSuccessMessage("Travel preferences saved successfully!");
      setIsEditPreferencesOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle multi-vehicle addition
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehModel || !vehColor || !vehNumber || !vehYear) return;
    setIsSaving(true);
    try {
      const newVeh = {
        type: vehType,
        model: vehModel,
        color: vehColor,
        number: vehNumber,
        year: Number(vehYear),
        isPrimary: vehiclesList.length === 0 // Make primary if first vehicle
      };
      const updated = [...vehiclesList, newVeh];
      await updateProfile({
        vehicles: updated,
        // Legacy sync
        vehicle_details: newVeh.isPrimary ? newVeh : profile?.vehicle_details
      });
      setVehiclesList(updated);
      setIsAddVehicleOpen(false);
      // Clear form
      setVehModel("");
      setVehColor("");
      setVehNumber("");
      setVehYear("");
      setSuccessMessage("Vehicle registered successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add vehicle");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete vehicle
  const handleDeleteVehicle = async (index: number) => {
    if (!window.confirm("Are you sure you want to remove this vehicle?")) return;
    try {
      const updated = vehiclesList.filter((_, i) => i !== index);
      // Re-assign primary if deleted one was primary
      if (updated.length > 0 && !updated.some(v => v.isPrimary)) {
        updated[0].isPrimary = true;
      }
      await updateProfile({
        vehicles: updated,
        vehicle_details: updated.find(v => v.isPrimary) || null
      });
      setVehiclesList(updated);
      setSuccessMessage("Vehicle removed successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to remove vehicle");
    }
  };

  // Mark vehicle as primary
  const handleSetPrimaryVehicle = async (index: number) => {
    try {
      const updated = vehiclesList.map((v, i) => ({
        ...v,
        isPrimary: i === index
      }));
      await updateProfile({
        vehicles: updated,
        vehicle_details: updated[index]
      });
      setVehiclesList(updated);
      setSuccessMessage(`Set ${updated[index].model} as primary vehicle.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to set primary vehicle");
    }
  };

  // ID Verification process simulator
  const startIdVerification = () => {
    setIdVerifyOpen(true);
    setIdVerifyStep("idle");
  };

  const handleSimulateIdUpload = () => {
    setIdVerifyStep("uploading");
    setTimeout(() => {
      setIdVerifyStep("scanning");
      setTimeout(async () => {
        try {
          await updateProfile({ is_id_verified: true });
          setIdVerifyStep("completed");
          setSuccessMessage("Government ID verified successfully! Green badge unlocked.");
        } catch (err) {
          setIdVerifyStep("idle");
          alert("Simulation error saving verify state");
        }
      }, 2500);
    }, 1500);
  };

  // Phone SMS process simulator
  const startPhoneVerification = () => {
    if (!phone) {
      alert("Please update your phone number in Personal Details first!");
      return;
    }
    setPhoneVerifyOpen(true);
    setPhoneVerifyStep("idle");
  };

  const handleSendOtp = () => {
    setPhoneVerifyStep("sending");
    setTimeout(() => {
      setPhoneVerifyStep("otp_challenge");
      setOtpCode("");
      setOtpError("");
    }, 1200);
  };

  const handleVerifyOtp = async () => {
    if (otpCode !== "123456" && otpCode !== "654321") {
      setOtpError("Invalid code! Try '123456' for simulation.");
      return;
    }
    setPhoneVerifyStep("sending"); // Loader
    setTimeout(async () => {
      try {
        await updateProfile({ is_phone_verified: true });
        setPhoneVerifyStep("completed");
        setSuccessMessage("Phone number verified successfully!");
      } catch (err) {
        setPhoneVerifyStep("otp_challenge");
      }
    }, 1000);
  };

  // Address search mockup simulator
  const handleAddressSearch = () => {
    if (!addressSearch) return;
    setAddressLoading(true);
    setTimeout(() => {
      setAddressResult(`${addressSearch}, New Delhi, DL, 110001, India`);
      setAddressLoading(false);
    }, 1000);
  };

  // Saved passengers mockup adder
  const handleAddSavedPassenger = () => {
    if (!newPassengerName) return;
    const newPassenger = {
      id: Date.now(),
      name: newPassengerName,
      rating: 5.0,
      trips: 1,
      avatar: ""
    };
    setSavedPassengers([...savedPassengers, newPassenger]);
    setNewPassengerName("");
  };

  // Password reset mockup simulator
  const handlePasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    setPassLoading(true);
    setTimeout(() => {
      setPassLoading(false);
      setNewPassword("");
      setConfirmPassword("");
      alert("Password updated successfully!");
      setActiveSubTab(null);
    }, 1500);
  };

  // Format Helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Alerts */}
        {successMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-100 mb-6 shadow-sm animate-scale-up">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-grow">{successMessage}</div>
            <button onClick={() => setSuccessMessage("")} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-800 border border-red-100 mb-6 shadow-sm animate-scale-up">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-grow">{errorMessage}</div>
            <button onClick={() => setErrorMessage("")} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tab Selector Header */}
        <div className="flex border-b border-slate-200 mb-8 bg-white rounded-t-3xl shadow-sm overflow-hidden">
          <button
            onClick={() => { setActiveTab("about_you"); setActiveSubTab(null); }}
            className={`w-1/2 py-4 text-center font-bold text-sm transition relative ${
              activeTab === "about_you" 
                ? "text-blue-600 bg-blue-50/10" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            About you
            {activeTab === "about_you" && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => { setActiveTab("account"); setActiveSubTab(null); }}
            className={`w-1/2 py-4 text-center font-bold text-sm transition relative ${
              activeTab === "account" 
                ? "text-blue-600 bg-blue-50/10" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Account
            {activeTab === "account" && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />
            )}
          </button>
        </div>

        {/* TAB 1: ABOUT YOU */}
        {activeTab === "about_you" && (
          <div className="space-y-6">
            
            {/* Header / Basic details */}
            <Card className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                  <div className="relative">
                    <Avatar src={avatarUrl} fallback={fullName || "Vinay"} size="xl" className="ring-4 ring-blue-50" />
                    {(profile?.is_id_verified || profile?.is_verified) && (
                      <span className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1 border-2 border-white shadow-md">
                        <ShieldCheck className="h-4.5 w-4.5" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                      {fullName || "Vinay"}
                      <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {vehiclesList.length > 0 ? "Expert Driver" : "Expert Passenger"}
                      </Badge>
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Member since {formatDate(profile?.created_at || new Date().toISOString())}</p>
                    <div className="flex items-center gap-1 mt-2.5">
                      <div className="flex text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <Star className="h-3.5 w-3.5 fill-current" />
                      </div>
                      <span className="text-xs font-bold text-slate-700">4.9/5 • 3 reviews</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Pre-fill local fields before opening
                      setFullName(profile?.full_name || "");
                      setAvatarUrl(profile?.avatar_url || "");
                      setBio(profile?.bio || "");
                      setAge(profile?.age ? String(profile?.age) : "");
                      setGender(profile?.gender || "");
                      setPhone(profile?.phone_number || "");
                      setLicenseNumber(profile?.license_number || "");
                      setIsEditDetailsOpen(true);
                    }}
                    className="w-full sm:w-auto font-bold text-xs"
                  >
                    Edit personal details
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const url = prompt("Paste your profile photo image URL:", avatarUrl);
                      if (url !== null) {
                        setAvatarUrl(url);
                        updateProfile({ avatar_url: url });
                      }
                    }}
                    className="w-full sm:w-auto font-bold text-xs"
                  >
                    Change profile picture
                  </Button>
                </div>
              </div>
            </Card>

            {/* Reliability Widget */}
            <Card className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm text-left">
              <div className="flex items-start gap-4">
                <div className="bg-amber-50 p-2.5 rounded-2xl text-amber-600 border border-amber-100 shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Your carpooling reliability</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Sometimes cancels bookings as a passenger. Clean track record recently!
                  </p>
                  <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: "85%" }} />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1.5 font-semibold text-right">Reliability Index: 85%</span>
                </div>
              </div>
            </Card>

            {/* Verified Profile Checklist */}
            <Card className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-left">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-400 mb-4">You have a Verified Profile</h3>
              
              <div className="divide-y divide-slate-50">
                {/* Government ID check */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${profile?.is_id_verified ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                      <Check className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">Govt. ID verified</span>
                      <span className="text-[10px] text-slate-400">Enables the exclusive Verified blue badge</span>
                    </div>
                  </div>
                  {!profile?.is_id_verified ? (
                    <Button variant="outline" size="sm" onClick={startIdVerification} className="py-1 px-3 text-[10px] font-bold">
                      Verify now
                    </Button>
                  ) : (
                    <Badge variant="success">Verified</Badge>
                  )}
                </div>

                {/* Email verification check */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <Check className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">{user?.email || "vinay@ridesync.com"}</span>
                      <span className="text-[10px] text-slate-400">Email addresses are verified during signup</span>
                    </div>
                  </div>
                  <Badge variant="success">Verified</Badge>
                </div>

                {/* Phone verification check */}
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${profile?.is_phone_verified ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400'}`}>
                      <Check className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-800 text-sm">
                        {phone ? phone : "Add Phone Number"}
                      </span>
                      <span className="text-[10px] text-slate-400">Receive SMS notifications and OTP security locks</span>
                    </div>
                  </div>
                  {!profile?.is_phone_verified ? (
                    <Button variant="outline" size="sm" onClick={startPhoneVerification} className="py-1 px-3 text-[10px] font-bold">
                      Verify now
                    </Button>
                  ) : (
                    <Badge variant="success">Verified</Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Travel Preferences */}
            <Card className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-left">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-400">Travel Preferences</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Let co-travelers know what to expect during rides</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditPreferencesOpen(true)}
                  className="text-xs font-bold py-1 px-3"
                >
                  Edit preferences
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Chat preference widget */}
                <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/20">
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                    <Smile className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Chat Preferences</span>
                    <span className="text-sm font-bold text-slate-800">
                      {prefChatty === "silent" && "🤐 I prefer silent trips"}
                      {prefChatty === "comfortable" && "💬 I talk when I feel comfortable"}
                      {prefChatty === "talkative" && "🗣️ I'm a chatty person!"}
                    </span>
                  </div>
                </div>

                {/* Music preference widget */}
                <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/20">
                  <div className="bg-cyan-50 text-cyan-600 p-2.5 rounded-xl">
                    <Music className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Music in Car</span>
                    <span className="text-sm font-bold text-slate-800">
                      {prefMusic === "no_music" && "🔇 I prefer silence"}
                      {prefMusic === "depending_on_mood" && "🎵 I'll jam depending on mood"}
                      {prefMusic === "all_the_time" && "🎸 Music is always on!"}
                    </span>
                  </div>
                </div>

                {/* Smoking preference widget */}
                <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/20">
                  <div className="bg-red-50 text-red-600 p-2.5 rounded-xl">
                    <Ban className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Smoking Rules</span>
                    <span className="text-sm font-bold text-slate-800">
                      {prefSmoking === "no_smoking" && "🚭 No smoking in the car"}
                      {prefSmoking === "breaks_only" && "🚬 Smoking allowed during stops"}
                      {prefSmoking === "allowed" && "💨 Smoking is permitted"}
                    </span>
                  </div>
                </div>

                {/* Pets preference widget */}
                <div className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 bg-slate-50/20">
                  <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                    <PawPrint className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Traveling with Pets</span>
                    <span className="text-sm font-bold text-slate-800">
                      {prefPets === "no_pets" && "🚫 No pets in the cabin"}
                      {prefPets === "depending_on_animal" && "🐶 Pets allowed depending on size"}
                      {prefPets === "allowed" && "🐱 Pets are fully welcome!"}
                    </span>
                  </div>
                </div>
              </div>

              {profile?.bio && (
                <div className="mt-5 p-4 bg-slate-50/40 rounded-2xl border border-slate-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Biography</span>
                  <p className="text-xs text-slate-600 leading-relaxed italic">"{profile.bio}"</p>
                </div>
              )}
            </Card>

            {/* Vehicles list section */}
            <Card className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm text-left">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-400">Registered Vehicles</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage multiple cars for carpooling trips</p>
                </div>
                <Button 
                  onClick={() => setIsAddVehicleOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Add vehicle
                </Button>
              </div>

              {vehiclesList.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-2xl bg-slate-50/20 text-xs text-slate-400 italic">
                  No vehicles registered. Click button above to register your first car!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehiclesList.map((v, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                        v.isPrimary 
                          ? "border-blue-500 bg-blue-50/5" 
                          : "border-slate-100 bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${v.isPrimary ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Car className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {v.model}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">
                              {v.color} • {v.type} • {v.year}
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-700 block mt-1 bg-slate-100 px-2 py-0.5 rounded w-max">
                              {v.number}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-1.5">
                          <button 
                            type="button"
                            onClick={() => handleDeleteVehicle(i)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Remove Vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        {v.isPrimary ? (
                          <Badge variant="success" className="text-[9px] py-0 px-2 font-bold">Primary Ride</Badge>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handleSetPrimaryVehicle(i)}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            Set as primary
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: ACCOUNT OPTIONS */}
        {activeTab === "account" && !activeSubTab && (
          <Card className="bg-white border border-slate-100 rounded-3xl shadow-sm text-left overflow-hidden">
            <div className="divide-y divide-slate-100">
              
              {/* Ratings */}
              <button 
                onClick={() => setActiveSubTab("ratings")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Ratings</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Saved passengers */}
              <button 
                onClick={() => setActiveSubTab("saved_passengers")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Saved passengers</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Communication preferences */}
              <button 
                onClick={() => setActiveSubTab("communication")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <BellRing className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Communication preferences</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Password */}
              <button 
                onClick={() => setActiveSubTab("password")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Password</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Postal Address */}
              <button 
                onClick={() => setActiveSubTab("postal_address")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Postal address</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Payout methods */}
              <button 
                onClick={() => setActiveSubTab("payout_methods")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <Landmark className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Payout methods</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Payouts */}
              <button 
                onClick={() => setActiveSubTab("payouts")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Payouts</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Payment methods */}
              <button 
                onClick={() => setActiveSubTab("payment_methods")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Payment methods</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Payments & refunds */}
              <button 
                onClick={() => setActiveSubTab("payments_refunds")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Payments & refunds</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Help */}
              <button 
                onClick={() => setActiveSubTab("help")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Help & FAQs</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Terms and Conditions */}
              <button 
                onClick={() => setActiveSubTab("terms")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Terms and Conditions</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Data protection */}
              <button 
                onClick={() => setActiveSubTab("data_protection")} 
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                  <span className="text-sm font-semibold">Data protection</span>
                </div>
                <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
              </button>

              {/* Log out */}
              <button 
                onClick={async () => {
                  if (window.confirm("Are you sure you want to sign out?")) {
                    await signOut();
                    navigate("/login");
                  }
                }}
                className="w-full flex items-center justify-between px-5 py-4.5 hover:bg-red-50/20 transition text-red-600 hover:text-red-700 font-semibold"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-5 w-5" />
                  <span>Log out</span>
                </div>
              </button>

              {/* Close my account */}
              <button 
                onClick={() => setActiveSubTab("close_account")}
                className="w-full flex items-center justify-between px-5 py-4.5 hover:bg-red-50/20 transition text-red-600/70 hover:text-red-700 font-semibold"
              >
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5" />
                  <span>Close my account</span>
                </div>
              </button>

            </div>
          </Card>
        )}

        {/* SUB ACCOUNT TAB PANELS */}
        {activeTab === "account" && activeSubTab && (
          <Card className="bg-white border border-slate-100 rounded-3xl shadow-sm text-left p-6">
            <button 
              onClick={() => setActiveSubTab(null)}
              className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline mb-6"
            >
              &larr; Back to account settings
            </button>

            {/* RATINGS SUB TAB */}
            {activeSubTab === "ratings" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Your Ratings & Feedback</h3>
                <p className="text-xs text-slate-500 mb-6">See how drivers and passengers rate their experience traveling with you</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b border-slate-50 pb-6">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-center items-center text-center">
                    <span className="text-3xl font-black text-slate-900">4.9</span>
                    <div className="flex text-amber-400 my-1">
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                      <Star className="h-4 w-4 fill-current" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">Average rating (3 reviews)</span>
                  </div>

                  <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
                    {/* Star progress bars */}
                    <div className="flex items-center text-xs text-slate-500 gap-3">
                      <span className="w-10 text-right">5 stars</span>
                      <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: "90%" }} />
                      </div>
                      <span className="w-8">90%</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 gap-3">
                      <span className="w-10 text-right">4 stars</span>
                      <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: "10%" }} />
                      </div>
                      <span className="w-8">10%</span>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 gap-3">
                      <span className="w-10 text-right">3 stars</span>
                      <div className="flex-grow bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full" style={{ width: "0%" }} />
                      </div>
                      <span className="w-8">0%</span>
                    </div>
                  </div>
                </div>

                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Reviews Feed</h4>
                <div className="space-y-4">
                  {reviewsList.map((r) => (
                    <div key={r.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/10">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">{r.author}</span>
                          <span className="text-[9px] text-slate-400">{formatDate(r.date)}</span>
                        </div>
                        <div className="flex text-amber-400">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">"{r.comment}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SAVED PASSENGERS SUB TAB */}
            {activeSubTab === "saved_passengers" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Saved Passengers</h3>
                <p className="text-xs text-slate-500 mb-6">Access and invite quick travel buddies you share seats with frequently</p>

                <div className="flex gap-2 mb-6">
                  <Input 
                    placeholder="Enter name to add..."
                    value={newPassengerName}
                    onChange={(e) => setNewPassengerName(e.target.value)}
                    className="text-xs py-2"
                  />
                  <Button 
                    onClick={handleAddSavedPassenger}
                    className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm"
                  >
                    Add Buddy
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedPassengers.map((sp) => (
                    <div key={sp.id} className="p-4 border border-slate-100 rounded-2xl bg-white flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <Avatar src="" fallback={sp.name} size="md" />
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">{sp.name}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{sp.trips} trips together</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] border-emerald-100 text-emerald-700 bg-emerald-50 font-bold">
                        ★ {sp.rating}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMMUNICATIONS SUB TAB */}
            {activeSubTab === "communication" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Communication Preferences</h3>
                <p className="text-xs text-slate-500 mb-6">Choose how you wish to receive notifications and trip status updates</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    {/* Toggle Emails */}
                    <label className="flex items-start gap-3 p-4 border border-slate-100 rounded-2xl bg-slate-50/20 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={commEmails} 
                        onChange={(e) => setCommEmails(e.target.checked)} 
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="block font-bold text-slate-800 text-sm">Email Notifications</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Receive route plans and receipt statements on email</span>
                      </div>
                    </label>

                    {/* Toggle SMS */}
                    <label className="flex items-start gap-3 p-4 border border-slate-100 rounded-2xl bg-slate-50/20 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={commSms} 
                        onChange={(e) => setCommSms(e.target.checked)} 
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="block font-bold text-slate-800 text-sm">SMS / Text messages</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Receive immediate driver status updates via SMS</span>
                      </div>
                    </label>

                    {/* Toggle Push */}
                    <label className="flex items-start gap-3 p-4 border border-slate-100 rounded-2xl bg-slate-50/20 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={commPush} 
                        onChange={(e) => setCommPush(e.target.checked)} 
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="block font-bold text-slate-800 text-sm">Real-time Push Alerts</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Receive alerts for new booking requests and messages</span>
                      </div>
                    </label>
                  </div>

                  {/* Simulated Mobile Mockup */}
                  <div className="border-4 border-slate-800 rounded-[36px] bg-slate-900 p-5 h-72 w-52 mx-auto relative shadow-2xl flex flex-col justify-between text-white">
                    <div className="w-20 bg-slate-800 h-4 rounded-full mx-auto mb-4" />
                    
                    <div className="space-y-3 flex-grow overflow-y-auto">
                      {commPush && (
                        <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-md border border-white/5 animate-scale-up">
                          <span className="block text-[8px] font-bold text-blue-400">RideSync</span>
                          <span className="block text-[9px] font-semibold text-slate-200 mt-0.5">Seat Booking Accepted!</span>
                          <span className="block text-[7px] text-slate-400 leading-tight">Your trip with Vinay is confirmed for tomorrow.</span>
                        </div>
                      )}
                      
                      {commSms && (
                        <div className="bg-white/10 rounded-2xl p-2.5 backdrop-blur-md border border-white/5 animate-scale-up">
                          <span className="block text-[8px] font-bold text-green-400">Messages (SMS)</span>
                          <span className="block text-[7px] text-slate-200 mt-0.5">"Vinay: I have arrived at the pickup location. See you soon!"</span>
                        </div>
                      )}
                    </div>

                    <div className="w-10 bg-white/20 h-1.5 rounded-full mx-auto mt-2" />
                  </div>
                </div>
              </div>
            )}

            {/* PASSWORD SUB TAB */}
            {activeSubTab === "password" && (
              <form onSubmit={handlePasswordResetSubmit} className="max-w-md">
                <h3 className="text-lg font-black text-slate-900 mb-2">Change Password</h3>
                <p className="text-xs text-slate-500 mb-6">Keep your account safe by updating your password periodically</p>

                <div className="space-y-4">
                  <Input 
                    type="password"
                    label="New Password"
                    required
                    placeholder="Enter at least 6 characters..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input 
                    type="password"
                    label="Confirm New Password"
                    required
                    placeholder="Repeat password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />

                  <Button type="submit" loading={passLoading} className="w-full bg-blue-600 text-white font-bold text-xs py-3.5 mt-2 rounded-xl shadow-md">
                    Update Password
                  </Button>
                </div>
              </form>
            )}

            {/* POSTAL ADDRESS SUB TAB */}
            {activeSubTab === "postal_address" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Postal Address</h3>
                <p className="text-xs text-slate-500 mb-6">Add your billing or pickup base address</p>

                <div className="flex gap-2 mb-4">
                  <Input 
                    placeholder="Search address (e.g. Connaught Place)..."
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
                    className="text-xs py-2"
                  />
                  <Button 
                    onClick={handleAddressSearch}
                    loading={addressLoading}
                    className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm"
                  >
                    Lookup
                  </Button>
                </div>

                {addressResult && (
                  <div className="space-y-4 animate-scale-up">
                    <div className="p-4 border border-emerald-100 rounded-2xl bg-emerald-50/20 flex gap-2 items-start">
                      <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-bold text-slate-800 text-xs">Identified Address</span>
                        <p className="text-xs text-slate-600 mt-1">{addressResult}</p>
                      </div>
                    </div>

                    {/* Micro MAP mockup */}
                    <div className="h-44 w-full rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative flex items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-bold bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border shadow-sm z-10 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-red-500" /> Delhi, India (📍 Mock Coordinates)
                      </span>
                      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAYOUT METHODS SUB TAB */}
            {activeSubTab === "payout_methods" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Payout Destination Bank</h3>
                <p className="text-xs text-slate-500 mb-6">Manage which bank account receives passenger seat payouts</p>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left flex justify-between items-start gap-4 mb-6">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Default Account</span>
                    <span className="text-base font-bold text-slate-900 block mt-1.5">Chase Savings Account</span>
                    <span className="text-xs text-slate-500 block">Routing: ••••5678 | Account: ••••1234</span>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>

                <Button variant="outline" className="w-full text-xs py-2 bg-white">
                  Add Payout Bank Account
                </Button>
              </div>
            )}

            {/* PAYOUTS HISTORY SUB TAB */}
            {activeSubTab === "payouts" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Payout Transfer Statements</h3>
                <p className="text-xs text-slate-500 mb-6">Review driver payout transactions sent to bank account</p>

                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-left">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Destination</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">25 Jun 2026</td>
                        <td className="py-3 px-4 text-slate-500">Chase Bank (****1234)</td>
                        <td className="py-3 px-4 font-bold text-slate-900">$75.00</td>
                        <td className="py-3 px-4 text-right"><Badge variant="success">completed</Badge></td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">24 Jun 2026</td>
                        <td className="py-3 px-4 text-slate-500">Chase Bank (****1234)</td>
                        <td className="py-3 px-4 font-bold text-slate-900">$50.00</td>
                        <td className="py-3 px-4 text-right"><Badge variant="success">completed</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYMENT METHODS SUB TAB */}
            {activeSubTab === "payment_methods" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Saved Payment Methods</h3>
                <p className="text-xs text-slate-500 mb-6">Manage debit or credit cards linked for booking rides</p>

                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-44 border border-slate-800 mb-6 max-w-sm">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Default Payment Card</span>
                      <span className="text-base font-bold tracking-widest mt-1 block">Visa Card</span>
                    </div>
                    <span className="text-lg font-black italic">VISA</span>
                  </div>

                  <div className="text-lg font-bold tracking-widest font-mono py-1">
                    •••• •••• •••• 4321
                  </div>

                  <div className="flex justify-between text-xs text-slate-400">
                    <div>
                      <span className="text-[8px] block uppercase font-bold tracking-wide">Holder</span>
                      <span className="text-white font-semibold block">{fullName || "Vinay"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] block uppercase font-bold tracking-wide">Expires</span>
                      <span className="text-white font-semibold block">12/28</span>
                    </div>
                  </div>
                </div>

                <Button variant="outline" className="w-full text-xs py-2 bg-white">
                  Add Credit Card
                </Button>
              </div>
            )}

            {/* PAYMENTS & REFUNDS STATEMENT SUB TAB */}
            {activeSubTab === "payments_refunds" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Billing Statement & Transactions</h3>
                <p className="text-xs text-slate-500 mb-6">Review payment charges and refund statuses for trip bookings</p>

                <div className="border border-slate-100 rounded-2xl overflow-hidden text-xs">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-left">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Route</th>
                        <th className="py-3 px-4">Amount</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">25 Jun 2026</td>
                        <td className="py-3 px-4 text-slate-500 font-medium">New Delhi → Gurugram</td>
                        <td className="py-3 px-4 font-bold text-slate-900">$50.00</td>
                        <td className="py-3 px-4"><Badge variant="success">paid</Badge></td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">18 Jun 2026</td>
                        <td className="py-3 px-4 text-slate-500 font-medium">Noida → Faridabad</td>
                        <td className="py-3 px-4 font-bold text-slate-900">$35.00</td>
                        <td className="py-3 px-4"><Badge variant="success">paid</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* HELP SUB TAB */}
            {activeSubTab === "help" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Help & Frequently Asked Questions</h3>
                <p className="text-xs text-slate-500 mb-6">Find answers to common issues or reach customer care</p>

                <div className="space-y-4">
                  <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20">
                    <span className="font-bold text-slate-800 text-sm block">How do I verify my profile?</span>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Go to the "About You" tab, find the checklist verification rows, and complete ID verification or phone verification.
                    </p>
                  </div>
                  <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20">
                    <span className="font-bold text-slate-800 text-sm block">How can I payout my driver shares?</span>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      All driver earnings are automatically calculated and processed within 24 hours of trip completion. Funds are deposited into your default Payout bank account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TERMS & CONDITIONS SUB TAB */}
            {activeSubTab === "terms" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Terms and Conditions</h3>
                <p className="text-xs text-slate-500 mb-6">User agreement policy documents</p>

                <div className="p-4 bg-slate-50 rounded-2xl border text-xs text-slate-500 h-60 overflow-y-auto leading-relaxed">
                  <p className="font-bold text-slate-800 mb-2">1. RideSync Services Agreements</p>
                  <p className="mb-4">
                    By accessing or booking carpools on the RideSync platform, you agree to comply with our ride-sharing codes of conduct, driver license policies, and regional pricing grids.
                  </p>
                  <p className="font-bold text-slate-800 mb-2">2. Booking Cancellations</p>
                  <p>
                    Passenger cancellations within 12 hours of departure are subject to a partial booking fee to support the driver's fuel cost estimates.
                  </p>
                </div>
              </div>
            )}

            {/* DATA PROTECTION SUB TAB */}
            {activeSubTab === "data_protection" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Data Protection & Privacy</h3>
                <p className="text-xs text-slate-500 mb-6">Manage how RideSync handles and secures your user records</p>

                <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 mb-6">
                  <span className="block font-bold text-slate-800 text-sm">GDPR / Data Rights Compliance</span>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    We secure your identity details using database RLS policies. We never sell location logs or phone contact metadata.
                  </p>
                </div>

                <Button variant="outline" className="w-full text-xs py-2 bg-white">
                  Download My Data Records (JSON)
                </Button>
              </div>
            )}

            {/* CLOSE ACCOUNT SUB TAB */}
            {activeSubTab === "close_account" && (
              <div>
                <h3 className="text-lg font-black text-red-600 mb-2">Close Account</h3>
                <p className="text-xs text-slate-500 mb-6">Permanently delete your profile and booking transaction statements from RideSync</p>

                <div className="p-4 border border-red-100 bg-red-50/30 rounded-2xl text-xs text-red-800 mb-6">
                  <strong className="block mb-1">Warning: Deletion is permanent!</strong>
                  Once you close your account, you will lose access to transaction records, reviews history, and active published rides.
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason for closing account</label>
                    <select
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-red-500 focus:outline-none"
                    >
                      <option value="">Select a reason...</option>
                      <option value="not_using">I do not use the app anymore</option>
                      <option value="privacy">Privacy concerns</option>
                      <option value="other">Other reason</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 py-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={closeConfirm} 
                      onChange={(e) => setCloseConfirm(e.target.checked)} 
                      className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">I confirm I want to permanently delete my account</span>
                  </label>

                  <Button 
                    disabled={!closeConfirm || !closeReason}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3.5 rounded-xl shadow-md disabled:opacity-40"
                    onClick={() => {
                      alert("Account closure request submitted! In sandbox simulation mode, this does not delete the user.");
                      setActiveSubTab(null);
                    }}
                  >
                    Confirm Permanent Account Deletion
                  </Button>
                </div>
              </div>
            )}

          </Card>
        )}

      </div>

      {/* MODAL 1: EDIT DETAILS */}
      {isEditDetailsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white border w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsEditDetailsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-2">Edit Personal Details</h3>
            <p className="text-xs text-slate-500 mb-6">Keep your contact information and driver criteria up to date</p>

            <form onSubmit={handleSaveDetails} className="space-y-4">
              <Input 
                label="Full Name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <Input 
                  label="Age"
                  type="number"
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <Input 
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <Input 
                label="License Number"
                placeholder="DL number for drivers..."
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Personal Biography</label>
                <textarea 
                  rows={3}
                  placeholder="Tell travel companions a bit about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditDetailsOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" loading={isSaving} className="bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl">
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: EDIT PREFERENCES */}
      {isEditPreferencesOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white border w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsEditPreferencesOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-2">Edit Travel Preferences</h3>
            <p className="text-xs text-slate-500 mb-6">Select your carpool preferences to find matching travel styles</p>

            <div className="space-y-5">
              {/* Chat Preference options */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2.5">Chat Preferences</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "silent", label: "🤐 Silent", desc: "No talk" },
                    { value: "comfortable", label: "💬 Comfortable", desc: "Talk sometimes" },
                    { value: "talkative", label: "🗣️ Talkative", desc: "Love to chat" }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPrefChatty(opt.value as any)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        prefChatty === opt.value 
                          ? "border-blue-600 bg-blue-50/20 text-blue-700" 
                          : "border-slate-100 bg-slate-50/20 hover:bg-slate-100/40 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[8px] text-slate-400 font-semibold">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Music Preference options */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2.5">Music preference</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "no_music", label: "🔇 Quiet", desc: "No tunes" },
                    { value: "depending_on_mood", label: "🎵 Custom", desc: "Mood basis" },
                    { value: "all_the_time", label: "🎸 Always", desc: "Continuous tunes" }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPrefMusic(opt.value as any)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        prefMusic === opt.value 
                          ? "border-blue-600 bg-blue-50/20 text-blue-700" 
                          : "border-slate-100 bg-slate-50/20 hover:bg-slate-100/40 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[8px] text-slate-400 font-semibold">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smoking Preference options */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2.5">Smoking permitted</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "no_smoking", label: "🚭 No smoking", desc: "Clean air" },
                    { value: "breaks_only", label: "🚬 Stops only", desc: "Breaks only" },
                    { value: "allowed", label: "💨 Permitted", desc: "Allows smoking" }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPrefSmoking(opt.value as any)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        prefSmoking === opt.value 
                          ? "border-blue-600 bg-blue-50/20 text-blue-700" 
                          : "border-slate-100 bg-slate-50/20 hover:bg-slate-100/40 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[8px] text-slate-400 font-semibold">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pets Preference options */}
              <div>
                <span className="block text-xs font-bold text-slate-700 mb-2.5">Pets in Cabin</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "no_pets", label: "🚫 No pets", desc: "Allergen free" },
                    { value: "depending_on_animal", label: "🐶 Conditional", desc: "Depends on pet" },
                    { value: "allowed", label: "🐱 Allowed", desc: "Fully welcome" }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPrefPets(opt.value as any)}
                      className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 ${
                        prefPets === opt.value 
                          ? "border-blue-600 bg-blue-50/20 text-blue-700" 
                          : "border-slate-100 bg-slate-50/20 hover:bg-slate-100/40 text-slate-700"
                      }`}
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-[8px] text-slate-400 font-semibold">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditPreferencesOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button onClick={handleSavePreferences} loading={isSaving} className="bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl">
                  Save preferences
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 3: ADD VEHICLE */}
      {isAddVehicleOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white border w-full max-w-lg rounded-3xl p-6 shadow-2xl relative text-left max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsAddVehicleOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <h3 className="text-lg font-black text-slate-900 mb-2">Register Vehicle Details</h3>
            <p className="text-xs text-slate-500 mb-6">Add details of the car you drive for carpooling journeys</p>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vehicle Type</label>
                <select
                  value={vehType}
                  onChange={(e) => setVehType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="hatchback">Hatchback</option>
                  <option value="ev">Electric (EV)</option>
                </select>
              </div>

              <Input 
                label="Model & Make"
                required
                placeholder="e.g. Honda City, Maruti Brezza"
                value={vehModel}
                onChange={(e) => setVehModel(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Color"
                  required
                  placeholder="e.g. White, Grey"
                  value={vehColor}
                  onChange={(e) => setVehColor(e.target.value)}
                />
                <Input 
                  label="Registration Year"
                  required
                  type="number"
                  min={2000}
                  max={2027}
                  placeholder="e.g. 2022"
                  value={vehYear}
                  onChange={(e) => setVehYear(e.target.value)}
                />
              </div>

              <Input 
                label="License Plate Number"
                required
                placeholder="e.g. DL-3C-AS-1234"
                value={vehNumber}
                onChange={(e) => setVehNumber(e.target.value)}
              />

              <div className="pt-4 flex justify-end gap-3 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddVehicleOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" loading={isSaving} className="bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl">
                  Register Vehicle
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 4: GOVERNMENT ID VERIFICATION SIMULATOR */}
      {idVerifyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white border w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-left">
            <button 
              onClick={() => setIdVerifyOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {idVerifyStep === "idle" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-blue-600" /> Government ID Verification
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Verify your identity to unlock a blue verification badge, boosting passenger booking trust by 3x.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Document Type</label>
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="passport">Passport</option>
                      <option value="drivers_license">Driver's License</option>
                      <option value="aadhaar">Aadhaar Card / National ID</option>
                    </select>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50">
                    <span className="block text-xs font-bold text-slate-700">Simulate Document Select</span>
                    <span className="text-[10px] text-slate-400 block mt-1">Select mock image or PDF to scan</span>
                  </div>
                </div>

                <div className="flex gap-3 justify-end border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => setIdVerifyOpen(false)}>Cancel</Button>
                  <Button onClick={handleSimulateIdUpload} className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm">
                    Submit Mock Scan
                  </Button>
                </div>
              </div>
            )}

            {idVerifyStep === "uploading" && (
              <div className="py-10 text-center space-y-4">
                <svg className="h-10 w-10 animate-spin text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="block font-bold text-slate-800 text-sm">Uploading document file...</span>
              </div>
            )}

            {idVerifyStep === "scanning" && (
              <div className="py-10 text-center space-y-4">
                <svg className="h-10 w-10 animate-pulse text-emerald-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                </svg>
                <span className="block font-bold text-slate-800 text-sm">Simulating document scan & OCR verification...</span>
                <p className="text-[10px] text-slate-400">Verifying name, ID legitimacy and matching criteria...</p>
              </div>
            )}

            {idVerifyStep === "completed" && (
              <div className="py-6 text-center space-y-4">
                <div className="bg-emerald-50 text-emerald-600 rounded-full p-3 w-max mx-auto border-2 border-emerald-200">
                  <Check className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Verification Complete!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your Government ID is verified. You now have a verified badge overlaying your avatar.
                  </p>
                </div>
                <Button onClick={() => setIdVerifyOpen(false)} className="bg-blue-600 text-white text-xs font-bold py-2 px-6 rounded-xl mt-4">
                  Continue
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL 5: PHONE SMS OTP SIMULATOR */}
      {phoneVerifyOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-white border w-full max-w-md rounded-3xl p-6 shadow-2xl relative text-left">
            <button 
              onClick={() => setPhoneVerifyOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {phoneVerifyStep === "idle" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Phone Verification</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Confirm phone number ownership. We will simulate sending a verification message to <strong>{phone}</strong>.
                </p>
                <Button onClick={handleSendOtp} className="w-full bg-blue-600 text-white font-bold text-xs py-3.5 rounded-xl shadow-md">
                  Send OTP Verification Code
                </Button>
              </div>
            )}

            {phoneVerifyStep === "sending" && (
              <div className="py-8 text-center space-y-4">
                <svg className="h-10 w-10 animate-spin text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="block font-bold text-slate-800 text-sm">Connecting SMS gateway...</span>
              </div>
            )}

            {phoneVerifyStep === "otp_challenge" && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">Enter Verification Code</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Enter the 6-digit OTP code sent to your phone. Use code <strong>123456</strong> for the simulation challenge.
                </p>

                <div className="space-y-4">
                  <Input 
                    placeholder="Enter 6-digit OTP..."
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                  {otpError && <span className="text-[10px] font-semibold text-red-600 block">{otpError}</span>}

                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPhoneVerifyStep("idle")}>
                      Resend Code
                    </Button>
                    <Button onClick={handleVerifyOtp} className="bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm">
                      Verify OTP Code
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {phoneVerifyStep === "completed" && (
              <div className="py-6 text-center space-y-4">
                <div className="bg-emerald-50 text-emerald-600 rounded-full p-3 w-max mx-auto border-2 border-emerald-200">
                  <Check className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Phone Number Verified!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Your number is now fully linked and verified in the database.
                  </p>
                </div>
                <Button onClick={() => setPhoneVerifyOpen(false)} className="bg-blue-600 text-white text-xs font-bold py-2 px-6 rounded-xl mt-4">
                  Done
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

    </div>
  );
};
