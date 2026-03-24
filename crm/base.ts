// Base CRM adapter interface — each CRM implements this

export interface CrmContact {
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  company?: string;
  leadStage?: string;
  notes?: string;
  customFields?: Record<string, string>;
}

export interface CrmDeal {
  id?: string;
  title: string;
  value?: number;
  currency?: string;
  stage: string;
  contactId?: string;
  expectedCloseDate?: string;
}

export interface CrmAdapter {
  name: string;
  createContact(contact: CrmContact): Promise<CrmContact>;
  updateContact(crmId: string, contact: Partial<CrmContact>): Promise<void>;
  createDeal(deal: CrmDeal): Promise<CrmDeal>;
  updateDealStage(crmId: string, stage: string): Promise<void>;
  addNote(objectId: string, note: string): Promise<void>;
}
