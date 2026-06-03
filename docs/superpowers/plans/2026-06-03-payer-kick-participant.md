# Payer Kick Participant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Kick/Remove Participant" feature, enabling the Payer (session host) to delete a participant and release their claimed items.

**Architecture:** Create a `DELETE /session/{id}/participant/{participantId}` endpoint in Go that verifies if the caller is the Payer using their token, removes the participant and their claims inside a transaction, and broadcasts the state. Update the frontend hook and UI to render a removal button next to other participants for the session Payer.

**Tech Stack:** Go (net/http, GORM), Next.js (React, fetch).

---

### Task 1: Backend Endpoint Registration & Handler

**Files:**
- Modify: `backend/cmd/meris/main.go:53-61`
- Modify: `backend/internal/handlers/session.go:164`

- [ ] **Step 1: Register the DELETE route in ServeMux**

Modify `backend/cmd/meris/main.go` to add the handler route registration:
```go
	mux.HandleFunc("DELETE /session/{id}/participant/{participantId}", sessionHandler.DeleteParticipant)
```

- [ ] **Step 2: Implement DeleteParticipant in SessionHandler**

Modify `backend/internal/handlers/session.go` to append the `DeleteParticipant` handler method:
```go
func (h *SessionHandler) DeleteParticipant(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	targetParticipantID := r.PathValue("participantId")
	callerToken := r.URL.Query().Get("token")

	if sessionID == "" || targetParticipantID == "" || callerToken == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}

	var session models.Session
	if err := h.DB.WithContext(r.Context()).First(&session, "id = ?", sessionID).Error; err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	var payer models.Participant
	err := h.DB.WithContext(r.Context()).Where("session_id = ? AND name = ?", sessionID, session.PayerName).First(&payer).Error
	if err != nil || payer.Token != callerToken {
		http.Error(w, "Unauthorized caller token", http.StatusUnauthorized)
		return
	}

	tx := h.DB.WithContext(r.Context()).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Where("participant_id = ?", targetParticipantID).Delete(&models.Claim{}).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete claims", http.StatusInternalServerError)
		return
	}

	if err := tx.Delete(&models.Participant{}, targetParticipantID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete participant", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}
```

- [ ] **Step 3: Run backend tests to verify compilation**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 4: Commit backend changes**

```bash
git add backend/cmd/meris/main.go backend/internal/handlers/session.go
git commit -m "feat: implement DeleteParticipant backend endpoint and route"
```

---

### Task 2: Frontend Hook Integration

**Files:**
- Modify: `frontend/src/app/session/[id]/useClaimSession.ts`

- [ ] **Step 1: Declare participants list state and populate it in mapBackendState**

Modify `frontend/src/app/session/[id]/useClaimSession.ts` to add the state variable:
```typescript
  const [participants, setParticipants] = useState<Array<{ id: number; name: string }>>([]);
```
Inside `mapBackendState` (around lines 90-110), populate `participants` from the backend payload:
```typescript
    if (Array.isArray(data.participants)) {
      setParticipants(data.participants);
    }
```

- [ ] **Step 2: Implement removeParticipant callback in useClaimSession**

Update `frontend/src/app/session/[id]/useClaimSession.ts` to implement `removeParticipant`:
```typescript
  const removeParticipant = useCallback(async (targetParticipantId: number): Promise<boolean> => {
    if (!participantToken) return false;
    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/participant/${targetParticipantId}?token=${participantToken}`, {
        method: "DELETE",
      });
      return response.ok;
    } catch (err) {
      return false;
    }
  }, [sessionId, backendUrl, participantToken]);
```

- [ ] **Step 3: Expose participants and removeParticipant**

Update the hook return object to expose the new values:
```typescript
  return {
    userName,
    setUserName,
    isJoined,
    items,
    tax,
    serviceCharge,
    payerName,
    payerBank,
    joinSession,
    changeName,
    updateClaim,
    renameItem,
    joinError,
    participants,
    removeParticipant,
  };
