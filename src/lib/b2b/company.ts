/**
 * Immutable company data shown on every wholesale invoice.
 *
 * Update these values only after coordinating with accounting — invoice
 * headers are legally binding in Spain and older invoices reference these
 * values verbatim once persisted as PDFs / rendered in emails.
 */

export const B2B_COMPANY = {
  brand: 'TCG Iberia',
  legalName: 'Miguel Rego Casas',
  taxId: '32692634C',
  addressLine: 'Lugar de Rumbo, 59',
  postalCode: '15198',
  city: 'Culleredo',
  province: 'A Coruña',
  phone: '+34 689 17 87 62',
  email: 'sales@tcgiberia.com',
  iban: 'ES15 2080 0068 7730 4002 4814'
} as const;

/** Formatted address block used in PDF and email templates. */
export const B2B_COMPANY_ADDRESS_LINES: readonly string[] = [
  B2B_COMPANY.legalName,
  `NIF ${B2B_COMPANY.taxId}`,
  `${B2B_COMPANY.addressLine}`,
  `${B2B_COMPANY.postalCode} ${B2B_COMPANY.city}, ${B2B_COMPANY.province}`,
  `Tel. ${B2B_COMPANY.phone}`,
  B2B_COMPANY.email,
];

/** Spanish B2B VAT rate applied to every wholesale invoice. */
export const B2B_IVA_RATE = 0.21;

/** How long the customer has to pay the invoice before prices may be revised. */
export const B2B_INVOICE_VALIDITY_HOURS = 24;
