# Magic: The Gathering Card Scanner Application
## Technical Planning Document

---

## 1. Project Overview

### Vision
A desktop/web application that uses a webcam to scan Magic: The Gathering cards in real-time, automatically identifies them using OCR and the Scryfall API, and maintains a personal inventory database with card counts.

### Core Requirements
- Real-time webcam integration with visual card detection zone
- Fast, accurate card identification (< 2 seconds per card)
- Persistent local database for inventory tracking
- Comprehensive error handling for unrecognized cards
- Intuitive, user-friendly interface

---

## 2. Technical Architecture

### Recommended Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React + TypeScript | Component-based, great webcam libraries, type safety |
| **UI Framework** | Tailwind CSS + shadcn/ui | Modern, responsive, accessible components |
| **Webcam** | react-webcam | Reliable, well-maintained, easy integration |
| **OCR Engine** | Tesseract.js | Browser-based, no server dependency, good accuracy |
| **Card Data API** | Scryfall API | Free, comprehensive, real-time MTG database |
| **Database** | IndexedDB (Dexie.js) | Client-side, persistent, no backend required |
| **State Management** | Zustand | Lightweight, simple, TypeScript-friendly |
| **Build Tool** | Vite | Fast development, optimized builds |

### Alternative: Desktop App (Electron)
If native desktop features are needed (better camera access, file system), wrap the React app in Electron.

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
├─────────────────────┬───────────────────┬───────────────────────────┤
│   Camera View       │   Card Preview    │    Inventory Panel        │
│   - Live feed       │   - Detected card │    - Card list            │
│   - Capture zone    │   - Confidence    │    - Search/filter        │
│   - Auto-detect     │   - Edit option   │    - Statistics           │
└─────────┬───────────┴─────────┬─────────┴───────────────┬───────────┘
          │                     │                         │
          ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LOGIC                              │
├─────────────────────┬───────────────────┬───────────────────────────┤
│  Camera Service     │  Recognition      │    Database Service       │
│  - Frame capture    │  - OCR processing │    - CRUD operations      │
│  - Image processing │  - API lookup     │    - Import/Export        │
│  - Quality check    │  - Fuzzy matching │    - Statistics           │
└─────────┬───────────┴─────────┬─────────┴───────────────┬───────────┘
          │                     │                         │
          ▼                     ▼                         ▼
┌─────────────────────┬───────────────────┬───────────────────────────┐
│   WebRTC/MediaAPI   │   Scryfall API    │      IndexedDB            │
│   (Browser Camera)  │   (Card Data)     │   (Local Storage)         │
└─────────────────────┴───────────────────┴───────────────────────────┘
```

---

## 4. Feature Specifications

### 4.1 Camera & Scanning Module

#### Core Features
- **Live Video Feed**: Display real-time webcam stream
- **Detection Zone**: Overlay rectangle showing where to place card
- **Auto-Capture**: Detect when card is stable and in position
- **Manual Capture**: Button to force capture current frame
- **Image Enhancement**: Pre-process image for better OCR (contrast, crop, rotate)

#### Camera Settings
- Resolution selection (720p, 1080p)
- Brightness/contrast adjustment
- Flip horizontal (for mirror mode)
- Focus lock (if supported)

#### Capture Flow
```
1. Card enters detection zone
2. Stability check (card not moving for 500ms)
3. Capture frame
4. Crop to card region
5. Enhance image (grayscale, contrast, threshold)
6. Extract card name region (top of card)
7. Send to OCR
```

### 4.2 Card Recognition Module

#### OCR Strategy
```typescript
interface RecognitionPipeline {
  // Step 1: Preprocess image
  preprocess(image: ImageData): ProcessedImage;
  
  // Step 2: Extract text from card name region
  extractText(image: ProcessedImage): string;
  
  // Step 3: Clean and normalize text
  normalizeText(raw: string): string;
  
