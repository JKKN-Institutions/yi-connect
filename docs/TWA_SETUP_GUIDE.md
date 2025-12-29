# Yi Connect - Trusted Web Activity (TWA) Setup Guide

**Complete Step-by-Step Guide for Publishing Yi Connect to Google Play Store**

---

## Prerequisites

- ✅ Windows machine with Node.js installed
- ✅ Java Development Kit (JDK) installed (for keytool and Android builds)
- ✅ Android device or emulator for testing
- ✅ Google Play Developer account ($25 one-time fee)

---

## Phase 1: Initial Setup ✅ COMPLETED

- ✅ PNG icons generated (192x192, 512x512, maskable versions)
- ✅ Manifest updated with PNG icon references
- ✅ Privacy policy page created at `/privacy-policy`

---

## Phase 2: Bubblewrap Installation & TWA Project Setup

### Step 1: Install Bubblewrap CLI Globally

**Run this command in PowerShell or Command Prompt:**

```bash
npm install -g @bubblewrap/cli
```

**Verify installation:**

```bash
bubblewrap --version
```

You should see output like: `@bubblewrap/cli@1.x.x`

---

### Step 2: Create TWA Project Directory

**Navigate to a location OUTSIDE your yi-connect project:**

```bash
# Example: Create in parent directory
cd D:\Projects
mkdir yi-connect-twa
cd yi-connect-twa
```

**Important:** Do NOT run Bubblewrap inside the yi-connect project directory.

---

### Step 3: Initialize TWA Project

**Run Bubblewrap initialization:**

```bash
bubblewrap init --manifest https://yi-connect.vercel.app/manifest.json
```

**Bubblewrap will prompt you for the following information:**

1. **Application name:** `Yi Connect`
2. **Short name:** `Yi Connect`
3. **Package ID (must be unique):** `com.jkkninstitutions.yiconnect`
4. **Host:** `yi-connect.vercel.app`
5. **Start URL:** `/m`
6. **Display mode:** `standalone` (should auto-detect from manifest)
7. **Theme color:** `#3b82f6` (should auto-detect from manifest)
8. **Background color:** `#ffffff` (should auto-detect from manifest)
9. **Icon URL:** Accept the detected icon or specify `/icons/icon-512x512.png`
10. **Maskable icon URL:** `/icons/icon-512x512-maskable.png`
11. **Splash screen settings:** Accept defaults
12. **Fallback behavior:** `customtabs` (if TWA fails, open in Chrome Custom Tab)
13. **Enable notifications:** `Yes`
14. **Web Share Target API:** `No` (or Yes if you want to enable sharing to the app)
15. **Location delegation:** `Yes` (for event check-in geolocation)

**Expected Output:**

```
✅ Project created successfully!
📁 Project directory: D:\Projects\yi-connect-twa
📦 Package name: com.jkkninstitutions.yiconnect
```

**What Bubblewrap Created:**

```
yi-connect-twa/
├── app/
│   ├── build.gradle
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── res/
│           │   ├── mipmap-*/  (app icons)
│           │   ├── values/
│           │   └── xml/
│           └── java/com/jkkninstitutions/yiconnect/
│               ├── LauncherActivity.java
│               └── DelegationService.java
├── build.gradle
├── settings.gradle
├── gradle/
├── twa-manifest.json
└── assetlinks.json (template)
```

---

## Phase 3: Generate Android Keystore (App Signing)

### Step 4: Generate Release Keystore

**This keystore is used to sign your app for Google Play Store.**

**⚠️ CRITICAL: Keep this keystore file SECURE. If you lose it, you CANNOT update your app on Play Store!**

**Run this command (adjust path as needed):**

```bash
keytool -genkey -v -keystore yi-connect-release.keystore ^
  -alias yi-connect-key ^
  -keyalg RSA ^
  -keysize 2048 ^
  -validity 10000
```

**Keytool will prompt for:**

1. **Keystore password:** Enter a STRONG password (remember this!)
2. **Re-enter password:** Confirm password
3. **What is your first and last name?** `JKKN Institutions`
4. **What is the name of your organizational unit?** `Yi Chapter`
5. **What is the name of your organization?** `JKKN`
6. **What is the name of your City or Locality?** `Erode`
7. **What is the name of your State or Province?** `Tamil Nadu`
8. **What is the two-letter country code for this unit?** `IN`
9. **Is CN=JKKN Institutions, OU=Yi Chapter... correct?** `yes`
10. **Enter key password (RETURN if same as keystore password):** Press ENTER to use same password

