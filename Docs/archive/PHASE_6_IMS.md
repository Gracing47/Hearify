# Intelligent Memory System (IMS) - Architecture Update

## Phase 6: Semantic Deduplication & Queue-Based Notifications

### Overview

This update implements a dual-layer architecture improvement:

1. **Interaction Layer**: Queue-based toast system with Reanimated 3 layout animations
2. **Data Layer**: Semantic deduplication with smart merge logic

---

## 1. Toast Queue System (M/D/1 Model)

### Files Created:
- `store/toastStore.ts` - Zustand store with FIFO queue logic
- `components/ToastContainer.tsx` - Reanimated 3 layout animations

### Features:
- **Strict serialization**: Toasts appear one-by-one with proper staggering
- **Auto-deduplication**: Consecutive identical toasts are suppressed
- **Haptic feedback**: Each toast type triggers distinct haptic pattern
- **Layout animations**: SlideInUp/SlideOutRight with spring physics
- **Max queue size**: Limited to 5 to prevent memory issues

### Usage:
```typescript
import { toast } from '@/store/toastStore';

toast.success('Memory Saved', 'New thought captured');
toast.merged('Memory Updated', 'Expanded existing thought');
toast.duplicate('Already Remembered', 'Similar memory exists');
toast.error('Save Failed', 'Could not store memory');
```

---

## 2. Semantic Deduplication Service

### Files Created:
- `services/SemanticDedupService.ts` - Main deduplication logic
- `utils/vectorMath.ts` - Cosine similarity & normalization
- `utils/textAnalysis.ts` - Levenshtein distance & merge decisions

### Thresholds:
| Similarity | Action |
|------------|--------|
| > 0.92 | **KEEP_OLD** - Update timestamp only |
| > 0.85 | **REPLACE/MERGE** - Smart content merge |
| 0.70 - 0.85 | **CREATE_NEW** with semantic edge |
| < 0.70 | **CREATE_NEW** - Unique thought |

### Smart Merge Logic:
1. **KEEP_OLD**: Exact duplicate, just update timestamp
2. **REPLACE**: New text significantly longer/better formatted
3. **MERGE_TAGS**: Semantic match, combine metadata
4. **CREATE_NEW**: Related but distinct, create with edge link

---

## 3. Integration Points

### MindLayout.tsx
- Added `<ToastContainer />` at viewport root
- Mounts outside navigation for global visibility

### OrbitScreen.tsx
- Replaced `insertSnippet()` with `saveSnippetWithDedup()`
- Removed `pendingSnippets` and `NeuralConfirmation` rendering
- All confirmations now flow through Toast Queue

---

## 4. Removed Files

| File | Reason |
|------|--------|
| `components/NeuralConfirmation.tsx` | Replaced by ToastContainer |
| `store/scrollCoordination.ts` | No longer needed (Modal nav) |
| `store/missionControl.ts` | Duplicate of contextStore |
| `services/intelligence.ts` | Unused |
| `utils/louvain.ts` | Unused |
| `hooks/use-color-scheme.ts` | Unused |
| `components/visuals/*` | Unused |

---

## 5. Performance Characteristics

### Toast Queue:
- **UI Thread**: Animations run on Reanimated UI thread (60fps)
- **Zero bridge crossings**: Layout animations computed natively
- **Memory**: Auto-cleanup via queue size limit

### Semantic Deduplication:
- **Embedding**: Uses existing OpenAI text-embedding-3-large
- **Similarity**: Optimized cosine similarity (pre-normalized vectors)
- **Decision**: O(1) merge decision after similarity calculation

---

## 6. Future Improvements

1. **Local TFLite Embeddings**: Replace OpenAI with on-device model
2. **HNSW Index**: For O(log N) similarity search at scale
3. **Batch Deduplication**: Maintenance task for existing duplicates
4. **Conflict Resolution UI**: User prompt for uncertain merges

---

*Architecture Update: December 2024*
*M/D/1 Queue Theory + Vector Space Semantic Modeling*
