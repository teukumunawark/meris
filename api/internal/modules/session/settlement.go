package session

import (
	"math"
	"sort"
)

type Transfer struct {
	From   string  `json:"from"`
	To     string  `json:"to"`
	Amount float64 `json:"amount"`
}

type DebtNode struct {
	Name    string
	Balance float64
}

func SimplifyDebts(balances map[string]float64) []Transfer {
	var debtors []DebtNode
	var creditors []DebtNode

	for name, bal := range balances {
		bal = math.Round(bal*100) / 100
		if bal < -0.01 {
			debtors = append(debtors, DebtNode{Name: name, Balance: -bal})
		} else if bal > 0.01 {
			creditors = append(creditors, DebtNode{Name: name, Balance: bal})
		}
	}

	sort.Slice(debtors, func(i, j int) bool { return debtors[i].Balance > debtors[j].Balance })
	sort.Slice(creditors, func(i, j int) bool { return creditors[i].Balance > creditors[j].Balance })

	var transfers []Transfer
	dIdx, cIdx := 0, 0

	for dIdx < len(debtors) && cIdx < len(creditors) {
		debtor := &debtors[dIdx]
		creditor := &creditors[cIdx]

		settledAmount := math.Min(debtor.Balance, creditor.Balance)
		if settledAmount > 0.01 {
			transfers = append(transfers, Transfer{
				From:   debtor.Name,
				To:     creditor.Name,
				Amount: settledAmount,
			})
		}

		debtor.Balance -= settledAmount
		creditor.Balance -= settledAmount

		if debtor.Balance <= 0.01 {
			dIdx++
		}
		if creditor.Balance <= 0.01 {
			cIdx++
		}
	}

	return transfers
}
