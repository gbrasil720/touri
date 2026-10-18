import type {
  AvatarAccessory,
  AvatarBullShape,
  AvatarHorns,
  AvatarLegacyShape,
  AvatarShape,
  Bot,
  Message,
  NotificationRecord,
  Run,
} from "./types"

export type AvatarHue = 0 | 30 | 55 | 100 | 150 | 185 | 215 | 245 | 280 | 320
export type AvatarIdentity = Pick<Bot, "id" | "color"> &
  Pick<Partial<Bot>, "avatarShape" | "avatarSeed" | "avatarPath"> & { avatarHue?: AvatarHue | null }
export type AvatarMood = "idle" | "working" | "waiting" | "failed" | "responded" | "asleep" | "connecting"
export type AvatarMotion = "hover" | "idle" | "always"
/** The seven animated states of the bull, matching the UI's mascot phases. */
export type AvatarPhase = "idle" | "thinking" | "working" | "waiting" | "done" | "failed" | "asleep"
export type AvatarLook = { color: string; horns: AvatarHorns; accessory: AvatarAccessory }
export type AvatarProfile = AvatarLook & { shape: AvatarBullShape; offset: number }
export type AvatarPath = { d: string; fill: string }
export type AvatarEffect = { id: string; paths: AvatarPath[] }
export type AvatarSprite = {
  body: AvatarPath[]
  eyes: AvatarPath[]
  blink: AvatarPath[]
  accessory: AvatarPath[]
  effects: AvatarEffect[]
}

/** Seconds of one blink cycle; profiles spread their offsets over it so neighbours never blink together. */
export const AVATAR_BLINK_SECONDS = 4.2
export const AVATAR_GRID = 16
export const AVATAR_HORNS: readonly AvatarHorns[] = ["classic", "short", "long", "none"]
export const AVATAR_ACCESSORIES: readonly AvatarAccessory[] = [
  "none",
  "ring",
  "glasses",
  "headphones",
  "cap",
  "flower",
  "crown",
]
export const AVATAR_SHAPES: readonly AvatarBullShape[] = AVATAR_HORNS.flatMap((horns) =>
  AVATAR_ACCESSORIES.map((accessory): AvatarBullShape => `${horns}-${accessory}`),
)
// Silhouettes saved before the bulls. The API keeps accepting them; they render the seeded automatic look.
export const LEGACY_AVATAR_SHAPES: readonly AvatarLegacyShape[] = [
  "cercle",
  "galet",
  "squircle",
  "capsule",
  "triangle",
  "hexagone",
  "nuage",
]
const PALETTE = [
  { id: "rouge", hex: "#e8483f" },
  { id: "orange", hex: "#f08a24" },
  { id: "ambre", hex: "#f0b429" },
  { id: "vert", hex: "#3ecf8e" },
  { id: "turquoise", hex: "#2fbfa0" },
  { id: "bleu", hex: "#3b93f0" },
  { id: "violet", hex: "#8b5cf6" },
  { id: "rose", hex: "#e152b0" },
  { id: "gris", hex: "#a3a3a3" },
] as const
export const AVATAR_COLORS = PALETTE.filter((color) => color.id !== "gris").map((color) => color.id)
const hueEntries = [
  [0, "Red", "rouge"],
  [30, "Orange", "orange"],
  [55, "Yellow", "ambre"],
  [100, "Lime", "vert"],
  [150, "Green", "vert"],
  [185, "Cyan", "turquoise"],
  [215, "Blue", "bleu"],
  [245, "Indigo", "violet"],
  [280, "Violet", "violet"],
  [320, "Magenta", "rose"],
] as const
export const AVATAR_HUES = hueEntries.map(([hue, label, color]) => ({
  hue,
  label,
  color,
  hex: PALETTE.find((item) => item.id === color)?.hex ?? "#0a0a0c",
}))
export const AVATAR_COLOR_CHOICES = AVATAR_HUES.filter(({ hue }) => hue !== 100 && hue !== 280)
export const avatarHueColor = (hue: AvatarHue): string =>
  AVATAR_HUES.find((option) => option.hue === hue)?.hex ?? "#0a0a0c"

