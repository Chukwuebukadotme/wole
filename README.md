# Wole Wole

A 3D Lagos danfo driving game for the browser. Load passengers at real Lagos bus stops, drop each one at their stop, hand back the right change, stop when the traffic warden raises his hand, and keep your fare streak alive from the morning rush to owambe night.

Built with TypeScript, Three.js and Vite. The city, people and sound are made in code; cars and trucks are free low-poly models. The whole game ships as one small static site.

## What's in the game

- **Guided first shift:** a new player's first run walks through one pickup and one drop-off step by step (kerb lane, brake in the bay, drop at the next stop) in clear daylight. Fuel, wardens, change and rivals switch on after the first fare, each with a one-time tip the first time it comes up.
- **Clear feedback:** the stop card counts down to the moment to brake ("Brake in 40 m", "BRAKE NOW", "Too fast!"), stopping a little short of the bay still counts, and crashes, fines, streak changes and passenger bonuses each get a visible reaction.
- **Three routes:** Ikorodu Road (Mile 12 → Fadeyi, with a BRT corridor), Third Mainland (Ebute Metta → CMS over the lagoon bridge, unlocks at level 3) and Lekki Express (Lekki Phase 1 → Ajah with a toll gate, unlocks at level 6).
- **Street races:** four races on stretches of the routes (Ikorodu Road Sprint, Third Mainland Night Dash, Lekki Big Boys Run and the Eko Night Grand Prix). Line up against four named drivers, weave through normal traffic and finish in the top three for prize money. Each race lays its traffic out the same way every time, so you can learn it and beat your best time.
- **Cars to buy:** nine cars for racing alongside your danfo, from the Tokunbo Saloon and Yaba Hot Hatch to SUVs, luxury cars, electric cars and two exotics. Each has its own top speed, pull-away, handling and toughness; electric cars whine instead of growl. Passenger runs stay in the danfo.
- **Busy roads:** saloons, yellow taxis, vans, pickups, jeeps, box trucks and refuse trucks, with luxury SUVs, sports coupés, electric cars and the odd race car showing up more on posh roads like Lekki.
- **Living Lagos:** an in-game clock from dawn to night (streetlights, lit windows, headlights), harmattan haze in season, rain showers with slippery brakes, market stretches with stalls, people crossing and hawkers on the lane lines, and Independence Day bunting on 1 October.
- **Passengers with personalities:** market women whose basins take two seats, students, office workers who tip if you are on time, preachers who protect your streak, Baba who doubles his fare for a smooth ride, hawkers who sell to your passengers, and owambe guests at night.
- **Rival danfos:** now and then another danfo (with its driver's name above it) races you to the next stop. Park in the bay first to keep the passengers and earn a bonus; let it load first and it carries them off.
- **Conductor and money:** give exact change from ₦50–₦500 notes for tips, buy fuel at filling stations, pay the Lekki toll, avoid warden and BRT camera fines.
- **Progression:** missions, levels, a daily bonus, weekday events (Church Sunday, Monday Rush, Harmattan Tuesday, Market Wednesday, Fuel Queue Thursday, Owambe Friday, Rainy Saturday), and a garage with cars, paint jobs, rear stickers, horns and upgrades. Danfo fares and race prizes go into the same bank. Progress is saved in the browser.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Change lane | ← → or A D | Swipe left or right |
| Speed up (eases back when released; in a race, full speed of your car) | Hold ↑ or W | Hold GAS |
| Brake (and stop at a bay) | Hold ↓, S or Shift | Hold BRAKE |
| Hop over barriers | Space | Swipe up or HOP |
| Leave a stop early | Space, ↑ or W | GO or GAS |
| Horn (moves okadas and kekes) | H | HORN |
| Give change | 1–4, Backspace to undo | Tap the notes |
| Pause, mute | P or Esc, M | Pause, Sound |

## Develop

Requires Node.js 20.19 or newer.

```bash
npm ci
npm run dev        # local dev server
npm test           # rules unit tests (fares, change, saves, missions, routes, daily events, traffic mix, races)
npm run check      # type-check + tests + production build
```

Append `?debug` to the URL to expose the running game as `window.__wole` for automated play tests.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite from `vercel.json`: build command `npm run build`, output directory `dist`. Click **Deploy**.

Or from a terminal: `npx vercel` (preview) and `npx vercel --prod` (production).

## Project layout

```
src/rules/   Pure game rules and data: routes, passengers, fares, change, saves, missions, daily events (unit tested)
src/engine/  Three.js: renderer, sky and weather, world tiles, models, car models, textures, route features
src/assets/  Car and truck models (glTF)
src/game/    Game loop, traffic simulation, AI racers, races, stops, stations, warden junctions, toll, BRT, collisions
src/ui/      HUD, change panel and screens
```

## Credits

An original game inspired by everyday Lagos transport. Stop names are real places; distances, businesses, brands, car names and dialogue are invented. Not affiliated with any other game.

Car and truck models: [Car Kit](https://kenney.nl/assets/car-kit) by Kenney, CC0 (see `src/assets/cars/LICENSE-kenney.txt`).
