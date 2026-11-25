# State diagrams

## ST-1 App screens

Settings, Filters and pickers open as sheets over the current screen and return to it when closed, so they are not drawn as separate states.

```mermaid
stateDiagram-v2
  [*] --> Loading
  Loading --> StartError: offline on first run
  StartError --> Loading: Try again
  Loading --> Home: species index loaded

  Home --> Home: search · filter · sort
  Home --> Listening: Say a name
  Listening --> Home: cancelled / no match
  Listening --> PokemonPage: name matched

  Home --> LensHandoff: Lens · photo taken
  state LensHandoff {
    [*] --> InLens
    InLens --> Waiting: back, nothing copied
    Waiting --> InLens: Try another photo
  }
  LensHandoff --> PokemonPage: name copied or selected
  LensHandoff --> Home: Cancel

  Home --> PokemonPage: tap a Pokémon
  PokemonPage --> PokemonPage: switch form / evolution stage
  PokemonPage --> Home: Back

  state PokemonPage {
    [*] --> Entry
    Entry --> Stats
    Stats --> Moves
    Moves --> Smogon
    Smogon --> Evolution
  }
  note right of PokemonPage
    Tabs can be chosen in any order.
    The tab is kept when switching forms.
  end note
```

## ST-2 Lens return watcher (MainActivity)

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Capturing: scan("lens-camera" / "lens-gallery")
  Capturing --> Idle: cancelled
  Capturing --> Sending: photo returned
  Sending --> Idle: no Google app (error)
  Sending --> Watching: shared to Lens\nlensSentAt = now\nclipBefore = clipboard
  Watching --> Idle: PROCESS_TEXT or SEND text received
  Watching --> Checking: window regains focus
  Checking --> Idle: clipboard changed → emit text
  Checking --> Watching: unchanged → emit lensBack
  Watching --> Idle: 15 min elapsed / Cancel
```

## ST-3 Read-aloud button

```mermaid
stateDiagram-v2
  [*] --> Disabled: page loading
  Disabled --> Ready: species loaded
  Ready --> Speaking: tap / auto-read\nNative.speak()
  Speaking --> Ready: onDone
  Speaking --> Ready: tap Stop
  Speaking --> Ready: change game / leave page
  Ready --> Disabled: open another Pokémon
```

## ST-4 Cached resource (NetCache)

```mermaid
stateDiagram-v2
  [*] --> Missing
  Missing --> Downloading: requested
  Downloading --> Fresh: HTTP 200 (stored)
  Downloading --> Failed: offline / HTTP error
  Failed --> Missing
  Fresh --> Stale: age > ttl
  Stale --> Downloading: requested and online
  Stale --> Stale: requested offline (serve stored copy)
  Fresh --> Fresh: requested (serve stored copy)
  Fresh --> Missing: Clear saved data
  Stale --> Missing: Clear saved data
  note right of Fresh
    Time to live
    images = forever
    Smogon sets = 3 days
    species index = 7 days
    PokéAPI = 30 days
  end note
```

## ST-5 Smogon tab selection

```mermaid
stateDiagram-v2
  [*] --> UsingDefault
  UsingDefault: rules + format from saved default\n(or latest generation + OU)
  UsingDefault --> SessionChoice: pick rules / format
  SessionChoice --> SessionChoice: pick again
  SessionChoice --> UsingDefault: Make this my default (saved)
  SessionChoice --> UsingDefault: app restarted
  state SessionChoice {
    [*] --> HasSets
    HasSets --> NoSets: format without sets
    NoSets --> HasSets: format with sets
    HasSets --> RandomBattle: Random Battle / Doubles
    RandomBattle --> HasSets
  }
```
