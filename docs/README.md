# Pokédex documentation

| Document | What's in it |
|---|---|
| [Software Requirements Specification](SRS.md) | Scope, users, environment, constraints, interfaces, functional requirements (FR), non-functional requirements (NFR), data, traceability, limitations |
| [Use case diagram](diagrams/use-case-diagram.md) | Actors, 11 use cases with «include»/«extend», and a full description of each use case |
| [Activity diagrams](diagrams/activity-diagrams.md) | Lens identification · name matching · opening a Pokémon page · choosing Smogon rules and format |
| [Sequence diagrams](diagrams/sequence-diagrams.md) | App start · opening a page · Lens round trip · read aloud · Smogon tab |
| [State diagrams](diagrams/state-diagrams.md) | App screens · Lens return watcher · read-aloud button · cached resource · Smogon selection |
| [Component diagram](diagrams/component-diagram.md) | Web UI, Android shell, platform services and data sources |

Diagrams are written in [Mermaid](https://mermaid.js.org), which GitHub draws directly when you open the files. SVG exports of every diagram are in [`diagrams/img`](diagrams/img/), for slides or reports.

## Updating a diagram
1. Edit the ```` ```mermaid ```` block in the `.md` file. GitHub shows the result right away.
2. To refresh the SVG: `npx -p @mermaid-js/mermaid-cli mmdc -i diagram.mmd -o docs/diagrams/img/name.svg -b white`

## Diagram index
| ID | Diagram | SVG |
|---|---|---|
| — | System context (SRS §2.1) | [context.svg](diagrams/img/context.svg) |
| UC | Use case diagram | [use-case.svg](diagrams/img/use-case.svg) |
| A-1 | Identify with Google Lens | [activity-lens.svg](diagrams/img/activity-lens.svg) |
| A-2 | Match a Pokémon name | [activity-match.svg](diagrams/img/activity-match.svg) |
| A-3 | Open a Pokémon page | [activity-open-page.svg](diagrams/img/activity-open-page.svg) |
| A-4 | Choose Smogon rules and format | [activity-smogon.svg](diagrams/img/activity-smogon.svg) |
| S-1 | App start and species index | [seq-startup.svg](diagrams/img/seq-startup.svg) |
| S-2 | Open a Pokémon page | [seq-open-page.svg](diagrams/img/seq-open-page.svg) |
| S-3 | Lens round trip | [seq-lens.svg](diagrams/img/seq-lens.svg) |
| S-4 | Read entry aloud | [seq-read-aloud.svg](diagrams/img/seq-read-aloud.svg) |
| S-5 | Smogon tab | [seq-smogon.svg](diagrams/img/seq-smogon.svg) |
| ST-1 | App screens | [state-screens.svg](diagrams/img/state-screens.svg) |
| ST-2 | Lens return watcher | [state-lens-watcher.svg](diagrams/img/state-lens-watcher.svg) |
| ST-3 | Read-aloud button | [state-read-aloud.svg](diagrams/img/state-read-aloud.svg) |
| ST-4 | Cached resource | [state-netcache.svg](diagrams/img/state-netcache.svg) |
| ST-5 | Smogon selection | [state-smogon.svg](diagrams/img/state-smogon.svg) |
| C | Component diagram | [component.svg](diagrams/img/component.svg) |
