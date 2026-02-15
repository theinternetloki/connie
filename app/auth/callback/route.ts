import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (!code) {
    const redirectUrl = new URL("/login?error=no_code", requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (!error) {
    // Create profile if it doesn't exist
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Use admin client to bypass RLS and ensure profile creation
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        // Get dealership name from user metadata if available
        const dealershipName = (user.user_metadata?.dealership_name as string) || "";
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: user.id,
            dealership_name: dealershipName,
          });
        
        if (profileError) {
          console.error("Profile creation error in callback:", profileError);
          // Continue anyway - the trigger or analyze route will handle it
        }
      }
    }

    const redirectUrl = new URL(next, requestUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  // If there's an error, redirect to login
  const redirectUrl = new URL("/login?error=invalid_token", requestUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