**Expected Output:**

```
[Storing yi-connect-release.keystore]
```

**IMPORTANT: Back up this keystore file NOW!**

```bash
# Copy to secure location (external drive, password manager, cloud storage)
copy yi-connect-release.keystore D:\Backups\
```

---

### Step 5: Extract SHA-256 Certificate Fingerprint

**This fingerprint is needed for Digital Asset Links verification.**

**Run this command:**

```bash
keytool -list -v -keystore yi-connect-release.keystore -alias yi-connect-key
```

**Enter keystore password when prompted.**

**Look for the SHA-256 line in the output:**

```
Certificate fingerprints:
         SHA1: 3F:12:A4:...
         SHA256: 14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C
```

**Copy the SHA-256 fingerprint** (the part after `SHA256:`). You'll need this for assetlinks.json.

**Save it to a text file for reference:**

```bash
# Create a file to store the fingerprint
echo "SHA-256: 14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C" > sha256-fingerprint.txt
```

---

## Phase 4: Configure Digital Asset Links

### Step 6: Create assetlinks.json

**This file proves you own both the domain and the Android app.**

**Navigate to your yi-connect project:**

```bash
cd D:\Projects\yi-connect
```

**Create the .well-known directory (if it doesn't exist):**

```bash
mkdir public\.well-known
```

**Create `public\.well-known\assetlinks.json` with your SHA-256 fingerprint:**

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.jkkninstitutions.yiconnect",
      "sha256_cert_fingerprints": [
        "14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C"
      ]
    }
  }
]
```

**⚠️ REPLACE** the `sha256_cert_fingerprints` value with YOUR actual SHA-256 fingerprint from Step 5!

---

### Step 7: Deploy assetlinks.json to Vercel

**Commit and push the changes:**

```bash
git add public/.well-known/assetlinks.json
git commit -m "Add Digital Asset Links for TWA verification"
git push
```

**Vercel will automatically deploy the changes.**

**Verify the file is accessible:**

```bash
curl https://yi-connect.vercel.app/.well-known/assetlinks.json
```

**You should see your assetlinks.json content returned.**

**Alternative: Test in browser:**
Open: `https://yi-connect.vercel.app/.well-known/assetlinks.json`

You should see the JSON file (not a 404 error).

---

## Phase 5: Configure Signing in Bubblewrap

### Step 8: Update TWA Manifest with Keystore Info

**Navigate to the TWA project directory:**

```bash
cd D:\Projects\yi-connect-twa
```

**Edit `twa-manifest.json` to add signing configuration:**

Open the file in a text editor and locate the `signing` section. Update it:

```json
{
  "signing": {
    "keystore": "../yi-connect-release.keystore",
    "alias": "yi-connect-key",
    "keystorePassword": "YOUR_KEYSTORE_PASSWORD",
    "keyPassword": "YOUR_KEY_PASSWORD"
  }
}
```

**⚠️ SECURITY WARNING:** For production, use environment variables instead of hardcoding passwords:

```json
{
  "signing": {
    "keystore": "../yi-connect-release.keystore",
    "alias": "yi-connect-key",
    "keystorePassword": "${KEYSTORE_PASSWORD}",
    "keyPassword": "${KEY_PASSWORD}"
  }
}
```

Then set environment variables before building:

```bash
set KEYSTORE_PASSWORD=your_password
set KEY_PASSWORD=your_password
```

---

## Phase 6: Build and Test

### Step 9: Build Debug APK (for Testing)

**Still in the TWA project directory:**

```bash
bubblewrap build --skipPwaValidation
```

**What this does:**
- Builds a debug APK (skips Digital Asset Links validation for easier testing)
- Output: `app\build\outputs\apk\debug\app-debug.apk`

**Expected Output:**

```
✅ Build successful!
📦 APK location: app\build\outputs\apk\debug\app-debug.apk
```

---

### Step 10: Install and Test on Android Device

**Option A: Using ADB (Android Debug Bridge)**

