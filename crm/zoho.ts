import type { CrmAdapter, CrmContact, CrmDeal } from "./base";

export class ZohoAdapter implements CrmAdapter {
  name = "Zoho";
  private apiKey: string;
  private datacenter: string;
  private apiBase: string;

  constructor(apiKey: string, datacenter = "com") {
    this.apiKey = apiKey;
    this.datacenter = datacenter;
    this.apiBase = `https://www.zohoapis.${datacenter}`;
  }

  async createContact(contact: CrmContact): Promise<CrmContact> {
    // Zoho CRM REST API — would use refresh token OAuth flow in production
    const res = await fetch(`${this.apiBase}/crm/v3/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            Email: contact.email,
            Full_Name: contact.name,
            Phone: contact.phone,
            Company: contact.company,
          },
        ],
      }),
    });
    const data = await res.json();
    return { ...contact, id: data.data?.[0]?.details?.id };
  }

  async updateContact(crmId: string, contact: Partial<CrmContact>): Promise<void> {
    await fetch(`${this.apiBase}/crm/v3/contacts/${crmId}`, {
      method: "PUT",
      headers: {
        Authorization: `Zoho-oauthtoken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [{ ...contact }] }),
    });
  }

  async createDeal(deal: CrmDeal): Promise<CrmDeal> {
    const res = await fetch(`${this.apiBase}/crm/v3/deals`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            Deal_Name: deal.title,
            Amount: deal.value,
            Stage: deal.stage,
            Closing_Date: deal.expectedCloseDate,
          },
        ],
      }),
    });
    const data = await res.json();
    return { ...deal, id: data.data?.[0]?.details?.id };
  }

  async updateDealStage(crmId: string, stage: string): Promise<void> {
    await fetch(`${this.apiBase}/crm/v3/deals/${crmId}`, {
      method: "PUT",
      headers: {
        Authorization: `Zoho-oauthtoken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: [{ Stage: stage }] }),
    });
  }

  async addNote(objectId: string, note: string): Promise<void> {
    // Zoho notes attach to contacts/deals via separate endpoint
    await fetch(`${this.apiBase}/crm/v3/notes`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [
          {
            Parent_Id: objectId,
            Note_Content: note,
          },
        ],
      }),
    });
  }
}
