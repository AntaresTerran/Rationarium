# Rationarium 🏛️

Das kaiserliche Rechenbuch für **Anno 117: Pax Romana**. Rationarium zeigt
Produktionsbilanzen, Engpässe, Gewinne und Arbeitskräfte auf einem zweiten
Bildschirm oder Tablet. Die Anwendung liest ausschließlich die vom Spiel
bereitgestellte Windows Named Pipe; Spieldateien und Texturen sind nicht enthalten.

## Start für Spieler

1. `Rationarium.exe` doppelklicken. Das Steuerfenster und der Standardbrowser
   öffnen sich. Das Dashboard ist standardmäßig unter
   [http://localhost:53117](http://localhost:53117) erreichbar.
2. Für Live-Daten in Ubisoft Connect bei Anno 117 das Startargument `/pipe`
   eintragen und das Spiel starten. Die Verbindung wird automatisch erneut
   versucht, falls das Spiel noch nicht läuft.
3. Ohne Spiel in **Einstellungen → Simulation** wechseln. Es gibt einen
   anschaulichen Beispieldatensatz, einen echten Community-Mitschnitt und einen
   JSONL-Upload für eigene Replays.

Die `.exe` benötigt auf dem Zielrechner weder Node.js noch Python noch weitere
Build-Werkzeuge. Das Windows-Steuerfenster nutzt die vorhandene PowerShell und
zeigt Dienst- und Spielstatus, Port, Browseröffnung und Beenden. Der Host bindet
standardmäßig nur an `127.0.0.1`.

### Tablet im lokalen Netzwerk

Im Steuerfenster den **Tablet- / Smartphone-Modus** aktivieren. Dort die passende
LAN-Adresse auswählen und den QR-Code mit dem Gerät scannen. Beide Geräte müssen
im selben Netzwerk sein; gegebenenfalls die Windows-Firewall für den gewählten
Port freigeben. Port und Modus werden sofort umgestellt und für den nächsten Start
gespeichert. Der QR-Code wird lokal erzeugt. Alternativ beim Start
`--port <nummer>` oder `--host 0.0.0.0` verwenden.

### Kommandozeilenoptionen

| Option | Wirkung |
|---|---|
| `--demo` | Integriertes Beispiel sofort abspielen |
| `--replay <datei.jsonl>` | Eigenes JSONL-Replay sofort abspielen |
| `--mock-pipe [datei.jsonl]` | Binäre Named Pipe simulieren und den Live-Connector testen |
| `--port <nummer>` | HTTP-Port überschreiben (Standard: 53117) |
| `--host 0.0.0.0` | Zugriff im lokalen Netz ermöglichen |
| `--no-browser` | Browser nicht automatisch öffnen |
| `--no-widget` | Windows-Steuerfenster nicht öffnen (für Tests/Headless-Betrieb) |

## Funktionen

- **Reichsübersicht:** Inseln und Regionen, Gewinn, Arbeitskraft, Engpässe und
  live aktualisierte Bilanzkurve.
- **Produktionsmatrix:** aktuelle und mögliche Produktion und Nachfrage,
  Defizite, Betriebe, Produktivität, Suche, Kategorie- und Defizitfilter.
- **Engpassradar:** kritische Waren, Grundversorgung und auf Wunsch ein dezentes
  Tonsignal. Die Spiel-Pipe übermittelt derzeit keinen Lagerbestand. Im Live-Modus
  kann der im Spiel angezeigte Bestand je Ware für die ausgewählte Insel oder das
  ganze Reich manuell eingetragen werden. Daraus berechnet Rationarium eine
  geschätzte Zeit bis zum Lagerleerstand (`Bestand / -Bilanz`). Manuelle Werte
  bleiben im lokalen Browser gespeichert und gelten zehn Minuten; Handel,
  Spielpausen und Tempoänderungen sind in der Schätzung nicht enthalten. Eine
  Reichsprognose ist nur rechnerisch, da Bestände nicht automatisch zwischen
  Inseln verfügbar sind. Replays
  mit vollständigen Lagerwerten zeigen diese direkt an.
- **Arbeitskraft:** Stufen und Betriebe unter 100 % Produktivität.
- **Einstellungen:** Live/Simulation, Replay-Steuerung, Deutsch/Englisch,
  helles/dunkles Marmor-Theme und Port.
- **Steuerfenster:** Status, sofortiger Tablet-Modus mit LAN-Adresse und QR-Code,
  Portwechsel, Browser öffnen und Anwendung beenden.

Die Zuordnung von GUIDs zu deutschen und englischen Namen stammt aus dem
Community-Rechner. Unbekannte GUIDs bleiben sichtbar und können in
`data/guid_mappings_*.json` ergänzt werden. Bei mehreren Waren aus demselben
Betrieb wird Arbeitskraft über die eindeutigen Betriebs-GUIDs geschätzt.

## Entwicklung

Voraussetzungen: Windows, Node.js 24+, npm. Nach dem Klonen:

```powershell
npm ci
npm run build
npm run typecheck
npm test
npm run demo
```

`npm run dev` startet Vite auf Port 5173. Daneben den gebauten Backend-Host mit
`npm start -- --no-browser` starten; Vite leitet `/api` und `/ws` dorthin weiter.
`npm run build` erzeugt `dist/client/` und `dist/server.cjs`. Die statischen
Dateien, GUID-Tabellen und Replays werden in das Backend eingebettet.

### Standalone-Datei bauen

```powershell
npm run package:exe
```

Das Skript bündelt das Frontend, erzeugt einen Node-SEA-Blob und injiziert ihn
in eine Kopie der lokalen Node-Laufzeit. Ergebnis: `dist/Rationarium.exe`.
Ein Release sollte die `.exe` zusätzlich auf einem Windows-Rechner ohne
installierte Entwicklungswerkzeuge prüfen. Die mitgelieferte Testumgebung
prüft Parser, Insel-Schlüssel und den echten Replay-Datensatz.

## Datenformat und Grenzen

Die Pipe unter `\\.\pipe\anno117` nutzt Protokollversion 2. Rationarium
begrenzt Frames auf 1 MiB, prüft Feldlängen und trennt Inseln anhand von
`sessionGUID_islandID`. Bei `SessionEnd` wird der Sitzungscache geleert.
JSONL-Replays enthalten pro Zeile ein `AreaProductionStatistics`-Objekt mit
`sessionGuid`, `islandId`, `areaName` und `entries`. Das Format des
[Community Connectors](https://github.com/anno-mods/anno117-game-connector)
wird direkt unterstützt.

Die Pipe ist eine experimentelle Schnittstelle; spätere Spielversionen können
das Format ändern. Quell- und Lizenzhinweise stehen in
[data/THIRD_PARTY.md](data/THIRD_PARTY.md). Weitere Architekturdetails:
[DESIGN.md](DESIGN.md).
