"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laborRateTier, setLaborRateTier] = useState<string>("medium");
  const [zipCode, setZipCode] = useState<string>("");
  const [dealershipName, setDealershipName] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    loadProfile();
  }, [user, authLoading, router]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("labor_rate_tier, region, dealership_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setLaborRateTier(data.labor_rate_tier || "medium");
        setZipCode(data.region || "");
        setDealershipName(data.dealership_name || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          labor_rate_tier: laborRateTier,
          region: zipCode,
          dealership_name: dealershipName,
        })
        .eq("id", user.id);

      if (error) throw error;

      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              Settings
            </h1>
          </div>
          <div className="p-6 sm:p-8 space-y-8">
            <div className="space-y-3">
              <Label htmlFor="dealership-name" className="text-base font-semibold text-gray-900">
                Dealership Name
              </Label>
              <Input
                id="dealership-name"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                placeholder="Enter your dealership name"
                className="h-12 text-base border-gray-300 rounded-xl"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="labor-market" className="text-base font-semibold text-gray-900">
                Labor Market
              </Label>
              <Select
                value={laborRateTier}
                onValueChange={setLaborRateTier}
              >
                <SelectTrigger id="labor-market" className="h-12 text-base border-gray-300 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Cost Market</SelectItem>
                  <SelectItem value="medium">Average Market</SelectItem>
                  <SelectItem value="high">High Cost Market</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600">
                Select your local labor market to get more accurate cost estimates.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="zip-code" className="text-base font-semibold text-gray-900">
                ZIP Code
              </Label>
              <Input
                id="zip-code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter your ZIP code"
                maxLength={5}
                className="h-12 text-base border-gray-300 rounded-xl"
              />
              <p className="text-sm text-gray-600">
                Used for location-based parts pricing and shipping estimates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
                className="flex-1 bg-blue-600 hover:bg-blue-700 font-semibold"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                size="lg"
                className="flex-1 border-gray-300 font-semibold"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
