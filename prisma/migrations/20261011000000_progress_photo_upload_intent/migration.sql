-- Draft migration. Apply only after reviewing environment and bucket setup.
CREATE TABLE "ProgressPhotoUploadIntent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressPhotoUploadIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgressPhotoUploadIntent_storagePath_key"
  ON "ProgressPhotoUploadIntent"("storagePath");
CREATE INDEX "ProgressPhotoUploadIntent_userId_expiresAt_idx"
  ON "ProgressPhotoUploadIntent"("userId", "expiresAt");

ALTER TABLE "ProgressPhotoUploadIntent"
  ADD CONSTRAINT "ProgressPhotoUploadIntent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
