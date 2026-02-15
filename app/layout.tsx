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
      <head>
        {/* Prevent custom element conflicts from browser extensions */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const originalDefine = window.customElements?.define;
                if (originalDefine) {
                  window.customElements.define = function(name, constructor, options) {
                    if (!window.customElements.get(name)) {
                      return originalDefine.call(this, name, constructor, options);
                    }
                    return;
                  };
                }
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
