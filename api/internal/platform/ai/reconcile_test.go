package ai

import (
	"errors"
	"testing"
)

func mustParse(t *testing.T, transcription string) *ExtractedReceipt {
	t.Helper()
	receipt, err := ParseReceipt([]byte(transcription))
	if err != nil {
		t.Fatalf("ParseReceipt: %v", err)
	}
	return receipt
}

func assertSumsToGrandTotal(t *testing.T, r *ExtractedReceipt) {
	t.Helper()
	sum := r.itemsTotal() - r.Discount + r.Tax + r.ServiceCharge + r.OtherCharges
	if diff := sum - r.GrandTotal; diff > 0.001 || diff < -0.001 {
		t.Errorf("amounts add up to %f but grand total is %f", sum, r.GrandTotal)
	}
}

func TestLineTotalIsDividedByQuantity(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"Warung Bu Tini","items":[
		{"name":"Nasi Goreng","quantity":2,"unit_price":15000,"line_total":30000,"discount":0,"sub_items":[]},
		{"name":"Es Jeruk","quantity":1,"unit_price":0,"line_total":5000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":35000,"grand_total":35000}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected the receipt to match its printed total")
	}
	if r.Items[0].Price != 15000 || r.Items[0].Quantity != 2 {
		t.Errorf("expected 2 x 15000, got %d x %f", r.Items[0].Quantity, r.Items[0].Price)
	}
	if r.MerchantName != "Warung Bu Tini" {
		t.Errorf("unexpected merchant %q", r.MerchantName)
	}
	assertSumsToGrandTotal(t, r)
}

func TestUnitPriceWrittenAsLineTotalIsCaughtByTheGrandTotal(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Es Jeruk Peras","quantity":2,"unit_price":0,"line_total":5000,"discount":0,"sub_items":[]},
		{"name":"Ayam Bakar","quantity":1,"unit_price":0,"line_total":25000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":35000,"grand_total":35000}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected the unit price reading to match the printed total")
	}
	if r.Items[0].Price != 5000 {
		t.Errorf("expected Es Jeruk at 5000 each, got %f", r.Items[0].Price)
	}
	if r.GrandTotal != 35000 {
		t.Errorf("expected the printed grand total 35000, got %f", r.GrandTotal)
	}
}

