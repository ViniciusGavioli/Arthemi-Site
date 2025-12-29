-- CreateEnum
CREATE TYPE "BookingOrigin" AS ENUM ('COMMERCIAL', 'ADMIN_COURTESY');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'COURTESY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'BOOKING_COURTESY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BOOKING_CANCELLED_AUTO';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_BACKFILL';
ALTER TYPE "AuditAction" ADD VALUE 'CREDIT_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_BACKFILL_EXECUTED';
ALTER TYPE "AuditAction" ADD VALUE 'ALERT_PAYMENT_NOT_CONFIRMED';

-- AlterEnum
ALTER TYPE "CreditStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "courtesyReason" TEXT,
ADD COLUMN     "financialStatus" "FinancialStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
ADD COLUMN     "origin" "BookingOrigin" NOT NULL DEFAULT 'COMMERCIAL';
