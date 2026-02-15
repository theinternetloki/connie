"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Zap, DollarSign, Shield } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">
            Vehicle Reconditioning Cost Estimator
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered damage analysis and cost estimation for auto dealers
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/vehicle-info")}
              className="text-lg px-8"
            >
              Start New Inspection
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="text-lg px-8"
            >
              View Dashboard
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          <Card>
            <CardHeader>
              <Camera className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Easy Photo Capture</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Guided camera flow with step-by-step instructions for capturing
                all vehicle angles
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>AI-Powered Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Advanced AI analyzes photos to identify damage and estimate
                reconditioning costs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <DollarSign className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Detailed Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Itemized cost breakdowns with customizable line items and cost
                adjustments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>Professional Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Export PDF reports and share estimates with your team
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            Estimates are AI-generated approximations. Actual costs may vary
            based on local labor rates and parts availability.
          </p>
        </div>
      </div>
    </div>
  );
}
