-- CreateEnum
CREATE TYPE "CreditUsageType" AS ENUM ('HOURLY', 'SHIFT', 'SATURDAY_HOURLY', 'SATURDAY_SHIFT');

-- AlterTable
ALTER TABLE "credits" ADD COLUMN     "usageType" "CreditUsageType";
