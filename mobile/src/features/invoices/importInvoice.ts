// TypeScript's platform-neutral resolver uses this fallback declaration target.
// Metro selects importInvoice.native.ts on devices and importInvoice.web.ts on web.
export { pickAndReadInvoice } from "./importInvoice.native";
