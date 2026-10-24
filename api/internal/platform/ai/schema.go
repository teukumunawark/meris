package ai

import (
	"bytes"
	"encoding/json"
)

type ExtractedItem struct {
	Name     string          `json:"name"`
	Price    float64         `json:"price"`
	Quantity int             `json:"quantity"`
	SubItems []ExtractedItem `json:"sub_items,omitempty"`
}

type ExtractedReceipt struct {
	MerchantName  string          `json:"merchant_name,omitempty"`
	Items         []ExtractedItem `json:"items"`
	Tax           float64         `json:"tax"`
	ServiceCharge float64         `json:"service_charge"`
	Discount      float64         `json:"discount"`
	OtherCharges  float64         `json:"other_charges"`
	GrandTotal    float64         `json:"grand_total"`

	MatchesPrintedTotal bool   `json:"-"`
	ExtractedByModel    string `json:"-"`
}

type transcribedReceipt struct {
	MerchantName    string              `json:"merchant_name"`
	Items           []transcribedItem   `json:"items"`
	Charges         []transcribedCharge `json:"charges"`
	PrintedSubtotal float64             `json:"printed_subtotal"`
	GrandTotal      float64             `json:"grand_total"`
}

type transcribedItem struct {
	Name      string               `json:"name"`
	Quantity  int                  `json:"quantity"`
	UnitPrice float64              `json:"unit_price"`
	LineTotal float64              `json:"line_total"`
	Discount  float64              `json:"discount"`
	SubItems  []transcribedSubItem `json:"sub_items"`
}

type transcribedSubItem struct {
	Name      string  `json:"name"`
	Quantity  int     `json:"quantity"`
	LineTotal float64 `json:"line_total"`
}

const (
	chargeTax      = "tax"
	chargeService  = "service"
	chargeDiscount = "discount"
	chargeRounding = "rounding"
	chargeOther    = "other"
)

type transcribedCharge struct {
	Label            string  `json:"label"`
	Kind             string  `json:"kind"`
	Amount           float64 `json:"amount"`
	IncludedInPrices bool    `json:"included_in_prices"`
}

type field struct {
	name   string
	schema any
}

type orderedProperties []field

func (p orderedProperties) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, f := range p {
		if i > 0 {
			buf.WriteByte(',')
		}
		key, err := json.Marshal(f.name)
		if err != nil {
			return nil, err
		}
		value, err := json.Marshal(f.schema)
		if err != nil {
			return nil, err
		}
		buf.Write(key)
		buf.WriteByte(':')
		buf.Write(value)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}

func strictObject(fields ...field) map[string]any {
	required := make([]string, len(fields))
	for i, f := range fields {
		required[i] = f.name
	}
	return map[string]any{
		"type":                 "object",
		"properties":           orderedProperties(fields),
		"required":             required,
		"additionalProperties": false,
	}
}

func arrayOf(items map[string]any) map[string]any {
	return map[string]any{"type": "array", "items": items}
}

var (
	str     = map[string]any{"type": "string"}
	num     = map[string]any{"type": "number"}
	integer = map[string]any{"type": "integer"}
	boolean = map[string]any{"type": "boolean"}
)

var transcribedReceiptSchema = strictObject(
	field{"merchant_name", str},
	field{"items", arrayOf(strictObject(
		field{"name", str},
		field{"quantity", integer},
		field{"unit_price", num},
		field{"line_total", num},
		field{"discount", num},
		field{"sub_items", arrayOf(strictObject(
			field{"name", str},
			field{"quantity", integer},
			field{"line_total", num},
		))},
	))},
	field{"charges", arrayOf(strictObject(
		field{"label", str},
		field{"kind", map[string]any{"type": "string", "enum": []string{chargeTax, chargeService, chargeDiscount, chargeRounding, chargeOther}}},
		field{"amount", num},
		field{"included_in_prices", boolean},
	))},
	field{"printed_subtotal", num},
	field{"grand_total", num},
)

const transcriptionPrompt = `Transcribe this receipt photo, usually from an Indonesian shop or restaurant, into the JSON schema.
Copy what is printed. Do not calculate, correct or balance any number: the server checks the arithmetic.

NUMBERS
- "." and "," are thousands separators: 14.000, 14,000 and Rp14.000 all mean 14000. "1.250.000,00" means 1250000.
- Output plain numbers: no separators, currency or quotes. Drop a trailing ",00" or ".00".
- If a digit is hard to read, give your best reading. Never skip a line because it is blurry.

ITEMS, one entry per purchased line, top to bottom
- name: as printed, abbreviations included (e.g. "NSI GRG SPC"). Only clean obvious OCR noise.
- quantity: the printed count, 1 if none is shown. Weights or volumes (0,5 KG) count as 1.
- line_total: the amount at the right end of the line. That is normally the total for the line: "2 x 15.000   30.000" gives 30000. If only one amount is printed, put it here.
- unit_price: the per-unit price when printed separately ("2 x 15.000", "2 @15.000", "15.000 x 2" give 15000), otherwise 0.
- The quantity and price are often on the line below the name; they still belong to that item.
- discount: a discount printed directly under this item and only for it ("Disc 10%  -2.500" gives 2500), as a positive number, otherwise 0.
- sub_items: lines under an item that are indented or start with "-", "+", ">" or "*": package contents, toppings, add-ons, notes such as "Less sugar". Give a sub-item a line_total only when it has its own printed amount, otherwise 0.
- Free items (0, "FREE", "GRATIS") are items with line_total 0.
- Leave out lines marked VOID, BATAL or CANCEL.

CHARGES, the lines between the items and the final total
- kind "tax": PB1, PPN, Pajak, Pajak Resto, Tax. included_in_prices is true when the receipt says prices already include it ("Harga sudah termasuk pajak", "incl. PB1", "PPN termasuk", or a DPP line next to it), otherwise false.
- kind "service": Service, Service Charge, Biaya Layanan.
- kind "discount": bill-wide discounts: Diskon, Disc, Promo, Voucher, Potongan, Member.
- kind "rounding": Pembulatan, Rounding.
- kind "other": Biaya Kemasan, Packaging, Ongkir, Delivery, Biaya Admin, Donasi, Tip.
- amount: as printed with its sign: negative when printed with "-" or in parentheses.
- Subtotal, Total, Total Item, Total Qty and payment lines are not charges.

TOTALS
- printed_subtotal: the Subtotal (or Sub Total) amount if printed, otherwise 0.
- grand_total: the final amount the customer had to pay: Total, Grand Total, Total Bayar, Jumlah, Tagihan. Never a payment or change line: ignore Tunai, Cash, Bayar, Kembali, Kembalian, Debit, Kredit, EDC, QRIS, OVO, GoPay, ShopeePay, DANA. 0 if not visible.
- merchant_name: the store or restaurant name in the header, not the address, NPWP or cashier. Empty string if not visible.

If the image is not a receipt or nothing is legible, return an empty items array.`
