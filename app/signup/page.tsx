"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="dealership">Dealership Name</Label>
              <Input
                id="dealership"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className="mt-2"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {showConfirmationMessage && !error && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-900">
                <p className="font-semibold mb-2">Check your email!</p>
                <p>
                  We've sent a confirmation link to <strong>{email}</strong>.
                  Please click the link in the email to verify your account.
                </p>
                <p className="mt-2 text-xs text-blue-700">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading || showConfirmationMessage}>
              {loading ? "Creating account..." : showConfirmationMessage ? "Check Your Email" : "Sign Up"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-blue-600 hover:underline"
              >
                Login
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
