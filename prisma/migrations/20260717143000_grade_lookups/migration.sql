CREATE TABLE "grade_lookups" (
    "id" TEXT NOT NULL,
    "customerFacingLabel" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "grade_lookups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grade_lookups_customerFacingLabel_key"
ON "grade_lookups"("customerFacingLabel");