// FNV-1a over UTF-16 code units makes persisted identities reproducible in JS and native exports.
export const avatarSeedHash = (seed: string): number => {
  let result = 2166136261
  for (let i = 0; i < seed.length; i++) result = Math.imul(result ^ seed.charCodeAt(i), 16777619)
  return result >>> 0
}
const seededIndex = (seed: string, field: string, count: number): number => avatarSeedHash(`${seed}:${field}`) % count
export const validAvatarShape = (shape: unknown): shape is AvatarShape =>
  isBullShape(shape) || LEGACY_AVATAR_SHAPES.some((item) => item === shape)
const isBullShape = (shape: unknown): shape is AvatarBullShape => AVATAR_SHAPES.some((item) => item === shape)
export const validAvatarColor = (color: unknown): color is string =>
  typeof color === "string" && /^#[\da-f]{6}$/i.test(color)
export const avatarShapeOf = (horns: AvatarHorns, accessory: AvatarAccessory): AvatarBullShape =>
  `${horns}-${accessory}`

export const avatarProfileFor = (bot: AvatarIdentity): AvatarProfile => {
  const seed = bot.avatarSeed ?? bot.id
  const shape = isBullShape(bot.avatarShape) ? bot.avatarShape : getSeededShape(seed)
  const [horns, accessory] = getLookParts(shape)
  const automatic = PALETTE[seededIndex(seed, "color", AVATAR_COLORS.length)]?.hex ?? "#e8483f"
  const storedColor = PALETTE.find(
    (item) => item.id === bot.color || item.hex.toLowerCase() === bot.color?.toLowerCase(),
  )?.hex
  // Pre-picker bots used arbitrary UI accent colors. They now get an automatic identity;
  // a picker identity still retains an explicitly saved custom hex color.
  const custom = (bot.avatarShape || bot.avatarSeed) && validAvatarColor(bot.color) ? bot.color : null
  const color = bot.avatarHue != null ? avatarHueColor(bot.avatarHue) : (storedColor ?? custom ?? automatic)

  return { shape, horns, accessory, color, offset: (avatarSeedHash(seed) / 4294967296) * AVATAR_BLINK_SECONDS }
}
export const avatarShapeFor = (bot: string | AvatarIdentity): AvatarBullShape =>
  avatarProfileFor(typeof bot === "string" ? { id: bot, color: null } : bot).shape
export const avatarColorFor = (bot: AvatarIdentity): string => avatarProfileFor(bot).color

const getSeededShape = (seed: string): AvatarBullShape =>
  avatarShapeOf(
    AVATAR_HORNS[seededIndex(seed, "horns", AVATAR_HORNS.length)] ?? "classic",
    AVATAR_ACCESSORIES[seededIndex(seed, "accessory", AVATAR_ACCESSORIES.length)] ?? "none",
  )
const getLookParts = (shape: AvatarBullShape): [AvatarHorns, AvatarAccessory] => {
  const horns = AVATAR_HORNS.find((item) => shape.startsWith(`${item}-`)) ?? "classic"
  const accessory = AVATAR_ACCESSORIES.find((item) => shape === `${horns}-${item}`) ?? "none"

  return [horns, accessory]
}

export const avatarMoodFor = ({
  botId,
  paused = false,
  connecting = false,
  runs = [],
  messages = [],
  notifications = [],
  recentReply = false,
}: {
  botId: string
  paused?: boolean
  connecting?: boolean
  runs?: readonly Run[]
  messages?: readonly Message[]
  notifications?: readonly NotificationRecord[]
  recentReply?: boolean
}): AvatarMood => {
  if (paused) return "asleep"
  const botRuns = runs.filter((run) => run.botId === botId)
  const lastRun = [...botRuns].sort((a, b) => b.queuedAt - a.queuedAt)[0]
  if (
    lastRun?.status === "failed" ||
    notifications.some(
      (item) =>
        item.botId === botId && item.resolvedAt === null && ["turn-failed", "routine-failed"].includes(item.kind),
    )
  )
    return "failed"
  if (
    notifications.some(
      (item) => item.botId === botId && item.resolvedAt === null && ["approval", "question"].includes(item.kind),
    ) ||
    messages.some((message) => message.parts.some((part) => part.type === "approval" && part.decision === "pending"))
  )
    return "waiting"
  if (botRuns.some((run) => ["queued", "starting", "running"].includes(run.status))) return "working"
  if (connecting) return "connecting"
  if (recentReply) return "responded"
  return "idle"
}