  // Step 4: Query Scryfall API
  lookupCard(name: string): Promise<ScryfallCard | null>;
  
  // Step 5: Fuzzy match if exact match fails
  fuzzyMatch(name: string): Promise<ScryfallCard[]>;
}
```

#### Scryfall API Integration
```typescript
// Exact name search
GET https://api.scryfall.com/cards/named?exact={cardName}

// Fuzzy name search (handles typos)
GET https://api.scryfall.com/cards/named?fuzzy={cardName}

// Autocomplete (for suggestions)
GET https://api.scryfall.com/cards/autocomplete?q={partial}
```

#### Error Handling Strategy
| Scenario | Action |
|----------|--------|
| OCR returns empty | Retry with different preprocessing |
| No exact match | Try fuzzy search |
| Multiple matches | Present options to user |
| API rate limit | Queue requests, show loading state |
| Network error | Cache last response, retry with backoff |
| Low confidence OCR | Manual entry mode |

### 4.3 Database Module

#### Schema Design
```typescript
interface CardEntry {
  id: string;                    // Scryfall ID (unique identifier)
  name: string;                  // Card name
  setCode: string;               // Set code (e.g., "MH3")
  setName: string;               // Set name (e.g., "Modern Horizons 3")
  collectorNumber: string;       // Collector number
  quantity: number;              // Count owned
  foilQuantity: number;          // Foil count
  imageUri: string;              // Card image URL
  manaCost: string;              // Mana cost string
  typeLine: string;              // Card type
  rarity: string;                // common/uncommon/rare/mythic
  priceUsd: number | null;       // Current price (cached)
  priceFoilUsd: number | null;   // Foil price (cached)
  dateAdded: Date;               // First scan date
  dateModified: Date;            // Last update date
}

interface ScanHistory {
  id: string;                    // Auto-generated
  cardId: string;                // Reference to CardEntry
  timestamp: Date;               // When scanned
  confidence: number;            // OCR confidence score
  wasManualEntry: boolean;       // If user manually entered
}
```

#### Database Operations
```typescript
interface DatabaseService {
  // Card operations
  addCard(card: ScryfallCard, quantity?: number): Promise<CardEntry>;
  incrementCard(cardId: string, amount?: number): Promise<CardEntry>;
  decrementCard(cardId: string, amount?: number): Promise<CardEntry>;
  removeCard(cardId: string): Promise<void>;
  
  // Query operations
  getAllCards(): Promise<CardEntry[]>;
  searchCards(query: string): Promise<CardEntry[]>;
  getCardsBySet(setCode: string): Promise<CardEntry[]>;
  getCardsByRarity(rarity: string): Promise<CardEntry[]>;
  
  // Statistics
  getTotalValue(): Promise<number>;
  getTotalCards(): Promise<number>;
  getUniqueCards(): Promise<number>;
  
  // Import/Export
  exportToCSV(): Promise<string>;
  exportToJSON(): Promise<string>;
  importFromCSV(data: string): Promise<ImportResult>;
}
```

### 4.4 User Interface Specifications

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | Scan Mode | Collection Mode | Settings | Stats │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────┐  ┌─────────────────────────────────┐│
│  │                       │  │  Last Scanned Card              ││
│  │    CAMERA FEED        │  │  ┌─────────┐                    ││
│  │                       │  │  │  Card   │  Card Name         ││
│  │   ┌───────────────┐   │  │  │  Image  │  Set - Rarity      ││
│  │   │ Detection     │   │  │  │         │  Price: $X.XX      ││
│  │   │ Zone          │   │  │  └─────────┘                    ││
│  │   │               │   │  │                                 ││
│  │   └───────────────┘   │  │  [+1] [+4] [Set Foil] [Undo]    ││
│  │                       │  │                                 ││
│  └───────────────────────┘  │  ─────────────────────────────  ││
│                             │  Scan History (last 10)         ││
│  [Capture] [Auto: ON]       │  • Card A - Set X - 2 copies    ││
│                             │  • Card B - Set Y - 1 copy      ││
│  Camera: [Dropdown v]       │  • Card C - Set Z - 4 copies    ││
│                             │                                 ││
│                             └─────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Status Bar: "Ready to scan" | Cards: 1,234 | Value: $5,678   │
└─────────────────────────────────────────────────────────────────┘
```

