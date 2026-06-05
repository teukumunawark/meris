# Session Robustness and Integrity Specification

This document details the architectural decisions and technical specifications to handle session refresh integrity, prevent "ghost claims", secure participant identity, and avoid race conditions during concurrent claiming.

---

## 1. Problem Definition
- **Ghost Claims / Identity Loss**: Guest participants currently lose their participant ID upon browser refresh because their identity is not persisted. Re-entering their name creates a duplicate participant record, leaving previous claims uneditable ("ghost claims").
- **Name Hijacking**: Anyone can impersonate any other guest participant simply by typing their name upon joining.
- **Claim Concurrency Races**: If multiple users claim the same item simultaneously, the sum of claims can exceed the physical item quantity.

---

## 2. Participant Authentication & Auto-Login Flow

To secure guest identities and allow seamless re-association on refresh, we introduce a **Participant Token** system.

### A. Database Model Update
The `Participant` model in `models/models.go` is extended with a `Token` field:
```go
type Participant struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	SessionID string `gorm:"index;type:varchar(50)" json:"sessionId"`
	Name      string `json:"name"`
	Token     string `gorm:"type:varchar(50)" json:"-"` // Hidden from standard JSON responses
	Claims    []Claim `gorm:"foreignKey:ParticipantID" json:"claims"`
}
```

### B. Route & Handler Rules

#### 1. Joining a Session (`POST /session/{id}/join`)
- **Payload**: `{"name": "Budi", "token": "optional-token-for-rejoin"}`
- **Backend Flow**:
  1. Check if a participant with `name = "Budi"` already exists in this session.
  2. **If exists**:
     - If the payload contains a matching `token`, return `200 OK` with the existing participant record. This re-authenticates the user.
     - If the payload does not contain a matching token (or token is empty/wrong), return `409 Conflict` (`Name already taken in this session`).
  3. **If does not exist**:
     - Generate a new secure UUID for the `Token`.
     - Create a new `Participant` record in the database.
     - Return `201 Created` with the participant ID, name, and the generated token.

#### 2. Claiming an Item (`POST /session/{id}/claim`)
- **Payload**:
  ```json
  {
    "participantId": 12,
    "itemId": "item-uuid",
    "shares": 0.5,
    "token": "participant-secret-token"
  }
  ```
- **Backend Flow**:
  1. Retrieve the participant by `participantId`.
  2. Validate that `Participant.Token` matches the requested `token`.
  3. If they do not match, return `401 Unauthorized`.

---

## 3. Claim Concurrency & Quantity Validation

To prevent double-claiming race conditions:
- **Transaction Block**: Perform claim updates inside a database transaction in `ClaimItem`.
- **Validation**:
  1. Within the transaction, sum all shares currently claimed on the target item by *other* participants:
     `SELECT SUM(shares) FROM claims WHERE item_id = ? AND participant_id != ?`
  2. Validate that:
     `SUM(other_shares) + new_requested_share <= item.quantity`
  3. If it exceeds `item.quantity`, abort the transaction and return `400 Bad Request` with error message `"Item quantity limit exceeded"`.

---

## 4. Frontend State & LocalStorage Management

### A. Session Storage Keys
The frontend uses the following browser local storage naming:
- **Key**: `meris_session_{sessionId}_participant`
- **Value**:
  ```json
  {
    "id": 12,
    "name": "Budi",
    "token": "participant-secret-token"
  }
  ```

### B. Auto-Login & Refresh UX
1. When mounting the session page (`ClaimSessionPage`), the custom hook checks if `meris_session_{sessionId}_participant` exists in `localStorage`.
2. **If it exists**:
   - Set `isJoined = true`, `userName = name`, and `participantId = id` in state.
   - When fetching initial state or communicating via SSE, use this cached identity.
3. **If it does not exist**:
   - Fall back to the "Who are you?" form.
   - When the user submits their name, the backend returns a new token, which the frontend saves to `localStorage` immediately.

---

## 5. Expiry & 7-Day History Tracking

- **History Registry Key**: `meris_recent_sessions` (JSON array of recently created or joined sessions).
- **Structure**:
  ```json
  [
    {
      "id": "session-id",
      "payerName": "Budi",
      "grandTotal": 120000,
      "joinedAt": 1706000000
    }
  ]
  ```
- **Pruning Trigger**: Every time the homepage mounts, it reads `meris_recent_sessions`, filters out entries where `joinedAt` is older than 7 days, and updates `localStorage`.