```

- [ ] **Step 4: Commit hook integration**

```bash
git add frontend/src/app/session/[id]/useClaimSession.ts
git commit -m "feat: implement participants state and removeParticipant callback in useClaimSession"
```

---

### Task 3: UI Component Integration

**Files:**
- Modify: `frontend/src/app/session/[id]/page.tsx`
- Modify: `frontend/src/app/session/[id]/ParticipantBreakdown.tsx`

- [ ] **Step 1: Update page.tsx to destructure and pass history hook state**

Modify hook destructuring in `frontend/src/app/session/[id]/page.tsx` to extract `participants` and `removeParticipant`:
```typescript
  const {
    userName,
    setUserName,
    isJoined,
    items,
    tax,
    serviceCharge,
    payerName,
    payerBank,
    joinSession,
    changeName,
    updateClaim,
    renameItem,
    joinError,
    participants,
    removeParticipant,
  } = useClaimSession(sessionId);
```
Inside `page.tsx`, replace the calculated `participants` list (which was a string array) with the state `participants` list, and pass `removeParticipant` to the `ParticipantBreakdown` component:
```typescript
  const isPayer = isJoined && userName.trim().toLowerCase() === payerName.trim().toLowerCase();
```
Update the instantiation of `ParticipantBreakdown` (around lines 343-354):
```tsx
            <ParticipantBreakdown
              participants={participants}
              items={items}
              totalSubtotal={totalSubtotal}
              tax={tax}
              serviceCharge={serviceCharge}
              userName={userName}
              isJoined={isJoined}
              isPayer={isPayer}
              payerName={payerName}
              onRemoveParticipant={removeParticipant}
              formatRupiah={formatRupiah}
              getAvatarBg={getAvatarBg}
              getInitials={getInitials}
            />
```

- [ ] **Step 2: Update ParticipantBreakdown to render Kick button**

Modify `frontend/src/app/session/[id]/ParticipantBreakdown.tsx` to handle the new props and render the Kick button next to other participant avatars:
Update the `ParticipantBreakdownProps` interface:
```typescript
interface ParticipantBreakdownProps {
  participants: Array<{ id: number; name: string }>;
  items: ReceiptItem[];
  totalSubtotal: number;
  tax: number;
  serviceCharge: number;
  userName: string;
  isJoined: boolean;
  isPayer: boolean;
  payerName: string;
  onRemoveParticipant: (id: number) => void;
  formatRupiah: (val: number) => string;
  getAvatarBg: (name: string) => string;
  getInitials: (name: string) => string;
}
```
Update the render map inside `ParticipantBreakdown` (around line 54):
```typescript
  const participantNames = participants.map((p) => p.name);
  const breakdowns = calculateParticipantBreakdowns(
    participantNames,
    items,
    totalSubtotal,
    tax,
    serviceCharge
  );
```
Inside the `breakdowns.map` block (around line 72), find the participant ID and render the Delete/Kick button next to their name:
```tsx
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${getAvatarBg(p.name)}`}>
                        {getInitials(p.name)}
                      </div>
                      <span className="font-sans text-base sm:text-xl text-foreground tracking-tight font-normal truncate">
                        {p.name} {isCurrentUser && <span className="inline-block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-sage not-italic ml-2 sm:ml-4">(You)</span>}
                      </span>
                      {(() => {
                        const match = participants.find((part) => part.name === p.name);
                        const isTargetPayer = p.name.trim().toLowerCase() === payerName.trim().toLowerCase();
                        if (isPayer && match && !isTargetPayer) {
                          return (
                            <button
                              onClick={() => onRemoveParticipant(match.id)}
                              className="text-foreground/30 hover:text-rose-400 p-1 cursor-pointer transition-colors shrink-0"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <span className="text-lg sm:text-xl font-sans font-bold text-sage text-glow-sage shrink-0">
                      {formatRupiah(p.total)}
                    </span>
                  </div>
```

- [ ] **Step 3: Run Next.js production build to verify compilation**

Run: `npm run build` in `frontend` directory.
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit UI changes**

```bash
git add frontend/src/app/session/[id]/page.tsx frontend/src/app/session/[id]/ParticipantBreakdown.tsx
git commit -m "feat: render Kick/Remove button next to participants in breakdown list for session Payer"
```
