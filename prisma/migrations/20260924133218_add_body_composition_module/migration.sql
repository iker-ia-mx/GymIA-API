-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPct" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "waistCm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMetric_userId_idx" ON "BodyMetric"("userId");

-- CreateIndex
CREATE INDEX "BodyMetric_userId_recordedAt_idx" ON "BodyMetric"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "ProgressPhoto_userId_idx" ON "ProgressPhoto"("userId");

-- CreateIndex
CREATE INDEX "ProgressPhoto_userId_takenAt_idx" ON "ProgressPhoto"("userId", "takenAt");

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
