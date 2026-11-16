// Startwerte („Bauchgefühl“) für das Bewertungssystem – vor den Simulationen festgelegt.
// Einheit: Wertpunkte. Bezug: „--“ = 0. Ein Schuss in der zentralen Offensive vor dem „/“ = 10.
// Zonen-Klassen (links und rechts zusammengefasst): OA = außen offensiv (LO/RO), ZO, ZM, DA = außen defensiv (LD/RD), ZD.
// Position 0 = vor dem „/“ (Pflichtoption), 1 = hinter dem „/“ (freiwillig, kostet Erschöpfen oder Token).
// Grundsätze (Lukas, 16.11.):
// - Hinter dem „/“ ist nichts negativ: Die Option ist freiwillig. Ihr Wert ist kleiner als vor dem „/“, weil sie etwas kostet
//   und nur genutzt wird, wenn sie besser ist als die erste Option.
// - Querpass vorne zentral (ZO) ist schwach, hinten treibt er das Spiel nach vorn.
// - Dribbling und Flanke sind positiv, etwa gleich stark, wo es beide gibt. Steilpass leicht schwächer als Dribbling.
// - Vorlage positiv (Ball bleibt, löst Direktschuss aus), aber schwächer als Schuss.
// - Gelb vor dem „/“ eher negativ (Gelb-Rot droht), hinter dem „/“ leicht positiv (Konter stoppen).
// - Kerze etwa wie „--“ (kann nicht abgefangen werden, dann Kopfballduell), eher leicht besser.
// - Befreiungsschlag und Slapstick: offen, vorsichtig angesetzt.
// - Ballverlust und Fehlpass klar negativ.
const ATT = {
  OA: [
    { '--': 0, 'Ball sichern': 1, 'Querpass': 2, 'Rückpass': 0, 'Flanke': 6, 'Dribbling': 5, 'Sprint': 4, 'Schuss': 4, 'Slapstick': 1, '-- und erschöpft': -1, 'Ballverlust': -6, 'Fehlpass': -6, 'Kerze': 0.5 },
    { 'Querpass': 1, 'Flanke': 4, 'Dribbling': 3, 'Sprint': 2.5, 'Schuss': 3, 'Vorlage': 3, 'Ballverlust': 0 },
  ],
  ZO: [
    { '--': 0, 'Schuss': 10, 'Vorlage': 7, 'Dribbling': 3, 'Querpass': -1, 'Ball sichern': 1, 'Slapstick': 1, 'Ballverlust': -6, 'Kerze': 1 },
    { 'Vorlage': 5, 'Schuss': 7, 'Querpass': 0, 'Dribbling': 2, 'Slapstick': 0.5 },
  ],
  ZM: [
    { '--': 0, 'Querpass': 1.5, 'Ball sichern': 1, 'Steilpass': 4, 'Schuss': 4, 'Dribbling': 4.5, 'Sprint': 4, 'Flanke': 3, 'Diagonalball': 3, 'Slapstick': 1, 'Kerze': 0.5, 'Ballverlust': -6 },
    { 'Querpass': 1, 'Schuss': 3, 'Flanke': 2, 'Dribbling': 3, 'Steilpass': 3, 'Diagonalball': 2, 'Vorlage': 2, 'Ball sichern': 0.5, 'Ballverlust': 0, 'Slapstick': 0.5, 'Kerze': 0.3 },
  ],
  DA: [
    { '--': 0, 'Ball sichern': 1, 'Querpass': 2.5, 'Dribbling': 4, 'Steilpass': 3.5, 'Diagonalball': 3, 'Sprint': 3.5, 'Befreiungsschlag': -1, 'Kerze': 0.5, 'Rückpass': 0, 'Slapstick': 1, 'Ballverlust': -6 },
    { 'Querpass': 1.5, 'Steilpass': 2.5, 'Dribbling': 3, 'Diagonalball': 2, 'Flanke': 1, 'Befreiungsschlag': 0, 'Kerze': 0.3, 'Slapstick': 0.5 },
  ],
  ZD: [
    { 'Querpass': 2.5, 'Ball sichern': 1, '--': 0, 'Dribbling': 3.5, '-- und erschöpft': -1, 'Fehlpass': -6, 'Kerze': 0.5, 'Befreiungsschlag': -1, 'Rückpass': 0, 'Ballverlust': -6, 'Slapstick': 1 },
    { 'Querpass': 1.5, 'Steilpass': 2.5, 'Rückpass': 0, 'Diagonalball': 2, 'Befreiungsschlag': 0, 'Kerze': 0.3 },
  ],
};
// Grün (nicht abzufangen): Zuschlag je nach Aktion
const GREEN = 1.5;
// Abwehr, aus Sicht der eigenen Zone (DA/ZD = eigene Abwehr, OA/ZO = vorne, Pressing)
const DEF = {
  OA: [{ '--': 0, 'Passabfangen': 2, 'Tackling': 2, '-- und Regeneriert': 0.5 }, { 'Tackling': 1.5, 'Passabfangen': 1.5, 'Gelb': 0.3 }],
  ZO: [{ '--': 0, 'Passabfangen': 2, 'Tackling': 2 }, { 'Gelb': 0.3, 'Tackling': 1.5, 'Passabfangen': 1.5, 'Ballgewinn': 2.5 }],
  ZM: [{ 'Ballgewinn': 6, 'Passabfangen': 3.5, 'Tackling': 3.5, '--': 0, '-- und Regeneriert': 0.5 }, { 'Passabfangen': 2.5, 'Tackling': 2.5, 'Ballgewinn': 4, 'Gelb': 0.5 }],
  DA: [{ 'Tackling': 3, '--': 0, 'Passabfangen': 3, 'Ballgewinn': 5, '-- und Regeneriert': 0.5 }, { 'Passabfangen': 2.5, 'Tackling': 2, 'Ballgewinn': 4, 'Block': 1.5, 'Gelb': 0.8 }],
  ZD: [{ 'Tackling': 3, 'Passabfangen': 3, 'Schuss blocken': 3, 'Ballgewinn': 6, '--': 0, '-- und Regeneriert': 0.5 }, { 'Block': 3, 'Tackling': 2, 'Ballgewinn': 4.5, 'Schuss blocken': 2.5, 'Passabfangen': 2, 'Gelb': 1 }],
};
// Gelb vor dem „/“ (nur zur Vollständigkeit; kommt auf echten Karten nicht vor): leicht negativ
for (const c of Object.keys(DEF)) if (DEF[c][0].Gelb == null) DEF[c][0].Gelb = -0.5;
// Eigenschaften je Punkt (Durchschnittskarte: Tempo 4, Präsenz 4, Assist 2,5, Kopfball 3, Schuss 3,4)
const STAT = { tempo: 0.8, praesenz: 1.2, assist: 0.8, kopf: 0.6, schuss: 0.4 };
// Zusammenspiel: Schusswert zählt mehr, wenn die Karte selbst Schuss-Optionen hat; Tempo mehr mit Steilpass/Sprint
const INTER = { 'schuss×Schuss-Optionen': 0.8, 'tempo×Tempo-Optionen': 0.3 };
// Token, die eine Aktion einbringt (rot = +1 Schusspunkt, grün = erschöpften Spieler auffrischen, blau = zweite Abwehrkarte)
const TOKEN = { R: 1, G: 1.5, B: 1.5 };
module.exports = { ATT, DEF, GREEN, STAT, INTER, TOKEN };
