# Travel Journal — Backend Deep Dive

This document analyzes the Node.js/Express backend that powers the Travel Journal application.

## 🚀 Infrastructure Stack

The backend is a **TypeScript + Node.js** application designed to act as a bridge between the mobile app and Firebase, while adding custom AI processing and data validation logic.

### 🧩 Architecture
- **Framework**: Express.js 4 (Model-View-Controller like structure).
- **Runtime**: TypeScript (compiled via `tsc`).
- **Persistence**: **Google Cloud Firestore** (via `firebase-admin`).
- **File Storage**: **Google Cloud Storage** (via Firebase buckets).
- **Health Tracking**: Integrated with **Winston** for logging and custom health endpoints.

## 🔑 Key Backend Components

### 1. Authentication (`/v1/auth`)
- **JWT Verification**: Instead of managing passwords, the backend receives a Google ID token from the mobile app.
- **Firebase Admin SDK**: The server verifies the token's authenticity with Google/Firebase.
- **User Upsert**: If the user is new, it creates a profile in Firestore; if existing, it returns the current profile.

### 2. Synchronization Engine (`/v1/sync`)
The sync logic is designed for **Conflict-Free Replication**:
- **Timestamp Tracking**: Both client and server track `updatedAt`.
- **Deduplication**: Uses generated UUIDs to ensure same entries are not duplicated across different devices.
- **Partial Updates**: Only modified fields are pushed to minimize data usage.

### 3. AI Upload Pipeline (`/v1/upload/photo`)
When an image is uploaded:
- **Streaming**: Uses `multer` to handle multi-part uploads directly to Firebase Storage.
- **Vertex AI / Vision**: (Configurable) Triggers AI analysis on the server-side to enrich entry metadata even if client-side tagging fails.

## 📡 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/auth/login` | Google Token verification & login |
| `GET` | `/v1/entries` | List journal entries with pagination |
| `POST` | `/v1/entries` | Create a new journal entry |
| `POST` | `/v1/sync` | Multi-entry bi-directional sync |
| `POST` | `/v1/upload/photo` | Multi-part image upload to storage |

## 🛡️ Security Measures
- **Helmet**: Secures Express apps by setting various HTTP headers.
- **Rate Limiting**: `express-rate-limit` prevents brute-force / DDoS attacks on the API.
- **CORS**: Configured only for the trusted mobile origins (`capacitor://`, `ionic://`, `localhost`).
- **Validation**: `express-validator` schema enforcement on every request body.
