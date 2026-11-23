import type { ProductInventoryStatus } from '@/lib/products/state';

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPercentage: number | null;
  /** Optional public price for the "Apertura en directo" (live-opening) variant. */
  liveOpeningPrice: number | null;
  /** Optional wholesale (B2B) price. B2B customers only ever get the sealed variant. */
  b2bPrice: number | null;
  notes: string | null;
  type: string | null;
  releaseDate: string | null;
  stock: number;
  imageUrl: string | null;
  language: 'JAPANESE' | 'KOREAN' | 'ENGLISH' | 'SPANISH' | 'CHINESE';
  priority: number;
  visible: boolean;
  available: boolean;
  canPurchase: boolean;
  isPreorder: boolean;
  inventoryStatus: ProductInventoryStatus;
  /** Shipping dimensions and weight for calculating zone-aware shipping costs */
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  createdAt: string;
  updatedAt: string;
  hitCards?: HitCard[];
};

export type HitCard = {
  id: string;
  productId: string;
  name: string;
  type: string;
  imageUrl: string;
  marketPrice: number;
  createdAt: string;
  updatedAt: string;
};

export type HitCardInput = Omit<HitCard, 'id' | 'createdAt' | 'updatedAt'>;

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'available' | 'hitCards'>;

export type AuthSession = {
  isAuthenticated: boolean;
  expiresAt: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type AnnouncementBanner = {
  id: string;
  text: string;
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementBannerInput = Omit<AnnouncementBanner, 'id' | 'createdAt' | 'updatedAt'>;

/** Homepage hero slider item (admin model; createdAt/updatedAt serialized as ISO strings) */
export interface HeroSlide {
  id: string;
  name: string;
  imageUrl: string;
  destinationUrl: string;
  headline: string | null;
  buttonLabel: string | null;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Public projection of a hero slide. `name` is intentionally omitted (admin only). */
export interface PublicHeroSlide {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  headline: string | null;
  buttonLabel: string | null;
  subtitle: string | null;
}

export interface HeroSlideInput {
  name: string;
  imageUrl: string;
  destinationUrl: string;
  headline?: string | null;
  buttonLabel?: string | null;
  subtitle?: string | null;
  isActive: boolean;
  /** Zero-based position. Omit to append (create) or keep current position (update). */
  sortOrder?: number;
}

export type UserRole = 'USER' | 'ADMIN';

export type UserProfile = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  locality: string | null;
  province: string | null;
  country: string;
  image: string | null;
  role: UserRole;
  createdAt: Date;
};
// ─────────────────────────────────────────────────────────────────────────────
// B2B orders & documents (shared by API serializers and client components).
// Dates are serialized as ISO strings; money as numbers (EUR, 2 decimals).
// ─────────────────────────────────────────────────────────────────────────────

export type B2bOrderLifecycleStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'REJECTED';
export type B2bPaymentStatusValue = 'PENDING' | 'PAID' | 'REFUNDED' | 'CANCELLED';
export type B2bFulfillmentStatusValue =
  | 'PENDING'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED';
export type B2bOrderSourceValue = 'CUSTOMER' | 'ADMIN';
export type B2bDocumentTypeValue = 'INVOICE' | 'PROFORMA' | 'QUOTATION' | 'CORRECTIVE_INVOICE';
export type B2bDocumentStatusValue = 'GENERATING' | 'ISSUED' | 'FAILED';
export type B2bShippingProviderValue = 'CORREOS' | 'MRW' | 'SEUR' | 'CTT_EXPRESS';

/**
 * Immutable order line snapshot persisted in `B2bOrder.items`.
 * `unitPriceEur` is the VAT-excluded unit price BEFORE the line discount;
 * `lineTotal` is the VAT-excluded line amount AFTER the discount.
 * Optional fields are missing on legacy rows.
 */
export interface B2bOrderLineSnapshot {
  productId: string;
  name: string;
  sku?: string | null;
  language?: string | null;
  variant?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPriceEur: number;
  discountPercent?: number;
  discountAmountEur?: number;
  vatRate?: number;
  lineTotal: number;
}

/** Customer data frozen on the order at creation time. */
export interface B2bCustomerSnapshot {
  companyName: string;
  vatNumber: string;
  contactName: string;
  email: string;
  phone: string;
  billingAddress: string | null;
  shippingAddress: string;
}

export interface B2bOrderTotals {
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  vatRate: number;
  ivaAmount: number;
  /** Recargo de Equivalencia (0 when the customer is not under that regime). */
  surchargeRate: number;
  surchargeAmount: number;
  total: number;
}

/** Document as seen by the B2B customer (only ISSUED documents are exposed). */
export interface B2bCustomerDocumentView {
  id: string;
  type: B2bDocumentTypeValue;
  number: string;
  issuedAt: string;
  total: number;
  correctsNumber: string | null;
}

/** Document as seen by admins (includes generation state). */
export interface B2bAdminDocumentView extends B2bCustomerDocumentView {
  status: B2bDocumentStatusValue;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  generatedAt: string | null;
  fileName: string | null;
  correctsDocumentId: string | null;
  correctionReason: string | null;
  correctedByNumbers: string[];
  createdBy: string | null;
}

export interface B2bCustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: B2bOrderLifecycleStatus;
  paymentStatus: B2bPaymentStatusValue;
  fulfillmentStatus: B2bFulfillmentStatusValue;
  total: number;
  itemCount: number;
  unitCount: number;
  trackingNumber: string | null;
  shippingProvider: B2bShippingProviderValue | null;
  trackingUrl: string | null;
  hasInvoice: boolean;
  createdAt: string;
  canCancel: boolean;
}

export interface B2bCustomerOrderDetail extends B2bCustomerOrderSummary, B2bOrderTotals {
  items: B2bOrderLineSnapshot[];
  customer: B2bCustomerSnapshot;
  notes: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  documents: B2bCustomerDocumentView[];
}

export interface B2bAdminOrderListItem {
  id: string;
  orderNumber: string;
  source: B2bOrderSourceValue;
  status: B2bOrderLifecycleStatus;
  paymentStatus: B2bPaymentStatusValue;
  fulfillmentStatus: B2bFulfillmentStatusValue;
  total: number;
  createdAt: string;
  trackingNumber: string | null;
  shippingProvider: B2bShippingProviderValue | null;
  invoiceNumber: string | null;
  invoiceStatus: B2bDocumentStatusValue | null;
  customer: { id: string; companyName: string; email: string; vatNumber: string };
}

export interface B2bOrderEventView {
  id: string;
  type: string;
  actor: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface B2bAdminOrderDetail extends B2bOrderTotals {
  id: string;
  orderNumber: string;
  source: B2bOrderSourceValue;
  status: B2bOrderLifecycleStatus;
  paymentStatus: B2bPaymentStatusValue;
  fulfillmentStatus: B2bFulfillmentStatusValue;
  items: B2bOrderLineSnapshot[];
  customer: B2bCustomerSnapshot & { id: string; currentStatus: string };
  notes: string | null;
  internalNotes: string | null;
  createdBy: string | null;
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  refundedAt: string | null;
  shippingProvider: B2bShippingProviderValue | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  processingAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  shippingEmailSentAt: string | null;
  shippingEmailError: string | null;
  documents: B2bAdminDocumentView[];
  events: B2bOrderEventView[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