1. **Enable USB Debugging on your Android device:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

2. **Connect device via USB and verify:**

```bash
adb devices
```

Expected output:
```
List of devices attached
1234567890ABCDEF    device
```

3. **Install the APK:**

```bash
adb install app\build\outputs\apk\debug\app-debug.apk
```

4. **Launch the app:**

```bash
adb shell am start -n com.jkkninstitutions.yiconnect/.LauncherActivity
```

**Option B: Manual Installation**

1. Copy `app-debug.apk` to your Android device
2. Open the APK file on your device
3. Android will prompt you to install (may need to enable "Install from Unknown Sources")

---

### Step 11: Test Functionality

**On your Android device, test the following:**

- [ ] App launches without address bar (if Digital Asset Links verified)
- [ ] Navigate to Dashboard (`/m`)
- [ ] Navigate to Events (`/m/events`)
- [ ] Navigate to Check-in (`/m/checkin`)
- [ ] Test QR scanner (camera access)
- [ ] Test push notifications (grant permission)
- [ ] Go offline and test offline mode
- [ ] Test background sync when back online
- [ ] Test haptic feedback (vibration)
- [ ] Test all navigation and features

**Debug with Chrome DevTools:**

1. On your computer, open Chrome
2. Go to `chrome://inspect/#devices`
3. Your Android device should appear
4. Click "Inspect" under Yi Connect
5. Full DevTools available (console, network, storage)

---

## Phase 7: Build Release APK/AAB for Play Store

### Step 12: Build Release App Bundle (AAB)

**App Bundle (AAB) is the recommended format for Play Store (smaller downloads for users).**

**Navigate to TWA project directory:**

```bash
cd D:\Projects\yi-connect-twa
```

**Build the release AAB:**

```bash
bubblewrap build
```

**This will prompt for keystore password. Enter the password you set in Step 4.**

**Expected Output:**

```
✅ Build successful!
📦 AAB location: app\build\outputs\bundle\release\app-release.aab
```

**Verify the AAB was created:**

```bash
dir app\build\outputs\bundle\release\
```

You should see `app-release.aab` file.

---

## Phase 8: Prepare Play Store Assets

### Step 13: Take App Screenshots

**You need at least 2 screenshots (recommend 4-6) of your app for Play Store listing.**

**Recommended sizes:**
- Phone screenshots: 1080x1920 (portrait) or 1920x1080 (landscape)
- Tablet screenshots: 1200x1920 or 2560x1600 (optional but recommended)

**How to take screenshots on Android:**

1. Open Yi Connect app on your device
2. Navigate to key screens (Dashboard, Events, Check-in, Profile)
3. Press Volume Down + Power Button simultaneously
4. Screenshots saved to Photos/Screenshots

**Recommended screenshots:**
1. Dashboard with stats and quick actions
2. Events listing
3. QR code check-in screen
4. Profile page
5. Event details
6. Notifications screen

**Transfer screenshots to computer:**

```bash
# Pull screenshots from device via ADB
adb pull /sdcard/Pictures/Screenshots D:\Projects\yi-connect-twa\screenshots
```

---

### Step 14: Create Feature Graphic

**Feature graphic is the banner image for your Play Store listing.**

**Requirements:**
- Size: 1024 x 500 pixels
- Format: PNG or JPEG
- Content: App name, logo, and key features

**Tools:**
- Canva (free, easy)
- Figma (free, professional)
- Photoshop (if available)

