<!--
Rules (hidden; no need to delete)

- The reader is a first-time user. This alone lets them start.
- First three lines answer: what it is, who it is for, how to start.
- One heading = one question the reader has. Headings are English words.
- Show with diagrams, tables and lists. Never more than three lines of prose in a row.
- Say what it does, never why. Reasons live in the design doc, history in git.
- Describe only the current state. Copy names, commands and values from the real thing.
- Do not be exhaustive. Write only where the reader would hesitate. One link, to the design doc.
- Diagrams are text (Mermaid, tree, table), never images. Draw a diagram only when four or more parts interact.
- Usage follows the order the user works in, with the names the user actually sees (command, screen, API, option).
- Output is what comes out. Limits is what it cannot do. Never both for the same fact.
- About 100 lines. Cut when longer.
-->

# {Name}

{What it does, in one line}
{Who it is for}

## Quick start

```
{install}
{run}
```

## How it works

```
{One flow. Step names are the ones the user sees}
```

## Usage

### {Step or feature 1}

{What the user does and what happens. Two or three lines}

### {Step or feature 2}

| Option | What to give |
|---|---|
| {option} | {value and meaning} |

## Output

```
{What comes out, as a tree}
```

## Limits

- {What it cannot do}
- {What happens then}

## Development

```
{build}
{test}
```

Design decisions: [`docs/design.md`](docs/design.md)
