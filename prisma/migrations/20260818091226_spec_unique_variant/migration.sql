-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecification_productId_color_size_key" ON "ProductSpecification"("productId", "color", "size");
