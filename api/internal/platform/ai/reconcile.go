package ai

import (
	"cmp"
	"errors"
	"math"
	"slices"
	"strings"
)

var ErrUnreadableReceipt = errors.New("no readable items on the receipt")

type itemCostSource int

const (
	lineTotalAsPrinted itemCostSource = iota
	lineTotalIsActuallyUnitPrice
	unitPriceTimesQuantity
)

type taxTreatment int

const (
	taxAsMarkedByModel taxTreatment = iota
	everyTaxIncludedInPrices
	everyTaxAddedOnTop
)

type reading struct {
	itemCost                 itemCostSource
	subItemsIncludedInParent bool
	tax                      taxTreatment
	roundingSignFlipped      bool
}

func (r reading) deviationsFromModel() int {
	deviations := 0
	if r.itemCost != lineTotalAsPrinted {
		deviations++
	}
	if r.subItemsIncludedInParent {
		deviations++
	}
	if r.tax != taxAsMarkedByModel {
		deviations++
	}
	if r.roundingSignFlipped {
		deviations++
	}
	return deviations
}

var readingsClosestToModelFirst = func() []reading {
	var all []reading
	for _, itemCost := range []itemCostSource{lineTotalAsPrinted, lineTotalIsActuallyUnitPrice, unitPriceTimesQuantity} {
		for _, subItemsIncluded := range []bool{false, true} {
			for _, tax := range []taxTreatment{taxAsMarkedByModel, everyTaxIncludedInPrices, everyTaxAddedOnTop} {
				for _, roundingFlipped := range []bool{false, true} {
					all = append(all, reading{
						itemCost:                 itemCost,
						subItemsIncludedInParent: subItemsIncluded,
						tax:                      tax,
						roundingSignFlipped:      roundingFlipped,
					})
				}
			}
		}
	}
	slices.SortStableFunc(all, func(a, b reading) int {
		return cmp.Compare(a.deviationsFromModel(), b.deviationsFromModel())
	})
	return all
}()

func toleranceForRoundedTaxLines(printedAmount float64) float64 {
	return math.Max(1, 0.001*math.Abs(printedAmount))
}

func roundToCents(v float64) float64 {
	return math.Round(v*100) / 100
}

func (r *transcribedReceipt) normalize() error {
	r.MerchantName = strings.TrimSpace(r.MerchantName)

	items := r.Items[:0]
	for _, it := range r.Items {
		it.Name = strings.TrimSpace(it.Name)
		it.Quantity = max(it.Quantity, 1)
		it.UnitPrice = math.Abs(it.UnitPrice)
		it.Discount = math.Abs(it.Discount)
		if it.LineTotal == 0 && it.UnitPrice > 0 {
			it.LineTotal = it.UnitPrice * float64(it.Quantity)
		}

		discountWrittenAsItem := it.LineTotal < 0
		if discountWrittenAsItem {
			r.Charges = append(r.Charges, transcribedCharge{Label: it.Name, Kind: chargeDiscount, Amount: it.LineTotal})
			continue
		}
		if it.Name == "" && it.LineTotal == 0 {
			continue
		}

		subItems := it.SubItems[:0]
		for _, sub := range it.SubItems {
			sub.Name = strings.TrimSpace(sub.Name)
			sub.Quantity = max(sub.Quantity, 1)
			sub.LineTotal = math.Max(sub.LineTotal, 0)
			if sub.Name != "" {
				subItems = append(subItems, sub)
			}
		}
		it.SubItems = subItems
		items = append(items, it)
	}
	r.Items = items

	if !slices.ContainsFunc(r.Items, func(it transcribedItem) bool { return it.LineTotal > 0 }) {
		return ErrUnreadableReceipt
	}
	return nil
}

func (it transcribedItem) cost(rd reading) float64 {
	quantity := float64(it.Quantity)
	cost := it.LineTotal
	switch rd.itemCost {
	case lineTotalIsActuallyUnitPrice:
		cost = it.LineTotal * quantity
	case unitPriceTimesQuantity:
		if it.UnitPrice > 0 {
			cost = it.UnitPrice * quantity
		}
	}
	cost -= it.Discount

	if !rd.subItemsIncludedInParent {
		for _, sub := range it.SubItems {
			cost += sub.LineTotal
		}
	}
	return cost
}

func (sub transcribedSubItem) asFreeDescription() ExtractedItem {
	return ExtractedItem{Name: sub.Name, Quantity: sub.Quantity}
}

func (c transcribedCharge) addedOnTop(treatment taxTreatment) bool {
	switch treatment {
	case everyTaxIncludedInPrices:
		return false
	case everyTaxAddedOnTop:
		return true
	default:
		return !c.IncludedInPrices
	}
}

func (r *transcribedReceipt) build(rd reading) *ExtractedReceipt {
	out := &ExtractedReceipt{MerchantName: r.MerchantName, Items: make([]ExtractedItem, 0, len(r.Items))}

	for _, it := range r.Items {
		item := ExtractedItem{
			Name:     it.Name,
			Quantity: it.Quantity,
			Price:    roundToCents(it.cost(rd) / float64(it.Quantity)),
		}
		for _, sub := range it.SubItems {
			item.SubItems = append(item.SubItems, sub.asFreeDescription())
		}
		out.Items = append(out.Items, item)
	}

	for _, c := range r.Charges {
		switch c.Kind {
		case chargeTax:
			if c.addedOnTop(rd.tax) {
				out.Tax += math.Abs(c.Amount)
			}
		case chargeService:
			out.ServiceCharge += math.Abs(c.Amount)
		case chargeDiscount:
			out.Discount += math.Abs(c.Amount)
		case chargeRounding:
			if rd.roundingSignFlipped {
				out.OtherCharges -= c.Amount
			} else {
				out.OtherCharges += c.Amount
			}
		default:
			out.OtherCharges += c.Amount
		}
	}

	out.GrandTotal = out.itemsTotal() - out.Discount + out.Tax + out.ServiceCharge + out.OtherCharges
	return out
}

func (r *ExtractedReceipt) itemsTotal() float64 {
	var total float64
	for _, it := range r.Items {
		total += it.Price * float64(it.Quantity)
	}
	return total
}

func (r *ExtractedReceipt) adoptPrintedGrandTotal(printedGrandTotal float64) {
	roundingLostOnTaxLines := printedGrandTotal - r.GrandTotal
	r.OtherCharges = roundToCents(r.OtherCharges + roundingLostOnTaxLines)
	r.GrandTotal = printedGrandTotal
}

func (r *transcribedReceipt) reconcile() *ExtractedReceipt {
	for _, rd := range readingsClosestToModelFirst {
		candidate := r.build(rd)
		switch {
		case r.GrandTotal > 0:
			if math.Abs(r.GrandTotal-candidate.GrandTotal) <= toleranceForRoundedTaxLines(r.GrandTotal) {
				candidate.adoptPrintedGrandTotal(r.GrandTotal)
				candidate.MatchesPrintedTotal = true
				return candidate
			}
		case r.PrintedSubtotal > 0:
			if math.Abs(r.PrintedSubtotal-candidate.itemsTotal()) <= toleranceForRoundedTaxLines(r.PrintedSubtotal) {
				candidate.MatchesPrintedTotal = true
				return candidate
			}
		}
	}
	return r.build(reading{})
}
