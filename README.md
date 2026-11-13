# Sõnapüramiid

Eesti liitsõnade püramiidimäng. Sõnad tuleb laduda nii, et iga joon annaks ülevalt alla
loetava liitsõna: ülemine sõna on liitsõna esimene pool, alumine teine pool
(õun + mahl = õunamahl).

An Estonian compound-word pyramid game. This is a plain static website: no build step,
no dependencies.

## Run it

Open `index.html` in a browser. Nothing needs to be installed.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page structure: home screen, game screen, leaderboard, guide |
| `css/style.css` | All styling. Every colour is a token in the `:root` block at the top |
| `js/puzzles.js` | Puzzle data, the campaign level list and the daily pool |
| `js/game.js` | Game logic, navigation, the animated guide |

## Design

The look is deliberately plain so it can be redesigned. To restyle the game, start with the
`:root` block in `css/style.css`: `--bg`, `--ink`, `--muted`, `--line`, `--good` (correct pair),
`--near` (real compound, wrong place), `--pin` (pair locked by the player), `--font`.
Dark-mode values are set in the three blocks right below it.

The guide's animated examples are SVG styled by the `.gd` rules in the same file.

## Adding a puzzle

Puzzles live in the `P` object in `js/puzzles.js`. Each one has:

- `w`: the words in solved order: the top word, then each row left to right
  (3, 7 or 15 words).
- `s`: for every word after the first, `[compound, meaning]` formed with the word above it.
  Order matches `w` from the second word on.
- `x`: other real compounds among the same words, as `[upper, lower, compound, meaning]`.
  These show as amber (real word, wrong place) when a player builds them.

Rules for a good puzzle:

- Every compound reads top-down: upper word first, lower word second.
- Tiles show the base (nominative) form; the compound is written in its real joined form
  (`käsi` + `kell` = `käekell`).
- Every compound should be checked against Sõnaveeb or ÕS.

Then add the puzzle's key to `DAILY` (daily rotation) or `CAMP` (campaign, with the time
limits in seconds for three and two stars).

## Not built yet

- **Leaderboard and nicknames.** These need a server. On the plain website the leaderboard
  entry is hidden; the daily game and campaign work fully.
- **Once-a-day limit and progress** are stored in the browser only.
- **Daily puzzle pool** is 8 puzzles; the target is around 80.
