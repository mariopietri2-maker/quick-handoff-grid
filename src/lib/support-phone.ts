/** Shared support contact. Empty / placeholder disables the call CTA. */
const RAW = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim() ?? '';

/** Real numbers only — ignore known placeholders. */
export const SUPPORT_PHONE =
  RAW && RAW !== '+302100000000' && RAW !== '2100000000' ? RAW : '';

export const hasSupportPhone = SUPPORT_PHONE.length > 0;
