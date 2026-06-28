import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { MapPin, Calendar, Users, Search, ArrowLeftRight, Clock, Star, Zap } from "lucide-react";
import { formatDate } from "../lib/utils";

interface SearchHistoryItem {
  from: string;
  fromLat?: number;
  fromLng?: number;
  to: string;
  toLat?: number;
  toLng?: number;
  date: string;
  passengers: number;
}

const POPULAR_LOCATIONS = [
  { name: "Greater Noida", lat: 28.4742, lng: 77.5040 },
  { name: "Noida", lat: 28.5747, lng: 77.3560 },
  { name: "Delhi", lat: 28.6139, lng: 77.2090 },
  { name: "Moradabad", lat: 28.8386, lng: 78.7733 },
  { name: "Agra", lat: 27.1767, lng: 78.0081 },
  { name: "Ghaziabad", lat: 28.6692, lng: 77.4538 }
];

export const FindRide: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile } = useAuth();

  // Search Fields
  const [fromQuery, setFromQuery] = useState("");
  const [fromCoords, setFromCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toQuery, setToQuery] = useState("");
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Date selection states: today, tomorrow, custom
  const [dateType, setDateType] = useState<"today" | "tomorrow" | "custom">("today");
  const [customDate, setCustomDate] = useState("");
  const [passengers, setPassengers] = useState(1);

  // Autocomplete UI states
  const [fromSuggestions, setFromSuggestions] = useState<any[]>([]);
  const [toSuggestions, setToSuggestions] = useState<any[]>([]);
  const [loadingFrom, setLoadingFrom] = useState(false);
  const [loadingTo, setLoadingTo] = useState(false);

  // Focus tracking to show suggestions/popular
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);

  // Recent Searches list
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  // Handle outside clicks to close autocomplete boxes
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setFromFocused(false);
      }
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setToFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch recent searches from local storage or profile
  useEffect(() => {
    let localHistory: SearchHistoryItem[] = [];
    try {
      const stored = localStorage.getItem("ridesync_recent_searches");
      if (stored) localHistory = JSON.parse(stored);
    } catch (e) {
      console.error("Failed loading recent searches:", e);
    }

    if (profile && profile.recent_searches) {
      // Merge and clean duplicates
      const dbHistory = profile.recent_searches as SearchHistoryItem[];
      const combined = [...dbHistory];
      localHistory.forEach((lh) => {
        if (!combined.some((dh) => dh.from === lh.from && dh.to === lh.to && dh.date === lh.date)) {
          combined.push(lh);
        }
      });
      setRecentSearches(combined.slice(0, 5));
    } else {
      setRecentSearches(localHistory.slice(0, 5));
    }
  }, [profile]);

  // Autocomplete fetch for From input
  useEffect(() => {
    if (!fromQuery.trim()) {
      setFromSuggestions([]);
      return;
    }
    
    // Simple debounce
    const timer = setTimeout(async () => {
      setLoadingFrom(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fromQuery)}&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setFromSuggestions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingFrom(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [fromQuery]);

  // Autocomplete fetch for To input
  useEffect(() => {
    if (!toQuery.trim()) {
      setToSuggestions([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoadingTo(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(toQuery)}&limit=5&addressdetails=1`
        );
        const data = await res.json();
        setToSuggestions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTo(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [toQuery]);

  // Select From Suggestion
  const handleSelectFrom = (name: string, lat: number, lng: number) => {
    setFromQuery(name);
    setFromCoords({ lat, lng });
    setFromSuggestions([]);
    setFromFocused(false);
  };

  // Select To Suggestion
  const handleSelectTo = (name: string, lat: number, lng: number) => {
    setToQuery(name);
    setToCoords({ lat, lng });
    setToSuggestions([]);
    setToFocused(false);
  };

  // Swap From and To fields
  const handleSwap = () => {
    const tempQuery = fromQuery;
    const tempCoords = fromCoords;
    setFromQuery(toQuery);
    setFromCoords(toCoords);
    setToQuery(tempQuery);
    setToCoords(tempCoords);
  };

  // Handle Search Submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromQuery.trim() || !toQuery.trim()) return;

    // Resolve date string
    let finalDate = "";
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateType === "today") {
      finalDate = todayStr;
    } else if (dateType === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      finalDate = tomorrow.toISOString().split("T")[0];
    } else {
      finalDate = customDate || todayStr;
    }

    // Save recent search
    const searchItem: SearchHistoryItem = {
      from: fromQuery,
      fromLat: fromCoords?.lat,
      fromLng: fromCoords?.lng,
      to: toQuery,
      toLat: toCoords?.lat,
      toLng: toCoords?.lng,
      date: finalDate,
      passengers,
    };

    // Update local list
    const filtered = recentSearches.filter(
      (item) => !(item.from.toLowerCase() === fromQuery.toLowerCase() && item.to.toLowerCase() === toQuery.toLowerCase())
    );
    const updated = [searchItem, ...filtered].slice(0, 5);

    // Save to local storage
    localStorage.setItem("ridesync_recent_searches", JSON.stringify(updated));

    // Save to database if authenticated
    if (user && profile) {
      try {
        await updateProfile({
          recent_searches: updated,
        });
      } catch (err) {
        console.error("Failed to sync search to profile:", err);
      }
    }

    // Navigate to Search Results
    const params = new URLSearchParams();
    params.append("from", fromQuery);
    if (fromCoords) {
      params.append("from_lat", fromCoords.lat.toString());
      params.append("from_lng", fromCoords.lng.toString());
    }
    params.append("to", toQuery);
    if (toCoords) {
      params.append("to_lat", toCoords.lat.toString());
      params.append("to_lng", toCoords.lng.toString());
    }
    params.append("date", finalDate);
    params.append("passengers", passengers.toString());

    navigate(`/rides/search-results?${params.toString()}`);
  };

  // Run Recent Search
  const handleExecuteRecentSearch = (item: SearchHistoryItem) => {
    setFromQuery(item.from);
    if (item.fromLat && item.fromLng) {
      setFromCoords({ lat: item.fromLat, lng: item.fromLng });
    }
    setToQuery(item.to);
    if (item.toLat && item.toLng) {
      setToCoords({ lat: item.toLat, lng: item.toLng });
    }
    setPassengers(item.passengers);
    
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    if (item.date === todayStr) {
      setDateType("today");
    } else if (item.date === tomorrowStr) {
      setDateType("tomorrow");
    } else {
      setDateType("custom");
      setCustomDate(item.date);
    }

    // Instant trigger
    const params = new URLSearchParams();
    params.append("from", item.from);
    if (item.fromLat && item.fromLng) {
      params.append("from_lat", item.fromLat.toString());
      params.append("from_lng", item.fromLng.toString());
    }
    params.append("to", item.to);
    if (item.toLat && item.toLng) {
      params.append("to_lat", item.toLat.toString());
      params.append("to_lng", item.toLng.toString());
    }
    params.append("date", item.date);
    params.append("passengers", item.passengers.toString());

    navigate(`/rides/search-results?${params.toString()}`);
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-[85vh] bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-4xl px-4 text-center mb-8">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          Your choice of rides at low prices
        </h2>
        <p className="mt-3 text-slate-500 text-lg">
          Search for cost-sharing carpools with verified community drivers
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl px-4">
        <Card className="border border-slate-100 shadow-2xl bg-white rounded-3xl p-6 md:p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            
            {/* From & To Row */}
            <div className="grid grid-cols-1 md:grid-cols-9 items-center gap-4 relative">
              
              {/* Departure Input */}
              <div ref={fromRef} className="md:col-span-4 relative">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Leaving From</label>
                <div className="relative">
                  <Input
                    placeholder="City, station, place"
                    value={fromQuery}
                    onChange={(e) => {
                      setFromQuery(e.target.value);
                      setFromCoords(null);
                    }}
                    onFocus={() => setFromFocused(true)}
                    className="pl-11 pr-4 py-3.5 text-base"
                    required
                  />
                  <MapPin className="absolute left-4 top-4 h-5 w-5 text-emerald-500" />
                </div>

                {/* Autocomplete suggestions */}
                {fromFocused && (
                  <div className="absolute left-0 mt-2 w-full rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden divide-y divide-slate-50 max-h-60 overflow-y-auto z-50 animate-scale-up">
                    {loadingFrom && (
                      <div className="px-4 py-3.5 text-sm text-slate-400 italic">Searching locations...</div>
                    )}
                    
                    {/* Nominatim results */}
                    {!loadingFrom && fromSuggestions.map((res, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectFrom(res.display_name, parseFloat(res.lat), parseFloat(res.lon))}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-start gap-2 transition"
                      >
                        <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{res.display_name}</span>
                      </button>
                    ))}

                    {/* Popular places if query empty */}
                    {!fromQuery.trim() && (
                      <div className="p-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">Popular Locations</span>
                        <div className="grid grid-cols-2 gap-2">
                          {POPULAR_LOCATIONS.map((loc, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectFrom(loc.name, loc.lat, loc.lng)}
                              className="text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-100 rounded-xl transition flex items-center gap-1.5"
                            >
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{loc.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <div className="md:col-span-1 flex justify-center pt-5">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="h-10 w-10 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 shadow-sm flex items-center justify-center transition active:scale-95"
                  title="Swap fields"
                >
                  <ArrowLeftRight className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Destination Input */}
              <div ref={toRef} className="md:col-span-4 relative">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Going To</label>
                <div className="relative">
                  <Input
                    placeholder="City, station, place"
                    value={toQuery}
                    onChange={(e) => {
                      setToQuery(e.target.value);
                      setToCoords(null);
                    }}
                    onFocus={() => setToFocused(true)}
                    className="pl-11 pr-4 py-3.5 text-base"
                    required
                  />
                  <MapPin className="absolute left-4 top-4 h-5 w-5 text-blue-500" />
                </div>

                {/* Autocomplete suggestions */}
                {toFocused && (
                  <div className="absolute left-0 mt-2 w-full rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden divide-y divide-slate-50 max-h-60 overflow-y-auto z-50 animate-scale-up">
                    {loadingTo && (
                      <div className="px-4 py-3.5 text-sm text-slate-400 italic">Searching locations...</div>
                    )}
                    
                    {!loadingTo && toSuggestions.map((res, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectTo(res.display_name, parseFloat(res.lat), parseFloat(res.lon))}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-start gap-2 transition"
                      >
                        <MapPin className="h-4.5 w-4.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{res.display_name}</span>
                      </button>
                    ))}

                    {!toQuery.trim() && (
                      <div className="p-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 px-1">Popular Locations</span>
                        <div className="grid grid-cols-2 gap-2">
                          {POPULAR_LOCATIONS.map((loc, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectTo(loc.name, loc.lat, loc.lng)}
                              className="text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-100 rounded-xl transition flex items-center gap-1.5"
                            >
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{loc.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date and Passengers Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              
              {/* Date Toggles */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Departure Date</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDateType("today")}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl border transition ${
                      dateType === "today"
                        ? "border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateType("tomorrow")}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl border transition ${
                      dateType === "tomorrow"
                        ? "border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateType("custom")}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl border transition ${
                      dateType === "custom"
                        ? "border-blue-600 bg-blue-50 text-blue-600 ring-2 ring-blue-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    Custom Date
                  </button>
                </div>

                {/* Custom Date Input */}
                {dateType === "custom" && (
                  <div className="relative mt-3 animate-fade-in">
                    <Input
                      type="date"
                      min={todayStr}
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="pl-11 pr-4 py-3 text-sm"
                      required
                    />
                    <Calendar className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Passengers dropdown */}
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Passengers</label>
                <div className="relative">
                  <select
                    value={passengers}
                    onChange={(e) => setPassengers(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer"
                  >
                    <option value="1">1 Passenger</option>
                    <option value="2">2 Passengers</option>
                    <option value="3">3 Passengers</option>
                    <option value="4">4 Passengers</option>
                  </select>
                  <Users className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Search CTA */}
            <div className="pt-4">
              <Button type="submit" className="w-full py-4 text-base font-black rounded-2xl shadow-xl flex items-center justify-center gap-2">
                <Search className="h-5 w-5" />
                <span>Search</span>
              </Button>
            </div>
          </form>

          {/* Recent Searches Section */}
          {recentSearches.length > 0 && (
            <div className="mt-8 border-t border-slate-100 pt-6 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Recent Searches</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {recentSearches.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleExecuteRecentSearch(item)}
                    className="cursor-pointer border border-slate-100 bg-slate-50/50 hover:bg-slate-50 p-3.5 rounded-2xl transition hover:-translate-y-0.5 flex flex-col justify-center space-y-1 text-xs text-slate-600"
                  >
                    <div className="flex items-center font-bold text-slate-800 text-sm gap-1 flex-wrap">
                      <span className="truncate max-w-[120px]">{item.from.split(",")[0]}</span>
                      <span>&rarr;</span>
                      <span className="truncate max-w-[120px]">{item.to.split(",")[0]}</span>
                    </div>
                    <div className="font-semibold text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{formatDate(item.date)}</span>
                      <span>&bull;</span>
                      <span>{item.passengers} Passenger{item.passengers > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