#### Collection View
```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | Scan Mode | Collection Mode | Settings | Stats │
├─────────────────────────────────────────────────────────────────┤
│  Search: [________________________] [Set: All v] [Rarity: All v]│
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │  Card   │ │  Card   │ │  Card   │ │  Card   │ │  Card   │   │
│  │  Image  │ │  Image  │ │  Image  │ │  Image  │ │  Image  │   │
│  │         │ │         │ │         │ │         │ │         │   │
│  │  x4     │ │  x2     │ │  x1     │ │  x3     │ │  x2     │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│  Card Name   Card Name   Card Name   Card Name   Card Name     │
│  $1.50       $25.00      $3.00       $0.50       $12.00        │
│                                                                 │
│  (Scrollable grid continues...)                                │
├─────────────────────────────────────────────────────────────────┤
│  Page: [< 1 2 3 4 5 >]  |  Showing 50 of 1,234 cards           │
└─────────────────────────────────────────────────────────────────┘
```

#### Component Hierarchy
```
App
├── Header
│   ├── Logo
│   ├── NavigationTabs (Scan | Collection | Settings)
│   └── QuickStats
├── ScanView
│   ├── CameraFeed
│   │   ├── VideoStream
│   │   ├── DetectionOverlay
│   │   └── CaptureIndicator
│   ├── CameraControls
│   │   ├── CaptureButton
│   │   ├── AutoModeToggle
│   │   └── CameraSelector
│   ├── CardPreview
│   │   ├── CardImage
│   │   ├── CardDetails
│   │   └── QuantityControls
│   └── ScanHistory
│       └── HistoryItem[]
├── CollectionView
│   ├── SearchBar
│   ├── FilterControls
│   ├── CardGrid
│   │   └── CardTile[]
│   └── Pagination
├── SettingsView
│   ├── CameraSettings
│   ├── ScanSettings
│   ├── DatabaseSettings
│   └── ImportExport
├── Modals
│   ├── ManualEntryModal
│   ├── CardDetailModal
│   ├── ConfirmDeleteModal
│   └── ErrorModal
└── StatusBar
```

---

## 5. Performance Optimization

### OCR Optimization
```typescript
// Use Web Workers for OCR to avoid blocking UI
const ocrWorker = new Worker('ocr-worker.js');

// Pre-initialize Tesseract
await Tesseract.createWorker({
  langPath: '/tessdata',
  logger: m => console.log(m),
});

// Only process card name region (top ~15% of card)
const nameRegion = cropImage(frame, { 
  x: 0.05, 
  y: 0.03, 
  width: 0.90, 
  height: 0.12 
});
```

### API Optimization
```typescript
// Cache Scryfall responses
const cardCache = new Map<string, ScryfallCard>();

// Debounce API calls
const debouncedLookup = debounce(lookupCard, 300);

// Respect rate limits (10 requests/second)
const rateLimiter = new RateLimiter({ 
  maxRequests: 10, 
  perMilliseconds: 1000 
});
```

### Image Processing Pipeline
```typescript
// Optimized preprocessing steps
const preprocessPipeline = [
  resize(800, 600),           // Reduce size for faster processing
  grayscale(),                // Convert to grayscale
  gaussianBlur(1),            // Reduce noise
  adaptiveThreshold(),        // Improve text contrast
  deskew(),                   // Correct rotation
];
```

---

## 6. Error Handling Matrix