func TestMisreadPriceKeepsTheModelReadingAndIsFlagged(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Kopi Susu","quantity":1,"unit_price":0,"line_total":28000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":0,"grand_total":23000}`)

	if r.MatchesPrintedTotal {
		t.Fatal("a misread price must not be reported as matching")
	}
	if r.Items[0].Price != 28000 || r.GrandTotal != 28000 {
		t.Errorf("expected the model's own reading to be kept, got price %f total %f", r.Items[0].Price, r.GrandTotal)
	}
}

func TestTaxIncludedInPricesIsNotAddedAgain(t *testing.T) {
	for name, includedFlag := range map[string]string{"marked by the model": "true", "missed by the model": "false"} {
		t.Run(name, func(t *testing.T) {
			r := mustParse(t, `{"merchant_name":"","items":[
				{"name":"Mie Ayam","quantity":2,"unit_price":0,"line_total":44000,"discount":0,"sub_items":[]}
			],"charges":[{"label":"PB1 10% (incl)","kind":"tax","amount":4000,"included_in_prices":`+includedFlag+`}],
			"printed_subtotal":44000,"grand_total":44000}`)

			if !r.MatchesPrintedTotal {
				t.Fatal("expected a match")
			}
			if r.Tax != 0 {
				t.Errorf("tax included in prices must not be charged again, got %f", r.Tax)
			}
			assertSumsToGrandTotal(t, r)
		})
	}
}

func TestTaxAndServiceAddedOnTop(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Steak","quantity":1,"unit_price":0,"line_total":100000,"discount":0,"sub_items":[]}
	],"charges":[
		{"label":"Service 5%","kind":"service","amount":5000,"included_in_prices":false},
		{"label":"PB1 10%","kind":"tax","amount":10500,"included_in_prices":true}
	],"printed_subtotal":100000,"grand_total":115500}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected a match")
	}
	if r.Tax != 10500 || r.ServiceCharge != 5000 {
		t.Errorf("expected tax 10500 and service 5000, got %f and %f", r.Tax, r.ServiceCharge)
	}
}

func TestTaxRoundedToTheRupiahKeepsThePrintedTotal(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Roti Bakar","quantity":1,"unit_price":0,"line_total":12345,"discount":0,"sub_items":[]}
	],"charges":[{"label":"PPN 11%","kind":"tax","amount":1358,"included_in_prices":false}],
	"printed_subtotal":12345,"grand_total":13704}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("a one rupiah rounding gap should still match")
	}
	if r.GrandTotal != 13704 {
		t.Errorf("expected the printed total 13704, got %f", r.GrandTotal)
	}
	assertSumsToGrandTotal(t, r)
}

func TestBillDiscountAndRounding(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Pizza","quantity":1,"unit_price":0,"line_total":120000,"discount":0,"sub_items":[]},
		{"name":"Cola","quantity":2,"unit_price":0,"line_total":30000,"discount":0,"sub_items":[]}
	],"charges":[
		{"label":"Voucher","kind":"discount","amount":-20000,"included_in_prices":false},
		{"label":"PB1","kind":"tax","amount":13000,"included_in_prices":false},
		{"label":"Biaya Kemasan","kind":"other","amount":2000,"included_in_prices":false},
		{"label":"Pembulatan","kind":"rounding","amount":-500,"included_in_prices":false}
	],"printed_subtotal":150000,"grand_total":144500}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected a match")
	}
	if r.Discount != 20000 {
		t.Errorf("expected discount 20000, got %f", r.Discount)
	}
	if r.OtherCharges != 1500 {
		t.Errorf("expected packaging minus rounding to be 1500, got %f", r.OtherCharges)
	}
	assertSumsToGrandTotal(t, r)
}

func TestRoundingTranscribedWithTheWrongSign(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Bakso","quantity":1,"unit_price":0,"line_total":18300,"discount":0,"sub_items":[]}
	],"charges":[{"label":"Pembulatan","kind":"rounding","amount":300,"included_in_prices":false}],
	"printed_subtotal":18300,"grand_total":18000}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected a match after flipping the rounding sign")
	}
	if r.OtherCharges != -300 {
		t.Errorf("expected rounding of -300, got %f", r.OtherCharges)
	}
}

func TestDiscountWrittenAsNegativeItemBecomesBillDiscount(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Burger","quantity":1,"unit_price":0,"line_total":50000,"discount":0,"sub_items":[]},
		{"name":"Fries","quantity":1,"unit_price":0,"line_total":20000,"discount":0,"sub_items":[]},
		{"name":"Promo Member","quantity":1,"unit_price":0,"line_total":-10000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":70000,"grand_total":60000}`)

	if len(r.Items) != 2 {
		t.Fatalf("expected the discount line to leave the items, got %d items", len(r.Items))
	}
	if r.Discount != 10000 || !r.MatchesPrintedTotal {
		t.Errorf("expected a matching bill discount of 10000, got %f (match %v)", r.Discount, r.MatchesPrintedTotal)
	}
}

