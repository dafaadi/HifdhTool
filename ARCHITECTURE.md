# 1. System Overview
The Spaced Repetition (SRS) Dashboard is the central orchestrator for a contiguous text memorization and revision engine. It leverages the **FSRS (Free Spaced Repetition Scheduler)** algorithm to manage both new memorization sets and long-term retention. 

Unlike standard flashcard apps that treat items independently, this system respects the **sequential integrity** of a religious text. It organizes tasks into "Macro-routines" (contiguous blocks of text) and "Micro-reviews" (detached units targeting specific weaknesses), providing a structured but adaptive path toward mastery.

# 2. Core Data Structures (Schemas)

### Hierarchy of Data
1.  **Schedule**: The root object for a specific plan (e.g., "Juz 30 Revision"). It tracks the `startDate`, a `type` discriminant (`revision` or `memorization`), and a list of Revision Units.
2.  **RevisionUnit (Macro-routine)**: Represents a larger block of text (a Surah, Juz, etc.). It acts as a container for its scheduled sub-parts and maintains a master FSRS card to determine when the entire block is due for its next "contiguous pass."
3.  **ScheduleUnit (SU)**: The atomic unit of work (e.g., a Page or Ruku). Each SU contains word-range metadata, its own FSRS state, and a historical log of every session.

### Macro vs. Micro Tasks
-   **`isMacroRoutine: true` (Contiguous Pass)**: These tasks are part of the main scheduled session. They represent the "ideal" path where the user reviews the text in sequence.
-   **`isMacroRoutine: false` (Detached Micro-review)**: These are spawned dynamically when a user struggles with a macro task. They "break away" from the contiguous cycle to provide focused remedial repetition without disrupting the master schedule.

### Static Metadata
The system relies on `quran_metadata.json` which provides the exact word-ID boundaries for every Juz, Surah, Page, and Ayah, ensuring that mathematical range calculations remain consistent across different script styles (Madani vs. IndoPak).

# 3. State Management & Storage

### The "Previously Memorized" Range Database (LLD)
The core of the user's progress is stored as raw word-ranges in `hifdhRangesV2`.
-   **Primitive**: An array of `[startWordId, endWordId]` tuples.
-   **Normalization**: The `mergeOverlappingIntervals` utility is the gatekeeper. Every update to the database triggers a sort-and-merge sweep that collapses adjacent or overlapping tuples into single contiguous ranges.
-   **Interpretation (Graduation Engine)**: The system does not store "Surah 1" or "Juz 30." Instead, it projects the raw ranges against `GraduationSettings` to dynamically render "Pills." This allows a user to toggle settings (e.g., `surahToJuz`) and see their progress visualize differently without changing the underlying data.

### Dynamic Task Generation
-   **Schedules & Logs**: Stored under the `schedules` key.
-   **`taskMap`**: On dashboard load, the app performs a **Reconstruction Sweep**. It iterates through all active schedules and logs to build a `taskMap`—a dictionary keyed by `YYYY-MM-DD` containing an array of `DailyTask` objects.

### Dev Mode State (Time Travel)
-   **`isDevMode`**: A toggle that unlocks "Time Travel" capabilities.
-   **`virtualDate` (Mock Clock)**: When in Dev Mode, the system replaces the standard `new Date()` with a `virtualDate`, enabling instant verification of future FSRS intervals.

# 4. Scheduling Trackers (Schedulers)

### RevisionScheduler (Strengthening)
Designed for batching multiple previously memorized units into a single timeline.
-   **Selection Filter**: Uses `isFullyContained` to only allow selection of units that exist in the `hifdhRangesV2` database.
-   **Priority Queue Logic**: 
    -   *Default*: Automaticaly sorted by Mushaf order (numerical word-ID).
    -   *Custom Order*: Enables HTML5 Drag & Drop reordering. The order in the `revisionQueue` determines the `priorityValue` during task distribution.
-   **Pacing (LLD)**: Uses **Proportional Distribution**. The total `durationDays` is split across items based on their share of the total sub-units (SUs).
    -   Formula: `assignedDays = Math.round((itemSUs / totalQueueSUs) * globalDurationDays)`.

### MemorizationScheduler (New Progress)
Enforces a "Singleton" constraint—users can only memorize one major unit at a time to prevent burnout.
-   **Singleton Queue**: If a schedule with `type: 'memorization'` exists, the tracker locks and displays a "Complete existing schedule" prompt.
-   **Selection Filter**: Inverts the logic—it only displays units that are **NOT** yet memorized.
-   **Pace-Driven Duration**: Instead of choosing a duration, users choose a **Pace** (1-10 SUs/day). 
    -   Formula: `duration = Math.ceil(totalSubUnits / pace)`.
-   **Theming**: Injects `scheduleType: 'memorization'` into all generated tasks to trigger the Gold/Yellow visual palette across the UI.

# 5. Component Hierarchy (HLD)

