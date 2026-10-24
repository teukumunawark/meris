package httpserver

import (
	"net/http"

	"meris-backend/internal/modules/session"
	"meris-backend/internal/platform/httpserver/generated"
)

type OpenAPIServer struct {
	sessionHandler *session.Handler
}

func NewOpenAPIServer(sessionHandler *session.Handler) *OpenAPIServer {
	return &OpenAPIServer{sessionHandler: sessionHandler}
}

func (s *OpenAPIServer) CreateSession(w http.ResponseWriter, r *http.Request, params generated.CreateSessionParams) {
	s.sessionHandler.CreateSession(w, r)
}

func (s *OpenAPIServer) GetSession(w http.ResponseWriter, r *http.Request, id string, params generated.GetSessionParams) {
	s.sessionHandler.GetSession(w, r, id)
}

func (s *OpenAPIServer) JoinSession(w http.ResponseWriter, r *http.Request, id string, params generated.JoinSessionParams) {
	s.sessionHandler.JoinSession(w, r, id)
}

func (s *OpenAPIServer) ClaimItem(w http.ResponseWriter, r *http.Request, id string, params generated.ClaimItemParams) {
	s.sessionHandler.ClaimItem(w, r, id)
}

func (s *OpenAPIServer) RenameItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	s.sessionHandler.RenameItem(w, r, id, itemId)
}

func (s *OpenAPIServer) DeleteParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string, params generated.DeleteParticipantParams) {
	s.sessionHandler.DeleteParticipant(w, r, id, participantId, params)
}

func (s *OpenAPIServer) UpdatePaymentInfo(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.UpdatePaymentInfo(w, r, id)
}

func (s *OpenAPIServer) AddItem(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.AddItem(w, r, id)
}

func (s *OpenAPIServer) UpdateItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	s.sessionHandler.UpdateItem(w, r, id, itemId)
}

func (s *OpenAPIServer) DeleteItem(w http.ResponseWriter, r *http.Request, id string, itemId string, params generated.DeleteItemParams) {
	s.sessionHandler.DeleteItem(w, r, id, itemId, params)
}

func (s *OpenAPIServer) AddBill(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.AddBill(w, r, id)
}

func (s *OpenAPIServer) DeleteBill(w http.ResponseWriter, r *http.Request, id string, billId string, params generated.DeleteBillParams) {
	s.sessionHandler.DeleteBill(w, r, id, billId, params)
}

func (s *OpenAPIServer) UpdateBill(w http.ResponseWriter, r *http.Request, id string, billId string) {
	s.sessionHandler.UpdateBill(w, r, id, billId)
}

func (s *OpenAPIServer) UpdateParticipantBankInfo(w http.ResponseWriter, r *http.Request, id string, participantId string) {
	s.sessionHandler.UpdateParticipantBankInfo(w, r, id, participantId)
}

func (s *OpenAPIServer) RenameParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string) {
	s.sessionHandler.RenameParticipant(w, r, id, participantId)
}
