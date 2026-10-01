-- CreateTable
CREATE TABLE "AIDecision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "output" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIDecision_userId_idx" ON "AIDecision"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AIDecision_userId_engine_forDate_key" ON "AIDecision"("userId", "engine", "forDate");

-- AddForeignKey
ALTER TABLE "AIDecision" ADD CONSTRAINT "AIDecision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
