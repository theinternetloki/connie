"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Wait for session to be properly set in cookies
      if (data.session) {
        // Small delay to ensure cookies are set, then redirect
        await new Promise(resolve => setTimeout(resolve, 200));
        // Use window.location for a full page reload to ensure middleware sees the cookies
        window.location.href = "/dashboard";
      } else {
        // Fallback: wait and try router refresh
        await new Promise(resolve => setTimeout(resolve, 300));
        router.refresh();
        router.push("/dashboard");
      }
    } catch (err: any) {
      // Handle specific error messages
      const errorMessage = err.message || err.error?.message || "An error occurred during login. Please try again.";
      
      if (errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
        setError("Too many login attempts. Please wait a few minutes and try again.");
      } else if (errorMessage.includes("Invalid login credentials") || errorMessage.includes("invalid") || errorMessage.includes("400")) {
        setError("Invalid email or password. Please check your credentials and try again.");
      } else if (errorMessage.includes("Email not confirmed")) {
        setError("Please check your email and click the confirmation link before logging in.");
      } else {
        setError(errorMessage);
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
            Login
          </h1>
        </div>
        <div className="p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-6">
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
                autoComplete="current-password"
                required
                className="h-12 text-base border-gray-300 rounded-xl"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 font-semibold h-12" 
              disabled={loading}
              size="lg"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
            <p className="text-sm text-center text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/signup")}
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Sign up
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
