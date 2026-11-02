// ─── Offline WebAuthn Biometric Support (Face ID / Touch ID / Fingerprint) ──
// Stores biometric credentials per user locally on the device (localStorage).
// 100% offline — uses the device hardware Secure Enclave / Keystore directly.

const BIOMETRIC_STORAGE_KEY = "yalambar_biometrics_v1";

interface BiometricStore {
  [userId: string]: {
    credentialId: string;
    userName: string;
    enabledAt: number;
  };
}

function getStore(): BiometricStore {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: BiometricStore) {
  try {
    localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Failed to save biometric store", e);
  }
}

/** Check if WebAuthn platform authenticator (Face ID / Touch ID / Fingerprint) is supported on this device */
export async function isBiometricsSupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    return false;
  }
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/** Check if a specific user has biometric enabled on this device */
export function hasBiometricForUser(userId: string): boolean {
  const store = getStore();
  return !!store[userId]?.credentialId;
}

/** Remove biometric credential for a user */
export function removeBiometricForUser(userId: string): void {
  const store = getStore();
  delete store[userId];
  saveStore(store);
}

/** Convert base64url string to Uint8Array */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const raw = atob(padded);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer;
}

/** Convert ArrayBuffer to base64url string */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Register biometric (Face ID / Fingerprint) for a user on this device */
export async function registerBiometric(userId: string, userName: string): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode(userId);

    const rp: PublicKeyCredentialRpEntity = {
      name: "Yalambar Store",
    };
    if (window.location.hostname && !/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
      rp.id = window.location.hostname;
    }

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp,
        user: {
          id: userIdBytes,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    const credId = arrayBufferToBase64Url(credential.rawId);
    const store = getStore();
    store[userId] = {
      credentialId: credId,
      userName,
      enabledAt: Date.now(),
    };
    saveStore(store);
    return true;
  } catch (err) {
    console.error("Biometric registration failed:", err);
    return false;
  }
}

/** Authenticate a user with their registered biometric */
export async function authenticateBiometric(userId: string): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;

    const store = getStore();
    const userBio = store[userId];
    if (!userBio?.credentialId) return false;

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credIdBytes = base64UrlToUint8Array(userBio.credentialId);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credIdBytes,
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    return !!assertion;
  } catch (err) {
    console.warn("Biometric authentication cancelled or failed:", err);
    return false;
  }
}
