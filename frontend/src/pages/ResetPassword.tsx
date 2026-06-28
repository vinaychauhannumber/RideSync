import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Car, AlertCircle, CheckCircle } from "lucide-react";

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false); // true if they clicked the email link
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if we have an active recovery session (hash parameters will contain access_token)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.location.hash.includes("type=recovery")) {
        setIsResetting(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsResetting(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSuccess(true);
      setMessage(`A password reset link has been sent to ${email}. Check your inbox!`);
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setMessage("Your password has been successfully updated! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update password");
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
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            {isResetting ? "Set New Password" : "Reset Password"}
          </h2>
        </div>

        <Card className="border border-slate-100 shadow-xl bg-white rounded-3xl p-2">
          <CardHeader>
            <CardTitle>{isResetting ? "Update Credentials" : "Recovery Link"}</CardTitle>
            <CardDescription>
              {isResetting ? "Enter your new password below" : "Enter email to receive recovery instructions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="rounded-2xl bg-emerald-50 p-6 text-center border border-emerald-100 space-y-3">
                <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
                <h4 className="text-lg font-bold text-emerald-800">Success</h4>
                <p className="text-xs text-emerald-600 leading-relaxed">{message}</p>
                {!isResetting && (
                  <div className="pt-2">
                    <Link to="/login">
                      <Button variant="outline" className="w-full">Back to Login</Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={isResetting ? handleUpdatePassword : handleRequestReset} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-700 border border-red-100">
                    <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {isResetting ? (
                  <Input
                    label="New Password"
                    type="password"
                    id="password"
                    required
                    placeholder="Enter at least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                ) : (
                  <Input
                    label="Email Address"
                    type="email"
                    id="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}

                <Button type="submit" className="w-full py-3" loading={loading}>
                  {isResetting ? "Update Password" : "Send Reset Link"}
                </Button>
              </form>
            )}

            {!success && (
              <div className="mt-6 text-center text-xs text-slate-500">
                Remember your password?{" "}
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
