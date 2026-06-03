# Mobile UI/UX Landing Page Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Sleek Tabs" card layout on the landing page (`/`) to optimize mobile viewports, including proportional side-by-side inputs for Bank and Account info.

**Architecture:** Use React state inside `/` page component to toggle the active tab view, applying conditional CSS classes and rendering for input fields and action buttons.

**Tech Stack:** Next.js (React), TypeScript, Tailwind CSS, Framer Motion

---

### Task 1: Update State and Segmented Control Tabs

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Declare activeTab State**
  Add `activeTab` state (`'create' | 'join'`) and default it to `'create'`.
  ```typescript
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  ```

- [ ] **Step 2: Replace Static Header Titles with Interactive Segmented Controls**
  In the main Card render, remove the separate headings and "OR" divider. Render a unified container with segmented tabs:
  ```tsx
  {/* Tab Selectors (Segmented Control style) */}
  <div className="flex bg-black/10 border border-white/5 rounded-glass-sm p-1 mb-6 font-sans">
    <button
      type="button"
      onClick={() => setActiveTab('create')}
      className={`flex-1 text-center py-2.5 rounded-glass-sm font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
        activeTab === 'create'
          ? "bg-sage/10 text-sage"
          : "text-foreground/40 hover:text-foreground/60"
      }`}
    >
      Create Session
    </button>
    <button
      type="button"
      onClick={() => setActiveTab('join')}
      className={`flex-1 text-center py-2.5 rounded-glass-sm font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
        activeTab === 'join'
          ? "bg-sage/10 text-sage"
          : "text-foreground/40 hover:text-foreground/60"
      }`}
    >
      Join Session
    </button>
  </div>
  ```

- [ ] **Step 3: Verify Compilation**
  Run: `npx tsc --noEmit` in `C:/Users/munawar/Development/meris/frontend`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/page.tsx
  git commit -m "feat: add activeTab state and segmented tabs UI on landing page"
  ```

---

### Task 2: Implement Conditional Rendering and Proportional Grid

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Configure Conditional Layout & Proportional Input Grid**
  Condition the inputs based on `activeTab`. Update the Bank & Account Number grid wrapper from `grid-cols-2` to `grid-cols-[2.5fr_3.5fr]` (giving more space to the account number), and shorten placeholders.
  
  Code structure:
  ```tsx
  {/* Active Form Content */}
  <AnimatePresence mode="wait">
    {activeTab === 'create' ? (
      <motion.div
        key="create"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="space-y-3">
          <input 
            type="text" 
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Your Name (Payer)" 
            className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans"
          />
          <div className="grid grid-cols-[2.5fr_3.5fr] gap-3">
            <input 
              type="text" 
              value={payerBankName}
              onChange={(e) => setPayerBankName(e.target.value)}
              placeholder="Bank (e.g., BCA)" 
              className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans"
            />
            <input 
              type="text" 
              value={payerBankAccount}
              onChange={(e) => setPayerBankAccount(e.target.value)}
              placeholder="Account No / Phone" 
              className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div 
            className="relative group/upload cursor-pointer"
            onClick={() => document.getElementById('receipt-upload')?.click()}
          >
            <input 
              type="file" 
              id="receipt-upload" 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <div className={`w-full border border-dashed ${isUploading ? 'border-sage/50 bg-sage/5' : 'border-white/10 bg-white/[0.01] group-hover/upload:border-sage/30 group-hover/upload:bg-sage/[0.02]'} rounded-glass-sm p-8 transition-all duration-300 flex flex-col items-center gap-3`}>
              <div className={`w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center text-sage ${!isUploading && 'group-hover/upload:scale-105'} transition-transform duration-300`}>
                {isUploading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                )}
              </div>
              <div className="text-center">
                <p className="text-foreground text-sm font-sans font-medium">
                  {isUploading ? "Reading Receipt..." : "Upload Receipt Photo"}
                </p>
                <p className="text-foreground/20 text-[9px] uppercase tracking-widest mt-1">AI Scan Engine</p>
              </div>
            </div>
          </div>
          
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="p-4 rounded-glass-sm bg-rose-950/20 border border-rose-500/25 text-rose-300 text-sm font-sans flex items-start gap-3 text-left"
            >
              <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold text-rose-200">Unable to Start Session</p>
                <p className="text-rose-300/80 text-xs mt-1 leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    ) : (
      <motion.div
        key="join"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3">
          <input 
            type="text" 
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoinSession();
            }}
            placeholder="Enter Session ID" 
            className="w-full px-4 py-3 rounded-glass-sm bg-white/[0.02] border border-white/5 text-foreground text-sm placeholder:text-foreground/20 focus:outline-none focus:border-sage/40 transition-colors font-sans text-center uppercase tracking-wider"
          />
          <button 
            onClick={handleJoinSession}
            style={{ backgroundColor: '#8ba895' }}
            className="w-full py-3.5 rounded-glass-sm text-background font-bold text-xs uppercase tracking-wider hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer font-sans"
          >
            Join Session
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
  ```

- [ ] **Step 2: Clean up unused layouts**
  Remove the `OR` divider section and duplicate structures to clean up code.

- [ ] **Step 3: Run Typecheck**
  Run: `npx tsc --noEmit` in `C:/Users/munawar/Development/meris/frontend`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/page.tsx
  git commit -m "feat: complete conditional rendering of forms and set proportional grid for Bank/Account inputs"
  ```
