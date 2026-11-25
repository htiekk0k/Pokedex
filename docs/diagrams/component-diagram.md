# Component diagram

```mermaid
flowchart TB
  subgraph APK["Pokédex APK"]
    direction TB
    subgraph Web["Web UI · assets/www"]
      html["index.html<br/>screens & icons"]
      css["app.css<br/>Pokédex styling"]
      js["app.js<br/>router · list · filters · tabs<br/>name matcher · pickers"]
      data["data.js<br/>type chart · games · labels"]
    end
    subgraph Native["Android shell · Java"]
      act["MainActivity<br/>WebView host · intents<br/>Lens hand-off · clipboard watch"]
      bridge["Bridge (window.Native)<br/>speak · listen · scan · copy …"]
      client["WebViewClient<br/>serves assets · routes /net"]
      net["NetCache<br/>download · store · ttl · thumbnails"]
    end
    fp["FileProvider<br/>cache/photos"]
  end

  subgraph Device["Android platform"]
    tts["TextToSpeech"]
    stt["Speech recogniser"]
    cam["Camera / gallery"]
    ocr["ML Kit text recognition"]
    clip["Clipboard"]
  end

  subgraph Remote["Internet"]
    pokeapi["PokéAPI"]
    sprites["PokéAPI sprites (GitHub)"]
    sd["Showdown data"]
    pkmn["data.pkmn.cc"]
  end
  lens["Google app / Lens"]

  js -- "window.Native.*" --> bridge
  bridge -- "onNative(event)" --> js
  js -- "fetch /net?u=…" --> client
  client --> net
  net --> pokeapi & sprites & sd & pkmn
  bridge --> tts & stt & cam & clip
  act --> ocr
  act -- "ACTION_SEND image" --> lens
  act --> fp
  lens -. "reads" .-> fp
```

| Component | Responsibility | Source |
|---|---|---|
| `index.html` | Screen skeleton, icon set | `app/src/main/assets/www/index.html` |
| `app.css` | Visual design, responsive layout | `…/www/app.css` |
| `app.js` | All UI logic: index, search, filters, routing, tabs, pickers, name matching, speech UI | `…/www/app.js` |
| `data.js` | Static reference data: type chart per generation, games ↔ generations, labels | `…/www/data.js` |
| `MainActivity` | Hosts WebView, JavaScript bridge, intents (share, process-text), camera/gallery, OCR, Lens hand-off, clipboard return | `app/src/main/java/dev/personal/pokedex/MainActivity.java` |
| `NetCache` | HTTPS download, on-disk store with time-to-live, offline fallback, thumbnail downscaling | `…/NetCache.java` |
| GitHub Actions | Builds the signed APK and publishes a Release on each push | `.github/workflows/build.yml` |
