-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'IN_PROCESS');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('HOURLY', 'PACKAGE', 'SHIFT', 'SUBLET');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('HOURS_4', 'HOURS_8');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('SUBLET', 'PROMO', 'CANCELLATION', 'SATURDAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('PENDING', 'CONFIRMED', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "SubletStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('HOURLY_RATE', 'PACKAGE_10H', 'PACKAGE_20H', 'PACKAGE_40H', 'SHIFT_FIXED', 'DAY_PASS', 'SATURDAY_HOUR', 'SATURDAY_5H', 'PROMO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_EXPIRED', 'BOOKING_MANUAL_CREATED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'CREDIT_CREATED', 'CREDIT_USED', 'CREDIT_EXPIRED', 'ADMIN_LOGIN', 'ADMIN_LOGOUT', 'ADMIN_BOOKING_VIEW', 'ADMIN_BOOKING_UPDATE', 'USER_LOGIN', 'USER_LOGOUT', 'USER_MAGIC_LINK_REQUESTED', 'USER_MAGIC_LINK_RATE_LIMITED');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "amenities" TEXT[],
    "hourlyRate" INTEGER NOT NULL DEFAULT 0,
    "pricePerHour" INTEGER NOT NULL DEFAULT 0,
    "pricePackage4" INTEGER NOT NULL DEFAULT 0,
    "pricePackage8" INTEGER NOT NULL DEFAULT 0,
    "priceShift" INTEGER NOT NULL DEFAULT 0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "bookingType" "BookingType" NOT NULL DEFAULT 'HOURLY',
    "packageUsageId" TEXT,
    "isSublet" BOOLEAN NOT NULL DEFAULT false,
    "originalUserId" TEXT,
    "subletRequestId" TEXT,
    "notes" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditIds" TEXT[],
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "type" "PackageType" NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "usedHours" INTEGER NOT NULL DEFAULT 0,
    "remainingHours" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT,
    "amount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL DEFAULT 0,
    "type" "CreditType" NOT NULL,
    "status" "CreditStatus" NOT NULL DEFAULT 'PENDING',
    "subletRequestId" TEXT,
    "sourceBookingId" TEXT,
    "referenceMonth" INTEGER NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sublet_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shiftType" "ShiftType" NOT NULL,
    "status" "SubletStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sublet_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "hoursIncluded" INTEGER,
    "validityDays" INTEGER,
    "shiftType" "ShiftType",
    "roomId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_rate_limits" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "source" "AuditSource" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorIp" TEXT,
    "userAgent" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE INDEX "bookings_roomId_startTime_endTime_idx" ON "bookings"("roomId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "user_packages_userId_expiresAt_idx" ON "user_packages"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "user_packages_roomId_idx" ON "user_packages"("roomId");

-- CreateIndex
CREATE INDEX "credits_userId_status_idx" ON "credits"("userId", "status");

-- CreateIndex
CREATE INDEX "credits_roomId_idx" ON "credits"("roomId");

-- CreateIndex
CREATE INDEX "sublet_requests_userId_status_idx" ON "sublet_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_roomId_idx" ON "products"("roomId");

-- CreateIndex
CREATE INDEX "payments_externalId_idx" ON "payments"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_tokenHash_key" ON "magic_link_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "magic_link_tokens_userId_idx" ON "magic_link_tokens"("userId");

-- CreateIndex
CREATE INDEX "magic_link_tokens_expiresAt_idx" ON "magic_link_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_rate_limits_email_key" ON "magic_link_rate_limits"("email");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_source_idx" ON "audit_logs"("source");

-- CreateIndex
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorEmail_idx" ON "audit_logs"("actorEmail");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subletRequestId_fkey" FOREIGN KEY ("subletRequestId") REFERENCES "sublet_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_packages" ADD CONSTRAINT "user_packages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_subletRequestId_fkey" FOREIGN KEY ("subletRequestId") REFERENCES "sublet_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sublet_requests" ADD CONSTRAINT "sublet_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
