-- CreateEnum
CREATE TYPE "CustomerReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'REPLACE', 'CREDIT');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('INITIATED', 'SHIPPED', 'CREDIT_RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "lowStockThreshold" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "orderedQty" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CustomerReturn" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT,
    "returnNumber" TEXT NOT NULL,
    "totalRefund" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "CustomerReturnStatus" NOT NULL DEFAULT 'PENDING',
    "processedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT,
    "batchId" TEXT,
    "qty" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "refundAmount" DECIMAL(65,30) NOT NULL,
    "reasonId" TEXT NOT NULL,
    "resolution" "ReturnResolution" NOT NULL DEFAULT 'REFUND',
    "restockable" BOOLEAN NOT NULL DEFAULT false,
    "isCustomItem" BOOLEAN NOT NULL DEFAULT false,
    "customItemName" TEXT,
    CONSTRAINT "CustomerReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditReceived" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'INITIATED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "unitCost" DECIMAL(65,30) NOT NULL,
    "totalCost" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReturn_returnNumber_key" ON "CustomerReturn"("returnNumber");
CREATE INDEX "CustomerReturn_invoiceId_idx" ON "CustomerReturn"("invoiceId");
CREATE UNIQUE INDEX "SupplierReturn_returnNumber_key" ON "SupplierReturn"("returnNumber");
CREATE INDEX "SupplierReturn_supplierId_idx" ON "SupplierReturn"("supplierId");

-- AddForeignKeys
ALTER TABLE "CustomerReturn" ADD CONSTRAINT "CustomerReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReturn" ADD CONSTRAINT "CustomerReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReturn" ADD CONSTRAINT "CustomerReturn_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReturnItem" ADD CONSTRAINT "CustomerReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "CustomerReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReturnItem" ADD CONSTRAINT "CustomerReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReturnItem" ADD CONSTRAINT "CustomerReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerReturnItem" ADD CONSTRAINT "CustomerReturnItem_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "MasterData"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SupplierReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
