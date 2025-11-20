-- CreateTable
CREATE TABLE "Credential" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "checkedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Credential_email_key" ON "Credential"("email");
