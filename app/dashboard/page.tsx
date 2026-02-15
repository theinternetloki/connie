"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Inspection } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Plus, Search, LogOut } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    avgCost: 0,
    totalCost: 0,
  });

  useEffect(() => {
    if (user) {
      loadInspections();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const loadInspections = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("inspections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setInspections(data || []);

      // Calculate stats
      if (data && data.length > 0) {
        const total = data.length;
        const totalCost = data.reduce(
          (sum, inv) => sum + (inv.total_cost_low + inv.total_cost_high) / 2,
          0
        );
        const avgCost = totalCost / total;

        setStats({ total, avgCost, totalCost });
      }
    } catch (error) {
      console.error("Error loading inspections:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInspections = inspections.filter(
    (inv) =>
      inv.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vin?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/vehicle-info")}>
              <Plus className="mr-2 h-4 w-4" />
              New Inspection
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Inspections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Average Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${Math.round(stats.avgCost).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Estimated Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${Math.round(stats.totalCost).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by make, model, or VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Inspections List */}
        <div className="space-y-4">
          {filteredInspections.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  No inspections found. Start by creating a new inspection.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredInspections.map((inspection) => (
              <Card
                key={inspection.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/report/${inspection.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold">
                        {inspection.year} {inspection.make} {inspection.model}{" "}
                        {inspection.trim}
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        {inspection.mileage.toLocaleString()} miles •{" "}
                        {format(new Date(inspection.created_at), "MMM d, yyyy")}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">
                          {inspection.exterior_condition}
                        </Badge>
                        <Badge variant="outline">
                          {inspection.interior_condition}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        ${inspection.total_cost_low.toLocaleString()} – $
                        {inspection.total_cost_high.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated cost
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
