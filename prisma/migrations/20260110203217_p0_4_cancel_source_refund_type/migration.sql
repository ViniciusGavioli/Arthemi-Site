-- CreateEnum
CREATE TYPE "CancelSource" AS ENUM ('ADMIN', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('CREDITS', 'MONEY', 'NONE');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelSource" "CancelSource",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundType" "RefundType";

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_purchaseId_idx" ON "payments"("purchaseId");

-- CreateIndex
CREATE INDEX "payments_idempotencyKey_idx" ON "payments"("idempotencyKey");
