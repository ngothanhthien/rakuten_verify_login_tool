-- DropIndex
DROP INDEX IF EXISTS "Proxy_usedAt_idx";

-- AlterTable
ALTER TABLE "Proxy" DROP COLUMN "usageCount";
ALTER TABLE "Proxy" DROP COLUMN "usedAt";
