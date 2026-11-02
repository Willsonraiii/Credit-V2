import { useState, useEffect } from "react";
import { Delete, KeyRound, ShieldCheck, Fingerprint, Sparkles } from "lucide-react";
import type { PosUser } from "./users";
import {
  isBiometricsSupported,
  hasBiometricForUser,
  registerBiometric,
  authenticateBiometric,
} from "./lib/biometrics";

const LOGO_SRC = "https://raw.githubusercontent.com/Willsonraiii/Credit-V2/main/icon-512.png";

function Avatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const hues = [
    "from-rose-400 to-pink-500", "from-amber-400 to-orange-500",
    "from-blue-500 to-[#1155ff]", "from-indigo-400 to-violet-500",
    "from-sky-400 to-blue-500", "from-fuchsia-400 to-purple-500",
  ];
  const idx = Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % hues.length;
  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${hues[idx]} text-white text-xl font-bold shadow-lg ring-2 ring-white/15 shadow-black/40`}>
      {initials}
    </div>
  );
}

export default function Login({
  users, onLogin, nepali,
}: {
  users: PosUser[];
  onLogin: (user: PosUser) => void;
  nepali: boolean;
}) {
  const [selected, setSelected] = useState<PosUser | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  useEffect(() => {
    isBiometricsSupported().then(setBiometricsAvailable);
  }, []);

  const t = {
    title: nepali ? "लग - इन" : "Sign In",
    choose: nepali ? "प्रयोगकर्ता छान्नुहोस्" : "Choose your profile",
    enterPin: nepali ? "PIN लेख्नुहोस्" : "Enter your PIN",
    wrong: nepali ? "गलत PIN" : "Wrong PIN",
    back: nepali ? "फिर्ता" : "Back",
    admin: nepali ? "एडमिन" : "Admin",
    bioUnlock: nepali ? "बायोमेट्रिकबाट खोल्नुहोस्" : "Unlock with Face / Fingerprint",
    bioVerifying: nepali ? "बायोमेट्रिक प्रमाणीकरण हुँदैछ..." : "Scanning biometric...",
    bioSetupTitle: nepali ? "बायोमेट्रिक सेटअप गर्ने?" : "Enable Biometric Login?",
    bioSetupDesc: nepali
      ? "अर्को पटक यो कोड बिना PIN, Face ID वा Fingerprint बाट सिधै खुल्नेछ।"
      : "Unlock this user directly next time using your phone's Face ID or Fingerprint.",
    bioSetupBtn: nepali ? "बायोमेट्रिक सुरु गर्नुहोस्" : "Enable Face / Fingerprint",
    bioSkipBtn: nepali ? "अहिले नगर्ने (पछिका लागि)" : "Not Now (Skip)",
    orEnterPin: nepali ? "वा PIN प्रयोग गर्नुहोस्" : "OR ENTER PIN",
  };

  const handleSelectUser = (u: PosUser) => {
    setSelected(u);
    setPin("");
    setError(false);
    setBioError(null);
    // If user has biometrics enrolled on this device, trigger prompt automatically
    if (hasBiometricForUser(u.id)) {
      setTimeout(() => {
        handleBiometricAuth(u);
      }, 250);
    }
  };

  const handleBiometricAuth = async (userToAuth?: PosUser) => {
    const target = userToAuth || selected;
    if (!target) return;
    setBiometricBusy(true);
    setBioError(null);
    try {
      const ok = await authenticateBiometric(target.id);
      if (ok) {
        onLogin(target);
      } else {
        setBioError(nepali ? "बायोमेट्रिक मिलेन वा रद्द भयो। कृपया PIN हाल्नुहोस्।" : "Biometric canceled or not matched. Please enter PIN.");
      }
    } catch {
      setBioError(nepali ? "बायोमेट्रिक असफल। कृपया PIN हाल्नुहोस्।" : "Biometric check failed. Please enter PIN.");
    } finally {
      setBiometricBusy(false);
    }
  };

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    setBioError(null);
    if (next.length === 4) {
      setTimeout(() => {
        if (selected && next === selected.pin) {
          // If device supports biometrics and this user hasn't enabled it yet, prompt setup
          if (biometricsAvailable && !hasBiometricForUser(selected.id)) {
            setShowBiometricPrompt(true);
          } else {
            onLogin(selected);
          }
        } else {
          setError(true);
          setPin("");
          if (navigator.vibrate) navigator.vibrate(120);
        }
      }, 120);
    }
  };

  const handleConfirmBiometricSetup = async () => {
    if (!selected) return;
    setBiometricBusy(true);
    try {
      await registerBiometric(selected.id, selected.name);
    } catch (e) {
      console.warn("Biometric enrollment skipped or errored", e);
    } finally {
      setBiometricBusy(false);
      setShowBiometricPrompt(false);
      onLogin(selected);
    }
  };

  const handleSkipBiometricSetup = () => {
    if (!selected) return;
    setShowBiometricPrompt(false);
    onLogin(selected);
  };

  const backspace = () => { setPin((p) => p.slice(0, -1)); setError(false); setBioError(null); };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-5 sm:p-6">
      <div className="status-bar-plate" aria-hidden="true" />
      {/* Ambient background */}
      <div className="aurora" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="bg-grid" />
      </div>

      {/* Brand */}
      <div className="relative flex flex-col items-center mb-8 animate-fade-up">
        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-[#1155ff]/20 blur-2xl animate-pulse-glow" />
          <img src={LOGO_SRC} alt="Yalambar Store" className="relative h-20 w-20 rounded-2xl object-contain bg-black/40 ring-1 ring-white/10 shadow-lg shadow-blue-700/30 animate-float" />
        </div>
        <h1 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-shimmer">Yalambar Store</h1>
        <p className="mt-1 text-xs text-white/40 uppercase tracking-[0.25em]">POS · {t.title}</p>
      </div>

      {!selected ? (
        <div className="relative w-full max-w-md animate-fade-up" style={{ animationDelay: "0.08s" }}>
          <p className="text-center text-sm text-white/50 mb-4">{t.choose}</p>
          <div className="grid grid-cols-2 gap-3 stagger">
            {users.map((u) => {
              const hasBio = hasBiometricForUser(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="glass card-lift rounded-2xl p-5 flex flex-col items-center gap-3 group relative overflow-hidden"
                >
                  <div className="transition-transform duration-300 group-hover:scale-105">
                    <Avatar name={u.name} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white">{u.name}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                      {u.isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-200 bg-[#1155ff]/15 border border-[#1155ff]/30 rounded-full px-2 py-0.5">
                          <ShieldCheck className="h-3 w-3" /> {t.admin}
                        </span>
                      )}
                      {hasBio && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-200 bg-sky-500/15 border border-sky-400/30 rounded-full px-2 py-0.5">
                          <Fingerprint className="h-3 w-3 text-sky-300" /> {nepali ? "बायोमेट्रिक" : "Biometric"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-xs animate-scale-in-spring">
          <div className="flex flex-col items-center gap-3 mb-5">
            <Avatar name={selected.name} />
            <div className="text-center">
              <p className="font-display text-base font-bold text-white">{selected.name}</p>
              <p className={`text-xs transition-colors ${error ? "text-rose-400" : "text-white/50"}`}>
                {error ? t.wrong : t.enterPin}
              </p>
            </div>

            {/* Quick Biometric Unlock Button if enrolled */}
            {hasBiometricForUser(selected.id) && (
              <div className="w-full mt-1">
                <button
                  onClick={() => handleBiometricAuth(selected)}
                  disabled={biometricBusy}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1155ff] to-sky-500 py-3 px-4 text-xs font-semibold text-white shadow-lg shadow-blue-700/30 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Fingerprint className={`h-4 w-4 ${biometricBusy ? "animate-spin" : "animate-pulse text-sky-200"}`} />
                  <span>{biometricBusy ? t.bioVerifying : t.bioUnlock}</span>
                </button>
                <div className="relative my-3 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <span className="relative bg-[#060914] px-2 text-[9px] uppercase tracking-wider text-white/40">
                    {t.orEnterPin}
                  </span>
                </div>
              </div>
            )}

            {bioError && (
              <p className="w-full text-center text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1.5 animate-shake">
                {bioError}
              </p>
            )}

            {/* PIN dots */}
            <div className={`flex items-center gap-4 mt-1 ${error ? "animate-shake" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-200 ${
                    pin.length > i
                      ? "bg-[#1155ff] border-[#1155ff] scale-125 shadow-[0_0_12px_rgba(17,85,255,0.65)]"
                      : error ? "border-rose-400/60" : "border-white/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                className="h-16 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-2xl font-semibold text-white hover:border-[#1155ff]/50 hover:bg-[#1155ff]/15 hover:shadow-[0_0_20px_rgba(17,85,255,0.25)] active:scale-90 active:bg-[#1155ff]/25 transition-all duration-150"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => { setSelected(null); setPin(""); setError(false); setBioError(null); }}
              className="h-16 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white/60 hover:bg-white/10 active:scale-90 transition-all duration-150"
            >
              {t.back}
            </button>
            <button
              onClick={() => press("0")}
              className="h-16 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm text-2xl font-semibold text-white hover:border-[#1155ff]/50 hover:bg-[#1155ff]/15 hover:shadow-[0_0_20px_rgba(17,85,255,0.25)] active:scale-90 active:bg-[#1155ff]/25 transition-all duration-150"
            >
              0
            </button>
            <button
              onClick={backspace}
              className="h-16 rounded-2xl bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white flex items-center justify-center active:scale-90 transition-all duration-150"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/30 flex items-center justify-center gap-1.5">
            <KeyRound className="h-3 w-3" /> {nepali ? "४ अंकको PIN" : "4-digit PIN"}
          </p>
        </div>
      )}

      {/* Biometric Setup Prompt Modal (when user enters correct PIN) */}
      {showBiometricPrompt && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass rounded-3xl p-6 max-w-sm w-full text-center space-y-4 animate-scale-in-spring">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1155ff]/20 text-[#1155ff] ring-1 ring-[#1155ff]/40 shadow-lg shadow-blue-600/30">
              <Fingerprint className="h-8 w-8 animate-pulse text-sky-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {t.bioSetupTitle}
              </h3>
              <p className="mt-1.5 text-xs text-white/60 leading-relaxed">
                {t.bioSetupDesc}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleConfirmBiometricSetup}
                disabled={biometricBusy}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1155ff] to-sky-500 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <Fingerprint className="h-4 w-4" />
                <span>{biometricBusy ? (nepali ? "प्रमाणीकरण हुँदैछ..." : "Enrolling...") : t.bioSetupBtn}</span>
              </button>
              <button
                onClick={handleSkipBiometricSetup}
                disabled={biometricBusy}
                className="w-full rounded-xl bg-white/5 py-2.5 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white transition-all"
              >
                {t.bioSkipBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
