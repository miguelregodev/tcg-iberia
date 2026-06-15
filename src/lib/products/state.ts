export const LOW_STOCK_THRESHOLD = 5;

export type ProductInventoryStatus =
  | 'preorder'
  | 'available'
  | 'low_stock'
  | 'out_of_stock';

export interface ProductStateInput {
  stock: number;
  releaseDate?: string | Date | null;
}

export interface ProductInventoryState {
  status: ProductInventoryStatus;
  isPreorder: boolean;
  isAvailable: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
  canPurchase: boolean;
  stock: number;
  releaseDate: string | null;
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function parseReleaseDate(value?: string | Date | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

export function isPreorderProduct(
  releaseDate?: string | Date | null,
  now: Date = new Date(),
) {
  const parsed = parseReleaseDate(releaseDate);
  if (!parsed) return false;

  return parsed.getTime() > now.getTime();
}

export function getProductInventoryState(
  input: ProductStateInput,
  now: Date = new Date(),
): ProductInventoryState {
  const stock = Math.max(0, Number(input.stock) || 0);
  const parsedReleaseDate = parseReleaseDate(input.releaseDate);
  const normalizedReleaseDate = parsedReleaseDate?.toISOString() ?? null;
  const preorder = isPreorderProduct(parsedReleaseDate, now);

  if (preorder) {
    return {
      status: 'preorder',
      isPreorder: true,
      isAvailable: false,
      isLowStock: false,
      isOutOfStock: false,
      canPurchase: true,
      stock,
      releaseDate: normalizedReleaseDate,
    };
  }

  if (stock > LOW_STOCK_THRESHOLD) {
    return {
      status: 'available',
      isPreorder: false,
      isAvailable: true,
      isLowStock: false,
      isOutOfStock: false,
      canPurchase: true,
      stock,
      releaseDate: normalizedReleaseDate,
    };
  }

  if (stock > 0) {
    return {
      status: 'low_stock',
      isPreorder: false,
      isAvailable: false,
      isLowStock: true,
      isOutOfStock: false,
      canPurchase: true,
      stock,
      releaseDate: normalizedReleaseDate,
    };
  }

  return {
    status: 'out_of_stock',
    isPreorder: false,
    isAvailable: false,
    isLowStock: false,
    isOutOfStock: true,
    canPurchase: false,
    stock,
    releaseDate: normalizedReleaseDate,
  };
}

export function getProductStatusLabel(state: ProductInventoryState) {
  switch (state.status) {
    case 'preorder':
      return 'Reserva';
    case 'available':
      return 'Disponible';
    case 'low_stock':
      return 'Últimas unidades';
    case 'out_of_stock':
    default:
      return 'Agotado';
  }
}

export function getProductPurchaseLabel(state: ProductInventoryState) {
  return state.isPreorder ? 'Reservar' : 'Añadir al carrito';
}

export function getProductQuantityLimit(state: ProductInventoryState) {
  return state.isPreorder ? null : state.stock;
}

export function formatReleaseDate(
  releaseDate?: string | Date | null,
  locale: string = 'es-ES',
) {
  const parsed = parseReleaseDate(releaseDate);
  if (!parsed) return null;

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}