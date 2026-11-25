import { Prisma } from '@prisma/client';
import { determineTier } from './calculations';

export interface LoyaltyTierConfig {
  name: string;
  threshold: string;
  multiplier: string;
  description: string;
  color: string;
  icon: string;
  benefits: string[];
}

export interface LoyaltyConfigInput {
  baseRate: string;
  pointsPerEuro: string;
  minimumRedemption: string;
  redemptionIncrement: string;
  maxDiscountPercent: string;
  evaluationDays: number;
  expirationMonths: number;
  tiers: LoyaltyTierConfig[];
}

function text(value: unknown, label: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== 'string') throw new Error(`${label}: valor inválido.`);
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maxLength) throw new Error(`${label}: valor inválido.`);
  return result;
}

function amount(value: unknown, label: string, scale: number, max: string, allowZero = false): string {
  if (typeof value !== 'string' || !new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(value)) {
    throw new Error(`${label}: número inválido.`);
  }
  const result = new Prisma.Decimal(value);
  if ((!allowZero && result.isZero()) || result.greaterThan(max)) {
    throw new Error(`${label}: fuera de rango.`);
  }
  return result.toString();
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuración inválida.');
  return value as Record<string, unknown>;
}

export function parseLoyaltyConfig(value: unknown): LoyaltyConfigInput {
  const config = object(value);
  const tiersInput = config.tiers;
  if (!Array.isArray(tiersInput) || tiersInput.length < 1 || tiersInput.length > 10) {
    throw new Error('Debe haber entre uno y diez niveles.');
  }
  const tiers = tiersInput.map((entry) => {
    const tier = object(entry);
    if (!Array.isArray(tier.benefits) || tier.benefits.length > 20) {
      throw new Error('Beneficios inválidos.');
    }
    const color = text(tier.color, 'Color', 7);
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('El color debe tener formato #RRGGBB.');
    return {
      name: text(tier.name, 'Nombre del nivel', 100),
      threshold: amount(tier.threshold, 'Umbral', 2, '9999999999.99', true),
      multiplier: amount(tier.multiplier, 'Multiplicador', 4, '999999.9999'),
      description: text(tier.description, 'Descripción', 2000, true),
      color,
      icon: text(tier.icon, 'Icono', 100, true),
      benefits: tier.benefits.map((benefit) => text(benefit, 'Beneficio', 200)),
    };
  });
  determineTier(tiers, '0');

  const evaluationDays = config.evaluationDays;
  const expirationMonths = config.expirationMonths;
  if (!Number.isInteger(evaluationDays) || typeof evaluationDays !== 'number' || evaluationDays < 1 || evaluationDays > 3650) {
    throw new Error('El periodo de evaluación debe estar entre 1 y 3650 días.');
  }
  if (!Number.isInteger(expirationMonths) || typeof expirationMonths !== 'number' || expirationMonths < 1 || expirationMonths > 120) {
    throw new Error('La caducidad debe estar entre 1 y 120 meses.');
  }
  return {
    baseRate: amount(config.baseRate, 'Tasa de puntos', 4, '999999.9999'),
    pointsPerEuro: amount(config.pointsPerEuro, 'Puntos por euro', 2, '9999999999.99'),
    minimumRedemption: amount(config.minimumRedemption, 'Mínimo de puntos', 2, '9999999999.99'),
    redemptionIncrement: amount(config.redemptionIncrement, 'Incremento de puntos', 2, '9999999999.99'),
    maxDiscountPercent: amount(config.maxDiscountPercent, 'Descuento máximo', 2, '100', true),
    evaluationDays,
    expirationMonths,
    tiers,
  };
}
