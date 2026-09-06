/**
 * FLOW ERP Core Types - REBUILT (NO LEGACY SUPPLIERS)
 */

export type ItemType = 'RAW' | 'PRODUCT' | 'SEMI_FINISHED' | 'DISH' | 'OTHER';
export type UnitType = 'KG' | 'L' | 'PCS' | 'PORTION' | 'PACK';
export type TransactionType = 'PURCHASE' | 'WRITE_OFF' | 'TRANSFER' | 'SALE' | 'INVENTORY' | 'PRODUCTION' | 'PAYMENT';
export type UserRole = 'super_admin' | 'brand_admin' | 'outlet_admin' | 'employee' | 'cashier';
export type OrderStatus = 'NEED_REVIEW' | 'DRAFT' | 'APPROVED' | 'WAITING_FOR_PROVIDER' | 'SUPPLIER_CONFIRMED' | 'VERIFIED_ON_GATE' | 'FINAL_WEIGHTED' | 'POSTED_TO_POSTER' | 'ARCHIVED';
export type OrderType = 'PLANNED' | 'EMERGENCY';
export type ABCGroup = 'A' | 'B' | 'C';
export type LimitType = 'MIN' | 'OPT' | 'MAX';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface ERPCategory {
  id: string;      // Poster Category ID
  name: string;    // Custom display name (e.g. "Drinks")
  order: number;   // Sorting order
  isActive: boolean;
  updatedAt?: any;
}

export interface Location {
  id: string;
  name: string;
  type: 'WAREHOUSE' | 'POINT' | 'KITCHEN' | 'BAR';
  mappings?: Record<string, string>; 
}

export interface ERPItem {
  id: string;
  posterId?: string; // Link to Poster POS if synced
  name: string;
  type: ItemType;
  baseUnit: UnitType;
  categoryId: string;
  barcode?: string;
  minStock?: number;
  maxStock?: number; 
  lastPurchasePrice?: number;
  averagePurchasePrice?: number; 
  preferredSupplierId?: string;
  supplierItemName?: string;
  mappings?: Record<string, string>;
  source: 'POSTER' | 'MANUAL';
  abcGroup?: ABCGroup;
  categoryName?: string; 
  orderSchedule?: {
    daysOfWeek: number[]; // 0-6
    weeksInterval: number; // 1 to 4
    startDate?: any; 
  };
  supplierLeadTime?: number; 
  isActive: boolean;
  syncStatus?: string;
  hasPosterUpdate?: boolean;
  pendingPosterData?: {
    name: string;
    baseUnit: string;
    categoryId: string;
    barcode?: string;
  };
  createdAt: any;
  updatedAt: any;
}

export interface Contractor {
    id: string; 
    name: string; 
    brandName?: string;
    alias?: string; // Понятное имя для сотрудника
    inn?: string;
    phone?: string;
    email?: string;
    address?: string;
    
    // Банковские детали для переводов
    bankAccount?: string;
    bankName?: string;
    bankCode?: string;
    defaultPaymentCode?: string;

    balance: number; // Общий баланс долга (в копейках)
    isActive: boolean;
    createdAt: any;
    updatedAt: any;
}

/**
 * CONTRACTOR ITEM LIST (Price List & Routing)
 * This connects a Contractor to our Poster Ingredients.
 */
export interface ContractorItem {
    id: string;
    contractorId: string; // Link to Contractor from Bank Hub
    linkedPosterId: string; // Link to Item in 'erp_items' (Poster base)
    
    nameInInvoice?: string; // How the supplier calls it
    unitInInvoice?: string; // kg, box, etc.
    price: number; // Price per base unit
    
    isPreferred: boolean; // Flag to AUTO-SELECT this supplier for this item in Order Form
    
    isActive: boolean;
    updatedAt: any;
}

export interface OrderItem {
  itemId: string; // Internal UUID
  posterId?: string;
  name?: string; 
  unit?: string; 
  count: number;
  pricePerUnit: number;
  totalPrice: number;
  sku?: string;           
  invoiceWeight?: number; 
  finalWeight?: number;   
  deviation?: number;     
  onHand?: number;        
  isVerifiedAtGate?: boolean; 
  isSkipped?: boolean;   
  comment?: string;       
}

export interface OrderRequest {
  id: string;
  orgId?: string;
  locationId: string;
  locationName?: string; 
  contractorId?: string; // NEW UNIFIED LINK
  supplierId?: string;
  supplierName?: string;
  imageUrl?: string;
  totalPrice?: number;
  status: OrderStatus;
  limitType: LimitType;
  orderType: OrderType;
  scheduleDay?: string; 
  deliveryDate?: string; 
  reasonForEmergency?: string; 
  reasonForExcess?: string;
  invoiceNumber?: string; 
  vehicleNumber?: string; 
  driverName?: string;    
  vatAmount?: number;     
  comment?: string;       
  items: OrderItem[];
  createdBy: string;
  approvedBy?: string;
  verifiedBy?: string;
  finalizedBy?: string;
  hasCriticalDiscrepancy: boolean;
  isConfirmedByAdmin: boolean;
  isSupplierConfirmed?: boolean;
  invoiceId?: string; 
  parentRequestId?: string; 
  createdAt: any;
  updatedAt: any;
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
  action: string; 
  payload: any;
  retryCount: number;
  lastError?: string;
  timestamp: any;
  processedAt?: any;
}

export interface Supplier {
  id: string;
  posterId?: string;
  mappings?: Record<string, string>;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  balance: number;
  isActive: boolean;
  preferredCommunication?: string;
  providerContactUid?: string;
}

export interface SupplierItem {
  id: string;
  supplierId: string;
  itemId: string;
  linkedPosterId?: string;
  price: number;
  isActive: boolean;
}

export type AccountingStatus = 'WAITING_INVOICE' | 'DEDOX_VERIFIED' | 'PAID' | 'PARTIAL_PAID';

export interface AccountsPayable {
  id: string;
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
