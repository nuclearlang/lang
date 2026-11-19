---
name: maps-geolocation
description: Build maps and geolocation in a Synapsis product: location permissions, accuracy and battery trade-offs, geocoding through a provider, distance queries and location privacy. Use when a feature reads the user's position, shows a map, finds places nearby or turns addresses into coordinates.
title: Maps and geolocation
title_es: Mapas y geolocalización
description_es: Construir mapas y geolocalización en un producto Synapsis: permisos, precisión frente a batería, geocodificación con un proveedor, consultas por distancia y privacidad. Úsalo cuando una función lee la posición del usuario, muestra un mapa, busca lugares cercanos o geocodifica direcciones.
kind: domain
tags: [maps, geolocation, location, gps, geocoding, nearby, permissions, privacy]
---
# Maps and geolocation

## When to use

"Near me" lists, a map with markers, delivery or ride tracking, address autocomplete, check-ins.

## What the platform has

No location, map or geocoding word in any platform yet. On mobile, the device position and the map widget come
from the dialect's packages through `nuclear add <package>`; that code is tied to the dialect, so keep it in one
service (position) and one widget (map), and record the missing portable words in the mobile platform's roadmap.
Geocoding and routing are other APIs: HTTP repositories with `--source rest:<url>`.

## Steps

1. **Ask why before asking where.** Decide the precision the feature needs: city (coarse, ~km) for "events near
   you", street (~100 m) for a store finder, precise (~10 m) only for navigation or delivery. Ask for the
   coarsest that works.
2. **Permissions**: ask "while in use" when the user taps the feature, after a screen that says why; "always"
   (background) only for a feature that truly needs it, with its own explanation (the stores review it).
   Handle every answer: granted, denied, denied forever (send to the system settings), location services off,
   approximate only (iOS, Android 12+). The feature must still work with a typed city or a map pick.
3. **Battery**: one position for a one-off lookup, not a stream; for tracking, a distance filter (move > 50 m) and
   a time interval, stop when the screen closes, and lower accuracy when precision is not needed.
4. **Coordinates**: `latitude` and `longitude` as `double` in WGS84 degrees, with `accuracy` in meters and the
   `capturedAt` time. Validate ranges on the backend (`@min(-90) @max(90)`, `@min(-180) @max(180)`).
5. **Nearby queries** on the backend: a bounding box first (`between` on latitude and longitude, both indexed with
   `@column(index = true)`), then the exact haversine distance in a service, sorted and limited. For large sets,
   the database's geo index (PostGIS) written in the migration file.
6. **Geocoding**: the provider (an HTTP repository, key from `env(...)`) is called from the backend, not the app,
   so the key stays secret and answers can be cached (`~cacheSet` with plugin `redis`, or a table). Respect the
   provider's terms on caching and attribution. Debounce address autocomplete (see `search`).
7. **Maps on the client**: the map widget in one `stateful` of the component; markers from the use case's models;
   cluster many markers; show the provider's attribution.
8. **Privacy**: location is personal data (`privacy-gdpr`). Store the least: a rounded position or the city when
   the exact one is not needed; keep tracks only as long as the purpose needs; never log raw coordinates; show
   other users an approximate position unless they chose to share it.
9. **Tests**: the position service behind a use case lets a test mock it (`@mock([...])` on mobile); test denied
   permission and services off, not only success.

## The platform's tools

- `nuclear add <package>` (mobile: the position and map packages of the dialect); `nuclear remove <package>`.
- `nuclear make service places Position`, `nuclear make stateful <name>` (mobile, the map widget).
- `nuclear gen resource places Geocode --source rest:<provider base url> --actions get` (backend).
- `nuclear gen resource places Place --source db --fields "name:string latitude:double longitude:double"`
- `nuclear migrate make "place indexes"`; `nuclear device` to try it in a phone window; `nuclear test`.

## Pitfalls

- Asking for location at first launch with no context: most users deny, and many forever.
- Requesting "always" when "while in use" is enough (store rejection, user distrust).
- A continuous GPS stream left running in the background: battery drain.
- `ORDER BY distance` over the whole table with no bounding box.
- The geocoding key inside the app binary.
- Storing precise histories "just in case".

## Checklist

- [ ] The precision needed is written in the spec; the lowest that works is requested.
- [ ] Permission is asked in context; denied, denied forever and services-off paths work (tests).
- [ ] Tracking stops when not visible and uses a distance filter.
- [ ] Coordinates are validated on the backend; nearby queries use an indexed bounding box.
- [ ] Provider keys live on the backend in `env(...)`; attribution is shown.
- [ ] Location retention and precision follow `privacy-gdpr`; `nuclear check .` reports 0 errors; `nuclear test` is green.
