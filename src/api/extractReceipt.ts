import { z } from 'zod';
import { createEndpoint, Expenses, ZiteError } from 'zite-integrations-backend-sdk';
import OpenAI from 'openai';
import { MAX_PDF_BYTES } from '../lib/validation';
import { validateFileUrl, safeFetch } from '../lib/urlValidation';

const VALID_CATEGORIES = ['Cleaning Supplies', 'Equipment', 'Fuel', 'Parking', 'Vehicle', 'Insurance', 'Marketing', 'Printing', 'Uniform', 'Software', 'Phone', 'Bank Fees', 'Professional Fees', 'Staff Payment', 'Refund', 'Other'];
const VALID_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Other'];
const VALID_DOC_TYPES = ['Receipt', 'Invoice', 'Credit Note', 'Other'];

function round2(n: number): number { return Math.round(n * 100) / 100; }

// SEC-002: Generic user-facing error messages
const GENERIC_EXTRACTION_ERROR = 'Receipt extraction failed. Please enter details manually.';
const GENERIC_PDF_ERROR = 'Unable to process the uploaded receipt. Please try a different file or enter details manually.';

export default createEndpoint({
  authenticated: true,
  description: 'Extract data from a receipt/invoice image or PDF using OpenAI vision',
  inputSchema: z.object({
    fileUrl: z.string().min(1),
    isPdf: z.boolean().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.object({
      supplier: z.string(),
      expenseDate: z.string(),
      documentType: z.string(),
      documentNumber: z.string(),
      documentNumberConfidence: z.string().optional(),
      subtotal: z.number(),
      vatAmount: z.number(),
      amount: z.number(),
      currency: z.string(),
      category: z.string(),
      paymentMethod: z.string(),
      description: z.string(),
    }),
    confidence: z.number(),
    notes: z.string(),
    warnings: z.array(z.string()),
    error: z.string().optional(),
  }),
  execute: async ({ input, context }) => {
    if (context.user.role !== 'Admin' || !context.user.active) {
      throw new ZiteError({ code: 'FORBIDDEN', message: 'Access denied — Admin only' });
    }

    const emptyResult = {
      success: false,
      data: { supplier: '', expenseDate: '', documentType: '', documentNumber: '', documentNumberConfidence: 'none' as const, subtotal: 0, vatAmount: 0, amount: 0, currency: '', category: '', paymentMethod: '', description: '' },
      confidence: 0,
      notes: '',
      warnings: [],
    };

    // ─── SEC-001: URL validation (SSRF protection) ───────────────
    const urlCheck = validateFileUrl(input.fileUrl);
    if (!urlCheck.valid) {
      console.warn('[extractReceipt] SEC-001 URL rejected:', urlCheck.reason, 'URL:', input.fileUrl);
      return { ...emptyResult, error: 'The file URL is not valid. Please upload a receipt through the app.', warnings: ['URL validation failed'] };
    }

    // SEC-001: Ownership is enforced by the hostname allowlist (only URLs from
    // the app's own upload CDN pass validation) combined with the authenticated
    // endpoint guard. The previous orphan-URL check that required the URL to
    // already be linked to an Expense record was removed because the Receipt
    // Scanner workflow legitimately calls extraction BEFORE saving the expense.

    const client = new OpenAI({ apiKey: process.env.ZITE_OPENAI_ACCESS_TOKEN });

    const systemPrompt = `You are a UK-based expense document data extractor for a cleaning business called ACHU. You will receive an image of a receipt, invoice, or credit note.

Extract ONLY information that is clearly visible on the document. Do NOT guess or invent any values.

Return a JSON object with these fields:
- supplier: string — the company/business name on the document. Empty string if not visible.
- expenseDate: string — the date in YYYY-MM-DD format. Use UK date interpretation (DD/MM/YYYY). Empty string if not visible.
- documentType: one of "Receipt", "Invoice", "Credit Note", "Other". Empty string if uncertain.
- documentNumber: string — CRITICAL RULES FOR THIS FIELD:
  1. ONLY extract a value that appears directly next to one of these labels: "Invoice Number", "Invoice No", "Invoice No.", "Invoice #", "Inv No", "Receipt Number", "Receipt No", "Receipt #", "Document Number", "Doc No", "Credit Note Number", "Reference Number", "Ref No".
  2. Copy the value EXACTLY digit-by-digit and character-by-character as it appears on the document. Do NOT rearrange, transpose, or approximate digits.
  3. NEVER use values labelled as: Customer Number, Customer No, Account Number, Account No, Account Code, Order Number, Order No, Purchase Order, PO Number, Telephone, Phone, Fax, VAT Number, VAT Reg, Company Registration, Sort Code, Transaction ID, Authorisation Code, Auth Code, Till Number, Store Number, Terminal ID, Payment Reference, Delivery Note.
  4. If the document contains an "Invoice Number" or "Invoice No" field, that takes priority over all other identifiers.
  5. If you cannot confidently identify which number is the document number, leave this field EMPTY. Do not guess.
  6. Read each digit carefully — transposing even one digit makes the number useless.
- documentNumberConfidence: one of "high", "medium", "low", "none".
  "high" = value appears directly next to a clear label like "Invoice No:" and you can read every character with certainty.
  "medium" = a plausible candidate found but labelling is partially obscured or ambiguous.
  "low" = only a guess, the label is unclear or missing. ALWAYS leave documentNumber empty when confidence is "low".
  "none" = no document number found. Leave documentNumber empty.
- documentNumberLabel: string — the EXACT label text next to the document number on the document (e.g. "Invoice No:", "Receipt #"), copied verbatim. Empty string if not found.
- subtotal: number — pre-tax subtotal. Use 0 if the value shown is genuinely zero. Use null ONLY if the field is not visible at all.
- vatAmount: number — VAT/tax amount. Use 0 if explicitly shown as zero. Use null ONLY if not shown. Do NOT calculate or invent VAT.
- amount: number — final total amount paid or payable. Use 0 if genuinely zero. Use null ONLY if not visible. This is the most important number.
- currency: string — e.g. "GBP", "EUR", "USD". Empty string if not visible. Default to "GBP" only if £ symbol is shown.
- category: one of these EXACT values only: ${VALID_CATEGORIES.map(c => `"${c}"`).join(', ')}. Empty string if uncertain or if you cannot confidently match the items to a category. Do NOT default to "Other" — leave empty instead.
- paymentMethod: one of "Card", "Cash", "Bank Transfer", "Other". Empty string if not clearly shown on the document.
- description: string — brief summary of items/services purchased. Empty string if not visible. Keep under 200 characters.
- confidence: number — 0 to 100 representing your overall confidence in the extraction accuracy.
  CONFIDENCE RULES:
  - Cap at 85 max if any material field (supplier, date, total, document number) is uncertain.
  - Cap at 75 max if document number confidence is "medium".
  - Cap at 60 max if document number confidence is "low" or "none" and a document number was expected (i.e. it's an invoice or receipt).
  - Reduce further when: totals don't add up, date format is unclear, text is partially obscured, or multiple plausible values exist.
- warnings: string[] — list of specific warnings. Be specific, e.g. "Date was partially obscured", "VAT not shown on document", "Multiple possible document numbers found: INV-123 and REF-456".

Rules:
- Round all monetary values to exactly 2 decimal places.
- Treat numeric 0 as a valid value — it means the field IS visible and shows zero. Only use null for fields genuinely not present.
- If a date is ambiguous between DD/MM and MM/DD, use UK format (DD/MM/YYYY).
- If you cannot read a field clearly, leave it empty/null rather than guessing.
- The "amount" should be the final total (the number the customer paid or owes), not the subtotal.
- Only set paymentMethod if it is explicitly shown on the document (e.g. "Paid by card", "CASH").
- Only use the category values listed above. If nothing matches well, use empty string — NOT "Other".

Return ONLY valid JSON, no markdown, no explanation.`;

    // ─── Build content parts: handle PDF vs image differently ───
    // ACHU-013: Never send PDFs as image_url. Use the file content type instead.
    let userContent: any[];
    let pdfWarning = '';

    if (input.isPdf) {
      // PDF: fetch the file and send using OpenAI file input (not image_url)
      try {
        // SEC-001: Use safeFetch with redirect protection
        const pdfResponse = await safeFetch(urlCheck.parsedUrl);
        if (!pdfResponse.ok) {
          console.error('[extractReceipt] PDF download failed, HTTP status:', pdfResponse.status);
          return { ...emptyResult, error: GENERIC_PDF_ERROR, warnings: ['PDF download failed'] };
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);

        // ACHU-021: Check file size accounting for base64 expansion (~1.37x) + JSON overhead
        if (pdfBytes.length > MAX_PDF_BYTES) {
          const sizeMB = (pdfBytes.length / (1024 * 1024)).toFixed(1);
          const limitMB = Math.floor(MAX_PDF_BYTES / (1024 * 1024));
          return {
            ...emptyResult,
            error: `PDF file is too large (${sizeMB} MB). Maximum supported size is ${limitMB} MB. Please enter details manually.`,
            warnings: ['PDF exceeds size limit'],
          };
        }

        // Convert to base64
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);
        const dataUrl = `data:application/pdf;base64,${base64}`;

        // ACHU-013: Use 'file' content type — never 'image_url' for PDFs
        userContent = [
          { type: 'text', text: 'Extract all available information from this PDF document. If it has multiple pages, examine all pages for relevant information. Follow the extraction rules precisely.' },
          { type: 'file', file: { filename: 'document.pdf', file_data: dataUrl } },
        ];
        pdfWarning = 'Document processed as PDF.';
      } catch (fetchErr: any) {
        // SEC-002: Log full error, return generic message
        console.error('[extractReceipt] PDF fetch/processing error:', fetchErr?.message, fetchErr?.stack);
        return { ...emptyResult, error: GENERIC_PDF_ERROR, warnings: ['PDF processing failed'] };
      }
    } else {
      // Image: use image_url directly (existing working flow)
      userContent = [
        { type: 'text', text: 'Extract all available information from this document. Follow the extraction rules precisely.' },
        { type: 'image_url', image_url: { url: input.fileUrl, detail: 'high' } },
      ];
    }

    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.1,
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return { ...emptyResult, error: GENERIC_EXTRACTION_ERROR, warnings: ['AI returned empty response'] };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        // SEC-002: Log details, return generic message
        console.error('[extractReceipt] JSON parse error:', (parseErr as Error)?.message, 'Raw:', raw.slice(0, 200));
        return { ...emptyResult, error: GENERIC_EXTRACTION_ERROR, warnings: ['Could not parse AI response'] };
      }

      // Sanitize and validate each field
      const supplier = typeof parsed.supplier === 'string' ? parsed.supplier.trim() : '';
      let expenseDate = typeof parsed.expenseDate === 'string' ? parsed.expenseDate.trim() : '';
      if (expenseDate && !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) expenseDate = '';

      let documentType = typeof parsed.documentType === 'string' ? parsed.documentType.trim() : '';
      if (documentType && !VALID_DOC_TYPES.includes(documentType)) documentType = '';

      // ACHU-014B: Deterministic document number validation
      let documentNumber = typeof parsed.documentNumber === 'string' ? parsed.documentNumber.trim() : '';
      const docNumConfidence = typeof parsed.documentNumberConfidence === 'string' ? parsed.documentNumberConfidence.trim().toLowerCase() : 'none';
      const docNumLabel = typeof parsed.documentNumberLabel === 'string' ? parsed.documentNumberLabel.trim() : '';

      // ACHU-014: Strict document number validation
      let documentNumberConfidence: string = docNumConfidence;
      if (documentNumber) {
        // Validate: must have a recognized label and at least medium confidence
        const validLabels = /invoice\s*(no|number|#|num|\.)|receipt\s*(no|number|#|num|\.)|document\s*(no|number|#)|credit\s*note\s*(no|number|#)|ref(erence)?\s*(no|number|#)/i;
        const hasValidLabel = validLabels.test(docNumLabel);

        // Reject identifiers that look like phone numbers, account numbers etc.
        const looksLikePhone = /^[\+]?\d[\d\s\-]{8,}$/.test(documentNumber) && /[\s\-]/.test(documentNumber);
        const looksLikeAccount = /account|customer|order|tel|phone|fax|vat\s*reg|sort\s*code/i.test(docNumLabel);

        if (docNumConfidence === 'low' || docNumConfidence === 'none') {
          documentNumber = '';
          documentNumberConfidence = 'rejected';
        } else if (looksLikeAccount || looksLikePhone) {
          documentNumber = '';
          documentNumberConfidence = 'rejected';
        } else if (docNumConfidence === 'medium' && !hasValidLabel) {
          documentNumber = '';
          documentNumberConfidence = 'rejected';
        }
        // high confidence with valid label → keep
        // medium confidence with valid label → keep but warn
      }

      // ACHU-014A: Treat 0 as valid — use ?? not ||
      const subtotal = typeof parsed.subtotal === 'number' && parsed.subtotal >= 0 ? round2(parsed.subtotal) : 0;
      const vatAmount = typeof parsed.vatAmount === 'number' && parsed.vatAmount >= 0 ? round2(parsed.vatAmount) : 0;
      const amount = typeof parsed.amount === 'number' && parsed.amount >= 0 ? round2(parsed.amount) : 0;

      const currency = typeof parsed.currency === 'string' ? parsed.currency.trim().toUpperCase() : '';

      // ACHU-022: Never default unknown categories to "Other" — leave empty
      let category = typeof parsed.category === 'string' ? parsed.category.trim() : '';
      if (category && !VALID_CATEGORIES.includes(category)) category = '';
      // If AI returns "Other", treat as uncertain — leave empty for manual selection
      if (category === 'Other') category = '';

      let paymentMethod = typeof parsed.paymentMethod === 'string' ? parsed.paymentMethod.trim() : '';
      if (paymentMethod && !VALID_METHODS.includes(paymentMethod)) paymentMethod = '';

      const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 200) : '';

      let confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.confidence))) : 50;

      const rawWarnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((w: unknown) => typeof w === 'string') : [];

      // Add our own warnings for missing critical fields
      const warnings: string[] = [...rawWarnings];
      if (pdfWarning) warnings.push(pdfWarning);
      if (!supplier) warnings.push('Supplier could not be read from document');
      if (!expenseDate) warnings.push('Date could not be read from document');
      if (parsed.amount === null || parsed.amount === undefined) warnings.push('Total amount could not be read from document');
      if ((parsed.vatAmount === null || parsed.vatAmount === undefined) && subtotal > 0) warnings.push('VAT not shown — only subtotal was found');

      // ACHU-014B: Warn about document number rejection
      if (documentNumberConfidence === 'rejected') {
        const originalDocNum = typeof parsed.documentNumber === 'string' ? parsed.documentNumber.trim() : '';
        if (originalDocNum) {
          warnings.push(`Document number "${originalDocNum}" was not accepted — confidence too low or label not validated. Please enter manually.`);
        }
      } else if (docNumConfidence === 'medium' && documentNumber) {
        warnings.push(`Document number "${documentNumber}" has medium confidence (label: "${docNumLabel || 'unknown'}"). Please verify.`);
      }

      // Consistency check
      if (subtotal > 0 && vatAmount > 0 && amount > 0) {
        const diff = Math.abs((subtotal + vatAmount) - amount);
        if (diff > 0.05) {
          warnings.push(`Subtotal (${subtotal.toFixed(2)}) + VAT (${vatAmount.toFixed(2)}) = ${(subtotal + vatAmount).toFixed(2)} does not match total (${amount.toFixed(2)})`);
          confidence = Math.min(confidence, 70);
        }
      }

      // ACHU-014: Cap confidence based on document number quality
      if (documentNumberConfidence === 'rejected') confidence = Math.min(confidence, 70);
      if (docNumConfidence === 'medium' && documentNumber) confidence = Math.min(confidence, 75);

      // Cap confidence if critical fields are missing
      if (!supplier || !expenseDate) confidence = Math.min(confidence, 60);
      if (parsed.amount === null || parsed.amount === undefined) confidence = Math.min(confidence, 40);

      const notesArr: string[] = [];
      if (confidence < 60) notesArr.push('Low confidence extraction — please review all fields carefully.');
      if (warnings.length > 0) notesArr.push(`${warnings.length} warning(s): ${warnings.join('; ')}`);

      return {
        success: true,
        data: { supplier, expenseDate, documentType, documentNumber, documentNumberConfidence, subtotal, vatAmount, amount, currency, category, paymentMethod, description },
        confidence,
        notes: notesArr.join(' '),
        warnings,
      };
    } catch (e: any) {
      // SEC-002: Log full diagnostic info, return only generic message to client
      console.error('[extractReceipt] Extraction error — message:', e?.message, '| status:', e?.status, '| code:', e?.code, '| stack:', e?.stack);

      if (input.isPdf) {
        return { ...emptyResult, error: GENERIC_PDF_ERROR, warnings: ['PDF extraction failed'] };
      }
      return { ...emptyResult, error: GENERIC_EXTRACTION_ERROR, warnings: ['Extraction failed'] };
    }
  },
});
