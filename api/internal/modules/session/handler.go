package session

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"meris-backend/internal/apperrors"
	"meris-backend/internal/platform/httpserver/generated"
	"meris-backend/internal/platform/httpresponse"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	file, _, err := r.FormFile("receipt")
	if err != nil {
		if err.Error() == "http: request body too large" || strings.Contains(err.Error(), "too large") {
			httpresponse.WriteError(w, http.StatusRequestEntityTooLarge, "file_too_large", "Upload size exceeded the 5MB limit")
			return
		}
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_file", "Invalid receipt image")
		return
	}
	defer file.Close()

	payerName := r.FormValue("payerName")
	payerBankName := r.FormValue("payerBankName")
	payerBankAccount := r.FormValue("payerBankAccount")

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		httpresponse.WriteError(w, http.StatusInternalServerError, "read_failed", "Failed to read image")
		return
	}

	contentType := http.DetectContentType(imageBytes)
	if !strings.HasPrefix(contentType, "image/") {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_content_type", "Uploaded file must be a valid image")
		return
	}

	session, _, _, payerID, payerToken, err := h.service.ExtractAndCreateSession(
		r.Context(),
		imageBytes,
		payerName,
		payerBankName,
		payerBankAccount,
	)
	if err != nil {
		httpresponse.WriteError(w, http.StatusInternalServerError, "creation_failed", err.Error())
		return
	}

	resp, err := h.service.GetCompiledSession(r.Context(), session.ID)
	if err != nil {
		httpresponse.WriteError(w, http.StatusInternalServerError, "fetch_failed", err.Error())
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
		httpresponse.WriteLocalizedError(w, r, NewSessionNotFoundError(id))
		return
	}

	httpresponse.WriteJSON(w, http.StatusOK, resp)
}

