import { requireOptionalNativeModule } from "expo-modules-core";

interface CherryInvoiceReaderModule {
  renderPdfPages(uri: string): Promise<string[]>;
}

const nativeModule = requireOptionalNativeModule<CherryInvoiceReaderModule>("CherryInvoiceReader");

export function renderPdfPages(uri: string): Promise<string[]> {
  if (!nativeModule) {
    return Promise.reject(new Error("PDF scan reading requires the installed Cherry app build."));
  }
  return nativeModule.renderPdfPages(uri);
}