const MOOD_PHASES: Record<AvatarMood, AvatarPhase> = {
  idle: "idle",
  working: "working",
  waiting: "waiting",
  failed: "failed",
  responded: "done",
  asleep: "asleep",
  connecting: "thinking",
}
export const avatarPhaseForMood = (mood: AvatarMood): AvatarPhase => MOOD_PHASES[mood]

/** Builds the 16 × 16 bull as one run-length path per palette colour, so each layer stays a few nodes. */
export const avatarSpriteFor = (look: AvatarLook, phase: AvatarPhase): AvatarSprite => {
  const colors = getPaletteFor(validAvatarColor(look.color) ? look.color : "#e8483f")
  const pose = PHASE_POSES[phase]
  const body = new Map([...getGridCells(BASE_ROWS), ...getGridCells(HORN_ROWS[look.horns])].map(toKeyedCell))

  return {
    body: getPaths([...body.values()], colors),
    eyes: getPaths(getEyeCells(pose.eyes), colors),
    blink: pose.blink ? getPaths(getEyeCells("closed"), colors) : [],
    accessory: getPaths(ACCESSORY_CELLS[look.accessory], colors),
    effects: pose.effects.map((effect) => ({ id: effect.id, paths: getPaths(effect.cells, colors) })),
  }
}

/** Portable still avatar for consumers without a DOM. */
export const renderAvatarSvg = (
  bot: AvatarIdentity,
  { size = 32, mood = "idle" }: { size?: number; mood?: AvatarMood } = {},
): string => {
  const sprite = avatarSpriteFor(avatarProfileFor(bot), avatarPhaseForMood(mood))
  const dimension = Number.isFinite(size) ? Math.max(1, size) : 32
  const paths = [
    ...sprite.body,
    ...sprite.eyes,
    ...sprite.accessory,
    ...sprite.effects.flatMap((effect) => effect.paths),
  ]
  const markup = paths.map((path) => `<path d="${path.d}" fill="${path.fill}"/>`).join("")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${AVATAR_GRID} ${AVATAR_GRID}" shape-rendering="crispEdges" overflow="visible">${markup}</svg>`
}

type Cell = readonly [x: number, y: number, key: string]
type Eyes = "open" | "closed" | "up" | "wide" | "happy" | "sad"

const mirror = (rows: readonly string[]): string[] => rows.map((row) => row + [...row].reverse().join(""))
const row = (y: number, from: number, to: number, key: string): Cell[] =>
  Array.from({ length: to - from + 1 }, (_, index): Cell => [from + index, y, key])

