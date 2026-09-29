/**
 * Tracking URL generation for shipping providers.
 * 
 * Maps shipping provider codes to their official tracking URL formats.
 */

export type ShippingProvider = 'CORREOS' | 'MRW' | 'SEUR' | 'CTT_EXPRESS';

export function getTrackingUrl(provider: ShippingProvider, trackingNumber: string): string | null {
  switch (provider) {
    case 'CORREOS':
      // Correos tracking URL: https://www.correos.es/es/es/herramientas/localizador/envios/detalle
      return `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${encodeURIComponent(trackingNumber)}`;
    default:
      return null;
  }
}

export function getProviderLabel(provider: ShippingProvider): string {
  switch (provider) {
    case 'CORREOS':
      return 'Correos';
    case 'MRW':
      return 'MRW';
    case 'SEUR':
      return 'SEUR';
    case 'CTT_EXPRESS':
      return 'CTT Express';
    default:
      return 'Desconocido';
  }
}
