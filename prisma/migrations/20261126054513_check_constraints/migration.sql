-- CHECK constraints from docs/DATABASE_MODEL.md §5.
-- Prisma's schema language can't express CHECKs, so they live in raw SQL here.
ALTER TABLE "Product"     ADD CONSTRAINT product_stock_nonneg   CHECK ("quantityInStock" >= 0);
ALTER TABLE "Product"     ADD CONSTRAINT product_price_nonneg   CHECK ("sellingPrice" >= 0 AND "costPrice" >= 0);
ALTER TABLE "SaleItem"    ADD CONSTRAINT saleitem_qty_pos       CHECK ("quantity" > 0);
ALTER TABLE "StockInItem" ADD CONSTRAINT stockinitem_qty_pos    CHECK ("quantity" > 0);
ALTER TABLE "Sale"        ADD CONSTRAINT sale_discount_valid    CHECK ("discount" >= 0 AND "discount" <= "subtotal");
ALTER TABLE "Setting"     ADD CONSTRAINT setting_single_row     CHECK ("id" = 1);
