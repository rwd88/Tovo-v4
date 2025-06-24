/*
  Warnings:

  - You are about to drop the column `bsc` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `solana` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "bsc",
DROP COLUMN "solana",
ADD COLUMN     "bscWallet" TEXT,
ADD COLUMN     "solanaWallet" TEXT;
