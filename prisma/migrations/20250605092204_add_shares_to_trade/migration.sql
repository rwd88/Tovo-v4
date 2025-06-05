/*
  Warnings:

  - You are about to drop the column `payout` on the `Trade` table. All the data in the column will be lost.
  - Added the required column `settled` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shares` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_userId_fkey";

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "payout",
ADD COLUMN     "settled" BOOLEAN NOT NULL,
ADD COLUMN     "shares" DOUBLE PRECISION NOT NULL;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;
