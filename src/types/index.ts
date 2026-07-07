import type { ProductInventoryStatus } from '@/lib/products/state';

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPercentage: number | null;
  noShrinkPrice: number | null;
  notes: string | null;
  type: string | null;
  releaseDate: string | null;
  stock: number;
  noShrinkStock: number;
  imageUrl: string | null;
  language: 'JAPANESE' | 'KOREAN' | 'ENGLISH' | 'SPANISH';
  priority: number;
  visible: boolean;
  available: boolean;
  canPurchase: boolean;
  isPreorder: boolean;
  inventoryStatus: ProductInventoryStatus;
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