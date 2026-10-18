# Bot avatars

Every bot is a 16 × 16 pixel-art bull from the same family as the touri mascot. A bot changes its colour, horns and accessory; each runtime state has its own face, effect and step animation. The sprite is original touri artwork drawn in `packages/contracts/src/avatar.ts`; there is no rendering dependency.

## Identity

Use a saved avatar seed, otherwise the stable bot ID. Hash UTF-16 code units with unsigned 32-bit FNV-1a and select each part with its own suffix: `:horns` (classic, short, long, none), `:accessory` (none, ring, glasses, headphones, cap, flower, crown) and `:color` (rouge, orange, ambre, vert, turquoise, bleu, violet, rose). The blink offset is the unsigned seed hash divided by 2^32, multiplied by the 4.2-second blink cycle.

`avatarShape` stores the chosen look as `<horns>-<accessory>` (`short-flower`). Older silhouette ids (`cercle`, `nuage`, …) stay readable and render the seeded automatic look, so stored bots and groups need no migration. The API only accepts the 28 bull looks.

| Stored hue | Label | Engine color | Hex |
| --- | --- | --- | --- |
| 0 | Red | rouge | #e8483f |
| 30 | Orange | orange | #f08a24 |
| 55 | Yellow | ambre | #f0b429 |
| 100 | Lime | vert | #3ecf8e |
| 150 | Green | vert | #3ecf8e |
| 185 | Cyan | turquoise | #2fbfa0 |
| 215 | Blue | bleu | #3b93f0 |
| 245 | Indigo | violet | #8b5cf6 |
| 280 | Violet | violet | #8b5cf6 |
| 320 | Magenta | rose | #e152b0 |

Lime and Violet remain valid aliases but are omitted from the eight visible colour choices. The picker saves palette hex values through touri's existing API; Automatic saves null. Uncustomized old UI accent colors, including #ff8a3d, no longer override automatic identities. Existing explicit custom hex colors on picker identities are retained.

## Sprite

The head, horns and snout come from mirrored row strings; each palette key becomes one SVG path of merged horizontal runs. The outline, highlight and cheek shades mix the bot colour with fixed inks, and the yellow bull gets a paler snout. Layers, in order: head and horns, open eyes, closed eyes (blink), accessory, then the state effects. Paths use `shape-rendering="crispEdges"`; sizes that are multiples of 16 stay sharpest.

## States and motion

| Phase | From mascot state | Face | Effect | Head motion |
| --- | --- | --- | --- | --- |
| idle | idle, listening | open, blinks | — | 1px breath every 2.8 s |
| thinking | thinking, connecting | looking up, blinks | three dots light up in turn | 1px breath every 2.2 s |
| working | typing, working-tool | open, blinks | steam from the nostrils | 1px bob every 0.5 s |
| waiting | waiting-approval | wide open, blinks | blue "!" (#0a84ff) bouncing | 1px bob every 1.6 s |
| done | done (2.4 s, or until focus returns) | happy | two sparkles | small hop every 1.4 s |
| failed | error | sad with a tear | smoke | head shake every 2.6 s |
| asleep | sleeping, parked | closed | rising zZ | slow breath, 72% opacity |

All movement is CSS `steps()` in whole grid pixels, like a game sprite, so active avatars never touch the DOM and need no frame loop. Idle bulls only move while their closest control is hovered or focused, or with `motion="always"`; every other phase animates. `still` and reduced motion (system or touri setting) show the static frame: the face and effect still carry the meaning. Effects are hidden below 20px, where they would be noise next to the face.

Photo avatars keep their image with a circular outline while thinking or working; image errors fall back to the bull and a changed URL retries the image.

## Runtime states and activity

`MascotMachine` owns a stable snapshot for each bot and each conversation: idle, listening, typing, thinking, working-tool, waiting-approval, error, done, sleeping, or parked. The provider projects existing run, message, notification, computer-grant and composer events into these machines; no database state or schema change is needed. Bot snapshots aggregate their conversations, while the chat avatar and activity line observe the same conversation snapshot.

Paused bots sleep. Pending approvals, questions and takeovers take precedence over active work. Pending tool calls or commands show working-tool; the latest text/reasoning part distinguishes typing from thinking. Terminal runs suppress stale streaming parts and pending message approvals. New work takes precedence over historical failures. An idle, hidden conversation parks; active work retains its state while its animation clock stops.

Fresh completions celebrate for 2.4 seconds, including when the composer retains focus. A background bot reply remains done until window focus returns. Initial history establishes a baseline instead of celebrating past replies. Deadlines are scheduled separately from snapshots, so consecutive completions reschedule the timeout even when the displayed state stays done. All machine timestamps use an injected monotonic clock.

The activity mark beneath a streaming reply carries a pt-BR status phrase beside a still bull, alongside three activity dots. Waiting for approval removes the dots and can link to the pending approval. Reduced motion holds the dots still with readable status updates.

The deterministic harness is `ui/test/fixtures/mascotHarness.ts`; state and integration tests cover transitions, cancellation, history hydration, completion deadlines, visibility and reduced motion. `ui/test/e2e/fixtures/mascot-states.html` exposes all states for browser checks of identity, activity, motion and accessibility.

## Customizer

`AvatarPicker` previews the bull at 96px with buttons for every phase, a 32px sidebar row and a 16px chat pill when the bot has a name. Colour, horns and accessory each have their own group; Shuffle picks a random full look and Restore automatic returns to the seeded look and automatic colour.

## Verification

`ui/test/avatar-motion.test.tsx` covers identity, the sprite and motion rules; `ui/test/e2e/avatars.spec.ts` and `ui/test/e2e/mascot-state.spec.ts` check the animations, reduced motion and the absence of DOM writes in a headless browser.
