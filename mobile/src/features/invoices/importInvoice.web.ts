import * as DocumentPicker from "expo-document-picker";
import { todayAsISODate } from "./parseInvoiceText";
import { InvoiceImportDraft } from "./types";

const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

function inferMimeType(fileName: string, mimeType?: string | null): string {
  if (mimeType) {
    const normalized = mimeType.toLowerCase();
    if (normalized !== "application/octet-stream") {
      return normalized === "image/jpg" ? "image/jpeg" : normalized;
    }
  }
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export async function pickAndReadInvoice(): Promise<InvoiceImportDraft | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const mimeType = inferMimeType(asset.name, asset.mimeType);
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(mimeType)) {
    throw new Error("Choose a PDF, JPEG, PNG, WebP, or HEIC invoice.");
  }
  if (asset.size !== undefined && asset.size > MAX_INVOICE_BYTES) {
    throw new Error("Invoice files must be 8 MB or smaller.");
  }
  if (!asset.base64) throw new Error("The selected file could not be read.");

  const base64 = asset.base64.replace(/^data:[^,]*;base64,/, "");
  return {
    attachment: { fileName: asset.name, mimeType, base64 },
    date: todayAsISODate(),
    notice: "Automatic invoice reading is available in the Android and iOS app. Enter the amount and date below.",
  };
}
