export interface Vehicle {
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  vin?: string;
}

export interface DamageItem {
  id: string;
  location: string;
  damage_type: string;
  severity: "minor" | "moderate" | "severe";
  description: string;
  recommended_repair: string;
  cost_low: number;
  cost_high: number;
  photo_index: number;
}

export interface AnalysisSummary {
  total_items: number;
  total_cost_low: number;
  total_cost_high: number;
  top_priority_repairs: string[];
  notes: string;
}

export interface AIAnalysis {
  vehicle: Vehicle;
  exterior_condition: "excellent" | "good" | "fair" | "poor";
  interior_condition: "excellent" | "good" | "fair" | "poor";
  items: DamageItem[];
  summary: AnalysisSummary;
}

export interface Inspection {
  id: string;
  user_id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  exterior_condition: string;
  interior_condition: string;
  total_cost_low: number;
  total_cost_high: number;
  ai_analysis: AIAnalysis;
  notes?: string;
  created_at: string;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  station: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
}

export interface EstimateItem {
  id: string;
  inspection_id: string;
  location: string;
  damage_type: string;
  severity: string;
  description: string;
  recommended_repair: string;
  cost_low: number;
  cost_high: number;
  is_included: boolean;
  photo_index: number;
  created_at: string;
}

export type PhotoStation =
  | "front_exterior"
  | "passenger_side_exterior"
  | "rear_exterior"
  | "driver_side_exterior"
  | "driver_side_interior"
  | "passenger_side_interior"
  | "roof"
  | "damage_closeup";

export interface PhotoStationConfig {
  id: PhotoStation;
  label: string;
  description: string;
  required: boolean;
}
