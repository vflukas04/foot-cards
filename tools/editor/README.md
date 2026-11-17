# Karten-Editor (Iteration 3)

Stand 18.11.2026. Der Editor ist eine Claude-Seite (Artifact) mit gemeinsamer Datenbank:
https://claude.ai/artifact/BCGiGrbs9gUmgWQweKqdip (nur für Simon und die Personen, mit denen er sie teilt).

## Was er kann
- Alle Mannschaften und Karten so anzeigen wie im Spiel, mit Marktwert aus `tools/bewertung`.
- Karten bearbeiten: Zone antippen, Aktionen vor/hinter dem „/“, grün, Token je Option; Werte, Name, Nummer, Trikot, Spielertyp; Torhüter-Felder und -Eigenschaften.
- Neue Spieler, Torhüter (leer oder als Kopie) und neue Mannschaften (Name, Kurzname, Stufe, Trikot).
- VfL-Karten sind gesperrt, bis man sie bewusst entsperrt.
- Jede Änderung ist ein **Vorschlag** (einer pro Karte) in der Datenbank-Sammlung `vorschlaege`. Postfach: Simon und Lukas sehen, was der andere vorgeschlagen, geändert, bestätigt, abgelehnt oder kommentiert hat. Wer „Simon“ und wer „Lukas“ ist, wählt man beim ersten Öffnen (gemerkt im Browser).
- „Ins Spiel exportieren“ setzt `exportState: "angefordert"`, mit Bestätigung oder ohne. Neue Mannschaften werden als Ganzes exportiert (mindestens 16 Feldspieler und 2 Torhüter).

## Export ins Spiel (Claude)
1. Alle Dokumente der Sammlung `vorschlaege` lesen (ArtifactData `list`) und als Liste `[{"id", "data"}]` speichern.
2. `python3 tools/editor/apply_export.py <datei.json>` übernimmt alle angeforderten Exporte in `challengers/iteration-3/src/cards.json` und gibt die Änderungsliste aus.
3. Wie immer: bauen, testen (Regression ändert sich nur durch die gewollten Kartenänderungen), BALANCE.md, Pull Request mit @vflukas04, mergen.
4. In der Datenbank bei jedem übernommenen Dokument `exportState: "exportiert"`, `exportStand: <neue BUILD-Kennung>` setzen und einen Verlaufseintrag `{by: "claude", action: "exportiert", at: <ms>}` anhängen.
5. Editor mit dem neuen Kartenstand neu bauen und auf dieselbe Adresse veröffentlichen:
   `python3 tools/editor/build_editor.py <ausgabe.html>`, dann Artifact publish mit `url` und `capabilities: {db: {}, user: {}}`.

## Dateien
- `editor.src.html`: die Seite (Platzhalter für Kartendaten, Marktwert-Daten, Stand).
- `build_editor.py`: baut die Seite aus den aktuellen Spieldaten; eicht die Marktwert-Formel an `tools/bewertung/ergebnisse`.
- `apply_export.py`: übernimmt angeforderte Exporte in `cards.json`.

Neue Mannschaften erscheinen im Spiel automatisch im Vereinsduell und im Kartenpool (Liste `clubs` in `cards.json`). Ins Turnier kommen sie erst, wenn Simon es sagt.
