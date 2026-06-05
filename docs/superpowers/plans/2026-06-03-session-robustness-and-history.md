# Session Robustness & 7-Day History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement participant token authentication, auto-login persistence on refresh, claim quantity race-condition validation, and 7-day session history tracking.

**Architecture:** Extend the GORM `Participant` model with a secure `Token` field. Update backend routes for `POST /session/{id}/join` and `POST /session/{id}/claim` to use transaction-level authentication and boundary validations. Enable the frontend hook to handle auto-login via `localStorage` and track/prune recent session histories.

**Tech Stack:** Go (net/http, GORM, UUID), Next.js (React, localStorage, Tailwind CSS).

---

### Task 1: Update Database Model & Migration

**Files:**
- Modify: `backend/internal/models/models.go:19-24`

- [ ] **Step 1: Add Token field to Participant model**

Modify `backend/internal/models/models.go` to add `Token` column configuration to `Participant` struct, hidden from standard JSON marshalling:
```go
type Participant struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SessionID string `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string `json:"name"`
	Token     string `gorm:"type:varchar(50)" json:"-"`
	Claims    []Claim `gorm:"foreignKey:ParticipantID" json:"claims"`
}
```

- [ ] **Step 2: Run tests to trigger GORM AutoMigration and verify compilation**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 3: Commit migration changes**

```bash
git add backend/internal/models/models.go
git commit -m "feat: add Token field to Participant model for session verification"
```

---

### Task 2: Implement Token-based Rejoin & Idempotency in JoinSession

**Files:**
- Modify: `backend/internal/handlers/session.go:133-163`

- [ ] **Step 1: Update JoinSession to support rejoins and generate unique tokens**

Modify `backend/internal/handlers/session.go` to rewrite the `JoinSession` method:
```go
func (h *SessionHandler) JoinSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	trimmedName := payload.Name
	if trimmedName == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	var existing models.Participant
	err := h.DB.WithContext(r.Context()).Where("session_id = ? AND name = ?", sessionID, trimmedName).First(&existing).Error
	if err == nil {
		if payload.Token != "" && existing.Token == payload.Token {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			var resp struct {
				ID        uint   `json:"id"`
				SessionID string `json:"sessionId"`
				Name      string `json:"name"`
				Token     string `json:"token"`
			}
			resp.ID = existing.ID
			resp.SessionID = existing.SessionID
			resp.Name = existing.Name
			resp.Token = existing.Token
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.Error(w, "Name already taken in this session", http.StatusConflict)
		return
	}

	newToken := uuid.New().String()
	participant := models.Participant{
		SessionID: sessionID,
		Name:      trimmedName,
		Token:     newToken,
	}

	if err := h.DB.WithContext(r.Context()).Create(&participant).Error; err != nil {
		http.Error(w, "Failed to join session", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	var resp struct {
		ID        uint   `json:"id"`
		SessionID string `json:"sessionId"`
		Name      string `json:"name"`
		Token     string `json:"token"`
	}
	resp.ID = participant.ID
	resp.SessionID = participant.SessionID
	resp.Name = participant.Name
	resp.Token = participant.Token
	json.NewEncoder(w).Encode(resp)
}
```

- [ ] **Step 2: Verify compiling and backend tests**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 3: Commit JoinSession changes**

```bash
git add backend/internal/handlers/session.go
git commit -m "feat: implement token-based rejoin and name conflict handling in JoinSession"
```

---

### Task 3: Secure Claiming and Concurrency Checks

**Files:**
- Modify: `backend/internal/handlers/session.go:90-132`

- [ ] **Step 1: Rewrite ClaimItem to use atomic transaction validation**

Modify `backend/internal/handlers/session.go` to update the `ClaimItem` method:
```go
func (h *SessionHandler) ClaimItem(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, "Invalid session ID", http.StatusBadRequest)
		return
	}

	var payload struct {
		ParticipantID uint    `json:"participantId"`
		ItemID        string  `json:"itemId"`
		Shares        float64 `json:"shares"`
		Token         string  `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	tx := h.DB.WithContext(r.Context()).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var participant models.Participant
	if err := tx.First(&participant, payload.ParticipantID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Participant not found", http.StatusNotFound)
		return
	}

	if participant.Token != payload.Token {
		tx.Rollback()
		http.Error(w, "Unauthorized claim verification token", http.StatusUnauthorized)
		return
	}

	var item models.Item
	if err := tx.First(&item, "id = ? AND session_id = ?", payload.ItemID, sessionID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	var otherShares float64
	tx.Model(&models.Claim{}).
		Where("item_id = ? AND participant_id != ?", payload.ItemID, payload.ParticipantID).
		Select("COALESCE(SUM(shares), 0)").
		Row().
		Scan(&otherShares)

	if otherShares+payload.Shares > float64(item.Quantity) {
		tx.Rollback()
		http.Error(w, "Item quantity limit exceeded", http.StatusBadRequest)
		return
	}

	claim := models.Claim{
		ItemID:        payload.ItemID,
		ParticipantID: payload.ParticipantID,
		Shares:        payload.Shares,
	}

	var existing models.Claim
	err := tx.Where("item_id = ? AND participant_id = ?", claim.ItemID, claim.ParticipantID).First(&existing).Error
	if err == nil {
		existing.Shares = claim.Shares
		if err := tx.Save(&existing).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to update claim", http.StatusInternalServerError)
			return
		}
	} else {
		if err := tx.Create(&claim).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create claim", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}
```

- [ ] **Step 2: Run backend tests to verify transaction validation is clean**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 3: Commit claiming updates**

```bash
git add backend/internal/handlers/session.go
git commit -m "feat: enforce token verification and quantity validation transaction in ClaimItem"
```

---

### Task 4: Expose Token-based Re-authentication in Frontend Hook

**Files:**
- Modify: `frontend/src/app/session/[id]/useClaimSession.ts`

- [ ] **Step 1: Implement Token state and auto-login logic on hook mount**

Modify `frontend/src/app/session/[id]/useClaimSession.ts` to add token state, load from `localStorage` on init, and update auto-join logic:
```typescript
  const [userName, setUserName] = useState<string>("");
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [participantToken, setParticipantToken] = useState<string>("");
  const [isJoined, setIsJoined] = useState<boolean>(false);
```
And add an initialization `useEffect` block right after state definitions to check `localStorage` for rejoining:
```typescript
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id && parsed.name && parsed.token) {
            setUserName(parsed.name);
            setParticipantId(parsed.id);
            setParticipantToken(parsed.token);
            setIsJoined(true);
          }
        } catch (e) {
          localStorage.removeItem(`meris_session_${sessionId}_participant`);
        }
      }
    }
  }, [sessionId]);
```

- [ ] **Step 2: Update joinSession method to store and handle tokens**

Update the `joinSession` implementation inside `useClaimSession.ts` to request and store the participant's secret token, handling name takeovers:
```typescript
  const [joinError, setJoinError] = useState<string | null>(null);

  const joinSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setJoinError(null);

    const stored = localStorage.getItem(`meris_session_${sessionId}_participant`);
    let cachedToken = "";
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.name.toLowerCase() === trimmedName.toLowerCase()) {
          cachedToken = parsed.token;
        }
      } catch (e) {}
    }

    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, token: cachedToken }),
      });

      if (response.ok) {
        const participant = await response.json();
        setUserName(trimmedName);
        setParticipantId(participant.id);
        setParticipantToken(participant.token);
        setIsJoined(true);
        localStorage.setItem(
          `meris_session_${sessionId}_participant`,
          JSON.stringify({
            id: participant.id,
            name: trimmedName,
            token: participant.token,
          })
        );
      } else if (response.status === 409) {
        setJoinError("This name is already taken. Please choose another name to join.");
      } else {
        setJoinError("Failed to join session. Please try again later.");
      }
    } catch (err) {
      setJoinError("Network error. Unable to connect to the server.");
    }
  };
```

- [ ] **Step 3: Update syncClaimToBackend method to send the token**

Modify the `syncClaimToBackend` callback to send the token payload for authentication:
```typescript
  const syncClaimToBackend = useCallback(async (itemId: string, shares: number): Promise<boolean> => {
    if (!participantId || !participantToken) return false;

    const url = `${backendUrl}/session/${sessionId}/claim`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: participantId,
          itemId: itemId,
          shares: shares,
          token: participantToken,
        }),
      });

      return response.ok;
    } catch (err) {
      console.warn("Outbound claim sync failed:", err);
      return false;
    }
  }, [participantId, participantToken, sessionId, backendUrl]);
```

- [ ] **Step 4: Expose joinError state and commit hook changes**

Expose `joinError` in the returned object of `useClaimSession.ts`:
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
  };
```
Commit:
```bash
git add frontend/src/app/session/[id]/useClaimSession.ts
git commit -m "feat: integrate participant token verification and auto-login in hook"
```

---

### Task 5: Implement 7-Day History Tracking & Pruning

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/session/[id]/page.tsx`
- Modify: `frontend/src/app/session/[id]/useClaimSession.ts`

- [ ] **Step 1: Save recent sessions to history from within session detail page**

Modify `frontend/src/app/session/[id]/useClaimSession.ts` inside `mapBackendState` to append current session to `meris_recent_sessions` in `localStorage`:
```typescript
    if (data.payerName && typeof grandTotal === "number") {
      const stored = localStorage.getItem("meris_recent_sessions");
      let list: Array<{ id: string; payerName: string; grandTotal: number; joinedAt: number }> = [];
      if (stored) {
        try { list = JSON.parse(stored); } catch (e) {}
      }
      list = list.filter(item => item.id !== sessionId);
      list.unshift({
        id: sessionId,
        payerName: data.payerName,
        grandTotal: grandTotal,
        joinedAt: Date.now(),
      });
      localStorage.setItem("meris_recent_sessions", JSON.stringify(list));
    }
```
Wait! How is `grandTotal` calculated in `useClaimSession.ts`?
We need to compute it:
```typescript
    const totalSub = Array.isArray(data.items) ? data.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 0), 0) : 0;
    const computedGrand = totalSub + (data.tax || 0) + (data.serviceCharge ?? data.service_charge ?? 0);
```
Let's make sure we put this calculation before updating the list.

- [ ] **Step 2: Render History Section on main page and implement pruning**

Modify `frontend/src/app/page.tsx` to read, prune, and render the recent session history section:
Add `useEffect` to prune history older than 7 days (604,800,000 ms) and store it in component state:
```typescript
  interface RecentSession {
    id: string;
    payerName: string;
    grandTotal: number;
    joinedAt: number;
  }
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meris_recent_sessions");
      if (stored) {
        try {
          const list = JSON.parse(stored) as RecentSession[];
          const now = Date.now();
          const valid = list.filter(s => now - s.joinedAt < 7 * 24 * 60 * 60 * 1000);
          setRecentSessions(valid);
          localStorage.setItem("meris_recent_sessions", JSON.stringify(valid));
        } catch (e) {}
      }
    }
  }, []);
```
Render the recent sessions list under the main forms card on the right-hand panel of `page.tsx`:
```tsx
            {recentSessions.length > 0 && (
              <div className="glass-panel p-6 sm:p-8 rounded-glass mt-6 text-left">
                <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-foreground/30 mb-4">Recent Sessions</h3>
                <ul className="space-y-3">
                  {recentSessions.map((session) => (
                    <li key={session.id} className="flex justify-between items-center py-2 border-b border-white/5">
                      <div className="flex flex-col">
                        <Link href={`/session/${session.id}`} className="font-mono text-xs text-sage hover:underline">
                          {session.id}
                        </Link>
                        <span className="text-[10px] text-foreground/40 font-sans">Payer: {session.payerName || "Anonymous"}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground/60">
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(session.grandTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
```

- [ ] **Step 3: Update session [id] page.tsx to display joinError if it occurs**

Modify `frontend/src/app/session/[id]/page.tsx` to handle join errors:
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
  } = useClaimSession(sessionId);
```
And inside the `Who are you?` form section under the input field:
```tsx
            <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 w-full md:max-w-lg relative z-10">
              ...
            </div>
            {joinError && (
              <p className="text-rose-400 text-xs font-sans mt-2 text-left">{joinError}</p>
            )}
```

- [ ] **Step 4: Run frontend production build to verify compilation**

Run: `npm run build` in `frontend` directory.
Expected: Build finishes with no compile errors.

- [ ] **Step 5: Commit history and error interface changes**

```bash
git add frontend/src/app/page.tsx frontend/src/app/session/[id]/page.tsx frontend/src/app/session/[id]/useClaimSession.ts
git commit -m "feat: implement 7-day recent sessions history list and UI error display"
```
