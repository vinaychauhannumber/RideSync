import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Car, AlertCircle, CheckCircle } from "lucide-react";

export const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
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
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">Create a new account</h2>
        </div>

        <Card className="border border-slate-100 shadow-xl bg-white rounded-3xl p-2">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Join our platform and travel smarter</CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-100 space-y-3">
                <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
                <h4 className="text-lg font-bold text-emerald-800">Registration Successful!</h4>
                <p className="text-xs text-emerald-600 leading-relaxed">
                  We sent a confirmation link to <span className="font-semibold">{email}</span>. Please verify your email, then return here to log in.
                </p>
                <div className="pt-2">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">Go to Login</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Input
                  label="Full Name"
                  type="text"
                  id="fullName"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />

                <Input
                  label="Email Address"
                  type="email"
                  id="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  label="Password"
                  type="password"
                  id="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Button type="submit" className="w-full py-3" loading={loading}>
                  Sign Up
                </Button>
              </form>
            )}

            {!success && (
              <div className="mt-6 text-center text-xs text-slate-500">
                Already have an account?{" "}
                <Link to="/login" className="font-bold text-blue-600 hover:underline">
                  Log in
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
