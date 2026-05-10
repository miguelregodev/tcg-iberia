export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPercentage: number | null;
  notes: string | null;
  stock: number;
  imageUrl: string | null;
  language: 'JAPANESE' | 'KOREAN' | 'ENGLISH' | 'SPANISH';
  visible: boolean;
  available: boolean;
  createdAt: String;
  updatedAt: String;
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