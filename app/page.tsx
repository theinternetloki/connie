"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Zap, DollarSign, Shield } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-gray-900 tracking-tight">
            Vehicle Reconditioning Cost Estimator
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto">
            AI-powered damage analysis and cost estimation for auto dealers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/vehicle-info")}
              className="text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-auto"
            >
              Start New Inspection
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="text-lg px-8 py-6 border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold h-auto"
            >
              View Dashboard
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 hover:shadow-md transition-shadow">
            <Camera className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Photo Capture</h3>
            <p className="text-gray-600 leading-relaxed">
              Guided camera flow with step-by-step instructions for capturing
              all vehicle angles
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 hover:shadow-md transition-shadow">
            <Zap className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">AI-Powered Analysis</h3>
            <p className="text-gray-600 leading-relaxed">
              Advanced AI analyzes photos to identify damage and estimate
              reconditioning costs
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 hover:shadow-md transition-shadow">
            <DollarSign className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Detailed Estimates</h3>
            <p className="text-gray-600 leading-relaxed">
              Itemized cost breakdowns with customizable line items and cost
              adjustments
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 hover:shadow-md transition-shadow">
            <Shield className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-3">Professional Reports</h3>
            <p className="text-gray-600 leading-relaxed">
              Export PDF reports and share estimates with your team
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500">
            Estimates are AI-generated approximations. Actual costs may vary
            based on local labor rates and parts availability.
          </p>
        </div>
      </div>
    </div>
  );
}
