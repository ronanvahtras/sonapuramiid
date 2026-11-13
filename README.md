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
| `index.html` | Page structure: home, game, leaderboard, privacy page, guide, dialogs |
| `css/style.css` | All styling. Every colour is a token in the `:root` block at the top |
| `js/config.js` | Supabase address and publishable key |
| `js/puzzles.js` | Puzzle data, the campaign level list and the daily pool |
| `js/game.js` | Game logic, navigation, leaderboard, sharing, the animated guide |
| `supabase/setup.sql` | Database tables and access rules for the leaderboard and word reports |
| `supabase/weekly.sql` | Adds the weekly leaderboard to a database set up before it existed |
| `builder.html` | Private helper page for writing new puzzles (not linked from the game) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Install to home screen and offline play |

## Leaderboard setup

The daily leaderboard and the "report a word" form use a Supabase database.

1. In the Supabase dashboard open the SQL editor, paste the contents of
   `supabase/setup.sql` and run it. It creates the `scores` and `reports` tables, the
   access rules, and a nightly job that deletes scores older than 30 days.
2. `js/config.js` already holds the project address and the publishable key. The
   publishable key is safe to keep in the code; a secret key must never be added.

How it works: players have no accounts. Each browser keeps a random id and a nickname.
One result per player per day is accepted, only for the current day in Tallinn time.
The website can read nicknames, times and moves, but not player ids. Reported words
appear in the `reports` table; rude nicknames can be removed by deleting the row in the
`scores` table.

Known limit: the game runs in the browser, so a determined player can submit a made-up
time. The database rejects impossible values, but real cheat-proofing needs the server to
check each game.

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

The quickest way to write one is `builder.html`: open it in a browser, type the words into
the pyramid, fill in each compound and meaning (each has a link to Sõnaveeb), and copy the
generated code into `P`.

Then add the puzzle's key to `DAILY` (daily rotation) or `CAMP` (campaign, with the time
limits in seconds for three and two stars).

## Releasing a change

Browsers keep copies of files for a few minutes, so after an update a player could get a new
page with an old script. To prevent that, the page and the script carry a version number.
When you change `index.html`, the CSS or any script, raise the number in all three places:

- `index.html`: the `sp-version` meta tag and the `?v=` on the CSS and script links
- `js/game.js`: `VERSION` at the top
- `sw.js`: the number in `CACHE`

## Not built yet

- **Cheat-proof scores** (see the known limit above).
- **Accounts.** Progress, statistics and the once-a-day limit are stored in the browser
  only, so they do not follow a player to another device.
- **Daily puzzle pool** is 8 puzzles; the target is around 80.
- **Campaign** has 20 levels; the target is 30.
