/**
 * FLOW ERP Core Types
 * Definitions for items, stock, transactions, and access control.
 */

export type ItemType = 'RAW' | 'PRODUCT' | 'SEMI_FINISHED' | 'DISH' | 'OTHER';
export type UnitType = 'KG' | 'L' | 'PCS' | 'PORTION' | 'PACK';
export type TransactionType = 'PURCHASE' | 'WRITE_OFF' | 'TRANSFER' | 'SALE' | 'INVENTORY' | 'PRODUCTION' | 'PAYMENT';
export type UserRole = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF_POINT' | 'KITCHEN';
export type OrderStatus = 'DRAFT' | 'APPROVED' | 'WAITING_FOR_PROVIDER' | 'SUPPLIER_CONFIRMED' | 'VERIFIED_ON_GATE' | 'FINAL_WEIGHTED' | 'POSTED_TO_POSTER';
export type AccountingStatus = 'WAITING_INVOICE' | 'DEDOX_VERIFIED' | 'PAID' | 'PARTIAL_PAID';
export type LimitType = 'MIN' | 'OPT' | 'MAX';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type CommunicationMethod = 'WHATSAPP' | 'TELEGRAM' | 'EMAIL' | 'PHONE';

export interface Location {
  id: string;
  name: string;
  type: 'WAREHOUSE' | 'POINT' | 'KITCHEN' | 'BAR';
  mappings?: Record<string, string>; // e.g., { "poster": "123", "scales": "99" }
}

export interface Supplier {
  id: string;
  posterId?: string; // Keep for legacy but move to mappings
  mappings?: Record<string, string>;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string; // e.g., "NET-30", "PREPAID"
  balance: number; // Current debt/balance (positive = we owe, negative = prepayment)
  preferredCommunication?: CommunicationMethod;
  providerContactUid?: string; // Telegram Chat ID or Phone for WhatsApp
  isActive: boolean;
}

export interface ERPItem {
  id: string;
  posterId?: string; // Link to Poster POS if synced
  name: string;
  type: ItemType;
  baseUnit: UnitType;
  categoryId: string;
  minStock?: number;
  lastPurchasePrice?: number;
  averagePurchasePrice?: number; // New field for smart validation
  preferredSupplierId?: string;
  mappings?: Record<string, string>;
}

export interface RecipeIngredient {
  itemId: string; // ID of the ingredient (RAW or SEMI_FINISHED)
  gross: number;  // Weight before processing
  net: number;    // Weight after processing
  lossPercent: number; // calculated loss percentage
}

export interface Recipe {
  id: string;
  targetItemId: string; // The item produced (DISH or SEMI_FINISHED)
  ingredients: RecipeIngredient[];
}

export interface StockTransaction {
  id: string;
  type: TransactionType;
  itemId: string;
  locationId: string;
  quantity: number; // delta change (+ for added stock, - for removed)
  timestamp: any;   // Firestore serverTimestamp
  userId: string;
  comment?: string;
  referenceId?: string; // Link to purchase order id, sale id, or inventory session id
}

export interface UserERP {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  locationIds: string[]; // Scope of locations the user has access to
  telegramId?: string;
}

export interface OrderItem {
  itemId: string;
  posterId?: string;
  count: number;
  pricePerUnit: number;
  totalPrice: number;
  invoiceWeight?: number; // Weight from the supplier invoice
  finalWeight?: number;   // Weight after weighing on site
  deviation?: number;     // Deviation % (final vs invoice)
}

export interface OrderRequest {
  id: string;
  supplierId: string;
  locationId: string;
  status: OrderStatus;
  limitType: LimitType;
  scheduleDay?: string; // Delivery day preference
  reasonForExcess?: string; // If ordering more than max
  supplierInvoiceRef?: string; // Photo reference or ID
  items: OrderItem[];
  createdBy: string;
  approvedBy?: string;
  verifiedBy?: string;
  finalizedBy?: string;
  hasCriticalDiscrepancy: boolean;
  isConfirmedByAdmin: boolean;
  accountingStatus?: AccountingStatus; // Link to CASH module
  invoiceId?: string; // Digital invoice number/ID
  createdAt: any;
  updatedAt: any;
}

export interface PaymentTransaction {
  id: string;
  supplierId: string;
  orderId?: string; // Reference specific order if paying for one
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'BANK';
  timestamp: any;
  userId: string;
  comment?: string;
}

export interface AccountsPayable {
  id: string; // usually linked to orderId or supplyId
  supplierId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: any;
  status: AccountingStatus;
  orderId?: string;
  posterSupplyId?: string;
  createdAt: any;
}

export interface SystemLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  source: 'UI' | 'API' | 'JOB' | 'SYNC';
  event: string;
  message: string;
  metadata?: any;
  timestamp: any;
  userId?: string;
}

export interface SyncQueueItem {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  action: string; // e.g., "PUSH_TO_POSTER", "SEND_TELEGRAM"
  payload: any;
  retryCount: number;
  lastError?: string;
  timestamp: any;
  processedAt?: any;
}
