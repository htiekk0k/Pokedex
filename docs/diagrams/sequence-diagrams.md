# Sequence diagrams

Participants
- **UI**: the web interface (`app.js`) running in the WebView.
- **WebView**: Android WebView; routes `/net` requests to the Java layer.
- **Activity**: `MainActivity` (Java), including the `Native` bridge and WebView client.
- **NetCache**: download-and-store layer (`NetCache.java`).

## S-1 App start and species index

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Activity as MainActivity
  participant WebView
  participant UI as UI (app.js)
  participant Net as NetCache
  participant SD as Showdown data
  participant API as PokéAPI

  User->>Activity: Launch app
  Activity->>WebView: loadUrl(appassets…/index.html)
  WebView->>Activity: shouldInterceptRequest(index.html, app.js, …)
  Activity-->>WebView: asset streams
  WebView->>UI: run app.js
  UI->>WebView: fetch /net?u=…/pokedex.json&ttl=7d
  WebView->>Activity: shouldInterceptRequest(/net)
  Activity->>Net: fetch(url, ttl)
  alt cached and fresh
    Net-->>Activity: stored file
  else missing or stale
    Net->>SD: GET pokedex.json
    SD-->>Net: JSON
    Net->>Net: write file + content type
    Net-->>Activity: stored file
  end
  Activity-->>UI: response
  UI->>WebView: fetch /net?u=…/pokemon?limit=3000
  WebView->>Activity: intercept
  Activity->>Net: fetch
  Net->>API: GET (if needed)
  Net-->>UI: list of names → ids
  UI->>UI: build index, form ids, name map
  UI->>UI: render list (first 60 rows)
  UI->>Activity: Native.ready()
  Activity-->>UI: flush queued events (e.g. shared text)
```

## S-2 Open a Pokémon page

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as UI (app.js)
  participant Activity as MainActivity
  participant Net as NetCache
  participant API as PokéAPI
  participant GH as GitHub raw (artwork)

  User->>UI: Tap "Charizard"
  UI->>UI: location.hash = #p-charizard
  UI->>UI: render header from index + skeleton
  UI->>Activity: GET /net?u=…/pokemon-species/6
  Activity->>Net: fetch(url, 30d)
  Net->>API: GET (if not cached)
  API-->>Net: species JSON
  Net-->>UI: species
  UI->>UI: pickVariety(species, entry)
  UI->>Activity: GET /net?u=…/pokemon/6
  Activity->>Net: fetch
  Net-->>UI: pokemon JSON
  UI->>UI: render artwork, types, tabs, Entry tab
  UI->>Activity: GET /net?u=…/official-artwork/6.png&ttl=-1
  Activity->>Net: fetch(url, forever, w=0)
  Net->>GH: GET (if not cached)
  Net-->>UI: PNG
```

## S-3 Identify with Google Lens and return

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as UI (app.js)
  participant Activity as MainActivity
  participant Camera as Camera app
  participant Lens as Google app (Lens)
  participant Clip as Clipboard

  User->>UI: Tap Lens → Take photo → Lens
  UI->>Activity: Native.scan("lens-camera")
  Activity->>Camera: ACTION_IMAGE_CAPTURE (FileProvider URI)
  Camera-->>Activity: RESULT_OK
  Activity->>Activity: copy photo → cache/photos/lens.jpg
  Activity->>Clip: read current text (remember)
  Activity->>Lens: ACTION_SEND image/jpeg + read grant
  Activity->>Activity: lensSentAt = now
  Lens-->>User: shows "Charizard"
  User->>Lens: long-press name → Copy
  Lens->>Clip: "Charizard"
  User->>Activity: Back
  Activity->>Activity: onWindowFocusChanged(true)
  Activity->>Clip: read text
  alt text changed
    Activity->>UI: onNative({type:'text', source:'lens', text})
    UI->>UI: findInText → Charizard
    UI->>UI: open page, auto-read
  else unchanged
    Activity->>UI: onNative({type:'lensBack'})
    UI-->>User: "Waiting for a name" sheet
    User->>UI: Check again
    UI->>Activity: Native.checkClipboard()
  end
