"use client";

import { PhotoStationConfig } from "@/lib/types";

interface StationGuideProps {
  station: PhotoStationConfig;
}

const guideImages: Record<string, string> = {
  front_exterior: "🚗",
  passenger_side_exterior: "🚙",
  rear_exterior: "🚗",
  driver_side_exterior: "🚙",
  driver_side_interior: "🪑",
  passenger_side_interior: "🪑",
  roof: "⬆️",
  damage_closeup: "🔍",
};

export function StationGuide({ station }: StationGuideProps) {
  return (
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="text-4xl">{guideImages[station.id] || "📷"}</div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            {station.label}
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            {station.description}
          </p>
        </div>
      </div>
    </div>
  );
}
