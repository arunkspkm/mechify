-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('ENQUIRY_RECORDED', 'ORDER_PLACED', 'IN_TRANSIT', 'RECEIVED', 'CUSTOMER_NOTIFIED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomerEnquiry" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerId" TEXT,
    "productDescription" TEXT NOT NULL,
    "desiredQty" INTEGER NOT NULL DEFAULT 1,
    "estimatedBudget" DECIMAL(65,30),
    "notes" TEXT,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'ENQUIRY_RECORDED',
    "operatorId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerEnquiry_status_idx" ON "CustomerEnquiry"("status");

-- CreateIndex
CREATE INDEX "CustomerEnquiry_customerPhone_idx" ON "CustomerEnquiry"("customerPhone");

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
