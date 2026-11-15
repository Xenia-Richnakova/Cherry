import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { extractText } from "expo-pdf-text-extract";
import { extractTextFromImage } from "expo-text-extractor";
import { renderPdfPages } from "../../../modules/invoice-reader";
import { parseInvoiceText, todayAsISODate } from "./parseInvoiceText";
import { InvoiceImportDraft } from "./types";

const MAX_INVOICE_BYTES = 8 * 1024 * 1024;

function inferMimeType(fileName: string, mimeType?: string | null): string {
  if (mimeType) {
    const normalized = mimeType.toLowerCase();
    if (normalized !== "application/octet-stream") {
      return normalized === "image/jpg" ? "image/jpeg" : normalized;
    }
  }
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic" || extension === "heif") return "image/heic";
  return "image/jpeg";
}

export async function pickAndReadInvoice(): Promise<InvoiceImportDraft | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
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

  const file = new File(asset.uri);
  if (file.size > MAX_INVOICE_BYTES) {
    throw new Error("Invoice files must be 8 MB or smaller.");
  }

  const base64 = await file.base64();
  let extractedText = "";
  if (mimeType === "application/pdf") {
    // First use the embedded text layer (fast and crisp). If it is a scan, or
    // it didn't contain enough invoice fields, render pages and OCR the images.
    try {
      extractedText = await extractText(file.uri);
    } catch {
      // Scanned or unusual PDFs can have no extractable text layer.
    }
    const textFields = parseInvoiceText(extractedText);
    if (!textFields.amountCents || !textFields.date) {
      let pageUris: string[] = [];
      try {
        pageUris = await renderPdfPages(file.uri);
        for (const pageUri of pageUris) {
          try {
            extractedText += `\n${(await extractTextFromImage(pageUri)).join("\n")}`;
          } catch {
            // Continue OCR on the next page if an individual page fails.
          } finally {
            try { new File(pageUri).delete(); } catch { /* cached image cleanup is best effort */ }
          }
        }
      } catch {
        // Keep any embedded text already extracted and fall back to manual review.
      }
    }
  } else {
    try {
      extractedText = (await extractTextFromImage(file.uri)).join("\n");
    } catch {
      // OCR errors should still allow the user to attach and complete the form.
    }
  }

  const parsed = parseInvoiceText(extractedText);
  const missing: string[] = [];
  if (!parsed.amountCents) missing.push("amount");
  if (!parsed.date) missing.push("date");
  const notice = missing.length > 0
    ? `Could not read the ${missing.join(" and ")} automatically. Review the fields below; the invoice will still be attached.`
    : undefined;

  return {
    attachment: { fileName: asset.name, mimeType, base64 },
    amountCents: parsed.amountCents,
    date: parsed.date ?? todayAsISODate(),
    notice,
  };
}
