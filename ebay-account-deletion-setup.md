# eBay Marketplace Account Deletion Webhook Setup

This document explains how to set up the eBay Marketplace User Account Deletion webhook endpoint.

## Overview

eBay requires all developers using eBay APIs to subscribe to Marketplace Account Deletion notifications. When an eBay user requests their account to be deleted, eBay will send a notification to your callback URL, and you must delete any eBay user data you have stored.

**Documentation:** https://developer.ebay.com/develop/guides-v2/marketplace-user-account-deletion/marketplace-user-account-deletion

## Endpoint

**URL:** `https://yourdomain.com/api/ebay/account-deletion`

**Methods:**
- `GET` - Handles eBay's challenge code verification during subscription
- `POST` - Receives account deletion notifications from eBay

## Setup Steps

### 1. Environment Variables

Add to your `.env` file:

```env
EBAY_VERIFICATION_TOKEN=your_verification_token_here
```

The verification token must be:
- Between 32 and 80 characters
- Only alphanumeric characters, underscore (_), and hyphen (-)
- Keep this secret and secure

### 2. Subscribe to Notifications

1. Sign into your eBay Developer account
2. Go to **Alerts and Notifications** page
3. For each application:
   - Set **Alert email** (where you'll receive alerts)
   - Set **Endpoint URL**: `https://yourdomain.com/api/ebay/account-deletion`
   - Set **Verification Token**: (same as `EBAY_VERIFICATION_TOKEN` in your .env)
   - Subscribe to **Marketplace Account Deletion** topic

### 3. Challenge Code Verification

When you first subscribe, eBay will send a `GET` request to your endpoint with a `challenge_code` query parameter. The endpoint will:

1. Receive the challenge code
2. Hash it with your verification token and endpoint URL
3. Return the hash in JSON format

This verifies that you own the endpoint URL.

### 4. Signature Verification (Production)

**Important:** The current implementation includes a placeholder for signature verification. For production, you must implement full signature verification using one of:

- **eBay Event Notification SDK (Recommended):**
  ```bash
  npm install @ebay/event-notification-sdk
  ```

- **Manual verification:** Follow eBay's documentation to:
  1. Decode the `x-ebay-signature` header (Base64)
  2. Extract `keyId` from decoded signature
  3. Fetch public key from eBay's Notification API
  4. Verify signature against payload

Update the `verifyEbaySignature` function in `/app/api/ebay/account-deletion/route.ts` with proper verification.

## Notification Processing

When eBay sends a notification:

1. **Immediate Acknowledgment:** The endpoint immediately returns `200 OK` (eBay requirement)
2. **Signature Verification:** Verifies the notification is from eBay
3. **Data Extraction:** Extracts `userId`, `username`, and `eiasToken` from the notification
4. **Data Deletion:** Deletes any eBay user data from your system

## Current Implementation Notes

The current implementation:
- ✅ Handles challenge code verification
- ✅ Immediately acknowledges notifications
- ✅ Extracts user identifiers from notifications
- ⚠️ Signature verification is a placeholder (must be implemented for production)
- ℹ️ Currently a no-op for data deletion (this app doesn't store eBay user accounts)

## If You Store eBay User Data

If your application stores eBay user data (eBay accounts linked to your users, orders, etc.), you must:

1. Add a database table to link your users to eBay `userId`s
2. Implement deletion logic in the POST handler
3. Delete all data associated with the eBay `userId`

Example:
```typescript
// In the POST handler, after extracting userId:
await deleteEbayUserData(userId, eiasToken);

async function deleteEbayUserData(userId: string, eiasToken: string) {
  // Delete from your database
  await supabaseAdmin
    .from("ebay_user_links")
    .delete()
    .eq("ebay_user_id", userId);
  
  // Delete any other eBay-related data
  // ...
}
```

## Testing

eBay provides a "Send Test Notification" tool on the Alerts and Notifications page. Use this to test your endpoint before going live.

## Compliance

**Failure to comply with eBay's requirements will result in:**
- Termination of access to Developer Tools
- Reduced access to APIs
- Marked as non-compliant

**Requirements:**
- Must acknowledge notifications immediately (200/201/202/204)
- Must verify signatures
- Must delete eBay user data when notified
- Must respond within 24 hours or callback URL will be marked down

## Support

- eBay Developer Documentation: https://developer.ebay.com
- eBay Developer Support: https://developer.ebay.com/support/developer-technical-support
