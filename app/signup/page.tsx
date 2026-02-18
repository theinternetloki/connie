"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmationMessage, setShowConfirmationMessage] = useState(false);

  useEffect(() => {
    if (searchParams.get("confirm") === "email") {
      setShowConfirmationMessage(true);
      const storedEmail = sessionStorage.getItem("signup_email");
      if (storedEmail) {
        setEmail(storedEmail);
      }
    }
  }, [searchParams]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Store email for confirmation message
      sessionStorage.setItem("signup_email", email);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          data: {
            dealership_name: dealershipName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Check if email confirmation is required
        if (authData.user.email_confirmed_at) {
          // Email already confirmed, create profile immediately
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: authData.user.id,
              dealership_name: dealershipName,
            });

          if (profileError) throw profileError;
          router.push("/dashboard");
        } else {
          // Email confirmation required - show message
          setError(null);
          setShowConfirmationMessage(true);
          // Store dealership name in session for after confirmation
          sessionStorage.setItem("pending_dealership_name", dealershipName);
        }
      } else {
        // No user returned, might need email confirmation
        setShowConfirmationMessage(true);
      }
    } catch (err: any) {
      // Handle specific error messages
      if (err.message?.includes("rate limit")) {
        setError("Too many signup attempts. Please wait a few minutes and try again.");
      } else if (err.message?.includes("already registered")) {
        setError("An account with this email already exists. Please login instead.");
      } else {
        setError(err.message || "An error occurred during signup. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Sign Up
          </h1>
        </div>
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dealership" className="text-base font-semibold text-gray-900">
                Dealership Name
              </Label>
              <Input
                id="dealership"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                required
                className="h-12 text-base border-gray-300 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-semibold text-gray-900">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-12 text-base border-gray-300 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-semibold text-gray-900">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className="h-12 text-base border-gray-300 rounded-xl"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
            {showConfirmationMessage && !error && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl p-5">
                <p className="font-semibold mb-2 text-blue-900">Check your email!</p>
                <p className="text-sm text-blue-800 mb-2">
                  We've sent a confirmation link to <strong>{email}</strong>.
                  Please click the link in the email to verify your account.
                </p>
                <p className="text-xs text-blue-700">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-12" 
              disabled={loading || showConfirmationMessage}
              size="lg"
            >
              {loading ? "Creating account..." : showConfirmationMessage ? "Check Your Email" : "Sign Up"}
            </Button>
            <p className="text-sm text-center text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Login
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <p className="text-center text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
