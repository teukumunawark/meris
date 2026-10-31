package session

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/httpresponse"
	"meris-backend/internal/platform/httpserver/generated"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

const maxReceiptUploadSize = 5 * 1024 * 1024

func (h *Handler) readReceiptImage(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxReceiptUploadSize)

	file, _, err := r.FormFile("receipt")
	if err != nil {
		if _, tooLarge := errors.AsType[*http.MaxBytesError](err); tooLarge {
			return nil, ErrFileTooLarge
		}
		return nil, apperrors.NewAppError(ErrInvalidFile.Code, nil, ErrInvalidFile.HTTPStatus, err)
	}
	defer func() { _ = file.Close() }()

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read receipt upload: %w", err)
	}

	if !strings.HasPrefix(http.DetectContentType(imageBytes), "image/") {
		return nil, ErrNotAnImage
	}

	return imageBytes, nil
}

type claimPayload struct {
	ParticipantID uint    `json:"participantId"`
	ItemID        string  `json:"itemId"`
	Shares        float64 `json:"shares"`
	Token         string  `json:"token"`
}

type paymentInfoPayload struct {
	PayerBankName    string `json:"payerBankName"`
	PayerBankAccount string `json:"payerBankAccount"`
	Token            string `json:"token"`
}

type itemPayload struct {
	BillID   string  `json:"billId"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Quantity int32   `json:"quantity"`
	Token    string  `json:"token"`
}

type billPayload struct {
	PayerName     string  `json:"payerName"`
	Name          string  `json:"name"`
	Tax           float64 `json:"tax"`
	ServiceCharge float64 `json:"serviceCharge"`
	Discount      float64 `json:"discount"`
	OtherCharges  float64 `json:"otherCharges"`
	GrandTotal    float64 `json:"grandTotal"`
	Token         string  `json:"token"`
}

func handleJSON[P any](w http.ResponseWriter, r *http.Request, successStatus int, call func(P) error) {
	var payload P
	if !decodeBody(w, r, &payload) {
		return
	}
	if err := call(payload); err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}
	w.WriteHeader(successStatus)
}

func decodeBody(w http.ResponseWriter, r *http.Request, target any) bool {
	if err := httpresponse.DecodeJSON(r, target); err != nil {
		httpresponse.RespondError(w, r, err)
		return false
	}
	return true
}

func (h *Handler) executeDelete(w http.ResponseWriter, r *http.Request, token string, deleteFn func() error) {
	if token == "" {
		httpresponse.RespondError(w, r, apperrors.ErrMissingToken)
		return
	}

	if err := deleteFn(); err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	imageBytes, err := h.readReceiptImage(w, r)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	payerName := r.FormValue("payerName")
	payerBankName := r.FormValue("payerBankName")
	payerBankAccount := r.FormValue("payerBankAccount")
	skipOCR := r.FormValue("skipOcr") == "true"

	session, _, _, payerID, payerToken, err := h.service.ExtractAndCreateSession(
		r.Context(),
		imageBytes,
		payerName,
		payerBankName,
		payerBankAccount,
		skipOCR,
	)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	resp, err := h.service.GetCompiledSession(r.Context(), session.ID)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	result := CreateSessionResult{CompiledSession: resp}
	if payerName != "" {
		result.PayerID = &payerID
		result.PayerToken = &payerToken
	}

	httpresponse.WriteJSON(w, http.StatusOK, result)
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request, id string) {
	resp, err := h.service.GetCompiledSession(r.Context(), id)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	httpresponse.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if !decodeBody(w, r, &payload) {
		return
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidName)
		return
	}

	p, err := h.service.JoinSession(r.Context(), id, name, payload.Token)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	httpresponse.WriteJSON(w, http.StatusOK, JoinSessionResult{
		ID:        p.ID,
		SessionID: p.SessionID,
		Name:      p.Name,
		Token:     p.Token,
	})
}

func (h *Handler) ClaimItem(w http.ResponseWriter, r *http.Request, id string) {
	handleJSON(w, r, http.StatusOK, func(p claimPayload) error {
		return h.service.ClaimItem(r.Context(), id, p.ParticipantID, p.ItemID, p.Shares, p.Token)
	})
}

func (h *Handler) RenameItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	var payload struct {
		Name string `json:"name"`
	}
	if !decodeBody(w, r, &payload) {
		return
	}

	if strings.TrimSpace(payload.Name) == "" {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidName)
		return
	}

	err := h.service.RenameItem(r.Context(), id, itemId, payload.Name)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string, params generated.DeleteParticipantParams) {
	callerToken := params.Token
	if callerToken == "" {
		httpresponse.RespondError(w, r, apperrors.ErrMissingToken)
		return
	}

	pID, err := strconv.ParseUint(participantId, 10, 32)
	if err != nil {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidID)
		return
	}

	err = h.service.DeleteParticipant(r.Context(), id, uint(pID), callerToken)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdatePaymentInfo(w http.ResponseWriter, r *http.Request, id string) {
	handleJSON(w, r, http.StatusOK, func(p paymentInfoPayload) error {
		return h.service.UpdatePaymentInfo(r.Context(), id, p.PayerBankName, p.PayerBankAccount, p.Token)
	})
}

func (h *Handler) AddItem(w http.ResponseWriter, r *http.Request, id string) {
	handleJSON(w, r, http.StatusCreated, func(p itemPayload) error {
		return h.service.AddItem(r.Context(), id, p.BillID, p.Name, p.Price, p.Quantity, p.Token)
	})
}

func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	handleJSON(w, r, http.StatusOK, func(p itemPayload) error {
		return h.service.UpdateItem(r.Context(), id, itemId, p.Name, p.Price, p.Quantity, p.Token)
	})
}

func (h *Handler) DeleteItem(w http.ResponseWriter, r *http.Request, id string, itemId string, params generated.DeleteItemParams) {
	h.executeDelete(w, r, params.Token, func() error {
		return h.service.DeleteItem(r.Context(), id, itemId, params.Token)
	})
}

func (h *Handler) AddBill(w http.ResponseWriter, r *http.Request, id string) {
	imageBytes, err := h.readReceiptImage(w, r)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	payerName := r.FormValue("payerName")
	billName := r.FormValue("name")
	token := r.FormValue("token")
	skipOCR := r.FormValue("skipOcr") == "true"

	err = h.service.AddBillToSession(r.Context(), id, imageBytes, payerName, billName, token, skipOCR)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) RescanBill(w http.ResponseWriter, r *http.Request, id string, billId string) {
	var payload struct {
		Token string `json:"token"`
	}
	if !decodeBody(w, r, &payload) {
		return
	}
	if strings.TrimSpace(payload.Token) == "" {
		httpresponse.RespondError(w, r, apperrors.ErrMissingToken)
		return
	}

	if err := h.service.RescanBill(r.Context(), id, billId, payload.Token); err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteBill(w http.ResponseWriter, r *http.Request, id string, billId string, params generated.DeleteBillParams) {
	h.executeDelete(w, r, params.Token, func() error {
		return h.service.DeleteBill(r.Context(), id, billId, params.Token)
	})
}

func (h *Handler) UpdateBill(w http.ResponseWriter, r *http.Request, id string, billId string) {
	handleJSON(w, r, http.StatusOK, func(p billPayload) error {
		charges := BillCharges{
			Tax:           p.Tax,
			ServiceCharge: p.ServiceCharge,
			Discount:      p.Discount,
			OtherCharges:  p.OtherCharges,
		}
		return h.service.UpdateBill(r.Context(), id, billId, p.Name, p.PayerName, charges, p.GrandTotal, p.Token)
	})
}

func (h *Handler) UpdateParticipantBankInfo(w http.ResponseWriter, r *http.Request, id string, participantId string) {
	pID, err := strconv.ParseInt(participantId, 10, 64)
	if err != nil {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidID)
		return
	}

	var payload struct {
		BankName    string `json:"bankName"`
		BankAccount string `json:"bankAccount"`
		Token       string `json:"token"`
	}
	if !decodeBody(w, r, &payload) {
		return
	}

	err = h.service.UpdateParticipantBankInfo(r.Context(), id, pID, payload.BankName, payload.BankAccount, payload.Token)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) RenameParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string) {
	pID, err := strconv.ParseInt(participantId, 10, 64)
	if err != nil {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidID)
		return
	}

	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if !decodeBody(w, r, &payload) {
		return
	}

	name := strings.TrimSpace(payload.Name)
	if name == "" {
		httpresponse.RespondError(w, r, apperrors.ErrInvalidName)
		return
	}
	if payload.Token == "" {
		httpresponse.RespondError(w, r, apperrors.ErrMissingToken)
		return
	}

	p, err := h.service.RenameParticipant(r.Context(), id, pID, name, payload.Token)
	if err != nil {
		httpresponse.RespondError(w, r, err)
		return
	}

	httpresponse.WriteJSON(w, http.StatusOK, JoinSessionResult{
		ID:        p.ID,
		SessionID: p.SessionID,
		Name:      p.Name,
		Token:     p.Token,
	})
}
