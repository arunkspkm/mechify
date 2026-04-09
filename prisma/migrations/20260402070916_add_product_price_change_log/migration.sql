-- CreateTable
CREATE TABLE "ProductPriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "oldMrp" DECIMAL(65,30) NOT NULL,
    "newMrp" DECIMAL(65,30) NOT NULL,
    "oldSellingPrice" DECIMAL(65,30) NOT NULL,
    "newSellingPrice" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPriceChange_productId_idx" ON "ProductPriceChange"("productId");

-- AddForeignKey
ALTER TABLE "ProductPriceChange" ADD CONSTRAINT "ProductPriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPriceChange" ADD CONSTRAINT "ProductPriceChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
