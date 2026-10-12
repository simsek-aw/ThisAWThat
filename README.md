# THIS AW THAT?

Kleines Abstimm-Tool fürs Büro-Vestaboard. Alle 2 Tage eine neue „This or That“-Frage, abgestimmt wird im Browser, die Balken laufen live aufs Vestaboard.

- **`/`** – Abstimmungsseite (eine Stimme pro Gerät, kann gewechselt werden, Ergebnis aktualisiert sich alle 3 s)
- **`/admin`** – Admin-Panel: Fragen hinzufügen, Warteschlange sortieren, sofort starten, KI-Vorschläge, Board-Vorschau, Verlauf

## Vestaboard-Layout (Flagship, 6 × 22)

```
     MITTAGESSEN?          ← Überschrift (optional, sonst THIS AW THAT?)
DOENER                 12  ← Option 1 + Stimmen
🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧        63%  ← Balken in Farb-Kacheln
CURRYWURST              7
🟦🟦🟦🟦🟦🟦              37%
     JETZT VOTEN!          ← VESTABOARD_FOOTER
```

Die Read/Write-API erlaubt nur ca. 1 Nachricht pro 15 s. Die erste Stimme geht sofort raus, alles danach wird gesammelt und ~16 s später mit dem neuesten Stand gesendet.

## Fragen-Wechsel

Ein Vercel-Cron läuft täglich um 06:00 UTC (`vercel.json`) und wechselt, sobald `ROTATE_HOURS` (Standard 48) um sind. Die nächste Frage kommt aus:

1. der Warteschlange im Admin-Panel,
2. sonst von Claude (wenn `ANTHROPIC_API_KEY` gesetzt ist),
3. sonst aus der eingebauten Liste (`lib/fallback.ts`).

## Einrichtung auf Vercel

1. Repo in Vercel importieren (Framework: Next.js wird erkannt).
2. **Storage → Marketplace → Upstash Redis** anlegen und mit dem Projekt verbinden (setzt `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatisch).
3. Environment Variables setzen (siehe `.env.example`):
   - `ADMIN_PASSWORD` – Pflicht
   - `VESTABOARD_RW_KEY` – Vestaboard Web-App → Settings → Developer → Read/Write API aktivieren
   - `VESTABOARD_FOOTER` – z. B. die Kurz-URL zur Seite
   - `CRON_SECRET` – beliebiger langer Zufallswert (Vercel schickt ihn beim Cron mit)
   - `ANTHROPIC_API_KEY` – optional, für KI-Fragen
4. Deployen, `/admin` öffnen, „Nächste Frage jetzt starten“.

## Lokal

```bash
npm install
ADMIN_PASSWORD=test npm run dev
```

Ohne Redis-Variablen läuft ein In-Memory-Speicher (nur zum Testen, geht beim Neustart verloren).
