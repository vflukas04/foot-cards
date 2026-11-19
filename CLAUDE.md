# Foot Cards – Hinweise für Claude

## Postfach zwischen Lukas und Simon
Fragen, Vorschläge und Nachrichten zwischen Lukas (vflukas04) und Simon (Firnmar) liegen als **GitHub-Issues mit dem Label `postfach`**.

- **Zu Beginn jeder Sitzung:** offene Postfach-Issues abrufen und dem Nutzer kurz nennen, was neu ist oder auf ihn wartet:
  `gh api "repos/vflukas04/foot-cards/issues?labels=postfach&state=open" --jq '.[] | "#\(.number) \(.title)"'`
  Kommentare eines Issues: `gh api repos/vflukas04/foot-cards/issues/<nr>/comments --jq '.[] | "\(.user.login): \(.body)"'`
- **Neue Nachricht:** Issue mit Label `postfach`, Titel beginnt mit „An Simon:“ oder „An Lukas:“, im Text @Firnmar bzw. @vflukas04 erwähnen (dann kommt eine Benachrichtigung).
- **Antwort:** als Kommentar im Issue. Erledigt: Issue schließen, mit kurzem Satz, was entschieden wurde oder in welchem Pull Request es umgesetzt ist.
- Kartenänderungen kann Simon auch im Karten-Editor bearbeiten (`tools/editor/README.md`). Der Editor hat ein eigenes Vorschlags-Postfach. Kommt ein Kartenvorschlag als Issue, gilt das Issue als Auftrag.

## Arbeitsweise im Repo
- Änderungen immer über Branch → Pull Request → Merge. `main` nie umschreiben oder force-pushen.
- Iteration 3 (`challengers/iteration-3`) entwickelt vor allem Simon weiter.
