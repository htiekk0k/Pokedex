# Pokédex (personal Android app)

A fan-made Pokédex for Android: search, voice search, scan card names with the camera, look up Pokémon from Google Lens / Circle to Search, read entries aloud, and view stats, learnsets, evolutions and Smogon sets under the rules of any generation (I–IX).

## Get the APK

Every push to `main` builds the app on GitHub Actions and publishes it under **Releases**.
On your phone open this repository → **Releases** → latest build → tap **Pokedex.apk** → install
(allow "install unknown apps" for your browser the first time). New builds install over the old one and keep your saved data.

## How it finds Pokémon (no AI service needed)

- **Search** by name or number, filter by type.
- **Say it**: phone speech recognition.
- **Share a screenshot** to the app: on-device text recognition (ML Kit) reads the Pokémon name written on it.
- **Identify with Lens**: take or pick a photo, it opens in Google Lens; copy the name and come back (or select it → **Pokédex**).

## Data sources

- [PokéAPI](https://pokeapi.co): Pokédex entries, stats, abilities, learnsets, evolution chains (with per-generation history).
- [Pokémon Showdown](https://play.pokemonshowdown.com) data: species list, forms, move details.
- [data.pkmn.cc](https://data.pkmn.cc): Smogon University sets (copyright Smogon and its contributors; personal use).

Everything you open is cached on the phone and works offline afterwards.

## Project layout

- `app/src/main/java/.../MainActivity.java`: Android shell (WebView, text-to-speech, voice, camera + OCR, share intents)
- `app/src/main/java/.../NetCache.java`: download + offline cache
- `app/src/main/assets/www/`: the app's screens (HTML/CSS/JS)
- `.github/workflows/build.yml`: builds and releases the APK

The signing key in `app/pokedex.keystore` is only for this personal app, so updates install over each other.

Pokémon and related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This project is not affiliated with them.
