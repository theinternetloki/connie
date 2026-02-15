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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
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
                autoComplete="current-password"
                required
                className="mt-2"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/signup")}
                className="text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
