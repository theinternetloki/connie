import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const maxDuration = 10;
export const runtime = 'nodejs';

/**
 * eBay Marketplace User Account Deletion Webhook
 * 
 * This endpoint receives notifications from eBay when a user requests
 * their account to be deleted. Per eBay's requirements:
 * 1. Must immediately acknowledge with 200 OK
 * 2. Must verify the signature to ensure it's from eBay
 * 3. Must delete any eBay user data stored in our system
 * 
 * Documentation: https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion
 */

interface EbayAccountDeletionNotification {
  metadata: {
    topic: string;
    schemaVersion: string;
    deprecated: boolean;
  };
  notification: {
    notificationId: string;
    eventDate: string;
    publishDate: string;
    publishAttemptCount: number;
    data: {
      username?: string; // May be replaced with userId after Sept 26, 2025
      userId: string; // Immutable public userId
      eiasToken: string; // Legacy token
    };
  };
}

/**
 * Verifies the eBay notification signature
 * This is a simplified version - for production, use eBay's Event Notification SDK
 * or implement full signature verification per eBay's documentation
 */
async function verifyEbaySignature(
  signature: string,
  payload: string,
  publicKeyUrl?: string
): Promise<boolean> {
  // TODO: Implement full signature verification using eBay's public key
  // For now, we'll do basic validation that signature exists
  // In production, you should:
  // 1. Decode the x-ebay-signature header (Base64)
  // 2. Extract keyId from decoded signature
  // 3. Fetch public key from eBay's Notification API using keyId
  // 4. Verify signature against payload using the public key
  
  // Basic check: signature should exist and be non-empty
  if (!signature || signature.length === 0) {
    return false;
  }

  // For production, use eBay's Event Notification SDK:
  // - Node.js: @ebay/event-notification-sdk
  // - Or implement manual verification per eBay docs
  
  // For now, return true if signature exists (you should implement full verification)
  return true;
}

/**
 * Handles eBay's challenge code verification during subscription setup
 * GET /api/ebay/account-deletion?challenge_code=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code");

  console.log("[eBay Webhook] Challenge code verification request received:", {
    challengeCode: challengeCode ? "***" : null,
    hasChallengeCode: !!challengeCode,
  });

  if (!challengeCode) {
    console.error("[eBay Webhook] Missing challenge_code parameter");
    return NextResponse.json(
      { error: "Missing challenge_code parameter" },
      { status: 400 }
    );
  }

  // Get verification token from environment
  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  if (!verificationToken) {
    console.error("[eBay Webhook] EBAY_VERIFICATION_TOKEN not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Get the endpoint URL (full URL of this endpoint)
  const endpoint = request.url.split("?")[0]; // Remove query params for hashing

  console.log("[eBay Webhook] Computing challenge response:", {
    endpoint,
    hasVerificationToken: !!verificationToken,
  });

  // Hash: challengeCode + verificationToken + endpoint (in that order)
  const hash = createHash("sha256");
  hash.update(challengeCode);
  hash.update(verificationToken);
  hash.update(endpoint);
  const challengeResponse = hash.digest("hex");

  console.log("[eBay Webhook] Challenge response computed successfully");

  // Return the challenge response in JSON format
  return NextResponse.json(
    { challengeResponse },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Handles eBay marketplace account deletion notifications
 * POST /api/ebay/account-deletion
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[eBay Webhook] Account deletion notification received");

  try {
    // Step 1: Immediately acknowledge the notification (eBay requirement)
    // We'll process asynchronously after acknowledging
    
    // Get the signature header for verification
    const signature = request.headers.get("x-ebay-signature");
    console.log("[eBay Webhook] Notification headers:", {
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      contentType: request.headers.get("content-type"),
    });
    
    // Parse the notification payload
    const payload = await request.text();
    console.log("[eBay Webhook] Payload received:", {
      payloadLength: payload.length,
      payloadPreview: payload.substring(0, 200),
    });

    let notification: EbayAccountDeletionNotification;
    
    try {
      notification = JSON.parse(payload);
      console.log("[eBay Webhook] Payload parsed successfully:", {
        topic: notification.metadata.topic,
        schemaVersion: notification.metadata.schemaVersion,
        notificationId: notification.notification.notificationId,
        publishAttemptCount: notification.notification.publishAttemptCount,
      });
    } catch (error) {
      console.error("[eBay Webhook] Failed to parse notification payload:", {
        error: error instanceof Error ? error.message : String(error),
        payloadPreview: payload.substring(0, 500),
      });
      // Still acknowledge to prevent retries
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 200 } // Acknowledge even on parse error
      );
    }

    // Step 2: Verify signature (async processing)
    // Note: In production, verify signature BEFORE processing
    // For now, we'll process and verify in parallel
    const isValid = signature
      ? await verifyEbaySignature(signature, payload)
      : false;

    console.log("[eBay Webhook] Signature verification:", {
      hasSignature: !!signature,
      isValid,
      notificationId: notification.notification.notificationId,
    });

    if (!isValid && signature) {
      console.warn("[eBay Webhook] Signature verification failed:", {
        notificationId: notification.notification.notificationId,
        userId: notification.notification.data.userId,
      });
      // Still acknowledge to prevent retries, but log the issue
      // In production, you might want to return 412 Precondition Failed
      // after implementing full signature verification
    }

    // Step 3: Extract user identifiers
    const { userId, username, eiasToken } = notification.notification.data;

    console.log("[eBay Webhook] Account deletion notification processed:", {
      notificationId: notification.notification.notificationId,
      userId,
      username: username || "N/A (using userId)",
      eiasToken: eiasToken ? "***" : "N/A",
      eventDate: notification.notification.eventDate,
      publishDate: notification.notification.publishDate,
      publishAttemptCount: notification.notification.publishAttemptCount,
    });

    // Step 4: Delete any eBay user data from our system
    // Since this app doesn't store eBay user accounts, we check if there's
    // any data linked to eBay userIds that needs deletion
    
    // If you store eBay user data, delete it here:
    // - User accounts linked to eBay userId
    // - Orders, transactions, or other eBay-related data
    // - Any cached data specific to this eBay user
    
    // For this application:
    // - parts_price_cache is shared (not user-specific)
    // - We don't link our users to eBay accounts
    // - So there's likely nothing to delete
    
    // However, if you do have eBay user data, delete it here:
    // Example:
    // await deleteEbayUserData(userId, eiasToken);

    // Step 5: Return success acknowledgment
    // eBay accepts: 200 OK, 201 Created, 202 Accepted, or 204 No Content
    const processingTime = Date.now() - startTime;
    console.log("[eBay Webhook] Notification processed successfully:", {
      notificationId: notification.notification.notificationId,
      userId,
      processingTimeMs: processingTime,
    });

    return NextResponse.json(
      {
        status: "acknowledged",
        notificationId: notification.notification.notificationId,
        processed: true,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error("[eBay Webhook] Error processing notification:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime,
    });
    
    // Always acknowledge to prevent eBay from retrying
    // Log the error for investigation
    return NextResponse.json(
      {
        status: "acknowledged",
        error: "Processing error (logged)",
      },
      { status: 200 }
    );
  }
}
