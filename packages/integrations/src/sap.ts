export interface SapCreateSupplierInput {
  caseId: string;
  supplierVat: string;
  supplierName: string;
}

export interface SapComplianceInput {
  supplierVat: string;
  reason: string;
}

export interface SapResult {
  success: boolean;
  reference: string;
  message: string;
}

export interface SapAdapter {
  createSupplier(input: SapCreateSupplierInput): Promise<SapResult>;
  blockSupplier(input: SapComplianceInput): Promise<SapResult>;
  unblockSupplier(input: SapComplianceInput): Promise<SapResult>;
}

export function createMockSapAdapter(): SapAdapter {
  return {
    async createSupplier(input) {
      return {
        success: true,
        reference: `sap-create-${input.caseId}`,
        message: "Supplier creation accepted by mock SAP adapter"
      };
    },
    async blockSupplier(input) {
      return {
        success: true,
        reference: `sap-block-${input.supplierVat}`,
        message: "Supplier block accepted by mock SAP adapter"
      };
    },
    async unblockSupplier(input) {
      return {
        success: true,
        reference: `sap-unblock-${input.supplierVat}`,
        message: "Supplier unblock accepted by mock SAP adapter"
      };
    }
  };
}
