package session

type ShareBreakdown struct {
	Total         float64
	Subtotal      float64
	Tax           float64
	ServiceCharge float64
}

func CalculateShare(personSubtotal, subtotal, tax, service float64) ShareBreakdown {
	if subtotal <= 0 || personSubtotal <= 0 {
		return ShareBreakdown{}
	}
	if tax < 0 {
		tax = 0.0
	}
	if service < 0 {
		service = 0.0
	}

	proportion := personSubtotal / subtotal	
	pTax := proportion * tax
	pService := proportion * service

	return ShareBreakdown{
		Total:         personSubtotal + pTax + pService,
		Subtotal:      personSubtotal,
		Tax:           pTax,
		ServiceCharge: pService,
	}
}
