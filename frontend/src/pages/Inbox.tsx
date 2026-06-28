import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { PassengerProfileModal } from "../components/PassengerProfileModal";
import { Conversation, Message, Profile, Booking } from "../types";
import { 
  Send, Phone, ArrowLeft, Search, Check, CheckCheck, MoreVertical, Calendar, 
  MapPin, Users, Car, Info, Lock, MessageSquare, AlertCircle, PhoneCall,
  Clock, CheckCircle2, XCircle, Eye, MessageCircle, Inbox as InboxIcon
} from "lucide-react";

type TabType = "requests" | "messages";

export const Inbox: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRideId = searchParams.get("ride_id");
  const urlPassengerId = searchParams.get("passenger_id");
  const urlTab = searchParams.get("tab") as TabType | null;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("requests");
  const [tabInitialized, setTabInitialized] = useState(false);

  // Conversations (Messages tab)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeConvoMessages, setActiveConvoMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(true);

  // Requests tab
  const [bookingRequests, setBookingRequests] = useState<Booking[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [passengerModalId, setPassengerModalId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Booking Requests ─────────────────────────────────────────────

  const fetchBookingRequests = useCallback(async () => {
    if (!user) return;
    setRequestsLoading(true);
    try {
      // Primary query: fetch bookings where user is passenger or driver
      const { data, error } = await supabase
        .from("ride_bookings")
        .select(`
          *,
          ride:rides(*, driver:profiles!rides_driver_id_fkey(*)),
          passenger:profiles!ride_bookings_passenger_id_fkey(*)
        `)
        .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      let allBookings: Booking[] = data || [];

      // Fallback: also fetch bookings for rides where user is driver
      // (handles older bookings where driver_id column may be null)
      const { data: myRides } = await supabase
        .from("rides")
        .select("id")
        .eq("driver_id", user.id);

      if (myRides && myRides.length > 0) {
        const rideIds = myRides.map((r) => r.id);
        const { data: rideBookings } = await supabase
          .from("ride_bookings")
          .select(`
            *,
            ride:rides(*, driver:profiles!rides_driver_id_fkey(*)),
            passenger:profiles!ride_bookings_passenger_id_fkey(*)
          `)
          .in("ride_id", rideIds)
          .order("created_at", { ascending: false });

        if (rideBookings) {
          // Merge, avoiding duplicates
          const existingIds = new Set(allBookings.map((b) => b.id));
          for (const rb of rideBookings) {
            if (!existingIds.has(rb.id)) {
              allBookings.push(rb as Booking);
            }
          }
        }
      }

      // Sort by created_at descending
      allBookings.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBookingRequests(allBookings);
      return allBookings;
    } catch (err) {
      console.error("Error loading booking requests:", err);
      return [];
    } finally {
      setRequestsLoading(false);
    }
  }, [user]);

  // ─── Conversations (Messages tab) ────────────────────────────────

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          ride:rides(*, driver:profiles(*)),
          driver:profiles!conversations_driver_id_fkey(*),
          passenger:profiles!conversations_passenger_id_fkey(*),
          messages(id, message, message_type, read_status, sender_id, created_at)
        `)
        .or(`driver_id.eq.${user.id},passenger_id.eq.${user.id}`);

      if (error) throw error;

      const formatted = (data || []).map((convo: any) => {
        const unread = convo.messages.filter(
          (m: any) => m.sender_id !== user.id && m.read_status !== "read"
        ).length;

        const sortedMsgs = [...convo.messages].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const lastMsg = sortedMsgs[sortedMsgs.length - 1];

        return {
          ...convo,
          unread_count: unread,
          last_message: lastMsg,
          messages: sortedMsgs
        } as Conversation;
      });

      formatted.sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
        return timeB - timeA;
      });

      setConversations(formatted);

      // Handle selecting conversation from URL parameters
      if (urlRideId && urlPassengerId) {
        const target = formatted.find(
          (c) => c.ride_id === urlRideId && c.passenger_id === urlPassengerId
        );
        if (target) {
          selectConversation(target);
        } else {
          await checkAndCreateConvoFromUrl(urlRideId, urlPassengerId);
        }
      } else if (formatted.length > 0 && !activeConversation) {
        if (window.innerWidth >= 768) {
          selectConversation(formatted[0]);
        }
      }
    } catch (err) {
      console.error("Error loading inbox conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkAndCreateConvoFromUrl = async (rideId: string, passengerId: string) => {
    try {
      const { data: booking, error: bErr } = await supabase
        .from("ride_bookings")
        .select("*, ride:rides(*)")
        .eq("ride_id", rideId)
        .eq("passenger_id", passengerId)
        .eq("status", "accepted")
        .single();

      if (bErr || !booking) {
        console.log("No accepted booking found to initialize conversation");
        return;
      }

      const { data: newConvo, error: cErr } = await supabase
        .from("conversations")
        .insert({
          ride_id: rideId,
          driver_id: booking.ride.driver_id,
          passenger_id: passengerId
        })
        .select(`
          *,
          ride:rides(*, driver:profiles(*)),
          driver:profiles!conversations_driver_id_fkey(*),
          passenger:profiles!conversations_passenger_id_fkey(*)
        `)
        .single();

      if (cErr) throw cErr;

      fetchConversations();
      if (newConvo) {
        selectConversation({ ...newConvo, messages: [], unread_count: 0 } as Conversation);
      }
    } catch (err) {
      console.error("Error creating conversation dynamically:", err);
    }
  };

  // ─── Accept / Reject Booking ──────────────────────────────────────

  const handleAcceptBooking = async (booking: Booking) => {
    if (!user) return;
    setActionLoading(booking.id);
    try {
      // 1. Update booking status
      await supabase.from("ride_bookings").update({ status: "accepted" }).eq("id", booking.id);

      // 2. Create conversation
      await supabase.from("conversations").insert({
        ride_id: booking.ride_id,
        driver_id: booking.ride?.driver_id || user.id,
        passenger_id: booking.passenger_id
      });

      // 3. Send notification to passenger
      await supabase.from("notifications").insert({
        user_id: booking.passenger_id,
        type: "booking_accepted",
        title: "Booking Accepted!",
        content: `Your booking for ${booking.ride?.source} → ${booking.ride?.destination} has been accepted.`,
        link_id: booking.ride_id,
        is_read: false
      });

      // 4. Refresh data
      fetchBookingRequests();
      fetchConversations();
    } catch (err) {
      console.error("Error accepting booking:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBooking = async (booking: Booking) => {
    if (!user) return;
    setActionLoading(booking.id);
    try {
      await supabase.from("ride_bookings").update({ status: "rejected" }).eq("id", booking.id);

      await supabase.from("notifications").insert({
        user_id: booking.passenger_id,
        type: "booking_rejected",
        title: "Booking Rejected",
        content: `Your booking for ${booking.ride?.source} → ${booking.ride?.destination} has been rejected.`,
        link_id: booking.ride_id,
        is_read: false
      });

      fetchBookingRequests();
    } catch (err) {
      console.error("Error rejecting booking:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Conversation Selection & Chat ────────────────────────────────

  const selectConversation = async (convo: Conversation) => {
    setActiveConversation(convo);
    setActiveConvoMessages(convo.messages || []);
    setTimeout(scrollToBottom, 50);

    try {
      const { data: booking } = await supabase
        .from("ride_bookings")
        .select("status")
        .eq("ride_id", convo.ride_id)
        .eq("passenger_id", convo.passenger_id)
        .single();
      setBookingStatus(booking?.status || "accepted");
    } catch {
      setBookingStatus("accepted");
    }

    if (user && convo.messages) {
      const unreadIds = convo.messages
        .filter((m) => m.sender_id !== user.id && m.read_status !== "read")
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ read_status: "read" })
          .in("id", unreadIds);

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convo.id ? { ...c, unread_count: 0 } : c
          )
        );
      }
    }
  };

  const handleSendMessage = async (text: string, type: "text" | "coordination" = "text") => {
    if (!user || !activeConversation || !text.trim()) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          message: text.trim(),
          message_type: type,
          read_status: "sent"
        })
        .select()
        .single();

      if (error) throw error;

      const optimisticMsg: Message = {
        ...data,
        sender: profileAsUser()
      };

      setActiveConvoMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(scrollToBottom, 50);

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeConversation.id) {
            return {
              ...c,
              last_message: optimisticMsg,
              messages: [...(c.messages || []), optimisticMsg]
            };
          }
          return c;
        });

        return updated.sort((a, b) => {
          const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
          const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
          return timeB - timeA;
        });
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const profileAsUser = () => {
    return {
      id: user?.id || "",
      full_name: "You",
      avatar_url: ""
    } as Profile;
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ─── Tab Logic ────────────────────────────────────────────────────

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    setSearchParams(params, { replace: true });
  };

  // ─── Initialize ───────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const bookings = await fetchBookingRequests();
      await fetchConversations();

      // Determine default tab
      if (urlTab === "requests" || urlTab === "messages") {
        setActiveTab(urlTab);
      } else {
        const hasPending = (bookings || []).some((b) => b.status === "pending");
        setActiveTab(hasPending ? "requests" : "messages");
      }
      setTabInitialized(true);
    };
    init();
  }, [user]);

  // Sync tab from URL query params
  useEffect(() => {
    if (urlTab === "requests" || urlTab === "messages") {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Sync conversation selection from URL query params
  useEffect(() => {
    if (urlRideId && urlPassengerId && conversations.length > 0) {
      const target = conversations.find(
        (c) => c.ride_id === urlRideId && c.passenger_id === urlPassengerId
      );
      if (target) {
        selectConversation(target);
      } else {
        checkAndCreateConvoFromUrl(urlRideId, urlPassengerId);
      }
    }
  }, [urlRideId, urlPassengerId, conversations]);

  // ─── Realtime Subscriptions ───────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    // Subscribe to booking changes
    const bookingSub = supabase
      .channel("inbox_bookings_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_bookings" },
        () => {
          fetchBookingRequests();
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messageSub = supabase
      .channel("inbox_messages_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          if (payload.eventType === "INSERT") {
            const belongsToMe = conversations.some((c) => c.id === newMsg.conversation_id);
            if (!belongsToMe) {
              fetchConversations();
              return;
            }

            if (newMsg.sender_id !== user.id) {
              if (activeConversation && activeConversation.id === newMsg.conversation_id) {
                await supabase
                  .from("messages")
                  .update({ read_status: "read" })
                  .eq("id", newMsg.id);

                newMsg.read_status = "read";

                setActiveConvoMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setTimeout(scrollToBottom, 50);
              } else {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === newMsg.conversation_id
                      ? { 
                          ...c, 
                          unread_count: (c.unread_count || 0) + 1,
                          last_message: newMsg,
                          messages: [...(c.messages || []), newMsg]
                        }
                      : c
                  )
                );
              }
            }
          } else if (payload.eventType === "UPDATE") {
            if (activeConversation && activeConversation.id === newMsg.conversation_id) {
              setActiveConvoMessages((prev) =>
                prev.map((m) => (m.id === newMsg.id ? { ...m, read_status: newMsg.read_status } : m))
              );
            }
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === newMsg.conversation_id) {
                  return {
                    ...c,
                    messages: (c.messages || []).map((m) =>
                      m.id === newMsg.id ? { ...m, read_status: newMsg.read_status } : m
                    ),
                    last_message: c.last_message?.id === newMsg.id ? newMsg : c.last_message
                  };
                }
                return c;
              })
            );
          }
        }
      )
      .subscribe();

    // Subscribe to new conversations
    const conversationSub = supabase
      .channel("inbox_conversations_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations"
        },
        (payload) => {
          const newConvo = payload.new as Conversation;
          if (newConvo.driver_id === user.id || newConvo.passenger_id === user.id) {
            fetchConversations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingSub);
      supabase.removeChannel(messageSub);
      supabase.removeChannel(conversationSub);
    };
  }, [user, conversations, activeConversation]);

  // ─── Helpers ──────────────────────────────────────────────────────

  const filteredConversations = conversations.filter((c) => {
    const isMeDriver = user && c.driver_id === user.id;
    const recipient = isMeDriver ? c.passenger : c.driver;
    const nameMatch = recipient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const routeMatch = (c.ride?.source + " " + c.ride?.destination)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return nameMatch || routeMatch;
  });

  const filteredRequests = bookingRequests.filter((b) => {
    if (!requestSearchQuery) return true;
    const q = requestSearchQuery.toLowerCase();
    const nameMatch = b.passenger?.full_name?.toLowerCase().includes(q) ||
      b.ride?.driver?.full_name?.toLowerCase().includes(q);
    const routeMatch = (b.ride?.source + " " + b.ride?.destination)
      .toLowerCase()
      .includes(q);
    return nameMatch || routeMatch;
  });

  const getRecipientProfile = (convo: Conversation) => {
    const isMeDriver = user && convo.driver_id === user.id;
    return isMeDriver ? convo.passenger : convo.driver;
  };

  const isDriverForBooking = (booking: Booking) => {
    if (!user) return false;
    // Check direct driver_id on booking, or driver_id on the ride
    return booking.driver_id === user.id || booking.ride?.driver_id === user.id;
  };

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-3 w-3" />;
      case "accepted":
        return <CheckCircle2 className="h-3 w-3" />;
      case "rejected":
        return <XCircle className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  const handleMessageDriver = (booking: Booking) => {
    // Find the conversation for this booking's ride + passenger
    const convo = conversations.find(
      (c) => c.ride_id === booking.ride_id && c.passenger_id === booking.passenger_id
    );
    switchTab("messages");
    if (convo) {
      setTimeout(() => selectConversation(convo), 100);
    }
  };

  // ─── Pending count for tab badge ──────────────────────────────────

  const pendingCount = bookingRequests.filter(
    (b) => b.status === "pending" && isDriverForBooking(b)
  ).length;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-slate-50 overflow-hidden">
      
      {/* SIDEBAR */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 ${
        activeConversation && activeTab === "messages" ? "hidden md:flex" : "flex"
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <h2 className="text-xl font-black text-slate-900 text-left">Inbox</h2>
          
          {/* Tab Bar */}
          <div className="flex border-b border-slate-100 -mx-4 px-4">
            <button
              onClick={() => switchTab("requests")}
              className={`flex-1 pb-2.5 text-xs font-bold transition relative ${
                activeTab === "requests"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                Requests
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => switchTab("messages")}
              className={`flex-1 pb-2.5 text-xs font-bold transition relative ${
                activeTab === "messages"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                Messages
                {conversations.some((c) => (c.unread_count || 0) > 0) && (
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                )}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "requests" ? "Search requests..." : "Search chat or route..."}
              value={activeTab === "requests" ? requestSearchQuery : searchQuery}
              onChange={(e) =>
                activeTab === "requests"
                  ? setRequestSearchQuery(e.target.value)
                  : setSearchQuery(e.target.value)
              }
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none bg-slate-50/50"
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ─── REQUESTS TAB ──────────────────────────────────── */}
          {activeTab === "requests" && (
            <div className="divide-y divide-slate-50">
              {requestsLoading ? (
                <div className="h-full flex flex-col items-center justify-center p-10">
                  <div className="animate-spin h-7 w-7 border-3 border-blue-600 border-t-transparent rounded-full mb-3" />
                  <p className="text-[10px] text-slate-400 font-semibold">Loading requests...</p>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 min-h-[300px]">
                  <InboxIcon className="h-10 w-10 text-slate-300 mb-2" />
                  <h3 className="text-xs font-bold text-slate-500">No booking requests</h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[220px]">
                    Booking requests will appear here when passengers request to join your rides, or when you request to join a ride.
                  </p>
                </div>
              ) : (
                filteredRequests.map((booking) => {
                  const isDriver = isDriverForBooking(booking);
                  const otherPerson = isDriver ? booking.passenger : booking.ride?.driver;
                  const isActionLoading = actionLoading === booking.id;

                  return (
                    <div
                      key={booking.id}
                      className="p-4 bg-white hover:bg-slate-50/50 transition"
                    >
                      {/* Top: avatar + name + status + time */}
                      <div className="flex items-start gap-3">
                        <Avatar
                          src={otherPerson?.avatar_url}
                          fallback={otherPerson?.full_name || "User"}
                          size="md"
                        />
                        <div className="flex-grow min-w-0 text-left">
                          <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold text-slate-900 truncate">
                              {otherPerson?.full_name || "Unknown"}
                            </h4>
                            <span className="text-[9px] text-slate-400 shrink-0 ml-2">
                              {formatDate(booking.created_at)}
                            </span>
                          </div>

                          <div className="text-[10px] text-blue-600 font-bold truncate mt-0.5">
                            {booking.ride?.source} &rarr; {booking.ride?.destination}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${getStatusStyle(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {booking.seats_booked} seat{booking.seats_booked > 1 ? "s" : ""}
                            </span>
                            {booking.ride?.departure_date && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(booking.ride.departure_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                          </div>

                          {/* Booking note */}
                          {booking.note && (
                            <p className="text-[10px] text-slate-500 mt-1.5 italic bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100 leading-relaxed">
                              "{booking.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isDriver && booking.status === "pending" && (
                        <div className="flex items-center gap-2 mt-3 ml-11">
                          <button
                            onClick={() => setPassengerModalId(booking.passenger_id)}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 px-3 py-1.5 rounded-full transition flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View Passenger
                          </button>
                          <button
                            disabled={isActionLoading}
                            onClick={() => handleAcceptBooking(booking)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded-full transition flex items-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Accept
                          </button>
                          <button
                            disabled={isActionLoading}
                            onClick={() => handleRejectBooking(booking)}
                            className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100/70 border border-red-100 px-3 py-1.5 rounded-full transition flex items-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Passenger view: accepted → "Message Driver" button */}
                      {!isDriver && booking.status === "accepted" && (
                        <div className="mt-3 ml-11">
                          <button
                            onClick={() => handleMessageDriver(booking)}
                            className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 px-3 py-1.5 rounded-full transition flex items-center gap-1"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Message Driver
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ─── MESSAGES TAB ──────────────────────────────────── */}
          {activeTab === "messages" && (
            <div className="divide-y divide-slate-50">
              {filteredConversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 min-h-[300px]">
                  <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                  <h3 className="text-xs font-bold text-slate-500">No conversations yet</h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[200px]">
                    Conversations appear after a ride booking is accepted.
                  </p>
                </div>
              ) : (
                filteredConversations.map((convo) => {
                  const recipient = getRecipientProfile(convo);
                  const isSelected = activeConversation?.id === convo.id;
                  
                  return (
                    <div
                      key={convo.id}
                      onClick={() => selectConversation(convo)}
                      className={`p-4 flex gap-3 cursor-pointer transition select-none ${
                        isSelected ? "bg-blue-50/30 border-l-4 border-blue-600" : "hover:bg-slate-50/50 bg-white"
                      }`}
                    >
                      <Avatar src={recipient?.avatar_url} fallback={recipient?.full_name || "Buddy"} size="md" />
                      
                      <div className="flex-grow min-w-0 text-left">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {recipient?.full_name}
                          </h4>
                          <span className="text-[9px] text-slate-400 shrink-0">
                            {convo.last_message ? formatTime(convo.last_message.created_at) : ""}
                          </span>
                        </div>

                        <div className="text-[10px] text-blue-600 font-bold truncate mt-0.5">
                          {convo.ride?.source} &rarr; {convo.ride?.destination}
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          <p className={`text-[11px] truncate flex-grow mr-2 ${
                            convo.unread_count && convo.unread_count > 0 ? "font-bold text-slate-900" : "text-slate-500"
                          }`}>
                            {convo.last_message?.message || "No messages yet"}
                          </p>
                          {convo.unread_count && convo.unread_count > 0 ? (
                            <span className="bg-red-500 text-white rounded-full text-[9px] font-bold h-4.5 min-w-[18px] px-1 flex items-center justify-center">
                              {convo.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* CHAT AREA (only visible when Messages tab or conversation selected) */}
      <div className={`flex-grow flex bg-slate-50 overflow-hidden relative ${
        !activeConversation || activeTab !== "messages" ? "hidden md:flex items-center justify-center" : "flex flex-col"
      }`}>
        
        {activeConversation && activeTab === "messages" ? (
          <div className="flex-grow flex overflow-hidden">
            
            {/* Conversation Core panel */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveConversation(null)} 
                    className="md:hidden p-1.5 hover:bg-slate-100 rounded-xl text-slate-500"
                  >
                    <ArrowLeft className="h-4.5 w-4.5" />
                  </button>

                  <Avatar 
                    src={getRecipientProfile(activeConversation)?.avatar_url} 
                    fallback={getRecipientProfile(activeConversation)?.full_name || "Buddy"} 
                    size="md" 
                  />
                  
                  <div className="text-left">
                    <h3 className="text-xs font-bold text-slate-900">
                      {getRecipientProfile(activeConversation)?.full_name}
                    </h3>
                    <p className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                      <Car className="h-3 w-3 text-blue-600" />
                      {activeConversation.ride?.source} &rarr; {activeConversation.ride?.destination}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="success" className="capitalize text-[9px] py-0 px-2.5 font-bold">
                    {bookingStatus || "Accepted"}
                  </Badge>
                  <button 
                    onClick={() => setShowDetailPanel(!showDetailPanel)} 
                    className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-500 hidden md:inline-flex"
                  >
                    <Info className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Message Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {activeConvoMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    No messages in this conversation. Choose a coordination template below or write a reply!
                  </div>
                ) : (
                  activeConvoMessages.map((msg) => {
                    const isMe = user && msg.sender_id === user.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-sm text-left ${
                          isMe 
                            ? "bg-blue-600 text-white rounded-br-none" 
                            : "bg-white text-slate-800 rounded-bl-none border border-slate-100"
                        }`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          
                          <div className="flex items-center justify-end gap-1 mt-1 text-[8px]">
                            <span className={isMe ? "text-blue-200" : "text-slate-400 font-semibold"}>
                              {formatTime(msg.created_at)}
                            </span>
                            
                            {isMe && (
                              <span className="text-white shrink-0">
                                {msg.read_status === "read" ? (
                                  <CheckCheck className="h-3 w-3 text-cyan-200 fill-current" />
                                ) : msg.read_status === "delivered" ? (
                                  <CheckCheck className="h-3 w-3 text-slate-300" />
                                ) : (
                                  <Check className="h-3 w-3 text-slate-300" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Ride Coordination Quick Actions */}
              <div className="px-4 py-2.5 bg-white border-t border-slate-100 overflow-x-auto shrink-0 flex gap-2 select-none no-scrollbar">
                {[
                  "I am near the pickup point.",
                  "Please wait 5 minutes.",
                  "I will arrive in 10 minutes.",
                  "Where should I meet you?"
                ].map((txt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(txt, "coordination")}
                    className="shrink-0 text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100/70 border border-blue-100 font-bold px-3 py-1.5 rounded-full transition"
                  >
                    {txt}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  handleSendMessage(chatInput);
                  setChatInput("");
                }} 
                className="p-3 border-t border-slate-200 bg-white flex gap-2.5 shrink-0"
              >
                <input
                  type="text"
                  required
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-grow rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
                <Button type="submit" className="py-2.5 px-4.5 rounded-xl">
                  <Send className="h-4.5 w-4.5" />
                </Button>
              </form>

            </div>

            {/* SIDE PANEL: Ride details & Contact info */}
            {showDetailPanel && (
              <div className="w-72 border-l border-slate-200 bg-white hidden lg:flex flex-col overflow-y-auto p-5 text-left shrink-0 select-none">
                <h3 className="font-black text-slate-900 text-sm mb-4">Trip Coordination</h3>
                
                {/* Ride route Card */}
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 mb-5 space-y-3.5">
                  <div className="flex gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Route</span>
                      <span className="text-xs font-bold text-slate-800">{activeConversation.ride?.source} &rarr; {activeConversation.ride?.destination}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Date & Time</span>
                      <span className="text-xs font-bold text-slate-800">
                        {activeConversation.ride?.departure_date ? new Date(activeConversation.ride.departure_date).toLocaleDateString("en-IN") : ""} • {activeConversation.ride?.departure_time}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact information */}
                <h4 className="font-bold text-slate-800 text-xs mb-3">Contact Details</h4>
                {bookingStatus === "accepted" ? (
                  <div className="space-y-4">
                    <div className="p-3.5 border border-emerald-100 rounded-2xl bg-emerald-50/20 text-xs space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-bold text-emerald-800 text-[10px]">Verified Contacts Unlocked</span>
                      </div>
                      
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Phone Number</span>
                        <span className="text-sm font-mono font-bold text-slate-900 block mt-0.5">
                          {getRecipientProfile(activeConversation)?.phone_number || "+91 98765 43210"}
                        </span>
                      </div>
                    </div>

                    <a 
                      href={`tel:${getRecipientProfile(activeConversation)?.phone_number || "+919876543210"}`} 
                      className="block w-full"
                    >
                      <Button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 py-2.5">
                        <PhoneCall className="h-4 w-4" /> Call Partner
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed rounded-2xl bg-slate-50 text-slate-400 text-xs flex gap-2">
                    <Lock className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Phone numbers are hidden until booking is accepted for passenger and driver privacy.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          /* Empty Chat Area on desktop */
          <div className="hidden md:flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <div className="bg-white border p-6 rounded-[32px] shadow-xl max-w-sm flex flex-col items-center">
              {activeTab === "requests" ? (
                <>
                  <InboxIcon className="h-12 w-12 text-blue-600 animate-pulse mb-3" />
                  <h3 className="text-sm font-black text-slate-900">Booking Requests</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Review incoming booking requests from the sidebar. Accept requests to start chatting with passengers.
                  </p>
                </>
              ) : (
                <>
                  <MessageSquare className="h-12 w-12 text-blue-600 animate-pulse mb-3" />
                  <h3 className="text-sm font-black text-slate-900">Select a conversation</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Choose a conversation from the sidebar list to start exchanging real-time ride coordination messages.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Passenger Profile Modal */}
      <PassengerProfileModal
        passengerId={passengerModalId || ""}
        isOpen={!!passengerModalId}
        onClose={() => setPassengerModalId(null)}
      />

    </div>
  );
};
