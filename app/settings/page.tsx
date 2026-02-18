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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dealership-name">Dealership Name</Label>
              <Input
                id="dealership-name"
                value={dealershipName}
                onChange={(e) => setDealershipName(e.target.value)}
                placeholder="Enter your dealership name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="labor-market">Labor Market</Label>
              <Select
                value={laborRateTier}
                onValueChange={setLaborRateTier}
              >
                <SelectTrigger id="labor-market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Cost Market</SelectItem>
                  <SelectItem value="medium">Average Market</SelectItem>
                  <SelectItem value="high">High Cost Market</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select your local labor market to get more accurate cost estimates.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip-code">ZIP Code</Label>
              <Input
                id="zip-code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter your ZIP code"
                maxLength={5}
              />
              <p className="text-sm text-muted-foreground">
                Used for location-based parts pricing and shipping estimates.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
              <Button
                onClick={() => router.push("/dashboard")}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
