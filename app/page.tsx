"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Zap, DollarSign, Shield } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-gray-900">
            Vehicle Reconditioning Cost Estimator
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI-powered damage analysis and cost estimation for auto dealers
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/vehicle-info")}
              className="text-lg px-8 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Start New Inspection
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="text-lg px-8 border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              View Dashboard
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <Camera className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle className="text-gray-900">Easy Photo Capture</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Guided camera flow with step-by-step instructions for capturing
                all vehicle angles
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <Zap className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle className="text-gray-900">AI-Powered Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Advanced AI analyzes photos to identify damage and estimate
                reconditioning costs
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <DollarSign className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle className="text-gray-900">Detailed Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Itemized cost breakdowns with customizable line items and cost
                adjustments
              </p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <Shield className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle className="text-gray-900">Professional Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Export PDF reports and share estimates with your team
              </p>
            </CardContent>
          </Card>
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
