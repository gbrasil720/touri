import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import {
  AVATAR_ACCESSORIES,
  AVATAR_COLOR_CHOICES,
  AVATAR_COLORS,
  AVATAR_HORNS,
  AVATAR_HUES,
  AVATAR_SHAPES,
  type AvatarPath,
  type AvatarPhase,
  avatarHueColor,
  avatarProfileFor,
  avatarSeedHash,
  avatarSpriteFor,
} from "@touri/contracts/avatar"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BotAvatar } from "../src/components/BotAvatar"

const bot = { id: "mark", color: null }
const look = { color: "#e8483f", horns: "classic", accessory: "none" } as const
const PHASES: AvatarPhase[] = ["idle", "thinking", "working", "waiting", "done", "failed", "asleep"]
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete document.documentElement.dataset.motion
})

describe("avatar identity specification", () => {
  it.each([
    ["mark", "classic-none", "#f08a24"],
    ["onb", "long-crown", "#3ecf8e"],
    ["Panko", "long-flower", "#3ecf8e"],
    ["seo", "long-headphones", "#3ecf8e"],
    ["qa-bot", "none-glasses", "#8b5cf6"],
    ["review", "short-cap", "#2fbfa0"],
  ])("derives a stable automatic look for %s", (seed, shape, color) => {
    expect(avatarProfileFor({ id: "other", avatarSeed: seed, color: null })).toMatchObject({ shape, color })
    expect(avatarSeedHash("😀")).toBe(3409036472)
  })
  it("replaces legacy accent colors and silhouettes, and reaches every horn and accessory", () => {
    const profiles = Array.from({ length: 500 }, (_, i) => avatarProfileFor({ id: `fixture-${i}`, color: null }))

    expect(avatarProfileFor({ ...bot, color: "#ff8a3d" })).toEqual(avatarProfileFor(bot))
    expect(avatarProfileFor({ ...bot, avatarShape: "goutte" as never })).toEqual(avatarProfileFor(bot))
    expect(avatarProfileFor({ ...bot, avatarShape: "long-crown" })).toMatchObject({ horns: "long", accessory: "crown" })
    expect(new Set(profiles.map((profile) => profile.shape)).size).toBe(AVATAR_SHAPES.length)
    expect(AVATAR_SHAPES).toHaveLength(AVATAR_HORNS.length * AVATAR_ACCESSORIES.length)
  })
  it("maps all ten stored hues to eight colors and exposes the correct labels", () => {
    expect(AVATAR_HUES.map(({ label }) => label)).toEqual([
      "Red",
      "Orange",
      "Yellow",
      "Lime",
      "Green",
      "Cyan",
      "Blue",
      "Indigo",
      "Violet",
      "Magenta",
    ])
    expect(AVATAR_COLOR_CHOICES.map(({ hue }) => hue)).toEqual([0, 30, 55, 150, 185, 215, 245, 320])
    expect(AVATAR_COLORS).toHaveLength(8)
    expect(AVATAR_HUES.map(({ hue }) => avatarHueColor(hue))).toEqual([
      "#e8483f",
      "#f08a24",
      "#f0b429",
      "#3ecf8e",
      "#3ecf8e",
      "#2fbfa0",
      "#3b93f0",
      "#8b5cf6",
      "#8b5cf6",
      "#e152b0",
    ])
    expect(avatarProfileFor({ ...bot, avatarHue: 280 }).color).toBe("#8b5cf6")
  })
})

describe("bull sprite specification", () => {
  it("draws a mirrored 16 × 16 head with one merged path per colour", () => {
    const sprite = avatarSpriteFor(look, "idle")
    const cells = getCells(sprite.body)

    expect(cells.every(([x, y]) => x >= 0 && x < 16 && y >= 0 && y < 16)).toBe(true)
    expect(cells.every(([x, y]) => cells.some(([mx, my]) => mx === 15 - x && my === y))).toBe(true)
    expect(new Set(sprite.body.map((path) => path.fill)).size).toBe(sprite.body.length)
    expect(sprite.body.find((path) => path.fill === look.color)?.d).toMatch(/^M6 6h4/)
  })
  it("changes only the horn rows and the accessory layer between looks", () => {
    const classic = getCells(avatarSpriteFor(look, "idle").body)
    const long = getCells(avatarSpriteFor({ ...look, horns: "long" }, "idle").body)
    const changed = long.filter(([x, y]) => !classic.some(([cx, cy]) => cx === x && cy === y))

    expect(changed.length).toBeGreaterThan(0)
    expect(changed.every(([, y]) => y <= 5)).toBe(true)
    expect(avatarSpriteFor(look, "idle").accessory).toEqual([])
    for (const accessory of AVATAR_ACCESSORIES.filter((item) => item !== "none"))
      expect(avatarSpriteFor({ ...look, accessory }, "idle").accessory.length).toBeGreaterThan(0)
  })
  it("gives each phase its own face and effect, and blinks only while awake and calm", () => {
    const sprites = PHASES.map((phase) => avatarSpriteFor(look, phase))

    expect(new Set(sprites.map((sprite) => JSON.stringify([sprite.eyes, sprite.effects]))).size).toBe(PHASES.length)
    expect(sprites.map((sprite) => sprite.blink.length > 0)).toEqual([true, true, true, true, false, false, false])
    expect(sprites.map((sprite) => sprite.effects.map((effect) => effect.id))).toEqual([
      [],
      ["dot-1", "dot-2", "dot-3"],
      ["steam-left", "steam-right"],
      ["alert"],
      ["sparkle-1", "sparkle-2"],
      ["smoke"],
      ["snore-1", "snore-2"],
    ])
  })
  it("derives the palette from the bot colour and falls back on invalid input", () => {
    const amber = avatarSpriteFor({ ...look, color: "#f0b429" }, "idle")

    expect(amber.body.map((path) => path.fill)).toContain("#ffe2b8")
    expect(avatarSpriteFor({ ...look, color: "url(#x)" }, "idle")).toEqual(avatarSpriteFor(look, "idle"))
  })
})

