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
 * Uses a remainder-distribution strategy to ensure the sum of all breakdowns
 * exactly matches the receipt's grand total (avoiding rounding errors).
 */
export function calculateParticipantBreakdowns(
  participants: string[],
  items: ReceiptItem[],
  totalSubtotal: number,
  tax: number,
  serviceCharge: number
): ParticipantBreakdown[] {
  if (participants.length === 0) return [];

  // 1. Calculate base subtotal for everyone
  const rawBreakdowns = participants.map((name) => {
    const personSubtotal = items.reduce((sum, item) => {
      const userClaim = item.claims.find((c) => c.name === name);
      const shares = userClaim?.shares ?? 0;
      return sum + item.price * shares;
    }, 0);

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
      claimedItems,
    };
  });

  // 2. Proportional distribution with rounding
  let remainingTax = tax;
  let remainingService = serviceCharge;

  // Identify the person with the largest subtotal to receive the rounding remainder
  const largestSpenderIndex = rawBreakdowns.reduce(
    (maxIdx, p, idx, arr) => (p.subtotal > arr[maxIdx].subtotal ? idx : maxIdx),
    0
  );

  const finalBreakdowns = rawBreakdowns.map((p, idx) => {
    const proportion = totalSubtotal > 0 ? p.subtotal / totalSubtotal : 0;
    
    let pTax = 0;
    let pService = 0;

    if (idx === largestSpenderIndex) {
      // This person will be handled at the end to take the remainder
      return { ...p, proportion };
    } else {
      pTax = Math.round(proportion * tax);
      pService = Math.round(proportion * serviceCharge);
      remainingTax -= pTax;
      remainingService -= pService;

      return {
        ...p,
        tax: pTax,
        serviceCharge: pService,
        total: p.subtotal + pTax + pService,
      };
    }
  });

  // 3. Assign remainder to the largest spender
  const spender = rawBreakdowns[largestSpenderIndex];
  const spenderTax = Math.max(0, remainingTax);
  const spenderService = Math.max(0, remainingService);

  finalBreakdowns[largestSpenderIndex] = {
    ...spender,
    tax: spenderTax,
    serviceCharge: spenderService,
    total: spender.subtotal + spenderTax + spenderService,
  } as ParticipantBreakdown;

  return finalBreakdowns as ParticipantBreakdown[];
}
