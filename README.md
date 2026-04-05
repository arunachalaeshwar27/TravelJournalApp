# Travel Journal App

A production-ready, offline-first mobile app built with **React Native CLI** (bare workflow). Users can create, view, and manage rich travel journal entries with photos, auto-geolocation, and AI-powered image tagging.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Folder Structure](#folder-structure)
3. [Tech Stack & Rationale](#tech-stack--rationale)
4. [Features](#features)
5. [Setup & Installation](#setup--installation)
6. [Native Module Setup](#native-module-setup)
7. [Environment Variables](#environment-variables)
8. [APK Build Steps](#apk-build-steps)
9. [Key Implementation Details](#key-implementation-details)
10. [Performance Optimizations](#performance-optimizations)
11. [Interview Discussion Points](#interview-discussion-points)
12. [Assumptions](#assumptions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    React Native UI                   │
│  Screens  →  Components  →  Hooks  →  Stores        │
└─────────────────────┬───────────────────────────────┘
                       │ Zustand (state)
┌─────────────────────▼───────────────────────────────┐
│                   Service Layer                      │
│  authService │ geoService │ aiTaggingService         │
│  syncService │ apiClient  │                          │
└──────┬──────────────┬──────────────────┬────────────┘
       │              │                  │
┌──────▼──────┐ ┌─────▼──────┐ ┌────────▼────────┐
│  SQLite DB  │ │  Keychain   │ │  REST API /      │
│  (offline)  │ │  (tokens)   │ │  Firebase        │
└─────────────┘ └────────────┘ └─────────────────-┘
```

### Data Flow (Offline-First)

```
User Action
    │
    ▼
Zustand Store  ──write──►  SQLite (sync_status='local')
    │                            │
    │                    Sync Queue item enqueued
    │
    ▼
UI updates instantly (optimistic)
    │
    ▼   (when network available)
Sync Engine  ──push──►  Remote API
             ◄──pull──  Remote API
                │
                ▼
        Conflict Resolution (LWW)
                │
                ▼
         SQLite updated (sync_status='synced')
```

---

## Folder Structure

```
TravelJournalApp/
├── android/                    # Native Android project
├── ios/                        # Native iOS project
├── src/
│   ├── components/
│   │   ├── ui/                 # Generic reusable UI atoms
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── TextInput.tsx
│   │   │   ├── TagChip.tsx
│   │   │   └── SyncBadge.tsx
│   │   └── journal/            # Domain-specific components
│   │       ├── EntryCard.tsx
│   │       └── PhotoPicker.tsx
│   ├── database/
│   │   ├── db.ts               # SQLite singleton + migrate()
│   │   ├── schema.ts           # CREATE TABLE SQL constants
│   │   ├── entryRepository.ts  # Repository pattern for entries
│   │   └── syncQueueRepository.ts
│   ├── navigation/
│   │   └── RootNavigator.tsx   # All navigators (Root/Tab/Stack)
│   ├── screens/
│   │   ├── Auth/
│   │   │   └── AuthScreen.tsx
│   │   ├── Journal/
│   │   │   ├── JournalListScreen.tsx
│   │   │   ├── JournalDetailScreen.tsx
│   │   │   └── JournalEditorScreen.tsx
│   │   ├── Search/
│   │   │   └── SearchScreen.tsx
│   │   └── Profile/
│   │       └── ProfileScreen.tsx
│   ├── services/
│   │   ├── apiClient.ts        # Axios instance + interceptors
│   │   ├── authService.ts      # Google Sign-In + Keychain
│   │   ├── geoService.ts       # Geolocation + reverse geocode
│   │   ├── aiTaggingService.ts # Google Vision + offline queue
│   │   └── syncService.ts      # Offline sync engine
│   ├── store/
│   │   ├── authStore.ts        # Zustand auth slice
│   │   ├── journalStore.ts     # Zustand journal slice
│   │   └── syncStore.ts        # Zustand sync status slice
│   ├── theme/
│   │   ├── colors.ts           # Light + dark palettes
│   │   ├── typography.ts       # Font scale
│   │   ├── spacing.ts          # Spacing + radius + shadows
│   │   ├── index.ts            # Export AppTheme
│   │   └── ThemeContext.tsx    # useTheme hook + ThemeProvider
│   ├── types/
│   │   └── index.ts            # All domain types + nav params
│   └── utils/
│       ├── generateId.ts       # UUID v4
│       └── dateUtils.ts        # date-fns wrappers
├── App.tsx
├── index.js
├── package.json
├── tsconfig.json
├── babel.config.js
└── README.md
```

---

## Tech Stack & Rationale

| Concern | Choice | Why |
|---|---|---|
| **Framework** | React Native CLI 0.73 | Full native control; no Expo constraints |
| **Language** | TypeScript 5 | Type safety, better IDE support |
| **State** | **Zustand + Immer** | 1/10th Redux boilerplate; works outside React tree; easy immer integration |
| **Local DB** | **SQLite** (`react-native-sqlite-storage`) | Ships with device; SQL is battle-tested; no license concerns vs Realm |
| **Navigation** | React Navigation v6 (native-stack) | Fully native, best performance; industry standard |
| **Auth** | `@react-native-google-signin/google-signin` | Native module; supports both Android & iOS |
| **Secure storage** | `react-native-keychain` | Keychain (iOS) / Keystore (Android) for tokens |
| **HTTP** | Axios | Interceptors for auth injection + 401 handling |
| **Images** | `react-native-image-picker` + `react-native-fast-image` | Native camera/gallery + GPU-accelerated rendering |
| **AI Tagging** | Google Cloud Vision API | Label detection; free tier available |
| **Geolocation** | `@react-native-community/geolocation` | Native, no Play Services dependency |
| **Animations** | React Native Reanimated v3 | JS-thread free; smooth 60fps |
| **Drag & Drop** | `react-native-draggable-flatlist` | Smooth photo reorder |
| **Network detect** | `@react-native-community/netinfo` | Triggers sync on connectivity change |
| **Sync** | Custom LWW engine + queue | Deterministic, no extra backend needed |

---

## Features

### Core
- [x] Google Sign-In with secure token storage (Keychain/Keystore)
- [x] Create / Edit / Delete journal entries
- [x] Photo picker (camera + gallery, max 5)
- [x] Drag-to-reorder photos
- [x] Auto-fetch geolocation + reverse geocoding (Nominatim/OSM)
- [x] AI photo tagging (Google Vision, async)
- [x] Offline-first: all ops work without internet
- [x] Background sync when online (NetInfo listener)
- [x] Conflict resolution (Last-Write-Wins)
- [x] Search by title/description
- [x] Filter by tags, date range, location proximity
- [x] Dark/Light/System theme
- [x] Pull-to-refresh sync trigger
- [x] Sync status badge per entry

### Bonus
- [x] Smooth list animations (Reanimated FadeInDown with stagger)
- [x] Press scale animations on cards/buttons
- [x] AI tagging queue (offline → process when online)

---

## Setup & Installation

### Prerequisites

- Node.js ≥ 18
- JDK 17
- Android Studio (API 34 SDK)
- Xcode 15 (iOS)
- CocoaPods

### 1. Clone & install

```bash
git clone <repo>
cd TravelJournalApp
npm install
```

### 2. iOS pods

```bash
cd ios && pod install && cd ..
```

### 3. Environment variables

Create `.env` in the project root:

```env
GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
GOOGLE_VISION_API_KEY=your-google-vision-api-key
API_BASE_URL=https://api.yourdomain.com/v1
```

> Install `react-native-config` to load `.env` natively.

### 4. Run

```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

---

## Native Module Setup

### Google Sign-In (Android)

1. Create a project in [Firebase Console](https://console.firebase.google.com)
2. Add Android app → download `google-services.json` → place in `android/app/`
3. In `android/build.gradle`:
   ```groovy
   classpath 'com.google.gms:google-services:4.4.1'
   ```
4. In `android/app/build.gradle`:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```

### Google Sign-In (iOS)

1. Add iOS app in Firebase Console → download `GoogleService-Info.plist`
2. Add to Xcode project (not the folder, the project root)
3. In `Info.plist`, add `GIDClientID` with your client ID
4. Add URL scheme: `com.googleusercontent.apps.YOUR_CLIENT_ID`

### Location Permissions

**Android** — `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

**iOS** — `Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to tag your journal entries with location.</string>
```

### Camera & Photo Library

**Android** — `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

**iOS** — `Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Take photos for journal entries.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Choose photos for journal entries.</string>
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_WEB_CLIENT_ID` | From Firebase Console → Authentication → Sign-in method → Google |
| `GOOGLE_VISION_API_KEY` | Google Cloud Console → Vision API → Credentials |
| `API_BASE_URL` | Your backend REST API base URL |

---

## APK Build Steps

### Debug APK

```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK

**Step 1**: Generate a keystore (once):
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/app/travel-journal.keystore \
  -alias travel-journal \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

**Step 2**: Add to `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=travel-journal.keystore
MYAPP_UPLOAD_KEY_ALIAS=travel-journal
MYAPP_UPLOAD_STORE_PASSWORD=your_store_password
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

**Step 3**: Configure `android/app/build.gradle`:
```groovy
android {
  signingConfigs {
    release {
      storeFile file(MYAPP_UPLOAD_STORE_FILE)
      storePassword MYAPP_UPLOAD_STORE_PASSWORD
      keyAlias MYAPP_UPLOAD_KEY_ALIAS
      keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
    }
  }
}
```

**Step 4**: Build:
```bash
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### AAB (Google Play)

```bash
cd android && ./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

---

## Key Implementation Details

### Offline-First Architecture

```
All writes → SQLite (sync_status='local') + sync_queue entry
                  │
         Network restored
                  │
         runSyncCycle()
           ├── pushLocalChanges()  → POST/PUT/DELETE to API
           └── pullRemoteChanges() → GET ?since=lastSyncAt
                  │
         Conflict Resolution (LWW):
           remote.updatedAt > local.updatedAt → remote wins
           local.isDeleted = true             → deletion wins
```

### SQLite Schema Design

- **`journal_entries`**: Core entry data. Uses soft-delete (`is_deleted=1`) to support sync conflict detection.
- **`entry_photos`**: Linked via FK with cascade delete.
- **`sync_queue`**: Outbox pattern — each mutation is enqueued as a serialised operation.
- **`tagging_queue`**: Separate queue for AI tagging retries (max 3 attempts).

### AI Tagging Flow

```
Photo added
     │
  Online? ──YES──► tagPhotoOnline() → Vision API → updatePhotoTags(done)
     │
    NO
     │
  enqueueTaggingItem()
     │
  Network restored → processPendingTaggingQueue()
```

### Authentication Security

| Storage | What goes there |
|---|---|
| Keychain / Keystore | JWT / session token (never leaves secure enclave) |
| Zustand + AsyncStorage | User profile (name, email, photo URL) — not sensitive |

---

## Performance Optimizations

1. **FlatList with `keyExtractor`** — avoids full re-renders on list updates
2. **`React.memo` + `useCallback`** on `EntryCard` and render functions
3. **FastImage** — GPU-accelerated image rendering with disk caching
4. **Reanimated worklets** — animations run on UI thread, never JS thread
5. **SQLite indexes** on `user_id`, `created_at`, `sync_status` — O(log n) queries
6. **Lazy sync** — sync only fires when network changes, not on a polling timer
7. **Image compression** — `quality: 0.8` on `launchImageLibrary` reduces upload size
8. **Optimistic UI** — entries appear instantly; sync happens in background
9. **`partialize`** in Zustand persist — only serialises what's needed
10. **Hermes engine** — enabled by default in RN 0.73; faster startup + lower memory

---

## Interview Discussion Points

### Why SQLite over Realm?
- Realm requires understanding reactive queries and its own migration DSL
- SQLite is universally known; every interviewer understands SQL
- No additional license risk; ships with every Android/iOS device
- `react-native-sqlite-storage` is battle-tested and widely used

### Why Zustand over Redux Toolkit?
- RTK is excellent for large multi-team apps with complex side effects
- For a mobile app this size, Zustand cuts boilerplate by ~80%
- Crucially: Zustand works outside React — services can call `getStore().getState()` without hooks
- `immer` middleware gives the same immutability guarantees as RTK's `createSlice`

### LWW Conflict Resolution — Is it safe?
- For a personal travel journal (single-user or low concurrency), LWW is sufficient
- Production upgrade path: vector clocks or CRDTs (e.g. Automerge) for true multi-user
- The soft-delete pattern ensures deleted entries don't resurrect after sync

### Why not Expo?
- Expo managed workflow restricts native module access
- `react-native-google-signin` requires native Gradle/pod configuration
- Custom native modules (Keychain, Camera, Background Fetch) need bare workflow
- Expo's OTA updates add complexity to the release pipeline

---

## Assumptions

1. **Backend**: A REST API or Firebase Firestore exists at `API_BASE_URL`. The sync engine makes calls to `/entries` (GET, POST, PUT, DELETE). Firebase Firestore can replace this with Firestore listeners for real-time sync.

2. **Google Vision API**: A valid billing-enabled Google Cloud project is available. Free tier: 1,000 units/month.

3. **Single user**: The conflict resolution strategy assumes one user on multiple devices. For multi-user shared journals, a more sophisticated CRDT strategy would be needed.

4. **iOS**: This codebase requires additional native setup (Xcode, CocoaPods). The implementation is iOS-compatible but iOS-specific testing is assumed to be done by the team.

5. **react-native-fs**: Used in `aiTaggingService.ts` for reading images as base64. Add it to `package.json` if not already included.

6. **ProGuard rules**: For release builds, ProGuard rules for `react-native-sqlite-storage` and other native modules need to be added to `android/app/proguard-rules.pro`.
