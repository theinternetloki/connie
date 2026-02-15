import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vehicle Reconditioning Cost Estimator",
  description: "AI-powered vehicle reconditioning cost estimation for auto dealers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