func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	p, err := h.service.JoinSession(r.Context(), id, payload.Name, payload.Token)
	if err != nil {
		var appErr *apperrors.AppError
		if errors.As(err, &appErr) && appErr.Code == "errors.name_conflict" {
			httpresponse.WriteLocalizedError(w, r, NewNameConflictError(payload.Name))
		} else {
			httpresponse.WriteLocalizedError(w, r, err)
		}
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
	var payload struct {
		ParticipantID uint    `json:"participantId"`
		ItemID        string  `json:"itemId"`
		Shares        float64 `json:"shares"`
		Token         string  `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err := h.service.ClaimItem(r.Context(), id, payload.ParticipantID, payload.ItemID, payload.Shares, payload.Token)
	if err != nil {
		var appErr *apperrors.AppError
		if errors.As(err, &appErr) {
			switch appErr.Code {
			case "errors.unauthorized":
				httpresponse.WriteLocalizedError(w, r, ErrUnauthorized)
			case "errors.quantity_exceeded":
				httpresponse.WriteLocalizedError(w, r, NewQuantityExceededError())
			case "errors.item_not_found":
				httpresponse.WriteLocalizedError(w, r, NewItemNotFoundError(payload.ItemID))
			default:
				httpresponse.WriteLocalizedError(w, r, err)
			}
		} else {
			httpresponse.WriteLocalizedError(w, r, err)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) RenameItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	var payload struct {
		Name string `json:"name"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	if strings.TrimSpace(payload.Name) == "" {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_name", "Name cannot be empty")
		return
	}

	err := h.service.RenameItem(r.Context(), id, itemId, payload.Name)
	if err != nil {
		httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string, params generated.DeleteParticipantParams) {
	callerToken := params.Token
	if callerToken == "" {
		httpresponse.WriteError(w, http.StatusBadRequest, "missing_token", "Missing token parameter")
		return
	}

	pID, err := strconv.ParseUint(participantId, 10, 32)
	if err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_id", "Invalid participant ID")
		return
	}

	err = h.service.DeleteParticipant(r.Context(), id, uint(pID), callerToken)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdatePaymentInfo(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		PayerBankName    string `json:"payerBankName"`
		PayerBankAccount string `json:"payerBankAccount"`
		Token            string `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err := h.service.UpdatePaymentInfo(r.Context(), id, payload.PayerBankName, payload.PayerBankAccount, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) AddItem(w http.ResponseWriter, r *http.Request, id string) {
	var payload struct {
		Name     string  `json:"name"`
		Price    float64 `json:"price"`
		Quantity int32   `json:"quantity"`
		Token    string  `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err := h.service.AddItem(r.Context(), id, payload.Name, payload.Price, payload.Quantity, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	var payload struct {
		Name     string  `json:"name"`
		Price    float64 `json:"price"`
		Quantity int32   `json:"quantity"`
		Token    string  `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err := h.service.UpdateItem(r.Context(), id, itemId, payload.Name, payload.Price, payload.Quantity, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) DeleteItem(w http.ResponseWriter, r *http.Request, id string, itemId string, params generated.DeleteItemParams) {
	token := params.Token
	if token == "" {
		httpresponse.WriteError(w, http.StatusBadRequest, "missing_token", "Missing token parameter")
		return
	}

	err := h.service.DeleteItem(r.Context(), id, itemId, token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) AddBill(w http.ResponseWriter, r *http.Request, id string) {
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	file, _, err := r.FormFile("receipt")
	if err != nil {
		if err.Error() == "http: request body too large" || strings.Contains(err.Error(), "too large") {
			httpresponse.WriteError(w, http.StatusRequestEntityTooLarge, "file_too_large", "Upload size exceeded the 5MB limit")
			return
		}
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_file", "Invalid receipt image")
		return
	}
	defer file.Close()

	payerName := r.FormValue("payerName")
	billName := r.FormValue("name")
	token := r.FormValue("token")

	imageBytes, err := io.ReadAll(file)
	if err != nil {
		httpresponse.WriteError(w, http.StatusInternalServerError, "read_failed", "Failed to read image")
		return
	}

	contentType := http.DetectContentType(imageBytes)
	if !strings.HasPrefix(contentType, "image/") {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_content_type", "Uploaded file must be a valid image")
		return
	}

	err = h.service.AddBillToSession(r.Context(), id, imageBytes, payerName, billName, token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) DeleteBill(w http.ResponseWriter, r *http.Request, id string, billId string, params generated.DeleteBillParams) {
	token := params.Token
	if token == "" {
		httpresponse.WriteError(w, http.StatusBadRequest, "missing_token", "Missing token parameter")
		return
	}

	err := h.service.DeleteBill(r.Context(), id, billId, token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdateBill(w http.ResponseWriter, r *http.Request, id string, billId string) {
	var payload struct {
		PayerName     string  `json:"payerName"`
		Name          string  `json:"name"`
		Tax           float64 `json:"tax"`
		ServiceCharge float64 `json:"serviceCharge"`
		GrandTotal    float64 `json:"grandTotal"`
		Token         string  `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err := h.service.UpdateBill(r.Context(), id, billId, payload.Name, payload.PayerName, payload.Tax, payload.ServiceCharge, payload.GrandTotal, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *Handler) UpdateParticipantBankInfo(w http.ResponseWriter, r *http.Request, id string, participantId string) {
	pID, err := strconv.ParseInt(participantId, 10, 64)
	if err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_id", "Invalid participant ID")
		return
	}

	var payload struct {
		BankName    string `json:"bankName"`
		BankAccount string `json:"bankAccount"`
		Token       string `json:"token"`
	}
	if err := httpresponse.DecodeJSON(r, &payload); err != nil {
		httpresponse.WriteError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	err = h.service.UpdateParticipantBankInfo(r.Context(), id, pID, payload.BankName, payload.BankAccount, payload.Token)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) {
			httpresponse.WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		} else {
			httpresponse.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusOK)
}

