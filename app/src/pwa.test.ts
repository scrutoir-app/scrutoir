import { test } from "node:test";
import assert from "node:assert/strict";
import { appliHote, appareilIOS, contexteArrivee, navigateurIOS, type EnvArrivee } from "./pwa";

// User agents réels (relevés sur appareils, 2024-2026), un par cas à distinguer.
const UA = {
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  // iPad en Safari : « site pour ordinateur » par défaut, il se présente comme un Mac.
  safariIpad:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  chromeIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1",
  firefoxIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,3; iOS 17_5; fr_FR; fr; scale=3.00; 1290x2796; 609183093)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 Instagram 334.0.0.42.95 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; fr_FR; 609848000)",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.50.106;FBBV/621178263;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/fr_FR;FBOP/5;FBRV/623034517]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/430.0.0.23.113;]",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/465.0.0.38.105;FBBV/615052563;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/fr_FR;FBOP/5]",
  tiktokIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR isDarkMode/0 WKWebView/1 RevealType/Dialog BytedanceWebview/d8a21c6",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-A525F Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 trill_330003 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/33.0.3 ByteLocale/fr ByteFullLocale/fr Region/FR BytedanceWebview/d8a21c6",
  snapchatIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.0.0.40 (like Safari/8617.2.4.10.8, panda)",
  linkedinIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.29.8935",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  firefoxMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0",
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
};

const env = (ua: string, o: Partial<EnvArrivee> = {}): EnvArrivee => ({ ua, standalone: false, invite: false, pointsTactiles: 0, ...o });
const tactile = { pointsTactiles: 5 };

test("contexte : app installée d'abord, quel que soit l'appareil", () => {
  assert.equal(contexteArrivee(env(UA.safariIphone, { standalone: true })), "installee");
  assert.equal(contexteArrivee(env(UA.chromeAndroid, { standalone: true, invite: true })), "installee");
  assert.equal(contexteArrivee(env(UA.chromeWindows, { standalone: true })), "installee");
});

test("contexte : navigateurs intégrés, iOS et Android", () => {
  for (const ua of [UA.instagramIos, UA.facebookIos, UA.messengerIos, UA.tiktokIos, UA.snapchatIos, UA.linkedinIos])
    assert.equal(contexteArrivee(env(ua, tactile)), "integre-ios", ua);
  for (const ua of [UA.instagramAndroid, UA.facebookAndroid, UA.tiktokAndroid])
    assert.equal(contexteArrivee(env(ua, tactile)), "integre-android", ua);
  // L'invite d'installation ne change rien dans un navigateur intégré.
  assert.equal(contexteArrivee(env(UA.instagramAndroid, { invite: true })), "integre-android");
});

test("contexte : iPhone et iPad hors appli hôte (Safari, Chrome iOS, iPad qui se dit Mac)", () => {
  assert.equal(contexteArrivee(env(UA.safariIphone, tactile)), "ios");
  assert.equal(contexteArrivee(env(UA.chromeIphone, tactile)), "ios");
  assert.equal(contexteArrivee(env(UA.firefoxIphone, tactile)), "ios");
  assert.equal(contexteArrivee(env(UA.safariIpad, tactile)), "ios");
});

test("contexte : Android avec ou sans invite d'installation", () => {
  assert.equal(contexteArrivee(env(UA.chromeAndroid, { invite: true })), "android-installable");
  assert.equal(contexteArrivee(env(UA.samsungInternet, { invite: true })), "android-installable");
  assert.equal(contexteArrivee(env(UA.chromeAndroid)), "android");
  assert.equal(contexteArrivee(env(UA.firefoxAndroid)), "android");
});

test("contexte : ordinateur, même avec une invite (Chrome de bureau) ou un Mac sans écran tactile", () => {
  assert.equal(contexteArrivee(env(UA.firefoxMac)), "ordinateur");
  assert.equal(contexteArrivee(env(UA.chromeWindows, { invite: true })), "ordinateur");
  assert.equal(contexteArrivee(env(UA.safariMac)), "ordinateur");
  assert.equal(contexteArrivee(env("")), "ordinateur");
});

test("appli hôte : nom affiché quand on le connaît", () => {
  assert.equal(appliHote(UA.instagramIos), "Instagram");
  assert.equal(appliHote(UA.instagramAndroid), "Instagram");
  assert.equal(appliHote(UA.facebookIos), "Facebook");
  assert.equal(appliHote(UA.facebookAndroid), "Facebook");
  assert.equal(appliHote(UA.tiktokIos), "TikTok");
  assert.equal(appliHote(UA.tiktokAndroid), "TikTok");
  assert.equal(appliHote(UA.snapchatIos), "Snapchat");
  assert.equal(appliHote(UA.linkedinIos), "LinkedIn");
  assert.equal(appliHote(UA.messengerIos), null, "Messenger : intégré, sans nom");
  assert.equal(appliHote(UA.safariIphone), undefined);
  assert.equal(appliHote(UA.chromeAndroid), undefined);
});

test("navigateur iOS et appareil iOS", () => {
  assert.equal(navigateurIOS(UA.safariIphone), "safari");
  assert.equal(navigateurIOS(UA.safariIpad), "safari");
  assert.equal(navigateurIOS(UA.chromeIphone), "chrome");
  assert.equal(navigateurIOS(UA.firefoxIphone), "autre");
  assert.ok(appareilIOS(UA.safariIpad, 5));
  assert.ok(!appareilIOS(UA.safariMac, 0));
  assert.ok(!appareilIOS(UA.chromeAndroid, 5));
});

test("noms affichés : appareil et navigateur", async () => {
  const { nomAppareilIOS, nomNavigateurIOS, nomNavigateurAndroid } = await import("./pwa");
  assert.equal(nomAppareilIOS(env(UA.safariIphone, tactile)), "iPhone");
  assert.equal(nomAppareilIOS(env(UA.safariIpad, tactile)), "iPad");
  assert.equal(nomNavigateurIOS(UA.safariIphone), "Safari");
  assert.equal(nomNavigateurIOS(UA.chromeIphone), "Chrome");
  assert.equal(nomNavigateurIOS(UA.firefoxIphone), "ce navigateur");
  assert.equal(nomNavigateurAndroid(UA.chromeAndroid), "Chrome");
  assert.equal(nomNavigateurAndroid(UA.samsungInternet), "Samsung Internet");
});
