/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `Market` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `externalId` to the `Market` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "externalId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Market_externalId_key" ON "Market"("externalId");
