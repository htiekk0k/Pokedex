# Activity diagrams

## A-1 Identify a Pokémon with Google Lens (UC-04)

```mermaid
flowchart TD
  start((●)) --> tapLens[User taps Lens]
  tapLens --> choose{Take photo or<br/>use a picture?}
  choose -- Take photo --> cam[Camera app takes photo]
  choose -- Use a picture --> gal[Gallery picker]
  cam --> got{Photo returned?}
  gal --> got
  got -- No / cancelled --> stop1((◉))
  got -- Yes --> copyImg[Copy image to app cache<br/>and create FileProvider URI]
  copyImg --> remember[Remember current clipboard]
  remember --> hasGoogle{Google app or<br/>Lens app installed?}
  hasGoogle -- No --> err[Show error:<br/>Google Lens isn't available] --> stop2((◉))
  hasGoogle -- Yes --> send[Share image to Google Lens]
  send --> lensId[Lens identifies the Pokémon]
  lensId --> how{How does the user<br/>come back?}
  how -- Select name → Pokédex --> proc[Receive PROCESS_TEXT intent]
  how -- Copy name → Back --> focus[App regains focus]
  how -- Back without copying --> focus
  focus --> clip{Clipboard changed<br/>within 15 min?}
  clip -- No --> waiting[Show Waiting for a name sheet]
  waiting --> again{User choice}
  again -- Check again --> focus
  again -- Try another photo --> cam
  again -- Cancel --> stop3((◉))
  clip -- Yes --> match[Match Pokémon name in text]
  proc --> match
  match --> found{Candidates?}
  found -- None --> notName[Show copied text<br/>with Check again] --> again
  found -- One clear --> open[Open Pokémon page]
  found -- Several --> pick[Show Which one? list] --> open
  open --> auto{Auto-read on?}
  auto -- Yes --> speak[Read entry aloud] --> done((◉))
  auto -- No --> done
```

## A-2 Match a Pokémon name in text (shared by voice, Lens, share, OCR)

```mermaid
flowchart TD
  s((●)) --> lines[Receive weighted lines<br/>voice: rank · OCR: text height · share: 1–2]
  lines --> loop[For each line, split into words]
  loop --> win[Try word windows of 4, 3, 2, 1 words<br/>skipping words already matched]
  win --> norm[Normalise: lowercase, strip accents<br/>and punctuation, ♀→f ♂→m]
  norm --> lookup{In name map?<br/>includes Alolan / Mega aliases}
  lookup -- Yes --> add[Add weight to candidate<br/>mark words used]
  lookup -- No --> next[Next window]
  add --> next
  next --> more{More lines?}
  more -- Yes --> loop
  more -- No --> any{Any candidate?}
  any -- No --> fuzzy[Fuzzy match words of 5+ letters<br/>edit distance ≤1, or ≤2 if 8+]
  fuzzy --> rank
  any -- Yes --> rank[Sort candidates by score]
  rank --> e((◉))
```

## A-3 Open a Pokémon page (UC-06)

```mermaid
flowchart TD
  s((●)) --> tap[User taps a Pokémon]
  tap --> hash[Set route #p-id<br/>push history entry]
  hash --> hero[Render header from index:<br/>number, name, types, thumbnail]
  hero --> sp[Request species via /net]
  sp --> cached{Cached and fresh?}
  cached -- Yes --> useC[Use stored copy]
  cached -- No --> online{Network OK?}
  online -- Yes --> dl[Download and store] --> useC
  online -- No --> stale{Stale copy exists?}
  stale -- Yes --> useC
  stale -- No --> errc[Show offline card<br/>with Try again] --> e1((◉))
  useC --> variety[Pick variety for form<br/>exact slug → prefix → default]
  variety --> pk[Request pokemon data via /net]
  pk --> render[Render artwork, category, form chips,<br/>tab bar and current tab]
  render --> autoq{Opened by voice / Lens / share<br/>and auto-read on?}
  autoq -- Yes --> read[Read entry aloud] --> e2((◉))
  autoq -- No --> e2
```

## A-4 Choose Smogon rules and format (UC-09, UC-10)

```mermaid
flowchart TD
  s((●)) --> open[User opens Smogon tab]
  open --> rules[Rules = picked this session<br/>else saved default<br/>else latest generation]
  rules --> load[Load sets/rules.json and sets/index.json]
  load --> fmts[Build format list:<br/>formats with sets for this Pokémon<br/>+ other formats in index<br/>+ Random Battle / Doubles]
  fmts --> pickF[Format = picked<br/>else saved default<br/>else OU else first]
  pickF --> isRand{Random Battle?}
  isRand -- Yes --> rb[Load randbats file<br/>show roles and move pools]
  isRand -- No --> has{Sets for this Pokémon<br/>in format?}
  has -- Yes --> show[Show set cards]
  has -- No --> none[Show No sets message<br/>and formats that have sets]
  rb --> act
  show --> act{User action}
  none --> act
  act -- Change rules --> rules
  act -- Change format --> pickF
  act -- Copy for Showdown --> copy[Copy set in Showdown format] --> act
  act -- Make this my default --> save[Save rules and format<br/>to settings] --> act
  act -- Leave tab --> e((◉))
```
