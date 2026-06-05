import {ParticipantBreakdown, ReceiptItem} from "@/types";

export function calculateParticipantBreakdowns(
  participants: string[],
  items: ReceiptItem[],
  totalSubtotal: number,
  tax: number,
  serviceCharge: number
): ParticipantBreakdown[] {
  if (participants.length === 0) return [];

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

  let remainingTax = tax;
  let remainingService = serviceCharge;

  const largestSpenderIndex = rawBreakdowns.reduce(
    (maxIdx, p, idx, arr) => (p.subtotal > arr[maxIdx].subtotal ? idx : maxIdx),
    0
  );

  const finalBreakdowns = rawBreakdowns.map((p, idx) => {
    const proportion = totalSubtotal > 0 ? p.subtotal / totalSubtotal : 0;
    
    let pTax = 0;
    let pService = 0;

    if (idx === largestSpenderIndex) {
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