```

## S-4 Read entry aloud

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as UI (app.js)
  participant Activity as MainActivity
  participant TTS as TextToSpeech

  User->>UI: Tap "Read entry aloud"
  UI->>UI: text = "Name. The category. Entry."
  UI->>Activity: Native.speak(text, rate, pitch)
  Activity->>TTS: setSpeechRate, setPitch, speak(QUEUE_FLUSH)
  Activity-->>UI: true
  UI->>UI: button → Stop, light blinks
  TTS-->>Activity: onStart
  Activity->>UI: onNative({type:'tts', state:'start'})
  alt finishes
    TTS-->>Activity: onDone
    Activity->>UI: onNative({type:'tts', state:'done'})
  else user taps Stop / leaves page
    UI->>Activity: Native.stopSpeaking()
    Activity->>TTS: stop()
    Activity->>UI: onNative({type:'tts', state:'done'})
  end
  UI->>UI: button → Read entry aloud
```

## S-6 In-app update

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as UI (app.js)
  participant Activity as MainActivity
  participant GH as GitHub API / Releases
  participant PI as Android package installer

  User->>UI: Settings → Check for updates
  UI->>Activity: Native.checkUpdate(false)
  Activity->>GH: GET /repos/htiekk0k/Pokedex/releases/latest
  GH-->>Activity: tag build-N, body, assets[Pokedex.apk]
  Activity->>Activity: N > installed version code?
  Activity->>UI: onNative({type:'update', available, latest, notes, url, size})
  UI-->>User: "Update available" + What's new
  User->>UI: Download and install
  UI->>Activity: Native.downloadUpdate(url)
  Activity->>Activity: check url is github.com/htiekk0k/Pokedex/…
  Activity->>GH: GET release asset (redirect followed)
  loop every ~2 %
    Activity->>UI: onNative({type:'updateProgress', pct})
  end
  Activity->>Activity: save cache/updates/Pokedex.apk
  opt install permission not yet granted
    Activity->>UI: onNative({type:'updatePermission'})
    Activity->>User: open "Install unknown apps" for Pokédex
    User->>Activity: allow, then back (onResume)
  end
  Activity->>PI: createSession · write base.apk · commit(status PendingIntent)
  PI-->>Activity: onNewIntent(INSTALL_STATUS = PENDING_USER_ACTION, confirm intent)
  Activity->>PI: startActivity(confirm intent)
  Activity->>UI: onNative({type:'updateConfirm'})
  PI-->>User: "Update this app?"
  alt User taps Update
    PI->>PI: replace APK in place (same key → data kept)
  else User cancels
    PI-->>Activity: INSTALL_STATUS = FAILURE_ABORTED
    Activity->>UI: onNative({type:'updateCancelled'}) → "Install now"
  end
  Note over UI,Activity: "Open installer" re-runs the install from the saved file
```

## S-5 Smogon tab

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as UI (app.js)
  participant Net as NetCache (via /net)
  participant PK as data.pkmn.cc → pkmn.github.io

  User->>UI: Open Smogon tab
  UI->>UI: rules = session ?? default ?? latest
  par set data
    UI->>Net: sets/{rules}.json (ttl 3d)
    Net->>PK: GET (302 followed)
    PK-->>Net: species → format → sets
    Net-->>UI: JSON
  and format list
    UI->>Net: sets/index.json (ttl 7d)
    Net-->>UI: file list
  end
  UI->>UI: formats with sets + other formats + Random
  UI->>UI: pick format (session ?? default ?? OU)
  UI-->>User: rules chips, format picker, set cards
  User->>UI: Make this my default
  UI->>UI: settings.format / smogonRules saved
  User->>UI: Copy for Showdown
  UI->>UI: build export text → Native.copy()
```