| Error Type | Detection | User Feedback | Recovery |
|------------|-----------|---------------|----------|
| Camera not found | MediaDevices API error | "No camera detected" modal | Retry button, manual entry |
| Camera permission denied | Permission error | "Permission needed" modal | Open settings link |
| Card not in frame | Frame analysis | Highlight detection zone | Audio/visual cue |
| OCR failed | Empty/low confidence | "Couldn't read card" | Retry or manual entry |
| Card not found | 404 from Scryfall | "Card not recognized" | Fuzzy suggestions, manual entry |
| Network error | Fetch error | "Connection issue" toast | Retry with backoff |
| Rate limited | 429 status | "Please wait" toast | Auto-retry after delay |
| Database error | IndexedDB error | "Storage error" modal | Offer export, retry |

### Manual Entry Fallback
```typescript
interface ManualEntryModal {
  // Autocomplete search
  searchQuery: string;
  suggestions: ScryfallCard[];
  
  // Set/variant selection
  selectedCard: ScryfallCard | null;
  availablePrintings: ScryfallCard[];
  
  // Confirmation
  quantity: number;
  isFoil: boolean;
}
```

---

## 7. File Structure

```
mtg-card-scanner/
├── public/
│   ├── tessdata/                 # Tesseract language data
│   │   └── eng.traineddata
│   ├── sounds/                   # Audio feedback
│   │   ├── scan-success.mp3
│   │   └── scan-error.mp3
│   └── index.html
├── src/
│   ├── components/
│   │   ├── camera/
│   │   │   ├── CameraFeed.tsx
│   │   │   ├── DetectionZone.tsx
│   │   │   ├── CameraControls.tsx
│   │   │   └── CaptureButton.tsx
│   │   ├── cards/
│   │   │   ├── CardPreview.tsx
│   │   │   ├── CardTile.tsx
│   │   │   ├── CardGrid.tsx
│   │   │   └── CardDetails.tsx
│   │   ├── collection/
│   │   │   ├── CollectionView.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── FilterControls.tsx
│   │   │   └── Pagination.tsx
│   │   ├── scan/
│   │   │   ├── ScanView.tsx
│   │   │   ├── ScanHistory.tsx
│   │   │   └── QuantityControls.tsx
│   │   ├── modals/
│   │   │   ├── ManualEntryModal.tsx
│   │   │   ├── CardDetailModal.tsx
│   │   │   └── ErrorModal.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── Navigation.tsx
│   │   └── ui/                   # shadcn components
│   ├── services/
│   │   ├── camera.service.ts     # Camera management
│   │   ├── ocr.service.ts        # Tesseract wrapper
│   │   ├── scryfall.service.ts   # API integration
│   │   ├── database.service.ts   # IndexedDB wrapper
│   │   └── image.service.ts      # Image processing
│   ├── hooks/
│   │   ├── useCamera.ts
│   │   ├── useCardRecognition.ts
│   │   ├── useCollection.ts
│   │   └── useDebounce.ts
│   ├── store/
│   │   ├── scanStore.ts          # Scanning state
│   │   ├── collectionStore.ts    # Collection state
│   │   └── settingsStore.ts      # App settings
│   ├── types/
│   │   ├── card.types.ts
│   │   ├── scryfall.types.ts
│   │   └── database.types.ts
│   ├── utils/
│   │   ├── imageProcessing.ts
│   │   ├── textNormalization.ts
│   │   └── fuzzyMatch.ts
│   ├── workers/
│   │   └── ocr.worker.ts         # Web Worker for OCR
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 8. Development Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Project setup (Vite + React + TypeScript + Tailwind)
- [ ] Basic layout and navigation
- [ ] Camera integration with device selection
- [ ] IndexedDB setup with Dexie.js

### Phase 2: Card Recognition (Week 2)
- [ ] Tesseract.js integration with Web Worker
- [ ] Image preprocessing pipeline
- [ ] Scryfall API integration
- [ ] Fuzzy matching for typo tolerance

### Phase 3: Scanning UI (Week 3)
- [ ] Detection zone overlay
- [ ] Auto-capture with stability detection
- [ ] Card preview component
- [ ] Quantity controls and foil toggle
- [ ] Scan history panel

### Phase 4: Collection Management (Week 4)
- [ ] Card grid view
- [ ] Search and filter functionality
- [ ] Card detail modal
- [ ] Edit/delete capabilities
- [ ] Pagination

### Phase 5: Polish & Features (Week 5)
- [ ] Manual entry modal with autocomplete
- [ ] Error handling and user feedback
- [ ] Audio/visual feedback
- [ ] Import/Export (CSV, JSON)
- [ ] Settings persistence
- [ ] Statistics dashboard

### Phase 6: Optimization (Week 6)
- [ ] Performance profiling
- [ ] OCR accuracy tuning
- [ ] Caching optimization
- [ ] Offline support
- [ ] Testing and bug fixes

---

## 9. Key Implementation Details

### Camera Stability Detection
```typescript
const STABILITY_THRESHOLD = 500; // ms
const MOVEMENT_THRESHOLD = 10; // pixels

