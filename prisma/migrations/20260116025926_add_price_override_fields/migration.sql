-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('STANDARD', 'OVERRIDE');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "overrideByUserId" TEXT,
ADD COLUMN     "overrideCreatedAt" TIMESTAMP(3),
ADD COLUMN     "overrideFinalCents" INTEGER,
ADD COLUMN     "overrideReason" TEXT,
ADD COLUMN     "pricingMode" "PricingMode" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "refunds" ALTER COLUMN "creditsReturned" DROP DEFAULT,
ALTER COLUMN "moneyReturned" DROP DEFAULT,
ALTER COLUMN "totalRefunded" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
