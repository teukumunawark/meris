package calculator

func CalculateShare(personSubtotal, subtotal, tax, service float64) float64 {
	if subtotal <= 0 || personSubtotal <= 0 {
		return 0.0
	}
	if tax < 0 {
		tax = 0.0
	}
	if service < 0 {
		service = 0.0
	}

	proportion := personSubtotal / subtotal
	return personSubtotal + proportion*(tax+service)
}
