-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "isAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LinkConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "telegramUserId" TEXT NOT NULL,
    "originalLink" TEXT NOT NULL,
    "normalizedLink" TEXT NOT NULL,
    "generatedAffiliateLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "LinkConversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_isAllowed_idx" ON "User"("isAllowed");

-- CreateIndex
CREATE INDEX "User_isAdmin_idx" ON "User"("isAdmin");

-- CreateIndex
CREATE INDEX "LinkConversion_telegramUserId_createdAt_idx" ON "LinkConversion"("telegramUserId", "createdAt");

-- CreateIndex
CREATE INDEX "LinkConversion_status_idx" ON "LinkConversion"("status");

-- CreateIndex
CREATE INDEX "LinkConversion_createdAt_idx" ON "LinkConversion"("createdAt");
