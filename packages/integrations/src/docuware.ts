export interface DocuwareArchiveInput {
  supplierName: string;
  supplierVat: string;
  documentCode: string;
  validationStatus: string;
  validationDate: string;
  expiryDate: string | null;
}

export interface DocuwareArchiveResult {
  success: boolean;
  reference: string;
}

export interface DocuwareAdapter {
  archiveDocument(input: DocuwareArchiveInput): Promise<DocuwareArchiveResult>;
}

export function createMockDocuwareAdapter(): DocuwareAdapter {
  return {
    async archiveDocument(input) {
      return {
        success: true,
        reference: `docuware-${input.supplierVat}-${input.documentCode}`
      };
    }
  };
}
