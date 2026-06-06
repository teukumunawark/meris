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

func (s *OpenAPIServer) CreateSession(w http.ResponseWriter, r *http.Request) {
	s.sessionHandler.CreateSession(w, r)
}

func (s *OpenAPIServer) GetSession(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.GetSession(w, r, id)
}

func (s *OpenAPIServer) JoinSession(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.JoinSession(w, r, id)
}

func (s *OpenAPIServer) ClaimItem(w http.ResponseWriter, r *http.Request, id string) {
	s.sessionHandler.ClaimItem(w, r, id)
}

func (s *OpenAPIServer) RenameItem(w http.ResponseWriter, r *http.Request, id string, itemId string) {
	s.sessionHandler.RenameItem(w, r, id, itemId)
}

func (s *OpenAPIServer) DeleteParticipant(w http.ResponseWriter, r *http.Request, id string, participantId string, params generated.DeleteParticipantParams) {
	s.sessionHandler.DeleteParticipant(w, r, id, participantId, params)
}
