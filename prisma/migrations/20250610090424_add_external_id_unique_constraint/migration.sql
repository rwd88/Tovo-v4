/*
  Warnings:

  - You are about to drop the column `eventTime` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `forecast` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `outcome` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `resolutionTime` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `isEarlyClose` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `bsc` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `solana` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tron` on the `User` table. All the data in the column will be lost.
  - Made the column `payout` on table `Trade` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_userId_fkey";

-- DropIndex
DROP INDEX "User_bsc_key";

-- DropIndex
DROP INDEX "User_solana_key";

-- DropIndex
DROP INDEX "User_tron_key";

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "eventTime",
DROP COLUMN "forecast",
DROP COLUMN "outcome",
DROP COLUMN "resolutionTime",
ADD COLUMN     "description" TEXT,
ALTER COLUMN "externalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "isEarlyClose",
ALTER COLUMN "payout" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "bsc",
DROP COLUMN "solana",
DROP COLUMN "tron",
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE INDEX "Trade_marketId_idx" ON "Trade"("marketId");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
