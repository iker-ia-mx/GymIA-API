-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "timeInBedMinutes" INTEGER,
    "sleepEfficiencyPct" DOUBLE PRECISION,
    "recoveryScorePct" DOUBLE PRECISION,
    "avgHeartRateBpm" DOUBLE PRECISION,
    "minHeartRateBpm" DOUBLE PRECISION,
    "hrvMs" DOUBLE PRECISION,
    "respiratoryRateBpm" DOUBLE PRECISION,
    "dataQuality" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepStageEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SleepStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepDataSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "grantsSleepAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "grantsHeartRate" BOOLEAN NOT NULL DEFAULT false,
    "grantsRespiratoryRate" BOOLEAN NOT NULL DEFAULT false,
    "grantsHrv" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SleepDataSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SleepSession_userId_idx" ON "SleepSession"("userId");

-- CreateIndex
CREATE INDEX "SleepSession_userId_startedAt_idx" ON "SleepSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "SleepStageEvent_sessionId_idx" ON "SleepStageEvent"("sessionId");

-- CreateIndex
CREATE INDEX "SleepDataSource_userId_idx" ON "SleepDataSource"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SleepDataSource_userId_provider_key" ON "SleepDataSource"("userId", "provider");

-- AddForeignKey
ALTER TABLE "SleepSession" ADD CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepStageEvent" ADD CONSTRAINT "SleepStageEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SleepSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepDataSource" ADD CONSTRAINT "SleepDataSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
