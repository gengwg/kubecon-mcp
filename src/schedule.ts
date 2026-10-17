export const FEED_URL = "https://sessionize.com/api/v2/svi82w6c/view/All";
export const SCHEDULE_URL =
  "https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/";

type Named = { id: number | string; name: string };

export type Feed = {
  sessions: {
    id: string;
    title: string;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
    roomId: number | null;
    speakers: string[];
    categoryItems: number[];
  }[];
  speakers: { id: string; fullName: string; tagLine: string | null }[];
  rooms: Named[];
  categories: { title: string; items: Named[] }[];
};

export type Session = {
  id: string;
  title: string;
  description: string;
  start: string; // local Salt Lake City time, "2026-11-10T09:00"
  end: string;
  room: string;
  track: string;
  level: string;
  tags: string[];
  speakers: { name: string; tagLine: string }[];
};

export type Filters = {
  query?: string;
  speaker?: string;
  day?: string;
  after?: string;
  before?: string;
  room?: string;
  track?: string;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function normalize(feed: Feed): Session[] {
  // Room names use " | " internally, which collides with the line format.
  const rooms = new Map(feed.rooms.map((r) => [String(r.id), r.name.replaceAll(" | ", ", ").trim()]));
  const speakers = new Map(feed.speakers.map((s) => [s.id, s]));
  const categoryOf = new Map<string, { group: string; name: string }>();
  for (const c of feed.categories) {
    for (const i of c.items) categoryOf.set(String(i.id), { group: c.title, name: i.name });
  }

  return feed.sessions
    .filter((s) => s.startsAt && s.endsAt)
    .map((s) => {
      const cats = s.categoryItems.flatMap((id) => categoryOf.get(String(id)) ?? []);
      return {
        id: s.id,
        title: s.title,
        description: (s.description ?? "").trim(),
        start: s.startsAt!.slice(0, 16),
        end: s.endsAt!.slice(0, 16),
        room: rooms.get(String(s.roomId)) ?? "",
        track: cats.find((c) => c.group === "All Sessions")?.name ?? "",
        level: cats.find((c) => c.group === "Audience Level")?.name ?? "",
        tags: cats
          .filter((c) => c.group !== "All Sessions" && c.group !== "Audience Level")
          .map((c) => c.name),
        speakers: s.speakers.flatMap((id) => {
          const sp = speakers.get(id);
          return sp ? [{ name: sp.fullName, tagLine: sp.tagLine ?? "" }] : [];
        }),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.room.localeCompare(b.room));
}

function weekday(start: string): string {
  return WEEKDAYS[new Date(`${start.slice(0, 10)}T00:00:00Z`).getUTCDay()];
}

function isFiller(s: Session): boolean {
  return s.track === "Breaks" || s.track === "Registration" || /^(break|lunch)\b/i.test(s.title);
}

const has = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

export function search(sessions: Session[], f: Filters): Session[] {
  const terms = (f.query ?? "").split(/\s+/).filter(Boolean);
  const day = f.day?.trim().toLowerCase();

  return sessions.filter((s) => {
    const text = [s.title, s.description, s.track, ...s.tags].join(" ");
    const time = s.start.slice(11);
    if (!terms.length && isFiller(s)) return false;
    if (!terms.every((t) => has(text, t))) return false;
    if (f.speaker && !s.speakers.some((sp) => has(`${sp.name} ${sp.tagLine}`, f.speaker!))) return false;
    if (day && s.start.slice(0, 10) !== day && weekday(s.start) !== day.slice(0, 3)) return false;
    if (f.after && time < f.after) return false;
    if (f.before && time >= f.before) return false;
    if (f.room && !has(s.room, f.room)) return false;
    if (f.track && !has([s.track, ...s.tags].join(" "), f.track)) return false;
    return true;
  });
}

export function listFilters(sessions: Session[]) {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();
  return {
    days: uniq(sessions.map((s) => `${s.start.slice(0, 10)} (${weekday(s.start)})`)),
    rooms: uniq(sessions.map((s) => s.room)),
    tracks: uniq(sessions.map((s) => s.track)),
  };
}

function when(s: Session): string {
  const day = weekday(s.start);
  return `${day[0].toUpperCase()}${day.slice(1)} ${s.start.slice(5, 10)} ${s.start.slice(11)}-${s.end.slice(11)}`;
}

export function formatLine(s: Session): string {
  const who = s.speakers.map((sp) => sp.name).join(", ");
  return [`[${s.id}] ${when(s)}`, s.room, s.track, s.title, who].filter(Boolean).join(" | ");
}

export function formatDetail(s: Session): string {
  const header = [
    s.title,
    `When: ${when(s)} (Salt Lake City time)`,
    `Room: ${s.room}`,
    `Track: ${s.track}${s.level ? ` (${s.level})` : ""}`,
    s.tags.length ? `Tags: ${s.tags.join(", ")}` : "",
    s.speakers.length
      ? `Speakers:\n${s.speakers.map((sp) => `- ${sp.name}${sp.tagLine ? `, ${sp.tagLine}` : ""}`).join("\n")}`
      : "",
  ].filter(Boolean);
  return `${header.join("\n")}\n\n${s.description}`.trim();
}

let cache: { at: number; sessions: Session[] } | undefined;

export async function loadSessions(): Promise<Session[]> {
  if (cache && Date.now() - cache.at < 300_000) return cache.sessions;
  const res = await fetch(FEED_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error(`Schedule feed returned HTTP ${res.status}`);
  cache = { at: Date.now(), sessions: normalize(await res.json()) };
  return cache.sessions;
}
