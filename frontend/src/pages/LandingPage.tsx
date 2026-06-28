import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Search, Calendar, Users, Shield, Award, Smile, ArrowRight, Star, Heart, MapPin, DollarSign, Car } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../context/AuthContext";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [seats, setSeats] = useState("1");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (source) params.append("from", source);
    if (destination) params.append("to", destination);
    if (date) params.append("date", date);
    if (seats) params.append("passengers", seats);
    navigate(`/rides/search-results?${params.toString()}`);
  };

  const faqItems = [
    {
      q: "How do I book a ride?",
      a: "Simply search for your source and destination cities, find a ride that fits your schedule, select your seats, and send a booking request. Once the driver accepts, your booking is confirmed!",
    },
    {
      q: "Is RideSync safe?",
      a: "Yes! Safety is our top priority. We verify government licenses and vehicle numbers for drivers. Additionally, passenger and driver live tracking is enabled, letting you share coordinates during pickup and throughout the trip.",
    },
    {
      q: "How do I pay for my ride?",
      a: "RideSync operates on a cost-sharing basis. Passengers pay drivers directly during the ride using the agreed price per seat displayed on the ride details.",
    },
    {
      q: "Can I cancel a booking?",
      a: "Yes, you can cancel your booking anytime from your Dashboard. We encourage passengers to cancel early if their plans change, so drivers can offer the seats to others.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 py-20 text-white lg:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/30 via-slate-950/90 to-slate-950"></div>
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Real-time Live Location Carpooling
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
              Your Ride, Synchronized in Real-Time
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">
              Connect with drivers heading your way. Share costs, reduce carbon footprint, and coordinate seamlessly with real-time passenger-driver location tracking.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/find-ride">
                <Button size="lg" className="shadow-lg shadow-blue-500/25">Find a Ride</Button>
              </Link>
              <Link to={user ? "/create-ride" : "/signup?role=driver"}>
                <Button variant="outline" size="lg" className="border-slate-800 text-white bg-slate-900 hover:bg-slate-800/80 hover:text-white">
                  Publish a Ride
                </Button>
              </Link>
            </div>
          </div>

          {/* Search Form Card */}
          <div className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-md ring-1 ring-white/5">
            <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Leaving From</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. San Francisco"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Going To</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Los Angeles"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Seats</label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <select
                      value={seats}
                      onChange={(e) => setSeats(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 py-3 pl-11 pr-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none"
                    >
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <option key={num} value={num} className="bg-slate-950 text-white">
                          {num} {num === 1 ? "seat" : "seats"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <Button type="submit" className="w-full py-3.5 shadow-lg shadow-blue-500/20">
                  <Search className="mr-2 h-4 w-4" />
                  Search Rides
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-slate-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How RideSync Works</h2>
            <p className="mt-4 text-slate-500">Coordinate and travel in 3 simple steps.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Publish or Search Rides",
                desc: "Drivers schedule routes with pickup spots and pricing. Passengers find trips heading in their direction.",
              },
              {
                step: "02",
                title: "Book & Chat Instantly",
                desc: "Request seats and coordinate via real-time built-in messaging once the driver approves the request.",
              },
              {
                step: "03",
                title: "Track Live Location & Ride",
                desc: "Prior to pickup, share coordinates on active maps. Confirm pickup to begin the ride route.",
              },
            ].map((step, idx) => (
              <div key={idx} className="relative rounded-2xl bg-white p-8 border border-slate-100 shadow-sm">
                <div className="text-4xl font-extrabold text-blue-600/10 mb-4">{step.step}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Why RideSync</span>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl mt-3">
                Smart Travel for Smart Commuters
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed">
                RideSync isn't just about carpooling. It's a real-time coordinator built for modern city travel. By matching drivers and passengers, we cut travel costs, decrease congestion, and make daily commutes enjoyable.
              </p>

              <div className="space-y-6 mt-8">
                {[
                  {
                    icon: <Award className="h-5 w-5 text-blue-600" />,
                    title: "Cost Efficient",
                    desc: "Split fuel and toll costs with passengers, paying only a fraction of normal ride-sharing rates.",
                  },
                  {
                    icon: <Heart className="h-5 w-5 text-cyan-500" />,
                    title: "Eco Friendly",
                    desc: "fewer cars on the road means lower emissions. Share rides to contribute to a cleaner planet.",
                  },
                  {
                    icon: <Smile className="h-5 w-5 text-emerald-500" />,
                    title: "Social & Fun",
                    desc: "Meet verified professionals and friendly neighbors during your trips.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative flex justify-center">
              <div className="w-full max-w-md aspect-square rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 opacity-10 blur-2xl absolute"></div>
              <div className="border border-slate-100 rounded-3xl bg-white p-8 shadow-xl relative z-10 w-full">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">JD</div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">John Doe</h4>
                      <p className="text-[10px] text-slate-500">Driving to San Jose</p>
                    </div>
                  </div>
                  <Badge variant="success">Active Trip</Badge>
                </div>
                
                {/* Live simulation */}
                <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Distance Remaining</span>
                    <span className="font-semibold text-slate-900">4.2 km</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>ETA</span>
                    <span className="font-semibold text-blue-600">6 minutes</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full w-2/3 rounded-full animate-pulse" />
                  </div>
                </div>
                
                <p className="text-xs text-slate-400 mt-4 text-center italic">
                  * Live locations are shared securely only between accepted participants.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Safety First</span>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl mt-3">
              Your Peace of Mind is Our Priority
            </h2>
            <p className="mt-4 text-slate-400">
              We design every feature around safety, ensuring total transparency between passengers and drivers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                icon: <Shield className="h-6 w-6 text-blue-400" />,
                title: "Profile Verification",
                desc: "We verify driver licenses, vehicle numbers, and email accounts to establish a trusted community.",
              },
              {
                icon: <MapPin className="h-6 w-6 text-cyan-400" />,
                title: "Live GPS Tracking",
                desc: "Passengers and drivers share coordinates on open-street maps. Track pickups and trip paths in real-time.",
              },
              {
                icon: <Star className="h-6 w-6 text-emerald-400" />,
                title: "Double-Sided Reviews",
                desc: "Both participants rate each other after rides, maintaining high accountability and professional standards.",
              },
            ].map((safety, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 mb-6">
                  {safety.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{safety.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{safety.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What Our Users Say</h2>
            <p className="mt-4 text-slate-500">Over 10,000+ happy passengers and drivers.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                name: "Sarah Jenkins",
                role: "Daily Commuter",
                img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
                text: "Live location sharing makes picking up John so easy. I no longer have to wait outside in the cold wondering when the car will arrive!",
                rating: 5,
              },
              {
                name: "David Chen",
                role: "Software Engineer / Driver",
                img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
                text: "I publish rides from SF to SJ twice a week. Splitting toll fees saves me almost $300 a month, and the passengers are always verified professionals.",
                rating: 5,
              },
              {
                name: "Maria Rodriguez",
                role: "Weekend Traveler",
                img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
                text: "I was skeptical about carpooling at first, but RideSync's verified profiles and rating systems made me feel completely safe. Great experience!",
                rating: 5,
              },
            ].map((t, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
                <div className="flex gap-1 mb-4 text-amber-400">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed italic mb-6">"{t.text}"</p>
                <div className="flex items-center space-x-3">
                  <img src={t.img} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                    <p className="text-[10px] text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-4 text-slate-500">Got questions? We have answers.</p>
          </div>

          <div className="space-y-6">
            {faqItems.map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                <h4 className="text-sm font-bold text-slate-900 mb-2">{faq.q}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-slate-900 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center space-x-2 text-white font-extrabold text-xl mb-4">
                <Car className="h-6 w-6 text-blue-500" />
                <span>RideSync</span>
              </Link>
              <p className="text-xs leading-relaxed">
                RideSync coordinates carpooling in real-time, matching drivers and passengers heading in the same direction to save money and the environment.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Explore</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/find-ride" className="hover:text-white">Find Rides</Link></li>
                <li><Link to="/create-ride" className="hover:text-white">Publish Ride</Link></li>
                <li><Link to="/dashboard" className="hover:text-white">User Dashboard</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Safety & Trust</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#" className="hover:text-white">Driver Verification</a></li>
                <li><a href="#" className="hover:text-white">Safety Checklist</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm font-bold text-white mb-4">Connect</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#" className="hover:text-white">Support Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Follow Twitter</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-xs flex flex-col sm:flex-row justify-between items-center gap-4">
            <span>&copy; {new Date().getFullYear()} RideSync Inc. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Cookie Preferences</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
