import type { CrmAdapter, CrmContact, CrmDeal } from "./base";

export class PipedriveAdapter implements CrmAdapter {
  name = "Pipedrive";
  private apiToken: string;
  private apiBase = "https://api.pipedrive.com/v1";

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  async createContact(contact: CrmContact): Promise<CrmContact> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    const res = await fetch(`${this.apiBase}/persons?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: contact.name,
        email: contact.email ? [{ value: contact.email }] : [],
        phone: contact.phone ? [{ value: contact.phone }] : [],
        org_name: contact.company,
      }),
    });
    const data = await res.json();
    return { ...contact, id: String(data.data?.id) };
  }

  async updateContact(crmId: string, contact: Partial<CrmContact>): Promise<void> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    await fetch(`${this.apiBase}/persons/${crmId}?${params}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(contact.name && { name: contact.name }),
        ...(contact.phone && { phone: contact.phone }),
      }),
    });
  }

  async createDeal(deal: CrmDeal): Promise<CrmDeal> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    const res = await fetch(`${this.apiBase}/deals?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        ...(deal.expectedCloseDate && { close_date: deal.expectedCloseDate }),
      }),
    });
    const data = await res.json();
    return { ...deal, id: String(data.data?.id) };
  }

  async updateDealStage(crmId: string, stage: string): Promise<void> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    await fetch(`${this.apiBase}/deals/${crmId}?${params}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_id: stage }),
    });
  }

  async addNote(objectId: string, note: string): Promise<void> {
    const params = new URLSearchParams({ api_token: this.apiToken });
    await fetch(`${this.apiBase}/notes?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: note,
        pinned_to_object_ids: [objectId],
        pinned_to_object_type: "person",
      }),
    });
  }
}