func TestItemDiscountReducesThatItemOnly(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Kopi Aren","quantity":2,"unit_price":20000,"line_total":40000,"discount":4000,"sub_items":[]},
		{"name":"Croissant","quantity":1,"unit_price":0,"line_total":25000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":61000,"grand_total":61000}`)

	if r.Items[0].Price != 18000 {
		t.Errorf("expected Kopi Aren at 18000 after its discount, got %f", r.Items[0].Price)
	}
	if r.Items[1].Price != 25000 || r.Discount != 0 {
		t.Errorf("the item discount must not spread to other items")
	}
}

func TestPricedAddOnIsFoldedIntoItsParent(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Es Kopi Susu","quantity":1,"unit_price":0,"line_total":25000,"discount":0,"sub_items":[
			{"name":"Extra Shot","quantity":1,"line_total":5000},
			{"name":"Less Sugar","quantity":1,"line_total":0}
		]}
	],"charges":[],"printed_subtotal":30000,"grand_total":30000}`)

	parent := r.Items[0]
	if parent.Price != 30000 {
		t.Errorf("expected the add-on inside the parent price, got %f", parent.Price)
	}
	if len(parent.SubItems) != 2 || parent.SubItems[0].Price != 0 || parent.SubItems[1].Price != 0 {
		t.Errorf("sub-items should stay as free descriptions: %+v", parent.SubItems)
	}
}

func TestPackageContentsAlreadyInParentPriceAreNotCountedTwice(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Paket Hemat","quantity":1,"unit_price":0,"line_total":45000,"discount":0,"sub_items":[
			{"name":"Nasi","quantity":1,"line_total":5000},
			{"name":"Ayam Geprek","quantity":1,"line_total":40000}
		]}
	],"charges":[],"printed_subtotal":45000,"grand_total":45000}`)

	if !r.MatchesPrintedTotal || r.Items[0].Price != 45000 {
		t.Errorf("expected the package at 45000, got %f (match %v)", r.Items[0].Price, r.MatchesPrintedTotal)
	}
}

func TestSubtotalIsUsedWhenTheTotalIsCutOff(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Sate Ayam","quantity":1,"unit_price":0,"line_total":30000,"discount":0,"sub_items":[]}
	],"charges":[{"label":"PB1","kind":"tax","amount":3000,"included_in_prices":false}],
	"printed_subtotal":30000,"grand_total":0}`)

	if !r.MatchesPrintedTotal {
		t.Fatal("expected the printed subtotal to confirm the items")
	}
	if r.GrandTotal != 33000 {
		t.Errorf("expected a computed total of 33000, got %f", r.GrandTotal)
	}
}

func TestMissingQuantityCountsAsOne(t *testing.T) {
	r := mustParse(t, `{"merchant_name":"","items":[
		{"name":"Air Mineral","quantity":0,"unit_price":0,"line_total":7000,"discount":0,"sub_items":[]}
	],"charges":[],"printed_subtotal":0,"grand_total":7000}`)

	if r.Items[0].Quantity != 1 || r.Items[0].Price != 7000 {
		t.Errorf("expected 1 x 7000, got %d x %f", r.Items[0].Quantity, r.Items[0].Price)
	}
}

func TestUnreadableReceipts(t *testing.T) {
	cases := map[string]string{
		"no items":        `{"merchant_name":"","items":[],"charges":[],"printed_subtotal":0,"grand_total":0}`,
		"only free items": `{"merchant_name":"","items":[{"name":"Air Putih","quantity":1,"unit_price":0,"line_total":0,"discount":0,"sub_items":[]}],"charges":[],"printed_subtotal":0,"grand_total":0}`,
		"only a discount": `{"merchant_name":"","items":[{"name":"Diskon","quantity":1,"unit_price":0,"line_total":-5000,"discount":0,"sub_items":[]}],"charges":[],"printed_subtotal":0,"grand_total":0}`,
	}
	for name, transcription := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseReceipt([]byte(transcription)); !errors.Is(err, ErrUnreadableReceipt) {
				t.Errorf("expected ErrUnreadableReceipt, got %v", err)
			}
		})
	}
}

func TestFencedJSONStillParses(t *testing.T) {
	r := mustParse(t, "```json\n"+`{"merchant_name":"","items":[{"name":"Soto","quantity":1,"unit_price":0,"line_total":20000,"discount":0,"sub_items":[]}],"charges":[],"printed_subtotal":0,"grand_total":20000}`+"\n```")
	if r.Items[0].Price != 20000 {
		t.Errorf("unexpected price %f", r.Items[0].Price)
	}
}

func TestInvalidJSON(t *testing.T) {
	if _, err := ParseReceipt([]byte("not json")); !errors.Is(err, ErrInvalidJSON) {
		t.Errorf("expected ErrInvalidJSON, got %v", err)
	}
}
