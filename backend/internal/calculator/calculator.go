package calculator

// CalculateShare calculates a person's individual share of the total bill,
// including a proportional amount of the tax and service charges based on their subtotal.
//
// If subtotal is zero or negative, or if the person's subtotal is negative,
// it returns 0.0 to prevent division by zero and handle invalid inputs cleanly.
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
