# Travel Journal — Project Overview & Concepts

This document outlines the core architecture and design principles of the Travel Journal application.

## 🌟 Core Concepts

### 1. Offline-First Architecture
The app is designed to work seamlessly in remote travel locations with poor or no internet connectivity.
- **Local Persistence**: All journal entries and photos are first saved locally using a custom repository pattern.
- **Sync Queue**: Actions taken while offline (creating, editing, deleting) are placed in a sync queue.
- **Background Synchronization**: When the app detects an active internet connection, it automatically triggers a background sync cycle to push local changes to the Firebase backend and pull updates from other devices.

### 2. AI-Powered Tagging
To help users organize memories without tedious typing:
- **Multi-Provider Analysis**: Every photo is analyzed by both **OpenAI GPT-4o** (for contextual/mood tags) and **Google Cloud Vision** (for objective object classification).
- **Fallbacks**: If premium APIs are unavailable or quotas are reached, the app falls back to free **Hugging Face** models (BLIP and ViT).

### 3. Cross-Platform Experience
Built with **React Native (v0.74+)**, the app shares 95%+ of its logic between iOS and Android, including:
- **Theming**: A unified dark/light mode system.
- **Navigation**: Native-feeling transitions using React Navigation.
- **State Management**: **Zustand** for lightweight, persistent global state.

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React Native, TypeScript, Reanimated 3 |
| **State** | Zustand + Middleware (Persist, Immer) |
| **Backend** | Node.js (Express), TypeScript |
| **Database** | Firebase Firestore (Cloud), Local Persistence |
| **Auth** | Google Sign-In + Firebase Auth |
| **Storage** | Firebase Storage |
| **AI** | OpenAI GPT-4o, Google Cloud Vision, Hugging Face |

## 📁 Repository Structure
- `/src`: Mobile application source code.
- `/backend`: Node.js/Express server source code.
- `/android` & `/ios`: Native platform code.
- `App.tsx`: The root component.
