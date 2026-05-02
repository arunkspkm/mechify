-- CreateTable: EnquiryNote (communication log per enquiry)
CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "CustomerEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
