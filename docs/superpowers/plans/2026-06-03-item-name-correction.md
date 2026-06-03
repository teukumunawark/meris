# Item Name Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable real-time item name correction (renaming) inside active split bill sessions.

**Architecture:** Create a REST endpoint `PUT /session/{id}/item/{itemId}/rename` in Go to update the item name in GORM and broadcast the state via SSE. Connect this to an inline edit text field in `ItemCard.tsx` which performs optimistic UI updates.

**Tech Stack:** Go (net/http, GORM), Next.js (React, Framer Motion, fetch).

---

### Task 1: Backend Endpoint Registration & Handler

**Files:**
- Modify: `backend/cmd/meris/main.go:53-60`
- Modify: `backend/internal/handlers/session.go:164`

- [ ] **Step 1: Register the new PUT route in ServeMux**

Modify `backend/cmd/meris/main.go` to add the handler route registration:
```go
	mux.HandleFunc("PUT /session/{id}/item/{itemId}/rename", sessionHandler.RenameItem)
```

- [ ] **Step 2: Implement RenameItem in SessionHandler**

Modify `backend/internal/handlers/session.go` to append the `RenameItem` handler method:
```go
func (h *SessionHandler) RenameItem(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	itemID := r.PathValue("itemId")
	if sessionID == "" || itemID == "" {
		http.Error(w, "Invalid parameters", http.StatusBadRequest)
		return
	}

	var payload struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.Name == "" {
		http.Error(w, "Name cannot be empty", http.StatusBadRequest)
		return
	}

	var item models.Item
	err := h.DB.WithContext(r.Context()).Where("id = ? AND session_id = ?", itemID, sessionID).First(&item).Error
	if err != nil {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	item.Name = payload.Name
	if err := h.DB.WithContext(r.Context()).Save(&item).Error; err != nil {
		http.Error(w, "Failed to update item name", http.StatusInternalServerError)
		return
	}

	go h.broadcastFullState(context.WithoutCancel(r.Context()), sessionID)

	w.WriteHeader(http.StatusOK)
}
```

- [ ] **Step 3: Compile and run tests to ensure no Go compile/syntax errors**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 4: Commit backend changes**

```bash
git add backend/cmd/meris/main.go backend/internal/handlers/session.go
git commit -m "feat: implement RenameItem backend endpoint and route"
```

---

### Task 2: Frontend Hook Integration

**Files:**
- Modify: `frontend/src/app/session/[id]/useClaimSession.ts`

- [ ] **Step 1: Add renameItem callback to useClaimSession**

Update `frontend/src/app/session/[id]/useClaimSession.ts` to implement `renameItem`:
```typescript
  const renameItem = useCallback(async (itemId: string, newName: string): Promise<boolean> => {
    const previousItems = [...items];
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, name: newName } : item))
    );
    try {
      const response = await fetch(`${backendUrl}/session/${sessionId}/item/${itemId}/rename`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        setItems(previousItems);
        return false;
      }
      return true;
    } catch (err) {
      setItems(previousItems);
      return false;
    }
  }, [sessionId, backendUrl, items]);
```

- [ ] **Step 2: Expose renameItem from useClaimSession return object**

Update the return block of `useClaimSession` to export the new callback:
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
  };
```

- [ ] **Step 3: Commit hook changes**

```bash
git add frontend/src/app/session/[id]/useClaimSession.ts
git commit -m "feat: implement renameItem callback in useClaimSession hook"
```

---

### Task 3: ItemCard & Page Component Integration

**Files:**
- Modify: `frontend/src/app/session/[id]/ItemCard.tsx`
- Modify: `frontend/src/app/session/[id]/page.tsx`

- [ ] **Step 1: Update ItemCard interface and render editing UI**

Modify `frontend/src/app/session/[id]/ItemCard.tsx` to include `onRenameItem` in `ItemCardProps`, declare internal editing states, and switch between heading and input layouts:
```typescript
interface ItemCardProps {
  item: ReceiptItem;
  isJoined: boolean;
  userName: string;
  onUpdateClaim: (itemId: string, increment: number) => void;
  onRenameItem: (itemId: string, newName: string) => void;
  formatRupiah: (val: number) => string;
}
```
And inside `ItemCard`:
```typescript
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(item.name);

  React.useEffect(() => {
    setEditValue(item.name);
  }, [item.name]);
```
Replace the name rendering container (`<div className="flex items-start ...">`) with inline input rendering:
```tsx
        <div className="flex items-center justify-between md:justify-start gap-4 sm:gap-6 min-h-12">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = editValue.trim();
                  if (trimmed && trimmed !== item.name) {
                    onRenameItem(item.id, trimmed);
                  }
                  setIsEditing(false);
                } else if (e.key === "Escape") {
                  setEditValue(item.name);
                  setIsEditing(false);
                }
              }}
              onBlur={() => {
                const trimmed = editValue.trim();
                if (trimmed && trimmed !== item.name) {
                  onRenameItem(item.id, trimmed);
                }
                setIsEditing(false);
              }}
              autoFocus
              className="px-2 py-1.5 rounded-glass-sm bg-white/[0.04] border border-white/10 text-foreground text-lg sm:text-xl md:text-2xl font-sans focus:outline-none focus:border-sage/40 w-full max-w-md"
            />
          ) : (
            <div className="flex items-center gap-3 w-full group/title">
              <h3 className="font-sans text-foreground text-lg sm:text-xl md:text-2xl tracking-tight font-normal">
                {item.name}
              </h3>
              {isJoined && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover/title:opacity-100 text-foreground/30 hover:text-sage transition-opacity p-1 cursor-pointer shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <AnimatePresence>
            {isFullyClaimed && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em] sm:tracking-[0.3em] px-3 py-1 sm:px-4 sm:py-1.5 rounded-glass-sm bg-sage/10 text-sage border border-sage/20 shrink-0"
              >
                Claimed
              </motion.span>
            )}
          </AnimatePresence>
        </div>
```

- [ ] **Step 2: Update session [id] page.tsx to destructure and pass renameItem**

Modify `frontend/src/app/session/[id]/page.tsx` to get `renameItem` from hook and pass it to `ItemCard`:
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
  } = useClaimSession(sessionId);
```
And update the `ItemCard` instantiation:
```tsx
                  <ItemCard
                    key={item.id}
                    item={item}
                    isJoined={isJoined}
                    userName={userName}
                    onUpdateClaim={updateClaim}
                    onRenameItem={renameItem}
                    formatRupiah={formatRupiah}
                  />
```

- [ ] **Step 3: Commit UI changes**

```bash
git add frontend/src/app/session/[id]/ItemCard.tsx frontend/src/app/session/[id]/page.tsx
git commit -m "feat: connect Inline Edit Mode to ItemCard UI and page component"
```
