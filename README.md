# West Road Life

A three-lane arcade driving game set in **London** and **Lagos**, built with Three.js and TypeScript. Drive a red double-decker over Tower Bridge or a yellow danfo along the Lagos Marina, dodge traffic, pick up passengers if you like, and earn pounds or naira for every metre. Then share your result and challenge a friend to drive the same road and beat it.

Play: https://wole-phi.vercel.app

## The game

- **Two cities, six areas.** London: River Run (over Tower Bridge to the South Bank), Wapping Streets (warehouses and quays), Bridge Approach (Bermondsey to Whitechapel). Lagos: Marina City Drive (the cathedral, Broad Street and Balogun Market), Ikeja Avenue Drive (Allen Avenue and Computer Village), Victoria Island Drive (glass towers, palms and the lagoon).
- **Route or Endless.** Route ends at the last stop; Endless keeps going, a little faster and busier each kilometre, until the damage limit.
- **Passengers on or off.** Either way you earn by driving (faster pays more). With passengers on, move into the marked bay at a stop and brake: riders get off and pay, new ones get on. Stop by the shelter for a perfect-stop tip. London pickups are at the left kerb, Lagos at the right.
- **Six vehicles per city.** London: red double-decker, black cab, teal hatchback, coral sedan, navy SUV, motorcycle. Lagos: yellow danfo, coral sedan, Lagos taxi, keke, navy SUV, okada. Each has its own seats, fares, speed, handling and health. All are free.
- **Feedback that reads at a glance:** close-pass and clean-kilometre bonuses, health marks with a damage warning that names what you hit, a Lagos conductor (or London bus announcement) calling the next stop.
- **Social:** a result card with a picture of your drive, shared through the phone's share sheet (or saved / copied). The link carries the same city, area, vehicle and traffic seed, so a friend drives the same road. A **daily drive** gives everyone the same city, vehicle and road each day.
- **First drive** teaches swipe, speed up and stopping one step at a time. Reduced-motion and volume settings are in Settings.

Controls: swipe left/right to change lane, hold the road or Gas to speed up, hold Brake. Keys: ← → lanes, ↑/W gas, ↓/S/Space brake, P pause, M sound.

## Art direction

The look follows the *West Road Life* visual kit (London and Lagos boards, fleets, environment sheets, Three.js spec): rounded cartoon forms, deep navy glass, cream hubs, ink/cream/yellow UI in Exo 2. There are no imported 3D models: every vehicle, building, person and landmark is built in code from rounded parts (`src/art/`), merged per model and drawn with instancing, so the whole game is a few hundred kilobytes. Lagos keeps Wole Wole's street life (market umbrellas, hand-painted signs, hawkers, black-and-white kerbs, water tanks, danfo stripes) on top of the kit's three districts.

## Code

```
src/config/   cities, areas, stops and vehicles
src/rules/    money, saves (with Wole Wole migration), daily drive, challenge links, advice — unit tested
src/art/      rounded-part kit, vehicles, people, buildings, props, landmarks, textures
src/world/    renderer and sky, road layout, street streaming, instanced pools
src/game/     the drive, traffic, crowd, player vehicle, camera
src/ui/       HUD, screens, share card
src/app.ts    screens, showcase, drives, results and sharing
```

```
npm install
npm run dev        # http://localhost:5173 (?gallery and ?street open model and street views)
npm test           # rules unit tests
npm run check      # types, tests and production build
```

Fonts: Exo 2 (SIL Open Font License, `public/fonts/OFL.txt`).
