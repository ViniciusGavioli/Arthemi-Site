-- ============================================================
-- Migration: Add expiresAt to Booking for automatic cleanup
-- ============================================================
-- Enables automatic cleanup of PENDING bookings without payment
-- Bookings with expiresAt < now() and status = PENDING can be
-- automatically cancelled and their coupons restored

-- Add expiresAt column
ALTER TABLE "bookings" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Create index for efficient cleanup queries
CREATE INDEX "bookings_expiresAt_idx" ON "bookings"("expiresAt");
