package session

import "meris-backend/internal/store/sqlc"

type ShareBreakdown struct {
	Total         float64
	Subtotal      float64
	Tax           float64
	ServiceCharge float64
	Discount      float64
	OtherCharges  float64
}

type BillCharges struct {
	Tax           float64
	ServiceCharge float64
	Discount      float64
	OtherCharges  float64
}

func chargesOf(b sqlc.Bill) BillCharges {
	return BillCharges{Tax: b.Tax, ServiceCharge: b.ServiceCharge, Discount: b.Discount, OtherCharges: b.OtherCharges}
}

func CalculateShare(personSubtotal, subtotal float64, charges BillCharges) ShareBreakdown {
	if subtotal <= 0 || personSubtotal <= 0 {
		return ShareBreakdown{}
	}
	tax := max(charges.Tax, 0)
	service := max(charges.ServiceCharge, 0)
	discount := max(charges.Discount, 0)

	proportion := personSubtotal / subtotal
	pTax := proportion * tax
	pService := proportion * service
	pDiscount := proportion * discount
	pOther := proportion * charges.OtherCharges

	return ShareBreakdown{
		Total:         personSubtotal - pDiscount + pTax + pService + pOther,
		Subtotal:      personSubtotal,
		Tax:           pTax,
		ServiceCharge: pService,
		Discount:      pDiscount,
		OtherCharges:  pOther,
	}
}
