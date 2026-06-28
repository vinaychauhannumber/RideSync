import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../hooks/useNotifications";
import { useInboxUnreadCount } from "../hooks/useInboxUnreadCount";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Bell, Car, Search, LogOut, Menu, X, Settings, ShieldAlert, User, Check, XSquare, MessageSquare, ChevronRight, TrendingUp, Landmark, XCircle } from "lucide-react";
import { formatDate } from "../lib/utils";

export const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { unreadChatCount } = useInboxUnreadCount();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [yourRidesExpanded, setYourRidesExpanded] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleNotifClick = async (notif: any) => {
    await markAsRead(notif.id);
    setNotifDropdownOpen(false);
    if (notif.type.includes("booking")) {
      navigate("/inbox?tab=requests");
    } else if (notif.type.includes("message")) {
      navigate("/inbox?tab=messages");
    } else if (notif.link_id) {
      navigate(`/ride/${notif.link_id}`);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 text-blue-600 font-extrabold text-2xl tracking-tight">
              <Car className="h-7 w-7 text-blue-600 animate-pulse" />
              <span>RideSync</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/find-ride" className="flex items-center space-x-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 transition">
              <Search className="h-4 w-4" />
              <span>Search Rides</span>
            </Link>
            
            <Link to={user ? "/create-ride" : "/login?redirect=/create-ride"} className="inline-flex items-center justify-center border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-5 py-1.5 rounded-full font-bold text-sm transition">
              Offer a ride
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setNotifDropdownOpen(!notifDropdownOpen);
                      setProfileDropdownOpen(false);
                    }}
                    className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {notifDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-4 shadow-xl ring-1 ring-black/5 animate-scale-up">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800">Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={markAllAsRead} className="text-[10px] font-semibold text-blue-600 hover:underline">
                            Mark all as read
                          </button>
                        )}
                      </div>
                      
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No notifications yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {notifications.slice(0, 5).map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => handleNotifClick(notif)}
                              className={`flex flex-col p-2.5 rounded-xl cursor-pointer hover:bg-slate-50 transition border-l-2 ${
                                notif.is_read ? "border-transparent" : "border-blue-500 bg-blue-50/20"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                                {!notif.is_read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1" />}
                              </div>
                              <span className="text-[11px] text-slate-500 mt-0.5">{notif.content}</span>
                              <span className="text-[9px] text-slate-400 mt-1">{formatDate(notif.created_at)}</span>
                            </div>
                          ))}
                          {notifications.length > 5 && (
                            <button
                              onClick={() => {
                                setNotifDropdownOpen(false);
                                navigate("/dashboard");
                              }}
                              className="w-full text-center py-2 text-xs font-bold text-blue-600 hover:underline"
                            >
                              View all notifications
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-xl flex items-center justify-center select-none cursor-default">
                  🇮🇳
                </span>

                {/* Profile Avatar Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(!profileDropdownOpen);
                      setNotifDropdownOpen(false);
                    }}
                    className="flex items-center space-x-2 focus:outline-none"
                  >
                    <div className="relative">
                      <Avatar
                        src={profile?.avatar_url}
                        fallback={profile?.full_name || "User"}
                        size="sm"
                        className="ring-2 ring-blue-500/10 hover:ring-blue-500/30 transition"
                      />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-100 bg-white shadow-2xl ring-1 ring-black/5 animate-scale-up overflow-hidden z-50">
                      <div className="py-2 divide-y divide-slate-100">
                        {/* Your rides Expandable */}
                        <div className="flex flex-col">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setYourRidesExpanded(!yourRidesExpanded);
                            }}
                            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group w-full text-left focus:outline-none"
                          >
                            <div className="flex items-center space-x-3">
                              <Car className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                              <span className="text-sm font-semibold">Your rides</span>
                            </div>
                            <ChevronRight className={`h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition duration-200 ${yourRidesExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          
                          {/* Submenu */}
                          {yourRidesExpanded && (
                            <div className="bg-slate-50 border-y border-slate-100 py-1.5 flex flex-col">
                              <Link
                                to="/my-rides?role=driver"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="pl-12 pr-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
                              >
                                As a rider
                              </Link>
                              <Link
                                to="/my-rides?role=passenger"
                                onClick={() => setProfileDropdownOpen(false)}
                                className="pl-12 pr-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition"
                              >
                                As a passenger
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Inbox */}
                        <Link
                          to="/inbox"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-955 group"
                        >
                          <div className="flex items-center space-x-3">
                            <MessageSquare className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                            <span className="text-sm font-semibold">Inbox {unreadChatCount > 0 ? `(${unreadChatCount})` : ""}</span>
                            {unreadChatCount > 0 && (
                              <span className="bg-red-500 text-white rounded-full text-[9px] font-bold px-2 py-0.5 ml-2">
                                {unreadChatCount}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
                        </Link>

                        {/* Profile */}
                        <Link
                          to="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
                        >
                          <div className="flex items-center space-x-3">
                            <User className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                            <span className="text-sm font-semibold">Profile</span>
                          </div>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
                        </Link>

                        {/* Transfers */}
                        <Link
                          to="/dashboard?tab=transfers"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-955 group"
                        >
                          <div className="flex items-center space-x-3">
                            <TrendingUp className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                            <span className="text-sm font-semibold">Transfers</span>
                          </div>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
                        </Link>

                        {/* Payments & refunds */}
                        <Link
                          to="/dashboard?tab=payments"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-955 group"
                        >
                          <div className="flex items-center space-x-3">
                            <Landmark className="h-5 w-5 text-slate-400 group-hover:text-blue-600 transition" />
                            <span className="text-sm font-semibold">Payments & refunds</span>
                          </div>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
                        </Link>

                        {profile?.role === "admin" && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center justify-between px-4 py-3.5 hover:bg-red-50/30 transition text-red-600 hover:text-red-700 group"
                          >
                            <div className="flex items-center space-x-3">
                              <ShieldAlert className="h-5 w-5 text-red-400 group-hover:text-red-600 transition" />
                              <span className="text-sm font-semibold">Admin Panel</span>
                            </div>
                            <ChevronRight className="h-4.5 w-4.5 text-red-400 group-hover:text-red-600 transition" />
                          </Link>
                        )}

                        {/* Log out */}
                        <button
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            handleSignOut();
                          }}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition text-slate-800 hover:text-slate-950 group"
                        >
                          <div className="flex items-center space-x-3">
                            <XCircle className="h-5 w-5 text-slate-400 group-hover:text-red-500 transition" />
                            <span className="text-sm font-semibold">Log out</span>
                          </div>
                          <ChevronRight className="h-4.5 w-4.5 text-slate-400 group-hover:text-slate-600 transition" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            {user && (
              <button
                onClick={() => navigate("/dashboard")}
                className="relative rounded-full p-2 text-slate-500 mr-2"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-3">
          <Link
            to="/find-ride"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50"
          >
            Search Rides
          </Link>
          
          {profile?.role === "driver" && (
            <Link
              to="/create-ride"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50"
            >
              Publish a Ride
            </Link>
          )}

          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <div className="flex flex-col">
                <button
                  onClick={() => setYourRidesExpanded(!yourRidesExpanded)}
                  className="flex items-center justify-between w-full px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50 focus:outline-none"
                >
                  <span>Your Rides</span>
                  <ChevronRight className={`h-4.5 w-4.5 transition duration-200 ${yourRidesExpanded ? 'rotate-90' : ''}`} />
                </button>
                {yourRidesExpanded && (
                  <div className="pl-6 flex flex-col space-y-1 mt-1 mb-2">
                    <Link
                      to="/my-rides?role=driver"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50"
                    >
                      As a rider
                    </Link>
                    <Link
                      to="/my-rides?role=passenger"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-3 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-50"
                    >
                      As a passenger
                    </Link>
                  </div>
                )}
              </div>
              <Link
                to="/inbox"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50 flex items-center justify-between"
              >
                <span>Inbox {unreadChatCount > 0 ? `(${unreadChatCount})` : ""}</span>
                {unreadChatCount > 0 && (
                  <span className="bg-red-500 text-white rounded-full text-[9px] font-bold px-2 py-0.5">
                    {unreadChatCount}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-base font-semibold text-slate-700 rounded-xl hover:bg-slate-50"
              >
                Profile Settings
              </Link>
              
              {profile?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-base font-semibold text-red-600 rounded-xl hover:bg-red-50/50"
                >
                  Admin Panel
                </Link>
              )}
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="flex w-full items-center space-x-2 px-3 py-2.5 text-base font-semibold text-slate-600 rounded-xl hover:bg-slate-50"
              >
                <LogOut className="h-5 w-5" />
                <span>Log Out</span>
              </button>
            </>
          ) : (
            <div className="pt-2 border-t border-slate-100 flex flex-col space-y-2">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Log In</Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};
