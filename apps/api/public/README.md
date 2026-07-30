# MangaVerse APK Downloads

Place compiled Android APK files in this directory. They will be served at `/api/download/<filename>`.

## How to Build the APK

### Prerequisites
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`)
- Expo account (`eas login`)

### Build for Release
```bash
# From the project root
cd apps/mobile

# Build APK locally (requires Android SDK)
pnpm build:apk

# Build APK on EAS servers (recommended)
eas build --platform android --profile preview

# After build, copy the APK here:
# cp ~/path/to/output.apk public/mangaverse-v0.1.0.apk
```

### Versioning
- Update `version` in `apps/mobile/app.json`
- Update `VERSIONS` array in `apps/web/src/app/download/page.tsx`
- Copy the built APK to this directory with the matching version filename
