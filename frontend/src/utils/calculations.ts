export interface ParticipantClaim {
  name: string;
  shares: number;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
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

/**
 * Calculates individual proportional share breakdown for each participant.
 */
export function calculateParticipantBreakdowns(
  participants: string[],
  items: ReceiptItem[],
  totalSubtotal: number,
  tax: number,
  serviceCharge: number
): ParticipantBreakdown[] {
  return participants.map((name) => {
    const personSubtotal = items.reduce((sum, item) => {
      const userClaim = item.claims.find((c) => c.name === name);
      const shares = userClaim?.shares ?? 0;
      return sum + item.price * shares;
    }, 0);

    const proportion = totalSubtotal > 0 ? personSubtotal / totalSubtotal : 0;
    const personTax = proportion * tax;
    const personService = proportion * serviceCharge;
    const personTotal = personSubtotal + personTax + personService;

    // Filter and map claimed items safely
    const claimedItems = items
      .filter((item) => item.claims.some((c) => c.name === name))
      .map((item) => {
        const claim = item.claims.find((c) => c.name === name);
        const shares = claim?.shares ?? 0;
        return {
          name: item.name,
          shares,
          price: item.price,
          totalPrice: item.price * shares,
        };
      });

    return {
      name,
      subtotal: personSubtotal,
      tax: personTax,
      serviceCharge: personService,
      total: personTotal,
      claimedItems,
    };
  });
}
