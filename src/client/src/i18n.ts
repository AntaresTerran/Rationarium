export type Language = 'de' | 'en';

const copy = {
  de: {
    subtitle: 'Das kaiserliche Rechenbuch', overview: 'Reichsübersicht', production: 'Produktionsmatrix', radar: 'Engpassradar', workforce: 'Arbeitskraft', settings: 'Einstellungen',
    empire: 'Gesamtes Reich', island: 'Insel', allIslands: 'Alle Inseln', connected: 'Spiel verbunden', connecting: 'Verbinde mit Spiel', disconnected: 'Spiel nicht verbunden', replay: 'Simulation aktiv',
    updated: 'Aktualisiert', overviewLead: 'Das Reich auf einen Blick', overviewText: 'Produktion, Versorgung und Ertrag aller bekannten Inseln.',
    netProfit: 'Gesamtgewinn', workforceTotal: 'Arbeitskräfte', critical: 'Kritische Waren', islands: 'Inseln', balance: 'Versorgungsbilanz', topDeficits: 'Größte Engpässe', noDeficits: 'Keine Engpässe erkannt',
    islandStatus: 'Inselstatus', goods: 'Waren', deficit: 'Defizit', surplus: 'Überschuss', stable: 'Ausgeglichen', viewDetails: 'Details ansehen',
    productionLead: 'Waren & Bilanz', productionText: 'Aktuelle und mögliche Leistung jeder Produktionskette.', search: 'Ware oder GUID suchen', allCategories: 'Alle Kategorien', onlyDeficits: 'Nur Defizite',
    good: 'Ware', category: 'Kategorie', generation: 'Produktion', potential: 'Potenzial', consumption: 'Verbrauch', demand: 'Bedarf bei 100 %', delta: 'Bilanz', buildings: 'Betriebe', productivity: 'Ø Produktivität', noResults: 'Keine passenden Waren',
    radarLead: 'Frühwarnsystem', radarText: 'Negative Bilanzen und bedrohte Grundversorgung im Blick.', activeAlerts: 'Aktive Warnungen', essentials: 'Grundversorgung', stock: 'Lager', timeToEmpty: 'Bis Lagerleerstand', unavailable: 'Nicht verfügbar', noStock: 'Die Pipe liefert keine Lagerbestände. Eine Prognose erscheint nur bei Replay-Daten mit Lagerwerten.', sound: 'Akustische Warnung',
    workforceLead: 'Arbeitskräfte & Betriebe', workforceText: 'Bedarf nach Bevölkerungsstufe und Betriebe unter Soll.', tiers: 'Arbeitskraft nach Stufe', inefficient: 'Ineffiziente Betriebe', noInefficient: 'Alle erfassten Betriebe erreichen 100 %.', maintenance: 'Unterhalt', profit: 'Gewinn',
    settingsLead: 'Konfiguration', settingsText: 'Verbindung, Simulation und Anzeige anpassen.', source: 'Datenquelle', liveMode: 'Live-Verbindung', demoMode: 'Simulation', liveDescription: 'Anno 117 mit dem Startargument /pipe starten.', demoDescription: 'Mit Replay-Daten ohne laufendes Spiel testen.', sample: 'Beispiel-Replay laden', realSample: 'Echten Mitschnitt laden', upload: 'JSONL-Replay hochladen', play: 'Abspielen', pause: 'Pausieren', step: 'Einzelschritt', speed: 'Intervall', language: 'Sprache', theme: 'Darstellung', dark: 'Dunkler Marmor', light: 'Heller Marmor', port: 'HTTP-Port', save: 'Speichern', restart: 'Port gespeichert. Anwendung neu starten.', network: 'Tablet im lokalen Netz', networkHelp: 'Mit --host 0.0.0.0 starten und im Tablet-Browser die IP-Adresse des PCs mit dem gewählten Port öffnen.',
    emptyTitle: 'Noch keine Statistikdaten', emptyText: 'Starte Anno 117 mit /pipe oder wechsle in die Simulation.', startDemo: 'Simulation starten', unknown: 'Unbekannte Ware', session: 'Sitzung', protocol: 'Protokoll', frames: 'Datensätze', warning: 'Warnung',
    food: 'Grundnahrung', drink: 'Getränke', materials: 'Baumaterial', military: 'Militär', luxury: 'Luxus', other: 'Sonstige',
  },
  en: {
    subtitle: 'The imperial ledger', overview: 'Empire overview', production: 'Production matrix', radar: 'Bottleneck radar', workforce: 'Workforce', settings: 'Settings',
    empire: 'Entire empire', island: 'Island', allIslands: 'All islands', connected: 'Game connected', connecting: 'Connecting to game', disconnected: 'Game disconnected', replay: 'Simulation active',
    updated: 'Updated', overviewLead: 'Your empire at a glance', overviewText: 'Production, supply and profit across every known island.',
    netProfit: 'Total profit', workforceTotal: 'Workforce', critical: 'Critical goods', islands: 'Islands', balance: 'Supply balance', topDeficits: 'Largest shortages', noDeficits: 'No shortages detected',
    islandStatus: 'Island status', goods: 'Goods', deficit: 'Deficit', surplus: 'Surplus', stable: 'Balanced', viewDetails: 'View details',
    productionLead: 'Goods & balance', productionText: 'Current and potential output of every production chain.', search: 'Search good or GUID', allCategories: 'All categories', onlyDeficits: 'Deficits only',
    good: 'Good', category: 'Category', generation: 'Production', potential: 'Potential', consumption: 'Consumption', demand: 'Demand at 100%', delta: 'Balance', buildings: 'Buildings', productivity: 'Avg. productivity', noResults: 'No matching goods',
    radarLead: 'Early warning', radarText: 'Negative balances and threatened essentials in one view.', activeAlerts: 'Active alerts', essentials: 'Essentials', stock: 'Stock', timeToEmpty: 'Until stock empty', unavailable: 'Unavailable', noStock: 'The pipe does not provide stock levels. A forecast appears only when replay data includes stock values.', sound: 'Sound alert',
    workforceLead: 'Workforce & buildings', workforceText: 'Demand by workforce tier and buildings below target.', tiers: 'Workforce by tier', inefficient: 'Inefficient buildings', noInefficient: 'All recorded buildings reach 100%.', maintenance: 'Maintenance', profit: 'Profit',
    settingsLead: 'Configuration', settingsText: 'Adjust connection, simulation and display.', source: 'Data source', liveMode: 'Live connection', demoMode: 'Simulation', liveDescription: 'Start Anno 117 with the /pipe launch argument.', demoDescription: 'Test with replay data without the game running.', sample: 'Load sample replay', realSample: 'Load real capture', upload: 'Upload JSONL replay', play: 'Play', pause: 'Pause', step: 'Step', speed: 'Interval', language: 'Language', theme: 'Appearance', dark: 'Dark marble', light: 'Light marble', port: 'HTTP port', save: 'Save', restart: 'Port saved. Restart the app.', network: 'Tablet on local network', networkHelp: 'Start with --host 0.0.0.0 and open your PC IP address and selected port on the tablet.',
    emptyTitle: 'No statistics yet', emptyText: 'Start Anno 117 with /pipe or switch to simulation.', startDemo: 'Start simulation', unknown: 'Unknown good', session: 'Session', protocol: 'Protocol', frames: 'Records', warning: 'Warning',
    food: 'Basic food', drink: 'Drinks', materials: 'Materials', military: 'Military', luxury: 'Luxury', other: 'Other',
  },
} as const;

export function translator(language: Language) {
  return (key: keyof typeof copy.de): string => copy[language][key];
}
