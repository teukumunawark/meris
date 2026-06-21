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

export interface ParticipantBreakdown {
  name: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  claimedItems: Array<{
    name: string;
    shares: number;
    price: number;
    totalPrice: number;
  }>;
}
