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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Dashboard
          </h1>
          <div className="flex gap-3">
            <Button 
              onClick={() => router.push("/vehicle-info")}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              <Plus className="mr-2 h-5 w-5" />
              New Inspection
            </Button>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              size="lg"
              className="border-gray-300 font-semibold"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Total Inspections
            </p>
            <div className="text-4xl sm:text-5xl font-bold text-gray-900">
              {stats.total}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Average Cost
            </p>
            <div className="text-4xl sm:text-5xl font-bold text-gray-900">
              ${Math.round(stats.avgCost).toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Total Estimated Cost
            </p>
            <div className="text-4xl sm:text-5xl font-bold text-gray-900">
              ${Math.round(stats.totalCost).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search by make, model, or VIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 text-base border-gray-300 rounded-xl"
          />
        </div>

        {/* Inspections List */}
        <div className="space-y-4">
          {filteredInspections.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-600 text-lg">
                No inspections found. Start by creating a new inspection.
              </p>
            </div>
          ) : (
            filteredInspections.map((inspection) => (
              <div
                key={inspection.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 cursor-pointer hover:shadow-md hover:border-gray-200 transition-all"
                onClick={() => router.push(`/report/${inspection.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {inspection.year} {inspection.make} {inspection.model}
                      {inspection.trim && ` ${inspection.trim}`}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {inspection.mileage.toLocaleString()} miles •{" "}
                      {format(new Date(inspection.created_at), "MMM d, yyyy")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant="outline"
                        className="px-3 py-1 border-gray-300 text-sm font-medium"
                      >
                        {inspection.exterior_condition}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className="px-3 py-1 border-gray-300 text-sm font-medium"
                      >
                        {inspection.interior_condition}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                      ${inspection.total_cost_low.toLocaleString()} – ${inspection.total_cost_high.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Estimated cost
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
