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
  visible: boolean;
  available: boolean;
  createdAt: String;
  updatedAt: String;
};

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'available'>;

export type AuthSession = {
  isAuthenticated: boolean;
  expiresAt: number;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};