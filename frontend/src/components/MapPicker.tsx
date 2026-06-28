import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Search, MapPin, Navigation, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

interface MapPickerProps {
  type: "pickup" | "dropoff";
  onChange: (val: { lat: number; lng: number; address: string }) => void;
  initialValue?: { lat: number; lng: number; address: string } | null;
  placeholder?: string;
  enableGeolocation?: boolean;
  onShowToast?: (msg: string) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  type,
  onChange,
  initialValue,
  placeholder = "Search location...",
  enableGeolocation = false,
  onShowToast,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const [currentAddress, setCurrentAddress] = useState(initialValue?.address || "");
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(
    initialValue ? { lat: initialValue.lat, lng: initialValue.lng } : null
  );

  // SVG Marker Icons
  const pickupIcon = L.divIcon({
    html: `
      <div class="relative">
        <div class="absolute -top-1.5 -left-1.5 w-11 h-11 bg-emerald-500/20 rounded-full animate-ping"></div>
        <div class="relative bg-emerald-600 border-2 border-white rounded-full p-2.5 shadow-xl text-white flex items-center justify-center h-9 w-9">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-leaflet-marker-picker",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });

  const dropoffIcon = L.divIcon({
    html: `
      <div class="relative">
        <div class="absolute -top-1.5 -left-1.5 w-11 h-11 bg-blue-500/20 rounded-full animate-ping"></div>
        <div class="relative bg-blue-600 border-2 border-white rounded-full p-2.5 shadow-xl text-white flex items-center justify-center h-9 w-9">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-leaflet-marker-picker",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });

  const activeIcon = type === "pickup" ? pickupIcon : dropoffIcon;

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Start with Noida/Delhi NCR as default view (or initialValue)
    const startLat = initialValue?.lat || 28.4742;
    const startLng = initialValue?.lng || 77.5040;

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([startLat, startLng], initialValue ? 15 : 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Initialize Marker
    const marker = L.marker([startLat, startLng], {
      icon: activeIcon,
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;

    // Marker Drag Event
    marker.on("dragend", async () => {
      const pos = marker.getLatLng();
      await updateLocationDetails(pos.lat, pos.lng);
    });

    // Map Click Event
    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      await updateLocationDetails(lat, lng);
    });

    // If initial value didn't have an address, geocode it
    if (initialValue && !initialValue.address) {
      updateLocationDetails(initialValue.lat, initialValue.lng);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Coords & Reverse Geocode Address
  const updateLocationDetails = async (lat: number, lng: number, manualAddress?: string) => {
    setGeocoding(true);
    setCurrentCoords({ lat, lng });
    
    let address = manualAddress || "";

    if (!manualAddress) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } catch (err) {
        console.error("Geocoding failed:", err);
        address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }

    setCurrentAddress(address);
    setGeocoding(false);
    onChange({ lat, lng, address });

    // Center map on update
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng]);
    }
  };

  // Geolocation Handler
  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
          mapInstanceRef.current.setView([latitude, longitude], 15);
          await updateLocationDetails(latitude, longitude);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        alert("Failed to fetch current location. Please search manually.");
      }
    );
  };

  // Nominatim Location Search
  const handleLocationSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setSearchResults(data);
        // Automatically select the first location match
        await selectResult(data[0], true);
      } else {
        const errorMsg = "Location not found. Please try another address.";
        if (onShowToast) {
          onShowToast(errorMsg);
        } else {
          alert(errorMsg);
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      const errorMsg = "Search failed. Please try again.";
      if (onShowToast) {
        onShowToast(errorMsg);
      } else {
        alert(errorMsg);
      }
    } finally {
      setSearching(false);
    }
  };

  // Select Search Result
  const selectResult = async (result: any, showSuccessToast = false) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;

    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.setView([lat, lng], 15);
      await updateLocationDetails(lat, lng, address);
    }
    setSearchResults([]);
    setSearchQuery("");

    if (showSuccessToast && onShowToast) {
      onShowToast(`${type === "pickup" ? "Pickup" : "Dropoff"} location found successfully`);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Search Input & Button */}
      <div className="flex gap-2">
        <div className="flex-grow flex gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLocationSearch();
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
            />
            <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleLocationSearch();
            }}
            disabled={searching}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 transition flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </div>

        {enableGeolocation && (
          <button
            type="button"
            onClick={handleGeolocation}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold px-3 py-2.5 transition flex items-center gap-1.5 shrink-0"
            title="Use current GPS location"
          >
            <Navigation className="h-4 w-4 text-blue-500 fill-current" />
            <span className="hidden sm:inline">Use GPS</span>
          </button>
        )}
      </div>

      {/* Search Results Dropdown List */}
      {searchResults.length > 0 && (
        <div className="border border-slate-100 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-50 max-h-48 overflow-y-auto animate-scale-up z-20 relative">
          {searchResults.map((res, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectResult(res)}
              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50/50 flex items-start gap-2 transition"
            >
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{res.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Leaflet Map Div */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-inner z-10">
        <div ref={mapRef} className="h-60 w-full" />
      </div>

      {/* Display Selection Details Card */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2.5 text-xs">
        <div className="flex items-start gap-2">
          <MapPin className={cn(
            "h-4.5 w-4.5 shrink-0 mt-0.5",
            type === "pickup" ? "text-emerald-500" : "text-blue-500"
          )} />
          <div className="space-y-1">
            <span className="font-bold text-slate-800 capitalize">{type} Point Selected:</span>
            <p className={cn(
              "font-medium leading-relaxed",
              geocoding ? "text-slate-400 italic" : "text-slate-600"
            )}>
              {geocoding ? "Locating address..." : currentAddress || "No location selected. Drag marker or click map."}
            </p>
          </div>
        </div>

        {currentCoords && (
          <div className="flex gap-4 border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-mono">
            <span>Latitude: <strong className="text-slate-600">{currentCoords.lat.toFixed(6)}</strong></span>
            <span>Longitude: <strong className="text-slate-600">{currentCoords.lng.toFixed(6)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};
