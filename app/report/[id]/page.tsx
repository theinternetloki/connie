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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {inspection.year} {inspection.make} {inspection.model}{" "}
                  {inspection.trim}
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  Mileage: {inspection.mileage.toLocaleString()} miles
                </p>
                <p className="text-sm text-muted-foreground">
                  Inspected: {format(new Date(inspection.created_at), "PPp")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant={getConditionColor(inspection.exterior_condition)}>
                Exterior: {inspection.exterior_condition}
              </Badge>
              <Badge variant={getConditionColor(inspection.interior_condition)}>
                Interior: {inspection.interior_condition}
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Necessary Repairs
                  </span>
                  <Badge variant="default" className="bg-blue-600">
                    {includedNecessary.length} items
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  ${necessaryTotalLow.toLocaleString()} – ${necessaryTotalHigh.toLocaleString()}
                </div>
              </div>
              {includedOptional.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      Optional Repairs
                    </span>
                    <Badge variant="secondary">
                      {includedOptional.length} items
                    </Badge>
                  </div>
                  <div className="text-xl font-semibold text-muted-foreground">
                    ${optionalTotalLow.toLocaleString()} – ${optionalTotalHigh.toLocaleString()}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="text-2xl font-bold">
                  ${totalLow.toLocaleString()} – ${totalHigh.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Total estimated reconditioning cost
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Necessary Repairs */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">
              Necessary Repairs
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Moderate and severe damage that should be addressed
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {necessaryItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <Checkbox
                    checked={item.is_included}
                    onCheckedChange={() =>
                      toggleItem(item.id, item.is_included)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{item.location}</h4>
                      <Badge variant={getSeverityColor(item.severity)}>
                        {item.severity}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {item.damage_type}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.description}
                    </p>
                    <p className="text-sm font-medium mb-2">
                      Repair: {item.recommended_repair}
                    </p>
                    {item.pricing_source && (
                      <Badge
                        variant={item.pricing_source === "ebay" ? "default" : "secondary"}
                        className={`mb-2 ${
                          item.pricing_source === "ebay"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : ""
                        }`}
                      >
                        {item.pricing_source === "ebay"
                          ? "Live Market Price"
                          : "Estimated"}
                      </Badge>
                    )}
                    <div className="space-y-2">
                      {(item.parts_cost_low !== undefined ||
                        item.labor_cost_low !== undefined) && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Parts:</span>
                            <div className="font-medium">
                              $
                              {(
                                item.parts_cost_low || 0
                              ).toLocaleString()}{" "}
                              – $
                              {(
                                item.parts_cost_high || 0
                              ).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Labor:</span>
                            <div className="font-medium">
                              $
                              {(
                                item.labor_cost_low || 0
                              ).toLocaleString()}{" "}
                              – $
                              {(
                                item.labor_cost_high || 0
                              ).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-sm font-semibold">Total:</span>
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
                          className="w-24 h-8"
                        />
                        <span>–</span>
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
                          className="w-24 h-8"
                        />
                      </div>
                      {item.product_link && (
                        <div className="pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Optional Repairs */}
        {optionalItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">Optional Repairs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Minor cosmetic issues that can be addressed if desired
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optionalItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 border rounded-lg opacity-75"
                  >
                    <Checkbox
                      checked={item.is_included}
                      onCheckedChange={() =>
                        toggleItem(item.id, item.is_included)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.location}</h4>
                        <Badge variant={getSeverityColor(item.severity)}>
                          {item.severity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.damage_type}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.description}
                      </p>
                      <p className="text-sm font-medium mb-2">
                        Repair: {item.recommended_repair}
                      </p>
                      {item.pricing_source && (
                        <Badge
                          variant={item.pricing_source === "ebay" ? "default" : "secondary"}
                          className={`mb-2 ${
                            item.pricing_source === "ebay"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : ""
                          }`}
                        >
                          {item.pricing_source === "ebay"
                            ? "Live Market Price"
                            : "Estimated"}
                        </Badge>
                      )}
                      <div className="space-y-2">
                        {(item.parts_cost_low !== undefined ||
                          item.labor_cost_low !== undefined) && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Parts:</span>
                              <div className="font-medium">
                                $
                                {(
                                  item.parts_cost_low || 0
                                ).toLocaleString()}{" "}
                                – $
                                {(
                                  item.parts_cost_high || 0
                                ).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Labor:</span>
                              <div className="font-medium">
                                $
                                {(
                                  item.labor_cost_low || 0
                                ).toLocaleString()}{" "}
                                – $
                                {(
                                  item.labor_cost_high || 0
                                ).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <span className="text-sm font-semibold">Total:</span>
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
                            className="w-24 h-8"
                          />
                          <span>–</span>
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
                            className="w-24 h-8"
                          />
                        </div>
                        {item.product_link && (
                          <div className="pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
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
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Photo Gallery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-lg overflow-hidden bg-gray-200"
                  >
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={() => router.push("/vehicle-info")}
            variant="outline"
            className="flex-1"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Inspection
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="flex-1"
          >
            View Dashboard
          </Button>
        </div>

        {/* Summary Footer */}
        {items.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">
                  {items.filter((i) => i.pricing_source === "ebay").length} of{" "}
                  {items.length} items priced with live market data
                </p>
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span>
                    {necessaryItems.length} necessary repairs
                  </span>
                  {optionalItems.length > 0 && (
                    <span>
                      {optionalItems.length} optional repairs
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-center text-muted-foreground">
          Estimates are AI-generated approximations. Actual costs may vary based
          on local labor rates and parts availability.
        </p>
      </div>
    </div>
  );
}
