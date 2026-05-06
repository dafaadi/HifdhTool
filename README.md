# HifdhTool - Spaced Repetition & Contiguous Text Engine

HifdhTool is a specialized web application engineered for contiguous text memorization, built specifically for the Quran. Unlike traditional flashcard applications that treat items as isolated units, HifdhTool leverages the Free Spaced Repetition Scheduler (FSRS) algorithm to optimize retention while respecting the sequential integrity of scripture.

It comprises two primary pillars:
1. **The Scheduling Dashboard**: A robust FSRS-powered planner that dynamically generates daily tasks to strengthen memory and bridge new memorization into long-term retention.
2. **The Annotation Engine**: A highly granular, digital reader interface that allows users to interact with the scripture and log specific weaknesses down to the individual diacritic.

---

## 🚀 High-Level Overview

At its core, HifdhTool ensures you never forget what you've memorized. It acts as an automated schedule manager. You tell it what Surah (Chapter) or Juz (Section) you want to memorize or revise, and the engine calculates exactly how many Ayahs (Verses) you should read each day. 

If you make a mistake while reading, the Annotation Engine allows you to click exactly where you stumbled. The system records this and, if you struggle repeatedly, breaks that specific verse away from the main schedule into a "Micro-review" to test you more frequently until the weakness is solidified.

---

## 🧠 Core Architecture & FSRS Integration

The application employs a sophisticated event loop to handle spaced repetition.

### Macro-Routines vs. Micro-Reviews
The engine divides work into two categories:
*   **Macro-Routines (Contiguous Passes):** The ideal path. These are scheduled sessions where the user reviews a larger, unbroken block of text (e.g., a full Surah (Chapter)).
*   **Micro-Reviews (Detached Tasks):** If a user rates a specific segment as "Hard" or "Again" during a Macro-Routine, the engine spawns a Micro-review. These detached tasks break away from the main cycle, allowing the system to enforce focused, remedial repetition on weak spots without disrupting the master schedule. 

### The Graduation Pipeline
For newly memorized text, the engine executes a strict **Memorization-to-Revision Lifecycle**:
1.  **Solidification (Reps 0-2):** Newly memorized segments are hard-capped at a maximum interval of 4 days. The FSRS algorithm is temporarily constrained to force highly concentrated Micro-reviews.
2.  **Graduation (Rep 3):** Once a segment survives 3 successful repetitions, it "graduates." The engine instantly writes the interval to long-term storage and bridges it into an isolated Revision Schedule.
3.  **Fledgling Phase (Reps 3-4):** To provide "training wheels," newly graduated segments still receive a 10-day cap before the algorithm takes full unrestricted control.

---

## 📖 The Annotation Engine

The Annotation Engine is a custom digital reader built to interface directly with static JSON payloads of the scriptural text.

### Granular Selection Modes
Users can toggle between four precision levels to record mistakes, utilizing keyboard shortcuts (A, S, D, F):
1.  **Ayah (Verse) Mode:** Selects the entire logical segment.
2.  **Word Mode:** Highlights a specific word.
3.  **Letter Mode:** Pinpoints exact character confusion.
4.  **Tashkeel (Diacritic) Mode:** For highly specific vowel or pronunciation errors.

### The Mistake Column
When a mistake is logged, it populates the **Mistakes Sidebar**. This column aggregates errors, allowing users to:
*   Append custom text comments to specific word/letter mistakes.
*   Click an entry to auto-scroll the viewport directly to the exact location of the error in the text.
*   Review aggregated weaknesses before concluding a session to solidify memory.

---

## 💾 State Management & Privacy-First Persistence

HifdhTool operates entirely client-side. There are no external databases storing your progression, ensuring absolute privacy.

*   **Local Persistence:** All memorized ranges, FSRS logs, and mistake metadata are persisted in the browser's `localStorage` or local IndexedDB equivalents.
*   **Interval Merging:** The underlying data layer tracks progression as primitive arrays of `[startWordId, endWordId]`. Every update triggers a normalization sweep that merges overlapping intervals, preventing data bloat and ensuring mathematically sound range calculations.
*   **Reconstruction Sweeps:** On load, the Dashboard dynamically rebuilds the daily task map from historical logs rather than maintaining a static daily list, preventing state desynchronization.

---

## 🛠️ Technical Stack & Telemetry

*   **Frontend:** React, TypeScript, Vite.
*   **Data Handling:** SQLite databases dumped to JSON payloads to handle the immense mapping of scriptural text, word boundaries, and diacritics without backend queries.
*   **Styling:** Vanilla CSS with custom theming logic (Dark/Light mode, font scaling).
*   **Analytics:** Integrated with the **Umami API** to collect privacy-centric, cookieless telemetry, ensuring no PII is tracked.

---

## 🔍 Detailed Functionality Matrix

For engineers looking to navigate the codebase, here is a breakdown of the specific UI minutiae and auxiliary features implemented:

**Scheduling Dashboard Minutiae:**
*   **Revision Unit (RU) & Schedule Unit (SU) Hierarchy:** Displays schedules in collapsible dropdowns for hierarchical organization.
*   **HTML5 Drag and Drop:** Enables custom priority reordering within the `revisionQueue`.
*   **Phantom Projections:** The calendar dynamically injects semi-transparent "phantom" tasks by simulating future FSRS intervals to preview upcoming workload.
*   **Completion Filters:** The active session modal strictly filters out completed tasks to prevent overlapping shells from cluttering the queue.
*   **Event Horizon:** Caps Micro-reviews so they don't schedule past their parent Macro-routine's next due date.
*   **Developer Mode (Mock Clock):** A built-in time-travel tool (`virtualDate`) allowing devs to simulate future dates to test algorithm scaling.
*   **Visual Celebrations:** Dispatches UI events (`megaCelebration`, `unitCelebration`) upon successful graduations.

**Annotation Engine Minutiae:**
*   **Script Toggling:** Hot-swappable rendering between Madani and IndoPak script fonts.
*   **Mobile Optimizations:** Collapsible headers and custom viewport hooks for seamless mobile reading.
*   **Typographic Controls:** Real-time font size scaling (ᴀ⁻ / A⁺) and word-spacing adjustments.
*   **Searchable Dropdowns:** A custom, prefix-tree powered search input for rapid Surah (Chapter) navigation.
*   **Contextual Ayah Dropdowns:** Dynamically calculates which physical page a specific verse resides on and auto-navigates.
