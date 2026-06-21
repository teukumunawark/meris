package session

import (
	"math"
	"slices"
)

type Transfer struct {
	From   string  `json:"from"`
	To     string  `json:"to"`
	Amount float64 `json:"amount"`
}

type DebtNodeInt struct {
	Name    string
	Balance int64
}

func SimplifyDebts(balances map[string]float64) []Transfer {
	var debtors []DebtNodeInt
	var creditors []DebtNodeInt

	for name, bal := range balances {
		balCents := int64(math.Round(bal * 100))
		if balCents < 0 {
			debtors = append(debtors, DebtNodeInt{Name: name, Balance: -balCents})
		} else if balCents > 0 {
			creditors = append(creditors, DebtNodeInt{Name: name, Balance: balCents})
		}
	}

	slices.SortFunc(debtors, func(a, b DebtNodeInt) int {
		if b.Balance > a.Balance {
			return 1
		} else if b.Balance < a.Balance {
			return -1
		}
		if a.Name < b.Name {
			return -1
		} else if a.Name > b.Name {
			return 1
		}
		return 0
	})
	slices.SortFunc(creditors, func(a, b DebtNodeInt) int {
		if b.Balance > a.Balance {
			return 1
		} else if b.Balance < a.Balance {
			return -1
		}
		if a.Name < b.Name {
			return -1
		} else if a.Name > b.Name {
			return 1
		}
		return 0
	})

	var transfers []Transfer
	dIdx, cIdx := 0, 0

	for dIdx < len(debtors) && cIdx < len(creditors) {
		debtor := &debtors[dIdx]
		creditor := &creditors[cIdx]

		settledAmount := debtor.Balance
		if creditor.Balance < settledAmount {
			settledAmount = creditor.Balance
		}

		if settledAmount > 0 {
			transfers = append(transfers, Transfer{
				From:   debtor.Name,
				To:     creditor.Name,
				Amount: float64(settledAmount) / 100.0,
			})
		}

		debtor.Balance -= settledAmount
		creditor.Balance -= settledAmount

		if debtor.Balance == 0 {
			dIdx++
		}
		if creditor.Balance == 0 {
			cIdx++
		}
	}

	return transfers
}
