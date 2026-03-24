import type { CrmAdapter, CrmContact, CrmDeal } from "./base";

export class HubSpotAdapter implements CrmAdapter {
  name = "HubSpot";
  private apiKey: string;
  private apiBase = "https://api.hubapi.com";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async createContact(contact: CrmContact): Promise<CrmContact> {
    const res = await fetch(`${this.apiBase}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        properties: {
          email: contact.email,
          firstname: contact.name?.split(" ")[0],
          lastname: contact.name?.split(" ").slice(1).join(" "),
          phone: contact.phone,
          company: contact.company,
          ...contact.customFields,
        },
      }),
    });
    const data = await res.json();
    return { ...contact, id: data.id };
  }

  async updateContact(crmId: string, contact: Partial<CrmContact>): Promise<void> {
    await fetch(`${this.apiBase}/crm/v3/objects/contacts/${crmId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({
        properties: {
          ...(contact.name && {
            firstname: contact.name.split(" ")[0],
            lastname: contact.name.split(" ").slice(1).join(" "),
          }),
          phone: contact.phone,
          ...contact.customFields,
        },
      }),
    });
  }

  async createDeal(deal: CrmDeal): Promise<CrmDeal> {
    const res = await fetch(`${this.apiBase}/crm/v3/objects/deals`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        properties: {
          dealname: deal.title,
          amount: deal.value,
          dealstage: deal.stage,
          ...(deal.expectedCloseDate && { closedate: deal.expectedCloseDate }),
        },
      }),
    });
    const data = await res.json();
    return { ...deal, id: data.id };
  }

  async updateDealStage(crmId: string, stage: string): Promise<void> {
    await fetch(`${this.apiBase}/crm/v3/objects/deals/${crmId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ properties: { dealstage: stage } }),
    });
  }

  async addNote(objectId: string, note: string): Promise<void> {
    await fetch(`${this.apiBase}/crm/v3/objects/notes`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        properties: {
          hs_note_body: note,
          hs_timestamp: Date.now(),
        },
        associations: [
          {
            to: { id: objectId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          },
        ],
      }),
    });
  }
}
