"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const funFacts = [
  "The average reconditioning cost for a used vehicle is $1,200-$1,800",
  "Paint and body work typically account for 40% of reconditioning costs",
  "Interior detailing can increase a vehicle's resale value by up to $500",
  "PDR (Paintless Dent Repair) is often 50% cheaper than traditional body work",
];

export default function AnalyzingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepMessage, setStepMessage] = useState("Identifying damage...");

  useEffect(() => {
    const vehicleData = sessionStorage.getItem("vehicle");
    const photosData = sessionStorage.getItem("photos");

    if (!vehicleData || !photosData) {
      router.push("/vehicle-info");
      return;
    }

    const analyze = async () => {
      try {
        const vehicle = JSON.parse(vehicleData);
        const photos = JSON.parse(photosData);

        // Get user ID from Supabase auth - required
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (!user || authError) {
          router.push("/login");
          return;
        }
        
        const userId = user.id;

        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ photos, vehicle, userId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || "Analysis failed";
          
          // Handle specific error cases
          if (errorMessage.includes("FUNCTION_PAYLOAD_TOO_LARGE") || 
              errorMessage.includes("payload") || 
              errorMessage.includes("too large")) {
            throw new Error("Photos are too large. Please try capturing fewer photos or lower resolution images.");
          }
          
          throw new Error(errorMessage);
        }

        const { inspectionId } = await response.json();
        router.push(`/report/${inspectionId}`);
      } catch (error: any) {
        console.error("Analysis error:", error);
        // Show user-friendly error message
        alert(error.message || "Failed to analyze photos. Please try again.");
        router.push("/vehicle-info");
      }
    };

    analyze();

    // Multi-step progress simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        
        // Step 1: Damage detection (0-40%)
        if (prev < 40) {
          setCurrentStep(1);
          setStepMessage("Identifying damage...");
          return prev + Math.random() * 3;
        }
        // Step 2: Parts pricing (40-80%)
        else if (prev < 80) {
          setCurrentStep(2);
          setStepMessage("Looking up parts pricing...");
          return prev + Math.random() * 3;
        }
        // Step 3: Building estimate (80-100%)
        else {
          setCurrentStep(3);
          setStepMessage("Building estimate...");
          return prev + Math.random() * 2;
        }
      });
    }, 500);

    // Rotate fun facts
    const factInterval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(factInterval);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10 text-center space-y-8">
        <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-600" />
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Analyzing Vehicle
          </h2>
          <p className="text-lg text-gray-600 mb-4">
            {stepMessage}
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className={`h-3 w-3 rounded-full transition-colors ${currentStep >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`h-3 w-3 rounded-full transition-colors ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <div className={`h-3 w-3 rounded-full transition-colors ${currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 border border-blue-200">
          <p className="text-base text-blue-900 font-medium">
            💡 {funFacts[factIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
