# MangaVerse Mobile App Assets

## ⚠️ IMPORTANT: SVG to PNG Conversion

Expo/Android/iOS do **not** support SVG files for app icons natively. The `.svg` files in this directory are **design source files**.

Before running `eas build`, you must convert them to **PNG**:

| File | Purpose | Required Size | Convert To |
|------|---------|---------------|-----------|
| `icon.svg` | App launcher icon | 1024×1024 PNG | `icon.png` |
| `adaptive-icon.svg` | Android adaptive icon foreground | 1024×1024 PNG with transparency | `adaptive-icon.png` |
| `splash.svg` | Splash/loading screen | 1242×2436 PNG (or device-specific) | `splash.png` |

### Quick Conversion (using sharp)

```bash
# Install sharp if not already available
pnpm add -D sharp

# Run the generator script
node scripts/generate-assets.js
```

### Update `app.json`
After generating PNGs, update `apps/mobile/app.json`:
```json
{
  "icon": "./assets/icon.png",
  "splash": {
    "image": "./assets/splash.png"
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png"
    }
  }
}
```