**Template idea:**
- Background: Gradient (#3b82f6 to #1d4ed8) matching your brand
- Left side: Yi Connect logo
- Right side: "Unified Chapter Management" + key icons (events, finance, communication)

---

## Phase 9: Google Play Console Setup

### Step 15: Create Google Play Developer Account

1. **Go to:** https://play.google.com/console
2. **Sign in** with your Google account
3. **Pay $25 registration fee** (one-time)
4. **Complete developer profile:**
   - Developer name: JKKN Institutions (or your organization name)
   - Email: your email
   - Phone: your phone
5. **Accept Play Store terms**

**Note:** Account approval takes 24-48 hours.

---

### Step 16: Create New App in Play Console

1. **Click "Create App"**

2. **App Details:**
   - App name: **Yi Connect**
   - Default language: **English (United States)**
   - App or game: **App**
   - Free or paid: **Free**

3. **Declarations:**
   - [x] This app complies with Google Play policy
   - [x] This app is directed at children OR This app targets children and families

4. **Click "Create App"**

---

### Step 17: Complete App Listing

**Navigate to Dashboard → Store presence → Main store listing**

**Fill in the following:**

1. **App name:** Yi Connect

2. **Short description (max 80 chars):**
   ```
   Yi Chapter Management System - Events, Finance, Communication & Leadership
   ```

3. **Full description (max 4000 chars):**
   ```
   Yi Connect is the comprehensive Yi Chapter Management System designed to unify member operations, events, finance, communication, and leadership across Yi Chapters.

   🎯 KEY FEATURES

   📊 Member Intelligence Hub
   • Centralized member database with professional skills tracking
   • Smart volunteer matching for events
   • Leadership readiness scoring
   • Engagement metrics and analytics

   📅 Event Lifecycle Manager
   • Event creation with RSVP management
   • QR code check-in for seamless attendance tracking
   • Volunteer assignments and shift scheduling
   • Post-event reporting and feedback collection

   💰 Financial Command Center
   • Budget creation and expense tracking
   • Sponsorship pipeline management
   • Reimbursement workflows with approval chains
   • Predictive budget analytics

   📢 Communication Hub
   • Centralized announcements and newsletters
   • Smart scheduling with audience targeting
   • Push notifications for important updates
   • WhatsApp integration for instant communication

   🏆 Awards & Recognition
   • Take Pride Award automation
   • Nomination tracking and jury scoring
   • Leaderboards and certificate generation

   📱 Mobile-First Experience
   • Optimized for mobile with bottom navigation
   • Full offline support with automatic sync
   • QR scanner for quick event check-in
   • Haptic feedback for better interaction

   🔐 Security & Privacy
   • Secure authentication with magic link login
   • Row-level security for data protection
   • Role-based access control
   • HTTPS encryption for all data

   PERFECT FOR:
   • Yi Chapter members and leaders
   • Event coordinators and volunteers
   • Finance teams and treasurers
   • Communication managers

   Yi Connect brings all chapter operations into one powerful, easy-to-use mobile application.
   ```

4. **App icon:** Upload `icon-512x512.png` (512x512 PNG)

5. **Feature graphic:** Upload your 1024x500 banner

6. **Phone screenshots:** Upload at least 2 screenshots (1080x1920)

7. **Tablet screenshots:** Optional (but recommended)

8. **App category:** Business / Productivity

9. **Tags:** management, events, yi, chapter, organization, productivity

10. **Contact details:**
    - Email: support@yiconnect.com (or your actual support email)
    - Phone: (optional)
    - Website: https://yi-connect.vercel.app

11. **Privacy policy URL:** `https://yi-connect.vercel.app/privacy-policy`

---

### Step 18: Complete Content Rating

**Navigate to Dashboard → Policy → App content → Content rating**

1. **Click "Start questionnaire"**

2. **Select app category:** Productivity

3. **Answer questions about content:**
   - Does your app contain violence? **No**
   - Does your app contain sexual content? **No**
   - Does your app contain profanity? **No**
   - Does your app contain controlled substances? **No**
   - Does your app contain gambling? **No**

4. **Submit**

Google will assign age ratings (ESRB, PEGI, etc.) based on your responses.

---

### Step 19: Complete Target Audience

**Navigate to Dashboard → Policy → App content → Target audience**

1. **Target age group:** 18+ (Adults)

2. **Submit**

---

### Step 20: Complete App Access

**Navigate to Dashboard → Policy → App content → App access**

1. **All functionality is available without restrictions?** Yes

2. **Submit**

---

### Step 21: Complete Data Safety

**Navigate to Dashboard → Policy → App content → Data safety**

**Data collection:**

1. **Does your app collect or share user data?** Yes

2. **Select data types collected:**
   - Personal info → Name, Email address, User IDs
   - Photos and videos → Optional (for profile photos)
   - App activity → In-app actions, App interactions

3. **Data usage:**
   - App functionality
   - Analytics

4. **Data sharing:**
   - No, we don't share data with third parties

5. **Data security:**
   - [x] Data is encrypted in transit
   - [x] Data is encrypted at rest
   - [x] Users can request deletion

6. **Submit**

---

## Phase 10: Upload and Submit

### Step 22: Create Production Release

**Navigate to Dashboard → Release → Production**

1. **Click "Create new release"**

2. **App bundles:** Upload `app-release.aab`

3. **Release name:** `1.0.0 - Initial Release`

4. **Release notes:**
   ```
   Initial release of Yi Connect for Android.

   Features:
   • Complete chapter management system
   • Event creation and QR check-in
   • Financial tracking and budgeting
   • Communication hub with push notifications
   • Full offline support
   • Mobile-optimized dashboard
   ```

5. **Click "Save"**

---

### Step 23: Review and Rollout

1. **Review all sections** - ensure no red exclamation marks remain

2. **Complete any missing information**

3. **Click "Start rollout to Production"**

4. **Confirm submission**

---

### Step 24: Wait for Review

**Google Play review typically takes 2-7 days (usually 2-3 days).**

**You'll receive an email when:**
- App is approved (goes live automatically)
- App needs changes (address issues and resubmit)

**Track review status:** Play Console Dashboard → Publishing overview

---

## Phase 11: Post-Launch

### Step 25: Monitor App Health

**After app goes live:**

1. **Monitor crash reports:** Play Console → Quality → Crashes & ANRs

2. **Read user reviews:** Play Console → Reviews

3. **Track installs:** Play Console → Statistics

4. **Monitor performance:** Play Console → Quality → Android vitals

---

### Step 26: Update Your App

**For PWA content updates (no app store update needed):**
1. Deploy changes to Vercel
2. Users get updates instantly when they open the app
3. No Play Store submission required

**For Android config updates (requires app store update):**
1. Increment version in `twa-manifest.json`
2. Rebuild AAB: `bubblewrap build`
3. Upload new AAB to Play Console
4. Submit for review

---

## Troubleshooting

### Issue: Digital Asset Links Not Verifying

**Symptom:** App shows address bar instead of fullscreen

**Solutions:**
1. Verify assetlinks.json is accessible: `curl https://yi-connect.vercel.app/.well-known/assetlinks.json`
2. Check SHA-256 fingerprint matches keystore
3. Ensure package name matches exactly
4. Wait 5-10 minutes for Google's cache to update
5. Use Google's validator: https://developers.google.com/digital-asset-links/tools/generator

---

### Issue: Build Fails

**Common causes:**
- JDK not installed or wrong version (need JDK 11 or higher)
- Keystore password incorrect
- Gradle build issues

**Solutions:**
```bash
# Check Java version
java -version

# Clean build
cd yi-connect-twa
bubblewrap build --skipPwaValidation
```

---

### Issue: Camera Permission Denied

**Solution:**
- Ensure AndroidManifest.xml has camera permission (Bubblewrap adds this automatically)
- User must grant permission when prompted
- Test on Android 6.0+ (runtime permissions)

---

## Success Checklist

Before submitting to Play Store, ensure:

- [ ] PNG icons generated and referenced in manifest
- [ ] Privacy policy page accessible at `/privacy-policy`
- [ ] assetlinks.json accessible at `/.well-known/assetlinks.json`
- [ ] Digital Asset Links verified (app launches fullscreen)
- [ ] All features tested on device (push, QR, offline, sync)
- [ ] Release AAB built successfully
- [ ] Screenshots prepared (minimum 2)
- [ ] Feature graphic created (1024x500)
- [ ] Play Console all sections completed
- [ ] No red exclamation marks in Play Console dashboard

---

## Timeline Summary

- **Days 1-2:** Icon conversion, privacy policy ✅ DONE
- **Day 3:** Bubblewrap setup, keystore generation
- **Day 4:** Digital Asset Links, testing
- **Day 5-6:** Play Console setup, screenshots, submission
- **Day 7-14:** Google review and approval

**Total: 1-2 weeks to Play Store launch**

---

## Support

If you encounter issues:

1. **Bubblewrap Issues:** https://github.com/GoogleChromeLabs/bubblewrap/issues
2. **TWA Documentation:** https://developer.chrome.com/docs/android/trusted-web-activity/
3. **Play Console Help:** https://support.google.com/googleplay/android-developer

---

**Good luck with your Play Store launch! 🚀**
