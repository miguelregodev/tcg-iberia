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