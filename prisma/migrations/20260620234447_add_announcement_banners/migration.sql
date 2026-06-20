-- CreateTable
CREATE TABLE "AnnouncementBanner" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnouncementBanner_enabled_idx" ON "AnnouncementBanner"("enabled");

-- CreateIndex
CREATE INDEX "AnnouncementBanner_displayOrder_idx" ON "AnnouncementBanner"("displayOrder");
