-- AlterTable
ALTER TABLE "cards" ADD COLUMN "sourcePageRaw" TEXT;

-- CreateIndex
CREATE INDEX "cards_noteId_idx" ON "cards"("noteId");

-- CreateIndex
CREATE INDEX "cards_deckId_idx" ON "cards"("deckId");
