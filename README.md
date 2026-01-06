# <p align="center">S.O.F.Y.

<p align="center">
  <img src="public/android_res/logo_color.svg" alt="App Icon" width="128"/>
</p>

<p align="center">
  <strong>Simple. Offline. Fluid. Yours.</strong><br>
  Transform your local library into a curated radio experience.
</p>

<p align="center">
  <img src="public/screenshots/player_1.png" alt="Screenshot 1" width="200" style="border-radius:16px;"/>
  <img src="public/screenshots/carousel.png" alt="Screenshot 2" width="200" style="border-radius:16px;"/>
  <img src="public/screenshots/player_2.png" alt="Screenshot 3" width="200" style="border-radius:16px;"/>
  <img src="public/screenshots/palette.png" alt="Screenshot 4" width="200" style="border-radius:16px;"/>
</p>

---

## ✨ Features

### 🎧 Radio Experience
- **Seamless Flow** — S.O.F.Y. generates a continuous stream from your local library. No distractions and no decisions - just pure music flow.
- **Random Queue** — Playback logic guarantees you a unique "Radio Station" every time you choose it.

### 🎨 Adaptive Interface
- **Reactive Design** — The UI is alive. It analyzes album art in real-time and extracts colors to customize the interface dynamically.
- **Customization** — Don't feel that algorithm get the colors right? You can choose what colors are selected from album art.

### 📂 Library
- **Offline First** — Zero internet dependencies. Your music stays on your device.
- **Wide Format Support** — Powered by ExoPlayer, S.O.F.Y. supports a vast range of audio formats, including MP3, M4A, FLAC, WAV, Ogg, and many more.

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Core Engine** | [Phaser 3](https://phaser.io/) |
| **Runtime / Bridge** | [Capacitor](https://github.com/ionic-team/capacitor) |
| **Native Layer** | Custom Android Plugins |
| **Audio** | Native Android Audio |

---

## 🚀 Getting Started

### Prerequisites

- Android Studio (latest)
- Node.js (v16+)
- Gradle tools

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/Drifty1803/SOFY
   cd SOFY
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Build the web assets**
   ```sh
   npm run build
   ```
   This will create the `dist` folder with the compiled web app.

4. **Sync with Android**
   ```sh
   npx cap sync android
   ```
   This command copies the web assets into the native Android project.

5. **Open in Android Studio**
   ```sh
   npx cap open android
   ```
   From Android Studio, you can build the APK and run the app on an emulator or a physical device.

---

## 🤝 Contributing

Contributions are welcome! If you have a suggestion or find a bug, please open an issue to discuss it.

If you'd like to contribute code:
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/YourFeature`)
3. Commit your Changes (`git commit -m 'I want to add this Feature'`)
4. Push to the Branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
