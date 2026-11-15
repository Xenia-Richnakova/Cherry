export type InvoiceAttachmentDraft = {
  fileName: string;
  mimeType: string;
  base64: string;
};

export type InvoiceImportDraft = {
  attachment: InvoiceAttachmentDraft;
  amountCents?: number;
  date?: string;
  notice?: string;
};
