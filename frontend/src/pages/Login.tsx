import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Car, AlertCircle } from "lucide-react";

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center space-x-2 text-blue-600 font-extrabold text-3xl">
            <Car className="h-8 w-8 text-blue-600" />
            <span>RideSync</span>
          </Link>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
        </div>

        <Card className="border border-slate-100 shadow-xl bg-white rounded-3xl p-2">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                id="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  id="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <Button type="submit" className="w-full py-3" loading={loading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              Don't have an account?{" "}
              <Link to="/signup" className="font-bold text-blue-600 hover:underline">
                Create an account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
