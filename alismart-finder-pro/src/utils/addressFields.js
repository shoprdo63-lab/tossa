/**
 * AliExpress Address Form Field Mapping
 * Maps AliExpress address form fields to our vault structure
 * Updated for 2024-2025 AliExpress UI
 */

export const ALIEXPRESS_ADDRESS_SELECTORS = {
  // Contact Information
  contactName: [
    'input[name="contactName"]',
    'input[name="contact-name"]',
    'input[placeholder*="Full name" i]',
    'input[data-testid*="contact-name"]',
    '[class*="contact-name"] input',
    '[class*="recipient-name"] input',
    'input[autocomplete="name"]'
  ],
  
  phoneNumber: [
    'input[name="phoneNumber"]',
    'input[name="mobile"]',
    'input[name="phone"]',
    'input[type="tel"]',
    'input[placeholder*="phone" i]',
    'input[data-testid*="phone"]',
    '[class*="phone"] input',
    'input[autocomplete="tel"]'
  ],
  
  email: [
    'input[name="email"]',
    'input[type="email"]',
    'input[autocomplete="email"]'
  ],

  // Address Lines
  addressLine1: [
    'input[name="addressLine1"]',
    'input[name="address-line1"]',
    'input[name="street"]',
    'input[placeholder*="street" i]',
    'input[data-testid*="address-line-1"]',
    'input[autocomplete="address-line1"]',
    '[class*="address"] input:first-of-type',
    '[class*="street-address"] input'
  ],
  
  addressLine2: [
    'input[name="addressLine2"]',
    'input[name="address-line2"]',
    'input[name="apartment"]',
    'input[placeholder*="apartment" i]',
    'input[placeholder*="suite" i]',
    'input[data-testid*="address-line-2"]',
    'input[autocomplete="address-line2"]'
  ],

  // City & State
  city: [
    'input[name="city"]',
    'input[name="town"]',
    'input[placeholder*="city" i]',
    'input[data-testid*="city"]',
    '[class*="city"] input',
    'input[autocomplete="address-level2"]'
  ],
  
  state: [
    'input[name="state"]',
    'input[name="province"]',
    'select[name="state"]',
    'select[name="province"]',
    'input[placeholder*="state" i]',
    'input[placeholder*="province" i]',
    'input[data-testid*="state"]',
    '[class*="state"] input',
    'input[autocomplete="address-level1"]'
  ],

  // Postal Code
  zipCode: [
    'input[name="zipCode"]',
    'input[name="postal"]',
    'input[name="zip"]',
    'input[name="postcode"]',
    'input[placeholder*="postal" i]',
    'input[placeholder*="zip" i]',
    'input[data-testid*="zip"]',
    'input[data-testid*="postal"]',
    '[class*="zip"] input',
    '[class*="postal"] input',
    'input[autocomplete="postal-code"]'
  ],

  // Country
  country: [
    'select[name="country"]',
    'input[name="country"]',
    'input[data-testid*="country"]',
    '[class*="country"] select',
    '[class*="country"] input'
  ],

  // Tax ID / Israeli ID for Customs
  taxId: [
    'input[name="taxId"]',
    'input[name="tax-id"]',
    'input[name="vat"]',
    'input[name="ein"]',
    'input[name="personalId"]',
    'input[name="idNumber"]',
    'input[placeholder*="tax" i]',
    'input[placeholder*="ID number" i]',
    'input[data-testid*="tax"]',
    'input[data-testid*="id-number"]',
    '[class*="tax"] input',
    '[class*="tax-id"] input',
    '[class*="id-number"] input',
    'input[autocomplete="tax-id"]'
  ],
  
  // Alternative selectors for Israeli customs ID
  israeliId: [
    'input[placeholder*="תעודת זהות" i]',
    'input[placeholder*="מספר זהות" i]',
    'input[placeholder*="ח.פ" i]',
    'input[name*="israeli"]',
    'input[name*="customs"]',
    'input[data-field*="customs"]',
    'input[data-field*="tax"]'
  ],

  // Delivery Notes
  deliveryNotes: [
    'textarea[name="notes"]',
    'textarea[name="deliveryNotes"]',
    'textarea[name="instructions"]',
    'input[name="deliveryNote"]',
    'textarea[placeholder*="note" i]',
    'textarea[placeholder*="instruction" i]',
    'textarea[data-testid*="note"]',
    '[class*="note"] textarea',
    '[class*="instruction"] textarea'
  ]
};

/**
 * Checks if current page is an AliExpress address/checkout page
 * @returns {boolean}
 */
export function isAddressPage() {
  const url = window.location.href;
  const pathname = window.location.pathname;
  
  // URL patterns for address pages
  const addressPatterns = [
    /aliexpress.*\/checkout/i,
    /aliexpress.*\/order\/confirm/i,
    /aliexpress.*\/address/i,
    /aliexpress.*\/shipping/i,
    /aliexpress.*\/payment\/address/i,
    /aliexpress.*\/buy\/address/i
  ];
  
  return addressPatterns.some(pattern => pattern.test(url)) ||
         pathname.includes('checkout') ||
         pathname.includes('address') ||
         document.querySelector('form[action*="address"]') !== null ||
         document.querySelector('[class*="checkout"]') !== null;
}

/**
 * Finds an input element using multiple selectors
 * @param {string[]} selectors - Array of CSS selectors to try
 * @returns {HTMLElement|null}
 */
export function findField(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        return element;
      }
    } catch (e) {
      // Invalid selector, continue
    }
  }
  return null;
}

/**
 * Gets all visible address form fields
 * @returns {Object} Map of field names to elements
 */
export function getAllAddressFields() {
  const fields = {};
  
  for (const [fieldName, selectors] of Object.entries(ALIEXPRESS_ADDRESS_SELECTORS)) {
    const element = findField(selectors);
    if (element) {
      fields[fieldName] = element;
    }
  }
  
  return fields;
}

/**
 * Validates if the form has required fields
 * @returns {boolean}
 */
export function hasRequiredAddressFields() {
  const requiredFields = ['contactName', 'phoneNumber', 'addressLine1', 'city'];
  const fields = getAllAddressFields();
  
  return requiredFields.some(field => fields[field] !== undefined);
}

console.log('🚀 AliSmart: AddressFieldMapping Loaded');
