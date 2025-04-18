/*
  Warnings:

  - You are about to drop the `card_progress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "card_progress";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CardProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "interval" REAL NOT NULL DEFAULT 0,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "dueDate" DATETIME NOT NULL,
    "lastReviewed" DATETIME,
    "state" TEXT NOT NULL DEFAULT 'learning',
    "learningStep" INTEGER,
    CONSTRAINT "CardProgress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CardProgress_cardId_key" ON "CardProgress"("cardId");

-- CreateIndex
CREATE INDEX "CardProgress_noteId_idx" ON "CardProgress"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "CardProgress_userId_cardId_key" ON "CardProgress"("userId", "cardId");
