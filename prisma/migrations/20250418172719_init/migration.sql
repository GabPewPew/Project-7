-- CreateTable
CREATE TABLE "note_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "cardTemplates" TEXT NOT NULL,
    "styling" TEXT
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteTypeId" TEXT NOT NULL,
    "fieldValues" TEXT NOT NULL,
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "notes_noteTypeId_fkey" FOREIGN KEY ("noteTypeId") REFERENCES "note_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "noteTypeCardTemplateName" TEXT NOT NULL,
    "frontContent" TEXT NOT NULL,
    "backContent" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sourcePageNumber" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cards_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateIndex
CREATE UNIQUE INDEX "note_types_name_key" ON "note_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "card_progress_cardId_key" ON "card_progress"("cardId");

-- CreateIndex
CREATE INDEX "card_progress_userId_idx" ON "card_progress"("userId");

-- CreateIndex
CREATE INDEX "card_progress_dueDate_idx" ON "card_progress"("dueDate");

-- CreateIndex
CREATE INDEX "card_progress_state_idx" ON "card_progress"("state");