// Left half of each sprite row; `mirror` completes the symmetric face. Keys index `getPaletteFor`.
const BASE_ROWS = mirror([
  "........",
  "........",
  "........",
  "........",
  "........",
  "....OOOO",
  "..OOLLBB",
  "OOOLBBBB",
  "OEEOBBBB",
  "OEEBBBBB",
  ".OOBBBBB",
  "..OBBBBB",
  "..OBOSSS",
  "..ODSSNS",
  "...OOSSS",
  "....OOOO",
])
const HORN_ROWS: Record<AvatarHorns, string[]> = {
  classic: mirror(["........", "..O.....", ".OHO....", ".OHO....", ".OhHO...", "..OhHOOO"]),
  short: mirror(["........", "........", "........", "..OO....", ".OHHO...", ".OhHOOOO"]),
  long: mirror(["O.......", "HO......", "HO......", "hHO.....", "OhHOO...", ".OhhHOOO"]),
  none: mirror(["........", "........", "........", "........", "........", "...OOOOO"]),
}
// Left eye only; `getEyeCells` mirrors it onto the right side.
const EYE_CELLS: Record<Eyes, readonly Cell[]> = {
  open: [
    [4, 9, "O"],
    [5, 9, "O"],
    [4, 10, "W"],
    [5, 10, "P"],
  ],
  closed: [
    [4, 10, "O"],
    [5, 10, "O"],
  ],
  up: [
    [4, 9, "W"],
    [5, 9, "P"],
    [4, 10, "W"],
    [5, 10, "W"],
  ],
  wide: [
    [4, 9, "W"],
    [5, 9, "W"],
    [4, 10, "W"],
    [5, 10, "P"],
  ],
  happy: [
    [4, 9, "O"],
    [3, 10, "O"],
    [5, 10, "O"],
    [3, 11, "E"],
  ],
  sad: [
    [5, 9, "O"],
    [4, 10, "W"],
    [5, 10, "P"],
    [4, 11, "T"],
  ],
}
const ACCESSORY_CELLS: Record<AvatarAccessory, readonly Cell[]> = {
  none: [],
  ring: [[6, 14, "R"], [9, 14, "R"], ...row(15, 6, 9, "R")],
  glasses: [
    ...row(9, 3, 6, "G"),
    [3, 10, "G"],
    ...row(10, 6, 9, "G"),
    [12, 10, "G"],
    ...row(11, 3, 6, "G"),
    ...row(9, 9, 12, "G"),
    ...row(11, 9, 12, "G"),
  ],
  headphones: [
    ...row(4, 4, 11, "K"),
    [3, 5, "K"],
    [12, 5, "K"],
    [2, 6, "K"],
    [13, 6, "K"],
    ...row(7, 0, 1, "K"),
    ...row(8, 0, 1, "K"),
    ...row(9, 0, 1, "K"),
    ...row(7, 14, 15, "K"),
    ...row(8, 14, 15, "K"),
    ...row(9, 14, 15, "K"),
    [1, 10, "K"],
    [1, 11, "K"],
    [2, 12, "K"],
    [3, 13, "k"],
  ],
  cap: [
    ...row(3, 5, 10, "C"),
    ...row(4, 4, 11, "C"),
    ...row(5, 3, 12, "C"),
    ...row(5, 13, 15, "c"),
    ...row(2, 7, 8, "c"),
  ],
  flower: [
    [13, 4, "F"],
    [12, 5, "F"],
    [13, 5, "Y"],
    [14, 5, "F"],
    [13, 6, "F"],
  ],
  crown: [
    [5, 2, "Y"],
    ...row(1, 7, 8, "Y"),
    [10, 2, "Y"],
    ...row(2, 7, 8, "Y"),
    ...row(3, 5, 10, "Y"),
    [5, 4, "Y"],
    [6, 4, "y"],
    ...row(4, 7, 8, "Y"),
    [9, 4, "y"],
    [10, 4, "Y"],
  ],
}
const PHASE_POSES: Record<
  AvatarPhase,
  { eyes: Eyes; blink: boolean; effects: readonly { id: string; cells: readonly Cell[] }[] }
