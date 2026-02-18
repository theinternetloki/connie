"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Inspection, EstimateItem } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Download, Share2, Plus, ExternalLink, ShoppingCart } from "lucide-react";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(true);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadInspection();
    }
  }, [params.id, user]);

  const loadInspection = async () => {
    if (!user) return;
    
    try {
      const { data: inspectionData, error: inspectionError } = await supabase
        .from("inspections")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (inspectionError) throw inspectionError;

      setInspection(inspectionData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("estimate_items")
        .select("*")
        .eq("inspection_id", params.id)
        .order("created_at");

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Load photos
      const { data: photosData, error: photosError } = await supabase
        .from("inspection_photos")
        .select("storage_path")
        .eq("inspection_id", params.id)
        .order("sort_order");

      if (!photosError && photosData) {
        const photoUrls = photosData.map((photo) => {
          const { data } = supabase.storage
            .from("inspection-photos")
            .getPublicUrl(photo.storage_path);
          return data.publicUrl;
        });
        setPhotos(photoUrls);
      }
    } catch (error) {
      console.error("Error loading inspection:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (itemId: string, isIncluded: boolean) => {
    const { error } = await supabase
      .from("estimate_items")
      .update({ is_included: !isIncluded })
      .eq("id", itemId);

    if (!error) {
      setItems(
        items.map((item) =>
          item.id === itemId ? { ...item, is_included: !isIncluded } : item
        )
      );
    }
  };

  const updateItemCost = async (
    itemId: string,
    costLow: number,
    costHigh: number
  ) => {
    const { error } = await supabase
      .from("estimate_items")
      .update({ cost_low: costLow, cost_high: costHigh })
      .eq("id", itemId);

    if (!error) {
      setItems(
        items.map((item) =>
          item.id === itemId
            ? { ...item, cost_low: costLow, cost_high: costHigh }
            : item
        )
      );
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "minor":
        return "success";
      case "moderate":
        return "warning";
      case "severe":
        return "danger";
      default:
        return "default";
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent":
        return "success";
      case "good":
        return "default";
      case "fair":
        return "warning";
      case "poor":
        return "danger";
      default:
        return "default";
    }
  };

  // Separate items into necessary (moderate/severe) and optional (minor)
  const necessaryItems = items.filter(
    (item) => item.severity === "moderate" || item.severity === "severe"
  );
  const optionalItems = items.filter((item) => item.severity === "minor");

  // Calculate totals for included items in each category
  const includedNecessary = necessaryItems.filter((item) => item.is_included);
  const includedOptional = optionalItems.filter((item) => item.is_included);

  const necessaryTotalLow = includedNecessary.reduce((sum, item) => sum + item.cost_low, 0);
  const necessaryTotalHigh = includedNecessary.reduce((sum, item) => sum + item.cost_high, 0);

  const optionalTotalLow = includedOptional.reduce((sum, item) => sum + item.cost_low, 0);
  const optionalTotalHigh = includedOptional.reduce((sum, item) => sum + item.cost_high, 0);

  const totalLow = necessaryTotalLow + optionalTotalLow;
  const totalHigh = necessaryTotalHigh + optionalTotalHigh;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Inspection not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                  {inspection.year} {inspection.make} {inspection.model}
                  {inspection.trim && ` ${inspection.trim}`}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <span className="font-medium">
                    {inspection.mileage.toLocaleString()} miles
                  </span>
                  <span>•</span>
                  <span>
                    Inspected {format(new Date(inspection.created_at), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Badge 
                    variant={getConditionColor(inspection.exterior_condition)}
                    className="px-3 py-1.5 text-sm font-medium"
                  >
                    Exterior: {inspection.exterior_condition}
                  </Badge>
                  <Badge 
                    variant={getConditionColor(inspection.interior_condition)}
                    className="px-3 py-1.5 text-sm font-medium"
                  >
                    Interior: {inspection.interior_condition}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-gray-300">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button variant="outline" size="sm" className="border-gray-300">
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
          
          {/* Cost Summary */}
          <div className="px-6 sm:px-8 py-8 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <div className="space-y-6">
              {/* Necessary Repairs Total */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
                      Necessary Repairs
                    </h2>
                    <p className="text-xs text-gray-500">
                      Moderate and severe damage
                    </p>
                  </div>
                  <Badge className="bg-blue-600 text-white px-3 py-1 text-sm font-semibold">
                    {includedNecessary.length} items
                  </Badge>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
                  ${necessaryTotalLow.toLocaleString()} – ${necessaryTotalHigh.toLocaleString()}
                </div>
              </div>

              {/* Optional Repairs Total */}
              {includedOptional.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                        Optional Repairs
                      </h2>
                      <p className="text-xs text-gray-500">
                        Minor cosmetic issues
                      </p>
                    </div>
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold">
                      {includedOptional.length} items
                    </Badge>
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-gray-700 tracking-tight">
                    ${optionalTotalLow.toLocaleString()} – ${optionalTotalHigh.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="pt-6 border-t-2 border-gray-200">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      Total Estimated Cost
                    </p>
                    <div className="text-5xl sm:text-6xl font-bold text-gray-900 tracking-tight">
                      ${totalLow.toLocaleString()} – ${totalHigh.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Necessary Repairs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 sm:px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-transparent">
            <h2 className="text-2xl font-bold text-gray-900">Necessary Repairs</h2>
            <p className="text-sm text-gray-600 mt-1">
              Moderate and severe damage that should be addressed
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {necessaryItems.map((item) => (
              <div
                key={item.id}
                className="px-6 sm:px-8 py-6 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <Checkbox
                      checked={item.is_included}
                      onCheckedChange={() =>
                        toggleItem(item.id, item.is_included)
                      }
                      className="h-5 w-5"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.location}
                      </h3>
                      <Badge 
                        variant={getSeverityColor(item.severity)}
                        className="px-2.5 py-1 text-xs font-semibold"
                      >
                        {item.severity}
                      </Badge>
                      <span className="text-sm text-gray-500 capitalize">
                        {item.damage_type.replace(/_/g, " ")}
                      </span>
                      {item.pricing_source && (
                        <Badge
                          variant={item.pricing_source === "ebay" ? "default" : "secondary"}
                          className={`${
                            item.pricing_source === "ebay"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          } px-2.5 py-1 text-xs font-medium border`}
                        >
                          {item.pricing_source === "ebay"
                            ? "✓ Live Market Price"
                            : "Estimated"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-base text-gray-700 mb-4 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-gray-900 mb-3">
                        Recommended Repair
                      </p>
                      <p className="text-sm text-gray-700">
                        {item.recommended_repair}
                      </p>
                    </div>
                    {(item.parts_cost_low !== undefined ||
                      item.labor_cost_low !== undefined) && (
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Parts
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            ${(item.parts_cost_low || 0).toLocaleString()} – ${(item.parts_cost_high || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Labor
                          </p>
                          <p className="text-lg font-bold text-gray-900">
                            ${(item.labor_cost_low || 0).toLocaleString()} – ${(item.labor_cost_high || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="pt-4 border-t border-gray-200 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Total Cost
                        </p>
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            value={item.cost_low}
                            onChange={(e) =>
                              updateItemCost(
                                item.id,
                                parseFloat(e.target.value) || 0,
                                item.cost_high
                              )
                            }
                            className="w-28 h-10 text-base font-semibold border-gray-300"
                          />
                          <span className="text-gray-400 font-medium">–</span>
                          <Input
                            type="number"
                            value={item.cost_high}
                            onChange={(e) =>
                              updateItemCost(
                                item.id,
                                item.cost_low,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-28 h-10 text-base font-semibold border-gray-300"
                          />
                        </div>
                      </div>
                      {item.product_link && (
                        <div>
                          <Button
                            variant="outline"
                            size="default"
                            className="w-full border-gray-300 hover:bg-gray-50 font-medium"
                            onClick={() => window.open(item.product_link, "_blank")}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            {item.product_link_label || "View Product"}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optional Repairs */}
        {optionalItems.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-700">Optional Repairs</h2>
              <p className="text-sm text-gray-600 mt-1">
                Minor cosmetic issues that can be addressed if desired
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {optionalItems.map((item) => (
                <div
                  key={item.id}
                  className="px-6 sm:px-8 py-6 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Checkbox
                        checked={item.is_included}
                        onCheckedChange={() =>
                          toggleItem(item.id, item.is_included)
                        }
                        className="h-5 w-5"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-700">
                          {item.location}
                        </h3>
                        <Badge 
                          variant={getSeverityColor(item.severity)}
                          className="px-2.5 py-1 text-xs font-semibold"
                        >
                          {item.severity}
                        </Badge>
                        <span className="text-sm text-gray-500 capitalize">
                          {item.damage_type.replace(/_/g, " ")}
                        </span>
                        {item.pricing_source && (
                          <Badge
                            variant={item.pricing_source === "ebay" ? "default" : "secondary"}
                            className={`${
                              item.pricing_source === "ebay"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            } px-2.5 py-1 text-xs font-medium border`}
                          >
                            {item.pricing_source === "ebay"
                              ? "✓ Live Market Price"
                              : "Estimated"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-base text-gray-600 mb-4 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-3">
                          Recommended Repair
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.recommended_repair}
                        </p>
                      </div>
                      {(item.parts_cost_low !== undefined ||
                        item.labor_cost_low !== undefined) && (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              Parts
                            </p>
                            <p className="text-lg font-bold text-gray-700">
                              ${(item.parts_cost_low || 0).toLocaleString()} – ${(item.parts_cost_high || 0).toLocaleString()}
                            </p>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              Labor
                            </p>
                            <p className="text-lg font-bold text-gray-700">
                              ${(item.labor_cost_low || 0).toLocaleString()} – ${(item.labor_cost_high || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="pt-4 border-t border-gray-200 space-y-4">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Total Cost
                          </p>
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              value={item.cost_low}
                              onChange={(e) =>
                                updateItemCost(
                                  item.id,
                                  parseFloat(e.target.value) || 0,
                                  item.cost_high
                                )
                              }
                              className="w-28 h-10 text-base font-semibold border-gray-300"
                            />
                            <span className="text-gray-400 font-medium">–</span>
                            <Input
                              type="number"
                              value={item.cost_high}
                              onChange={(e) =>
                                updateItemCost(
                                  item.id,
                                  item.cost_low,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-28 h-10 text-base font-semibold border-gray-300"
                            />
                          </div>
                        </div>
                        {item.product_link && (
                          <div>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full border-gray-300 hover:bg-gray-50 font-medium"
                              onClick={() => window.open(item.product_link, "_blank")}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              {item.product_link_label || "View Product"}
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 sm:px-8 py-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Photo Gallery</h2>
            </div>
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => window.open(photo, "_blank")}
                  >
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => router.push("/vehicle-info")}
            variant="outline"
            size="lg"
            className="flex-1 border-gray-300 font-semibold h-12"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Inspection
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            size="lg"
            className="flex-1 bg-blue-600 hover:bg-blue-700 font-semibold h-12"
          >
            View Dashboard
          </Button>
        </div>

        {/* Summary Footer */}
        {items.length > 0 && (
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium text-gray-700">
                {items.filter((i) => i.pricing_source === "ebay").length} of{" "}
                {items.length} items priced with live market data
              </p>
              <div className="flex justify-center gap-6 text-sm text-gray-600">
                <span className="font-medium">
                  {necessaryItems.length} necessary repairs
                </span>
                {optionalItems.length > 0 && (
                  <span className="font-medium">
                    {optionalItems.length} optional repairs
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-center text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Estimates are AI-generated approximations. Actual costs may vary based
          on local labor rates and parts availability.
        </p>
      </div>
    </div>
  );
}
