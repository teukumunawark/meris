export interface ParticipantClaim {
  name: string;
  shares: number;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  parentId?: string;
  billId?: string;
  claims: ParticipantClaim[];
}
