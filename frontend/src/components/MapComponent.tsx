import React, { useEffect, useRef } from "react";
import L from "leaflet";

interface MapComponentProps {
  driverLoc?: { lat: number; lng: number } | null;
  passengerLocs?: Record<string, { lat: number; lng: number }>;
  pickupLocName?: string;
  dropLocName?: string;
  height?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  driverLoc,
  passengerLocs = {},
  pickupLocName,
  dropLocName,
  height = "400px",
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const passengerMarkerRefs = useRef<Record<string, L.Marker>>({});
  const polylineRefs = useRef<Record<string, L.Polyline>>({});

  // SVG Marker Icons
  const driverIcon = L.divIcon({
    html: `
      <div class="relative">
        <div class="absolute -top-1 -left-1 w-10 h-10 bg-blue-500/30 rounded-full animate-ping"></div>
        <div class="relative bg-blue-600 border-2 border-white rounded-full p-2 shadow-xl text-white flex items-center justify-center h-8 w-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-leaflet-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const passengerIcon = L.divIcon({
    html: `
      <div class="relative">
        <div class="absolute -top-1 -left-1 w-10 h-10 bg-emerald-500/30 rounded-full animate-ping"></div>
        <div class="relative bg-emerald-500 border-2 border-white rounded-full p-2 shadow-xl text-white flex items-center justify-center h-8 w-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>
    `,
    className: "custom-leaflet-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  useEffect(() => {
    if (!mapRef.current) return;

    let centerLat = 37.7749;
    let centerLng = -122.4194;

    if (driverLoc) {
      centerLat = driverLoc.lat;
      centerLng = driverLoc.lng;
    } else {
      const passengerIds = Object.keys(passengerLocs);
      if (passengerIds.length > 0) {
        centerLat = passengerLocs[passengerIds[0]].lat;
        centerLng = passengerLocs[passengerIds[0]].lng;
      }
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([centerLat, centerLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds: L.LatLngExpression[] = [];

    // Update Driver Marker
    if (driverLoc) {
      const driverLatLng: L.LatLngExpression = [driverLoc.lat, driverLoc.lng];
      bounds.push(driverLatLng);

      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(driverLatLng);
      } else {
        driverMarkerRef.current = L.marker(driverLatLng, { icon: driverIcon })
          .addTo(map)
          .bindPopup(`<b>Driver Location</b><br/>Sharing live coordinates`);
      }
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    // Update Passenger Markers & Polylines
    const activePassengerIds = new Set(Object.keys(passengerLocs));

    // Remove old passengers
    Object.keys(passengerMarkerRefs.current).forEach((userId) => {
      if (!activePassengerIds.has(userId)) {
        passengerMarkerRefs.current[userId].remove();
        delete passengerMarkerRefs.current[userId];
      }
    });

    Object.keys(polylineRefs.current).forEach((userId) => {
      if (!activePassengerIds.has(userId) || !driverLoc) {
        polylineRefs.current[userId].remove();
        delete polylineRefs.current[userId];
      }
    });

    // Add/Update current passengers
    activePassengerIds.forEach((userId) => {
      const pLoc = passengerLocs[userId];
      const pLatLng: L.LatLngExpression = [pLoc.lat, pLoc.lng];
      bounds.push(pLatLng);

      if (passengerMarkerRefs.current[userId]) {
        passengerMarkerRefs.current[userId].setLatLng(pLatLng);
      } else {
        passengerMarkerRefs.current[userId] = L.marker(pLatLng, { icon: passengerIcon })
          .addTo(map)
          .bindPopup(`<b>Passenger Location</b><br/>${pickupLocName || "Pickup Point"}`);
      }

      // Draw polyline to driver
      if (driverLoc) {
        const latlngs: L.LatLngExpression[] = [
          [driverLoc.lat, driverLoc.lng],
          [pLoc.lat, pLoc.lng],
        ];

        if (polylineRefs.current[userId]) {
          polylineRefs.current[userId].setLatLngs(latlngs);
        } else {
          polylineRefs.current[userId] = L.polyline(latlngs, {
            color: "#2563EB",
            weight: 4,
            opacity: 0.8,
            dashArray: "8, 8",
          }).addTo(map);
        }
      }
    });

    // Fit Bounds if markers exist
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      }
    }
  }, [driverLoc, passengerLocs, pickupLocName]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-inner">
      <div ref={mapRef} style={{ height }} className="w-full z-10" />
    </div>
  );
};
