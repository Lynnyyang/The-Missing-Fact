import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Action = {
  at: number;
  page: string;
  control: string;
  value: string;
};

export type Snapshot = {
  lesson: string;
  page: string;
  /** 页面上真实出现的中文标签与数字 */
  facts: Record<string, string | number>;
  /** 规则提醒（即时，不经过大模型） */
  hints: string[];
};

export type Profile = {
  xp: number;
  visited: string[];
  notes: Record<string, string>;
  certifiedAt?: number;
};

const emptyProfile: Profile = { xp: 0, visited: [], notes: {} };

/** 用户自备的大模型连接信息（OpenAI 兼容接口，如通义千问 Qwen） */
export type LlmSettings = { baseUrl: string; model: string; apiKey: string };
const emptyLlm: LlmSettings = { baseUrl: "", model: "", apiKey: "" };

const K_USER = "cb-session-user";
const K_INDEX = "cb-user-index";
const K_PROFILE = (u: string) => `cb-profile:${u}`;
const K_WIDTH = "cb-companion-width";
const K_LLM = "cb-llm-settings";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

type Ctx = {
  ready: boolean;
  user: string | null;
  users: string[];
  profile: Profile;
  login: (name: string) => void;
  logout: () => void;
  clearProgress: () => void;
  visit: (id: string, xp?: number) => void;
  setNote: (id: string, text: string) => void;
  actions: Action[];
  track: (page: string, control: string, value: string | number | boolean) => void;
  snapshot: Snapshot | null;
  setSnapshot: (s: Snapshot | null) => void;
  companionWidth: number;
  setCompanionWidth: (w: number) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [actions, setActions] = useState<Action[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [companionWidth, setWidthState] = useState(400);

  useEffect(() => {
    const u = read<string | null>(K_USER, null);
    setUsers(read<string[]>(K_INDEX, []));
    setWidthState(read<number>(K_WIDTH, 400));
    if (u) {
      setUser(u);
      setProfile(read<Profile>(K_PROFILE(u), emptyProfile));
    }
    setReady(true);
  }, []);

  const persist = useCallback(
    (u: string, next: Profile) => {
      setProfile(next);
      write(K_PROFILE(u), next);
    },
    [],
  );

  const login = useCallback((name: string) => {
    const n = name.trim();
    if (!n) return;
    setUser(n);
    write(K_USER, n);
    setUsers((prev) => {
      const next = prev.includes(n) ? prev : [...prev, n];
      write(K_INDEX, next);
      return next;
    });
    setProfile(read<Profile>(K_PROFILE(n), emptyProfile));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    write(K_USER, null);
    setProfile(emptyProfile);
    setActions([]);
  }, []);

  const clearProgress = useCallback(() => {
    if (!user) return;
    persist(user, emptyProfile);
    setActions([]);
  }, [user, persist]);

  const visit = useCallback(
    (id: string, xp = 10) => {
      if (!user) return;
      setProfile((prev) => {
        if (prev.visited.includes(id)) return prev;
        const next = { ...prev, visited: [...prev.visited, id], xp: prev.xp + xp };
        write(K_PROFILE(user), next);
        return next;
      });
    },
    [user],
  );

  const setNote = useCallback(
    (id: string, text: string) => {
      if (!user) return;
      setProfile((prev) => {
        const next = { ...prev, notes: { ...prev.notes, [id]: text } };
        write(K_PROFILE(user), next);
        return next;
      });
    },
    [user],
  );

  const track = useCallback((page: string, control: string, value: string | number | boolean) => {
    setActions((prev) =>
      [...prev, { at: Date.now(), page, control, value: String(value) }].slice(-60),
    );
  }, []);

  const setCompanionWidth = useCallback((w: number) => {
    const clamped = Math.min(720, Math.max(300, w));
    setWidthState(clamped);
    write(K_WIDTH, clamped);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      users,
      profile,
      login,
      logout,
      clearProgress,
      visit,
      setNote,
      actions,
      track,
      snapshot,
      setSnapshot,
      companionWidth,
      setCompanionWidth,
    }),
    [ready, user, users, profile, login, logout, clearProgress, visit, setNote, actions, track, snapshot, companionWidth, setCompanionWidth],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内使用");
  return ctx;
}

/** 把当前页面的中文事实与提醒交给小果；页面每次变化都会同步 */
export function useCompanionSnapshot(s: Snapshot) {
  const { setSnapshot } = useApp();
  const key = JSON.stringify(s);
  const last = useRef("");
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    setSnapshot(JSON.parse(key) as Snapshot);
  }, [key, setSnapshot]);
  useEffect(() => () => setSnapshot(null), [setSnapshot]);
}

export const RANKS: Array<{ min: number; title: string }> = [
  { min: 0, title: "见习评估官" },
  { min: 60, title: "助理评估官" },
  { min: 160, title: "评估官" },
  { min: 300, title: "主任评估官" },
  { min: 460, title: "因果局长" },
];

export const rankOf = (xp: number) => [...RANKS].reverse().find((r) => xp >= r.min)!.title;