describe("avatar motion specification", () => {
  it("rests until its control is hovered/focused and freezes when reduced motion changes", () => {
    let change: () => void = () => undefined
    const media = {
      matches: false,
      addEventListener: (_type: string, handler: () => void) => {
        change = handler
      },
      removeEventListener: () => undefined,
    }
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList)
    const { container } = render(
      <button type="button">
        <BotAvatar bot={bot} />
      </button>,
    )
    const avatar = container.querySelector(".tb-avatar")
    const button = container.querySelector("button")
    if (!button) throw new Error("Missing control")

    expect(avatar).toHaveAttribute("data-avatar-animated", "false")
    fireEvent.pointerEnter(button)
    expect(avatar).toHaveAttribute("data-avatar-animated", "true")
    fireEvent.pointerLeave(button)
    expect(avatar).toHaveAttribute("data-avatar-animated", "false")
    fireEvent.focusIn(button)
    expect(avatar).toHaveAttribute("data-avatar-animated", "true")
    act(() => {
      media.matches = true
      change()
    })
    expect(avatar).toHaveAttribute("data-avatar-animated", "false")
  })
  it("animates every non-idle phase with CSS only, never a frame loop", () => {
    const frame = vi.spyOn(window, "requestAnimationFrame")
    const { container, rerender } = render(<BotAvatar bot={bot} state="thinking" />)
    const avatar = container.querySelector(".tb-avatar")

    expect(avatar).toHaveAttribute("data-avatar-phase", "thinking")
    expect(avatar).toHaveAttribute("data-avatar-animated", "true")
    expect(container.querySelectorAll(".tb-avatar-fx")).toHaveLength(3)
    rerender(<BotAvatar bot={bot} state="thinking" still />)
    expect(avatar).toHaveAttribute("data-avatar-animated", "false")
    expect(container.querySelectorAll(".tb-avatar-fx")).toHaveLength(3)
    rerender(<BotAvatar bot={bot} state="thinking" size={18} />)
    expect(container.querySelectorAll(".tb-avatar-fx")).toHaveLength(0)
    expect(frame).not.toHaveBeenCalled()
  })
  it("retains photo identity during work and falls back to the seeded avatar on failure", () => {
    const { container, rerender } = render(<BotAvatar bot={bot} url="/photo-a.png" mood="working" />)
    const image = container.querySelector("img")
    if (!image) throw new Error("Missing image")

    expect(container.querySelector(".tb-avatar")).toHaveAttribute("data-avatar", "image")
    expect(container.querySelector(".tb-avatar-outline circle")).toBeInTheDocument()
    fireEvent.error(image)
    expect(container.querySelector(".tb-avatar")).toHaveAttribute("data-avatar", "generated")
    expect(container.querySelector("[data-avatar-body]")).toHaveAttribute("fill", "#f08a24")
    rerender(<BotAvatar bot={bot} url="/photo-b.png" mood="working" />)
    expect(container.querySelector("img")).toHaveAttribute("src", "/photo-b.png")
  })
  it("stops a running avatar when the host reduces motion and resumes when restored", async () => {
    const view = render(<BotAvatar bot={bot} state="thinking" motion="always" />)
    const avatar = view.container.querySelector(".tb-avatar")

    expect(avatar).toHaveAttribute("data-avatar-animated", "true")
    document.documentElement.dataset.motion = "reduce"
    await waitFor(() => expect(avatar).toHaveAttribute("data-avatar-animated", "false"))
    expect(avatar).toHaveAttribute("data-mascot-phase", "thinking")
    delete document.documentElement.dataset.motion
    await waitFor(() => expect(avatar).toHaveAttribute("data-avatar-animated", "true"))
  })
})

const getCells = (paths: readonly AvatarPath[]): [number, number][] =>
  paths.flatMap((path) =>
    [...path.d.matchAll(/M(-?\d+) (-?\d+)h(\d+)/g)].flatMap(([, x, y, length]) =>
      Array.from({ length: Number(length) }, (_, index): [number, number] => [Number(x) + index, Number(y)]),
    ),
  )
