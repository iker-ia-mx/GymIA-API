-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadPost" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SquadPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Squad_inviteCode_key" ON "Squad"("inviteCode");

-- CreateIndex
CREATE INDEX "Squad_inviteCode_idx" ON "Squad"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMembership_userId_key" ON "SquadMembership"("userId");

-- CreateIndex
CREATE INDEX "SquadMembership_squadId_idx" ON "SquadMembership"("squadId");

-- CreateIndex
CREATE INDEX "SquadPost_squadId_idx" ON "SquadPost"("squadId");

-- CreateIndex
CREATE INDEX "SquadPost_squadId_createdAt_idx" ON "SquadPost"("squadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SquadPostLike_postId_userId_key" ON "SquadPostLike"("postId", "userId");

-- AddForeignKey
ALTER TABLE "SquadMembership" ADD CONSTRAINT "SquadMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMembership" ADD CONSTRAINT "SquadMembership_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPost" ADD CONSTRAINT "SquadPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPostLike" ADD CONSTRAINT "SquadPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SquadPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadPostLike" ADD CONSTRAINT "SquadPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
