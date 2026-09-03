#!/bin/bash
#
# Rulează la începutul fiecărei sesiuni Claude Code (vezi .claude/settings.json).
#
# Face două lucruri, în ordinea asta:
#   1. Aduce sesiunea pe `dev`. Regula proiectului (CLAUDE.md) e că se lucrează
#      pe `dev` și se promovează în `main` — dar sesiunile pornite din web sunt
#      așezate automat pe o ramură `claude/<ceva>`. Fără hook-ul ăsta, regula e
#      doar scrisă undeva; aici chiar se execută.
#   2. Instalează dependențele, ca `npm run lint` / `npm test` / `npm run build`
#      să meargă imediat — containerul pornește fără `node_modules`, iar aceleași
#      trei comenzi sunt condiția de promovare a fiecărei etape.
#
# Tot zgomotul comenzilor pleacă pe stderr; pe stdout iese un singur obiect JSON
# la final, altfel Claude Code nu poate citi rezultatul.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

notes=()

# ---------------------------------------------------------------- 1. ramura dev

branch_note() {
  local current
  current=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || {
    notes+=("Nu e un repo git — am sărit peste trecerea pe dev.")
    return
  }

  if [ "$current" = "dev" ]; then
    notes+=("Ramura curentă: dev.")
  elif [ -n "$(git status --porcelain)" ]; then
    # Modificări nesalvate: a schimba ramura sub ele e exact felul în care se
    # pierde muncă. Le lăsăm pe loc și spunem ce s-a întâmplat.
    notes+=("Ramura curentă e \`$current\`, cu modificări nesalvate — NU am schimbat-o. Regula proiectului e să se lucreze pe \`dev\`: mută modificările (\`git stash\` sau un commit) și treci pe dev înainte să continui.")
    return
  fi

  git fetch origin dev >&2 2>/dev/null

  if [ "$current" != "dev" ]; then
    if git show-ref --verify --quiet refs/heads/dev; then
      git checkout dev >&2 2>/dev/null || {
        notes+=("Nu am putut trece pe \`dev\` de pe \`$current\`.")
        return
      }
    elif git show-ref --verify --quiet refs/remotes/origin/dev; then
      git checkout -B dev origin/dev >&2 2>/dev/null || {
        notes+=("Nu am putut crea \`dev\` din \`origin/dev\`.")
        return
      }
    else
      notes+=("Nu există nicio ramură \`dev\` (nici locală, nici pe origin) — am rămas pe \`$current\`.")
      return
    fi
    notes+=("Am trecut de pe \`$current\` pe \`dev\` (regula din CLAUDE.md).")
  fi

  # Doar fast-forward: dacă `dev` local are commit-uri nepromovate, merge-ul
  # eșuează și le păstrăm, în loc să le rescriem peste.
  if git show-ref --verify --quiet refs/remotes/origin/dev; then
    if git merge --ff-only origin/dev >&2 2>/dev/null; then
      :
    else
      notes+=("\`dev\` local nu se poate avansa direct la \`origin/dev\` — are commit-uri proprii sau a divergat. Verifică \`git log origin/dev..dev\` înainte să lucrezi.")
    fi
  fi
}

branch_note

# --------------------------------------------------------- 2. dependențe (web)

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if npm install --no-audit --no-fund >&2; then
    notes+=("Dependențele sunt instalate: \`npm run lint\`, \`npm test\` și \`npm run build\` pot rula.")
  else
    notes+=("\`npm install\` a eșuat — lint/test/build nu vor merge până nu se rezolvă.")
  fi
fi

# ------------------------------------------------------------------- rezultatul

context=$(printf '%s\n' "${notes[@]}")

# node, nu python/jq: proiectul îl are oricum, deci e cea mai sigură dependență.
CONTEXT="$context" node -e '
const rules = [
  "Reguli de ramură pentru acest proiect (vezi CLAUDE.md):",
  "- Se lucrează pe `dev`. Nu se creează ramuri `claude/**` sau altele.",
  "- Când o etapă e gata și `npm run lint`, `npm test` și `npm run build` trec, se merge `dev` → `main` și se face push pe `main`. Doar `main` publică.",
  "",
  "Starea la pornirea sesiunii:",
  process.env.CONTEXT,
].join("\n")
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: rules },
}))
'
