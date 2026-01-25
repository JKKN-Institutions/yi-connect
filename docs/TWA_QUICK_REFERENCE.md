# TWA Setup - Quick Reference Card

**Yi Connect → Google Play Store in 1-2 Weeks**

---

## ✅ Phase 1: COMPLETED

- [x] PNG icons generated (192x192, 512x512, maskable)
- [x] Manifest updated with PNG references
- [x] Privacy policy page created
- [x] Helper scripts and guide created

---

## 🚀 Phase 2: Manual Steps (You Need to Do This)

### Step 1: Verify Prerequisites

```bash
npm run twa:check
```

**Expected output:**
- ✅ Node.js
- ✅ Java (if not, install from https://adoptium.net/)
- ✅ Icons
- ✅ Privacy policy

### Step 2: Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

**Verify:**
```bash
bubblewrap --version
```

### Step 3: Initialize TWA Project

**Navigate OUTSIDE yi-connect project:**

```bash
cd D:\Projects
mkdir yi-connect-twa
cd yi-connect-twa
```

**Run Bubblewrap:**

```bash
bubblewrap init --manifest https://yi-connect-app.vercel.app/manifest.json
```

**Prompts (use these values):**
- App name: `Yi Connect`
- Package: `com.jkkninstitutions.yiconnect`
- Host: `yi-connect-app.vercel.app`
- Start URL: `/m`
- (Accept other defaults)

### Step 4: Generate Android Keystore

```bash
keytool -genkey -v -keystore yi-connect-release.keystore -alias yi-connect-key -keyalg RSA -keysize 2048 -validity 10000
```

**Remember the password you set!** ⚠️ Back up this keystore file!

### Step 5: Extract SHA-256 Fingerprint

```bash
keytool -list -v -keystore yi-connect-release.keystore -alias yi-connect-key
```

**Copy the SHA-256 line (format: 14:F9:D8:A5:...**

### Step 6: Update assetlinks.json

**Navigate back to yi-connect project:**

```bash
cd D:\Projects\yi-connect
```

**Update assetlinks.json with your SHA-256:**

```bash
npm run twa:update-assetlinks "YOUR_SHA256_FINGERPRINT_HERE"
```

Example:
```bash
npm run twa:update-assetlinks "14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C"
```

### Step 7: Deploy assetlinks.json

```bash
git add public/.well-known/assetlinks.json
git commit -m "Add Digital Asset Links for TWA"
git push
```

**Verify deployment:**

```bash
curl https://yi-connect-app.vercel.app/.well-known/assetlinks.json
```

Or open in browser: https://yi-connect-app.vercel.app/.well-known/assetlinks.json

### Step 8: Build Debug APK

**Navigate to TWA project:**

```bash
cd D:\Projects\yi-connect-twa
```

**Build:**

```bash
bubblewrap build --skipPwaValidation
```

**Output:** `app\build\outputs\apk\debug\app-debug.apk`

### Step 9: Test on Android Device

**Enable USB Debugging on your phone:**
- Settings → About Phone → Tap "Build Number" 7 times
- Settings → Developer Options → Enable "USB Debugging"

**Connect phone via USB and install:**

```bash
adb devices
adb install app\build\outputs\apk\debug\app-debug.apk
```

**Test all features:**
- [ ] App launches fullscreen (no address bar)
- [ ] Dashboard, Events, Check-in, Profile all work
- [ ] QR scanner accesses camera
- [ ] Push notifications
- [ ] Offline mode

### Step 10: Build Release AAB

**Update signing in twa-manifest.json:**

```json
{
  "signing": {
    "keystore": "../yi-connect-release.keystore",
    "alias": "yi-connect-key"
  }
}
```

**Build release:**

```bash
bubblewrap build
```

**Enter keystore password when prompted.**

**Output:** `app\build\outputs\bundle\release\app-release.aab`

---

## 📸 Phase 3: Play Store Assets

### Screenshots (Minimum 2, Recommend 4-6)

**Capture from your Android device:**
1. Dashboard
2. Events listing
3. QR check-in
4. Profile
5. Event details
6. Notifications

**Transfer to computer:**

```bash
adb pull /sdcard/Pictures/Screenshots screenshots/
```

### Feature Graphic (1024 x 500)

**Use Canva or Figma to create:**
- Background: Blue gradient (#3b82f6 → #1d4ed8)
- Left: Yi Connect logo
- Right: "Unified Chapter Management" + icons

---

## 🏪 Phase 4: Google Play Console

### Create Account

1. Go to: https://play.google.com/console
2. Pay $25 registration fee
3. Complete developer profile

### Create App

1. Click "Create App"
2. Name: **Yi Connect**
3. Language: English (US)
4. Type: App, Free

### Complete Sections

**Main Store Listing:**
- App name: Yi Connect
- Short description: "Yi Chapter Management - Events, Finance, Communication"
- Full description: (see TWA_SETUP_GUIDE.md)
- App icon: `icon-512x512.png`
- Feature graphic: Your 1024x500 banner
- Screenshots: Upload 2-6 phone screenshots
- Category: Business/Productivity
- Privacy policy: `https://yi-connect-app.vercel.app/privacy-policy`

**Content Rating:**
- Category: Productivity
- No violence, sexual content, profanity, etc.
- Target: Adults 18+

**Data Safety:**
- Collects: Name, Email, User activity
- Encrypted in transit and at rest
- Users can request deletion

### Upload AAB

1. Dashboard → Release → Production
2. Create new release
3. Upload `app-release.aab`
4. Release notes: "Initial release - Complete chapter management system"
5. Save and start rollout

---

## ⏱️ Timeline

- **Day 1-2:** Icons, privacy policy ✅ DONE
- **Day 3:** Bubblewrap setup, keystore, assetlinks
- **Day 4:** Testing on device
- **Day 5-6:** Screenshots, Play Console setup, submit
- **Day 7-14:** Google review (2-7 days typical)

**Total: 1-2 weeks**

---

## 🆘 Quick Troubleshooting

**Address bar shows in app?**
→ Digital Asset Links not verified. Check assetlinks.json is accessible and SHA-256 matches.

**Build fails?**
→ Check Java installed: `java -version` (need JDK 11+)

**Camera doesn't work?**
→ Grant camera permission when app prompts

**App not installing?**
→ Enable "Install from Unknown Sources" in Android settings

---

## 📚 Full Documentation

- **Complete Guide:** `docs/TWA_SETUP_GUIDE.md`
- **Implementation Plan:** `.claude/plans/dapper-cooking-umbrella.md`

---

## 🔑 Commands Cheat Sheet

```bash
# Check prerequisites
npm run twa:check

# Generate icons (if needed again)
npm run twa:icons

# Update assetlinks.json
npm run twa:update-assetlinks "SHA256_FINGERPRINT"

# Install Bubblewrap
npm install -g @bubblewrap/cli

# Init TWA (run outside project)
bubblewrap init --manifest https://yi-connect-app.vercel.app/manifest.json

# Generate keystore
keytool -genkey -v -keystore yi-connect-release.keystore -alias yi-connect-key -keyalg RSA -keysize 2048 -validity 10000

# Get SHA-256
keytool -list -v -keystore yi-connect-release.keystore -alias yi-connect-key

# Build debug APK
bubblewrap build --skipPwaValidation

# Install on device
adb install app-debug.apk

# Build release AAB
bubblewrap build
```

---

**Good luck! You're ready to publish Yi Connect to Google Play Store! 🚀**