### Dashboard Container
The main wrapper that holds the global `virtualDate` state. It listens for `hifdhSchedulesUpdated` events to trigger a re-sweep of the `taskMap`.

### CalendarPreview
-   **Historical Shells**: Renders completed tasks as solid color pills reconstructed from historical `reviewLogs`.
-   **Projections**: Reconstructs future "phantom" tasks using `generateProjectedSUs`.
-   **Visual Distinction**: 
    -   **Macro Tasks**: Solid borders and full opacity.
    -   **Micro-reviews**: Dashed borders and `0.75` opacity.
    -   **Revision (Green) vs. Memorization (Gold)** themes based on the `scheduleType`.

### DailyRoutineModal (The Session)
Handles the active learning session using a **Decoupled Session Queue** architecture:
-   **`sessionQueue`**: A memory-only array where `sessionQueue[0]` is always the active task.
-   **Completion Filter**: Upon session initialization, the modal strictly filters the input tasks to exclude those with `isCompleted: true`. This prevents completed "shells" (macro-tasks already reviewed) from reappearing in the queue when concurrent micro-reviews fall on the same date.
-   **The "Again" (Rating 1) Loop**: Moves the task to the back of the queue without saving to the DB, allowing the user to see the item again in the same session.

# 6. Core Engine Logic (LLD)

### The "Weakness Filter" & Grading
The `handleGradeSubmission` function manages the transition of tasks between memory and storage:
1.  **Again (Rating 1)**: Memory-only operation (penalty calculated, no DB write, re-queued).
2.  **Passing Grades (2-4)**: Triggers a permanent FSRS save.
3.  **Spawning Logic**: Future Micro-reviews (`isMacroRoutine: false`) are **ONLY** generated if the user selects "Again" or "Hard."

### The "Event Horizon"
To prevent "Task Bloat," every Micro-review is governed by an Event Horizon (`dueDateLimit`). If a micro-review's next interval pushes it past the date of the next contiguous Macro pass, the engine archives it to prevent redundant revision.

### Dynamic Future Projection
To provide a long-term preview of mastery, the engine dynamically generates "phantom" tasks for future dates:
1.  **Anchor Extraction**: The system pulls the `fsrsCard` from the parent Revision Unit (RU).
2.  **Date Prediction**: It uses the FSRS `due` date (calculated from average stability and difficulty across all segments) as the projected Start Date.
3.  **Sequential Fill**: It retrieves the original RU word-range and `routineDurationDays`, then runs the `distributeSequentially` engine to fill the projected window with segments.
4.  **Visual Feedback**: These tasks are rendered with lower opacity and unique "muted" color palettes (Muted Green for revision, Muted Gold for memorization) to distinguish them from confirmed schedule data.

### `actualizeMacroRoutine` (The Sweep)
Fires when the final segment of a block is completed:
1.  **Anchor Calculation**: Identifies the completion date of the last segment.
2.  **Rest Buffer**: Sets the next Macro-routine start date exactly **7 days** in the future.
3.  **Cleanup Sweep**: Archives all old completed macro-tasks and caps surviving micro-reviews to the new Start Date.

### The Memorization-to-Revision Lifecycle Pipeline
The engine operates a specific state machine for units memorized as `type: 'memorization'`, gracefully bridging them out of initial learning phases and into long-term retention:
1.  **Phase 0 & 1 - Solidification (Reps 0-2)**
    - FSRS interval expands slowly. The system intercepts the `nextDueDate` and hard-caps the interval to a strict maximum of **4 days**, forcing `isMacroRoutine: false` so it spawns a highly concentrated micro-review.
2.  **Phase 2 - Graduation & The Genesis Trigger (Rep 3)**
    - When an SU reaches rep count 3, it **Graduates**. Operations triggered:
      - Marks the SU as `isMemorizationGraduated: true`.
      - Instantly writes the raw word intervals into `hifdhRangesV2` storage.
      - **Genesis Bridge**: It programmatically constructs an isolated `type: 'revision'` schedule explicitly for its parent track and copies the SU into it natively so structural integrity is preserved without disrupting algorithm projections.
      - Dispatches a `unitCelebration` so the dashboard prompts the user immediately that a specific segment has moved.
3.  **Phase 3 - The Fledgling Phase (Reps 3-4)**
    - Despite reaching the Revision Schedule, graduating micro-reviews retain the `isMemorizationGraduated` flag. This triggers a structural override of the Weakness Filter. It forces the generation of a 10-day capped micro-review even for passing grades ("Good"/"Easy"), providing "training wheels" until algorithms catch up.
4.  **Phase 4 - Final Actualization (Mature RU)**
    - Once the final detached SU in the *overarching* block graduates, the system dispatches a `megaCelebration` object to celebrate the cycle's finality visually. 
    - The new Revision Track calls `actualizeMacroRoutine` natively on the backend, generating its first unified, completely detached sequence for FSRS integration directly on the calendar.
