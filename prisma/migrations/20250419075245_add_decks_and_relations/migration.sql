/*
  Warnings:

  - You are about to drop the `CardProgress` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `deckId` to the `cards` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CardProgress_userId_cardId_key";

-- DropIndex
DROP INDEX "CardProgress_noteId_idx";

-- DropIndex
DROP INDEX "CardProgress_cardId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CardProgress";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "decks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "card_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'default_user',
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" INTEGER NOT NULL DEFAULT 2500,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'new',
    "learningStep" INTEGER NOT NULL DEFAULT 0,
    "lastReviewDate" DATETIME,
    CONSTRAINT "card_progress_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "noteTypeCardTemplateName" TEXT NOT NULL,
    "frontContent" TEXT NOT NULL,
    "backContent" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourcePageNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cards_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cards_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "decks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_cards" ("backContent", "createdAt", "frontContent", "id", "noteId", "noteTypeCardTemplateName", "sourceDocumentId", "sourcePageNumber") SELECT "backContent", "createdAt", "frontContent", "id", "noteId", "noteTypeCardTemplateName", "sourceDocumentId", "sourcePageNumber" FROM "cards";
DROP TABLE "cards";
ALTER TABLE "new_cards" RENAME TO "cards";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "decks_name_key" ON "decks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "card_progress_cardId_key" ON "card_progress"("cardId");

-- CreateIndex
CREATE INDEX "card_progress_userId_idx" ON "card_progress"("userId");

-- CreateIndex
CREATE INDEX "card_progress_dueDate_idx" ON "card_progress"("dueDate");

-- CreateIndex
CREATE INDEX "card_progress_state_idx" ON "card_progress"("state");
