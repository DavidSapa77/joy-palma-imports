/**
 * Business-rule violations raised by the inventory services. Server actions
 * turn these into friendly form errors; anything else is an unexpected bug.
 *
 * Services check rules *before* writing, so a thrown InventoryError never
 * leaves a half-written record in the transaction.
 */
export type InventoryErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_ARCHIVED"
  | "INSUFFICIENT_STOCK"
  | "INVALID_QUANTITY"
  | "INVALID_AMOUNT"
  | "NOTE_REQUIRED"
  | "SALE_NOT_FOUND"
  | "SALE_ALREADY_VOIDED"
  | "REASON_REQUIRED";

export class InventoryError extends Error {
  override name = "InventoryError";

  constructor(
    readonly code: InventoryErrorCode,
    message: string,
    readonly productId?: string,
  ) {
    super(message);
  }
}