> = {
  idle: { eyes: "open", blink: true, effects: [] },
  thinking: {
    eyes: "up",
    blink: true,
    effects: [
      { id: "dot-1", cells: [[5, 2, "X"]] },
      { id: "dot-2", cells: [[7, 2, "X"]] },
      { id: "dot-3", cells: [[9, 2, "X"]] },
    ],
  },
  working: {
    eyes: "open",
    blink: true,
    effects: [
      { id: "steam-left", cells: row(14, 1, 2, "Z") },
      { id: "steam-right", cells: row(14, 13, 14, "Z") },
    ],
  },
  waiting: {
    eyes: "wide",
    blink: true,
    effects: [
      { id: "alert", cells: [...row(0, 7, 8, "Q"), ...row(1, 7, 8, "Q"), ...row(2, 7, 8, "Q"), ...row(4, 7, 8, "Q")] },
    ],
  },
  done: {
    eyes: "happy",
    blink: false,
    effects: [
      {
        id: "sparkle-1",
        cells: [
          [5, 1, "Y"],
          [4, 2, "Y"],
          [5, 2, "X"],
          [6, 2, "Y"],
          [5, 3, "Y"],
        ],
      },
      {
        id: "sparkle-2",
        cells: [
          [10, 0, "Y"],
          [9, 1, "Y"],
          [10, 1, "X"],
          [11, 1, "Y"],
          [10, 2, "Y"],
        ],
      },
    ],
  },
  failed: {
    eyes: "sad",
    blink: false,
    effects: [
      {
        id: "smoke",
        cells: [
          [7, 3, "Z"],
          [8, 3, "Z"],
          [8, 2, "Z"],
          [7, 1, "Z"],
        ],
      },
    ],
  },
  asleep: {
    eyes: "closed",
    blink: false,
    effects: [
      { id: "snore-1", cells: [...row(2, 9, 11, "X"), [10, 3, "X"], ...row(4, 9, 11, "X")] },
      { id: "snore-2", cells: [...row(-2, 12, 14, "Z"), [13, -1, "Z"], ...row(0, 12, 14, "Z")] },
    ],
  },
}

const getPaletteFor = (hex: string): Record<string, string> => {
  const snout = hex.toLowerCase() === "#f0b429" ? "#ffe2b8" : "#ffc94d"
  return {
    O: mixColor(hex, "#140808", 0.78),
    B: hex,
    L: mixColor(hex, "#ffffff", 0.28),
    D: mixColor(hex, "#000000", 0.25),
    E: mixColor(hex, "#ffffff", 0.42),
    H: "#f0f0f2",
    h: "#a8a8ae",
    W: "#ffffff",
    P: "#141416",
    S: snout,
    N: mixColor(snout, "#3c1e00", 0.7),
    T: "#64b5ff",
    R: "#d1d1d6",
    G: "#f5f5f7",
    K: "#d1d1d6",
    k: "#0a84ff",
    C: "#f5f5f7",
    c: "#a1a1a6",
    F: "#ff8cc8",
    Y: "#febc2e",
    y: "#e5322d",
    X: "#f5f5f7",
    Q: "#0a84ff",
    Z: "#a1a1a6",
  }
}
const mixColor = (from: string, to: string, amount: number): string => {
  const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const target = channels(to)
  const mixed = channels(from).map((value, index) => Math.round(value + ((target[index] ?? value) - value) * amount))

  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`
}
const getGridCells = (rows: readonly string[]): Cell[] =>
  rows.flatMap((line, y) => [...line].flatMap((key, x): Cell[] => (key === "." ? [] : [[x, y, key]])))
const toKeyedCell = (cell: Cell): [string, Cell] => [`${cell[0]},${cell[1]}`, cell]
const getEyeCells = (eyes: Eyes): Cell[] =>
  EYE_CELLS[eyes].flatMap(([x, y, key]): Cell[] => [
    [x, y, key],
    [AVATAR_GRID - 1 - x, y, key],
  ])
const getPaths = (cells: readonly Cell[], colors: Record<string, string>): AvatarPath[] => {
  const keys = [...new Set(cells.map((cell) => cell[2]))]
  return keys.map((key) => ({
    d: getRuns(cells.filter((cell) => cell[2] === key))
      .map(([x, y, length]) => `M${x} ${y}h${length}v1h-${length}z`)
      .join(""),
    fill: colors[key] ?? "#000000",
  }))
}
// Merges horizontally adjacent cells of one colour into a single rectangle per run.
const getRuns = (cells: readonly Cell[]): [x: number, y: number, length: number][] => {
  const filled = new Set(cells.map(([x, y]) => `${x},${y}`))
  const getLength = (x: number, y: number): number => (filled.has(`${x},${y}`) ? 1 + getLength(x + 1, y) : 0)

  return [...cells]
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .filter(([x, y]) => !filled.has(`${x - 1},${y}`))
    .map(([x, y]) => [x, y, getLength(x, y)])
}
