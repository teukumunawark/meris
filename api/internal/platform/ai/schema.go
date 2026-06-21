package ai

type ExtractedItem struct {
	Name     string          `json:"name"`
	Price    float64         `json:"price"`
	Quantity int             `json:"quantity"`
	SubItems []ExtractedItem `json:"sub_items,omitempty"`
}

type ExtractedReceipt struct {
	MerchantName  string          `json:"merchant_name,omitempty"`
	Items         []ExtractedItem `json:"items"`
	Subtotal      float64         `json:"subtotal"`
	Tax           float64         `json:"tax"`
	ServiceCharge float64         `json:"service_charge"`
	GrandTotal    float64         `json:"grand_total"`
}
