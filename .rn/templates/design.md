<!-- For developers. Answer why it is this way. Delete any line the README or the code already answers. -->

# {Name} design

## Goals

- {the problem, and what goes wrong without this}

## Non-goals

- {what it deliberately does not do}

## Solution

{The core idea, in a few lines. Why it solves the problem}

Assumes: {facts relied on but not verified, or none}

## Structure

```mermaid
flowchart LR
  A["{actor or part}"] --> B["{part}"] --> C["{part}"]
```

| Part | Responsibility |
|---|---|
| {part} | {what it does, and what it must not do} |

## Flow

```mermaid
sequenceDiagram
  {actor} ->> {part}: {step}
  {part} -->> {actor}: {result}
```

## Alternatives

| Alternative | Why not |
|---|---|
| {option considered} | {what it would cost or break} |
