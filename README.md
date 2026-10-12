# West Road Life

A three-lane arcade driving game set in **London** and **Lagos**, built with Three.js and TypeScript. London is West Road Life (this page); Lagos is **Wole Wole**, the original danfo game, at `/lagos/` with its own routes, systems and save. Drive a red double-decker over Tower Bridge, dodge traffic, pick up passengers if you like, and earn pounds for every metre. Then share your result and challenge a friend to drive the same road and beat it.

Play: https://wole-phi.vercel.app

## The game

- **Three London areas.** River Run (over Tower Bridge to the South Bank), Wapping Streets (warehouses and quays), Bridge Approach (Bermondsey to Whitechapel). Choosing Lagos opens Wole Wole.
- **Route or Endless.** Route ends at the last stop; Endless keeps going, a little faster and busier each kilometre, until the damage limit.
- **Passengers on or off.** Either way you earn by driving (faster pays more). With passengers on, move into the marked bay at a stop and brake: riders get off and pay, new ones get on. Stop by the shelter for a perfect-stop tip. Pickups are at the left kerb.
- **Six vehicles:** red double-decker, black cab, teal hatchback, coral sedan, navy SUV and motorcycle, each with its own seats, fares, speed, handling and health. All are free.
- **Feedback that reads at a glance:** close-pass and clean-kilometre bonuses, health marks with a damage warning that names what you hit, and the bus announcing the next stop.
- **Social:** a result card with a picture of your drive, shared through the phone's share sheet (or saved / copied). The link carries the same city, area, vehicle and traffic seed, so a friend drives the same road. A **daily drive** gives everyone the same city, vehicle and road each day.
- **First drive** teaches swipe, speed up and stopping one step at a time. Reduced-motion and volume settings are in Settings.

Controls: swipe left/right to change lane, hold the road or Gas to speed up, hold Brake. Keys: ← → lanes, ↑/W gas, ↓/S/Space brake, P pause, M sound.

## Art direction

London follows the *West Road Life* visual kit (London boards, fleet, environment sheets, Three.js spec): rounded cartoon forms, deep navy glass, cream hubs, ink/cream/yellow UI in Exo 2. There are no imported 3D models: every vehicle, building, person and landmark is built in code from rounded parts (`src/art/`), merged per model and drawn with instancing, so the game is a few hundred kilobytes. Lagos is Wole Wole with its own look.

## Rendering

- **Surfaces per vertex.** Every model part carries a surface (paint, glass, rubber, chrome, brick, stone, plaster, asphalt, paving, foliage, cloth…): roughness, metalness, clear coat and procedural detail in world space (brick courses, asphalt grain, paving speckle, leaf clumps), faded out before it can alias. A whole bus or street still draws in one call (`src/art/surfaces.ts`).
- **Light.** One sun with texel-snapped shadows near the player (stable as the road streams past), sky and ground fill light, sky reflections on vehicles, soft contact shadows under every vehicle, person and tree, and baked darkening where walls meet the pavement.
- **Motion.** The drive runs in fixed 1/120 s steps, so braking distance and lane changes are the same at any frame rate. Lane changes are a critically damped spring limited by forward speed; the body pitches, rolls and bounces on springs above wheels that stay on the road; front wheels steer. People's legs and arms swing in the vertex shader, with stride matched to walking speed.
- **Graphics tiers** (Settings → Graphics): High (desktop: 2× pixels, 2048 shadows, building shadows), Medium (phones: 1.5×, 1024 shadows), Low (1×, contact shadows only, no surface detail or reflections). Auto steps down if the frame rate stays low.
- **Lagos (Wole Wole)** keeps its own look and adds the same realism: a sun that moves with the game clock (rising on the right of the road, setting on the left) and casts texel-snapped shadows; vehicle bodies, glass, tyres and chrome on the shared physical material with sky reflections that fade at night; plain-coloured parts merged per model (about half the draw calls of before, shadow pass included); the bus on pitch, roll and bounce springs in fixed 1/120 s steps, a smoother lane-change spring, steering front wheels, and traffic that eases between lanes; passengers who crowd to the door as the danfo pulls in, step up into it, or step down and walk away. Graphics (Auto/High/Medium/Low) is a toggle on its title screen; `src/wole/rules/motion.ts` holds the tested step and spring code.

## Code

```
src/config/   cities, areas, stops and vehicles
src/rules/    money, saves, daily drive, challenge links, advice — unit tested
src/art/      rounded-part kit, vehicles, people, buildings, props, landmarks, textures
src/world/    renderer and sky, road layout, street streaming, instanced pools
src/game/     the drive, traffic, crowd, player vehicle, camera
src/ui/       HUD, screens, share card
src/app.ts    screens, showcase, drives, results and sharing
src/wole/     Wole Wole (Lagos), served at /lagos/
tools/        headless play-test driver and scenarios (before/after views, motion, tiers, smoke)
```

```
npm install
npm run dev        # http://localhost:5173 (?gallery and ?street open model and street views)
npm test           # rules and drive-physics tests (and Wole Wole's)
npm run check      # types, tests and production build
```

Fonts: Exo 2 (SIL Open Font License, `public/fonts/OFL.txt`).
