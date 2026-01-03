-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_activation_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_activation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_activation_tokens_tokenHash_key" ON "email_activation_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "email_activation_tokens_userId_idx" ON "email_activation_tokens"("userId");

-- CreateIndex
CREATE INDEX "email_activation_tokens_expiresAt_idx" ON "email_activation_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_activation_tokens" ADD CONSTRAINT "email_activation_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