function detectStability(frames: ImageData[]): boolean {
  if (frames.length < 2) return false;
  
  const diff = calculateFrameDifference(
    frames[frames.length - 1],
    frames[frames.length - 2]
  );
  
  return diff < MOVEMENT_THRESHOLD;
}
```

### Card Name Extraction Region
```typescript
// MTG card name is in top portion
const NAME_REGION = {
  x: 0.08,      // 8% from left
  y: 0.045,     // 4.5% from top
  width: 0.84,  // 84% of card width
  height: 0.08  // 8% of card height
};
```

### Scryfall Rate Limiting
```typescript
class ScryfallService {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequest = 0;
  private minDelay = 100; // 10 requests per second max

  async request<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const elapsed = Date.now() - this.lastRequest;
      if (elapsed < this.minDelay) {
        await sleep(this.minDelay - elapsed);
      }
      
      const fn = this.queue.shift()!;
      this.lastRequest = Date.now();
      await fn();
    }

    this.processing = false;
  }
}
```

---

## 10. Testing Strategy

### Unit Tests
- Image processing functions
- Text normalization
- Fuzzy matching algorithm
- Database operations

### Integration Tests
- OCR pipeline (image → text → API → result)
- Camera capture → recognition flow
- Database CRUD operations

### E2E Tests
- Full scan flow (camera → recognition → database)
- Collection management workflows
- Import/Export functionality

### Manual Testing
- Various card conditions (worn, foil, different sets)
- Different lighting conditions
- Camera angle tolerance
- Edge cases (split cards, DFCs, tokens)

---

## 11. Future Enhancements

### Nice-to-Have Features
- Bulk scanning mode (rapid consecutive scans)
- Price tracking and alerts
- Deck building integration
- Cloud sync (optional account system)
- Mobile app version (React Native)
- Barcode scanner support (set barcodes)
- Condition grading assistance
- Trade list management
- Wishlist functionality

### Advanced Recognition
- Double-faced card detection
- Split/Adventure card handling
- Art card / promo detection
- Language detection
- Foil detection via glare analysis

---

## 12. Quick Start Commands for Claude Code

```bash
# Initialize project
npm create vite@latest mtg-scanner -- --template react-ts
cd mtg-scanner

# Install core dependencies
npm install react-webcam tesseract.js dexie zustand axios

# Install UI dependencies
npm install -D tailwindcss postcss autoprefixer
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react class-variance-authority clsx tailwind-merge

# Initialize Tailwind
npx tailwindcss init -p

# Start development
npm run dev
```

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Recognition accuracy | > 95% on standard cards |
| Time to recognize | < 2 seconds |
| False positive rate | < 1% |
| UI response time | < 100ms |
| Crash rate | < 0.1% |

---

*Document Version: 1.0*
*Created for: MTG Card Scanner Project*
*Ready for implementation in Claude Code*
