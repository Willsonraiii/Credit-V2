import { useState } from "react";
import { Delete, KeyRound, ShieldCheck } from "lucide-react";
import type { PosUser } from "./users";

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
    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${hues[idx]} text-white text-xl font-bold shadow-lg`}>
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

  const t = {
    title: nepali ? "लग - इन" : "Sign In",
    choose: nepali ? "प्रयोगकर्ता छान्नुहोस्" : "Choose your profile",
    enterPin: nepali ? "PIN लेख्नुहोस्" : "Enter your PIN",
    wrong: nepali ? "गलत PIN" : "Wrong PIN",
    back: nepali ? "फिर्ता" : "Back",
    admin: nepali ? "एडमिन" : "Admin",
  };

  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      // verify shortly after the 3rd digit shows
      setTimeout(() => {
        if (selected && next === selected.pin) {
          onLogin(selected);
        } else {
          setError(true);
          setPin("");
          if (navigator.vibrate) navigator.vibrate(120);
        }
      }, 120);
    }
  };

  const backspace = () => { setPin((p) => p.slice(0, -1)); setError(false); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center mb-8">
        <img src={LOGO_SRC} alt="Yalambar Store" className="h-20 w-20 rounded-2xl object-contain bg-black/40 ring-1 ring-white/10 shadow-lg shadow-blue-700/20" />
        <h1 className="mt-3 text-xl font-bold text-white">Yalambar Store</h1>
        <p className="text-xs text-white/40 uppercase tracking-[0.2em]">POS · {t.title}</p>
      </div>

      {!selected ? (
        <div className="w-full max-w-md">
          <p className="text-center text-sm text-white/50 mb-4">{t.choose}</p>
          <div className="grid grid-cols-2 gap-3">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => { setSelected(u); setPin(""); setError(false); }}
                className="glass rounded-2xl p-5 flex flex-col items-center gap-3 hover:border-[#1155ff]/40 hover:-translate-y-0.5 transition-all"
              >
                <Avatar name={u.name} />
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">{u.name}</p>
                  {u.isAdmin && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-blue-200 bg-[#1155ff]/15 border border-[#1155ff]/30 rounded-full px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3" /> {t.admin}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <div className="flex flex-col items-center gap-3 mb-6">
            <Avatar name={selected.name} />
            <div className="text-center">
              <p className="text-base font-semibold text-white">{selected.name}</p>
              <p className={`text-xs ${error ? "text-rose-400" : "text-white/50"}`}>
                {error ? t.wrong : t.enterPin}
              </p>
            </div>
            {/* PIN dots */}
            <div className="flex items-center gap-4 mt-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                    pin.length > i
                      ? "bg-[#1155ff] border-[#1155ff] scale-110"
                      : error ? "border-rose-400/60" : "border-white/30"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                className="h-16 rounded-2xl bg-white/5 border border-white/10 text-2xl font-semibold text-white active:scale-95 active:bg-[#1155ff]/20 transition-all"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => { setSelected(null); setPin(""); setError(false); }}
              className="h-16 rounded-2xl bg-white/5 border border-white/10 text-xs font-medium text-white/60 active:scale-95 transition-all"
            >
              {t.back}
            </button>
            <button
              onClick={() => press("0")}
              className="h-16 rounded-2xl bg-white/5 border border-white/10 text-2xl font-semibold text-white active:scale-95 active:bg-[#1155ff]/20 transition-all"
            >
              0
            </button>
            <button
              onClick={backspace}
              className="h-16 rounded-2xl bg-white/5 border border-white/10 text-white/60 flex items-center justify-center active:scale-95 transition-all"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-white/30 flex items-center justify-center gap-1.5">
            <KeyRound className="h-3 w-3" /> {nepali ? "४ अंकको PIN" : "4-digit PIN"}
          </p>
        </div>
      )}
    </div>
  );
}
