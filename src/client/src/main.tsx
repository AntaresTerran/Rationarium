import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, Tooltip } from 'recharts';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Bell, Building2, ChevronDown, CircleHelp, Coins, Factory, FileUp, Globe2, Landmark, Leaf, Pause, Play, RotateCcw, Search, Settings2, ShieldAlert, SlidersHorizontal, Volume2, VolumeX, Users, Waves } from 'lucide-react';
import type { Category, DashboardState, GuidMap, Island, ProductionEntry } from '../../shared/types';
import { post, useDashboard } from './hooks/useDashboard';
import { translator, type Language } from './i18n';
import { isFreshStock, minutesUntilEmpty, readManualStocks, stockKey, type ManualStocks } from './stock';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/marcellus/latin-400.css';
import './styles.css';

type Tab = 'overview' | 'production' | 'radar' | 'workforce' | 'settings';
type Aggregate = ProductionEntry & { islandKeys: string[] };
const categoryOrder: Category[] = ['food', 'drink', 'materials', 'military', 'luxury', 'other'];
const nav = [
  { key: 'overview' as Tab, icon: Landmark }, { key: 'production' as Tab, icon: BarChart3 },
  { key: 'radar' as Tab, icon: ShieldAlert }, { key: 'workforce' as Tab, icon: Users },
  { key: 'settings' as Tab, icon: Settings2 },
];

function compact(value: number, digits = 0, language: Language = 'de'): string {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function tone(value: number): 'positive' | 'negative' | 'warning' {
  return value < -0.05 ? 'negative' : value <= 0.05 ? 'warning' : 'positive';
}

function aggregate(islands: Island[]): Aggregate[] {
  const rows = new Map<number, Aggregate>();
  const incompleteStocks = new Set<number>();
  for (const island of islands) for (const item of island.entries) {
    const row = rows.get(item.productGuid) || {
      productGuid: item.productGuid, generation: 0, consumption: 0, delta: 0,
      perfectGeneration: 0, perfectConsumption: 0, amountOfBuildings: 0,
      totalMaintenance: 0, totalIncome: 0, totalProfit: 0, summedProductivity: 0,
      averageProductivity: 0, workforces: {}, buildings: {}, islandKeys: [],
    };
    row.averageProductivity += item.averageProductivity * Math.max(1, item.amountOfBuildings);
    for (const field of ['generation', 'consumption', 'delta', 'perfectGeneration', 'perfectConsumption', 'amountOfBuildings', 'totalMaintenance', 'totalIncome', 'totalProfit', 'summedProductivity'] as const) row[field] += item[field];
    for (const [guid, value] of Object.entries(item.workforces)) row.workforces[guid] = (row.workforces[guid] || 0) + value;
    for (const [guid, value] of Object.entries(item.buildings)) row.buildings[guid] = (row.buildings[guid] || 0) + value;
    if (item.stock === undefined) incompleteStocks.add(item.productGuid);
    else row.stock = (row.stock || 0) + item.stock;
    row.islandKeys.push(island.key);
    rows.set(item.productGuid, row);
  }
  return [...rows.values()].map((row) => {
    if (incompleteStocks.has(row.productGuid)) delete row.stock;
    return { ...row, averageProductivity: row.amountOfBuildings ? row.averageProductivity / row.amountOfBuildings : 0 };
  });
}

function workforceByTier(islands: Island[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const island of islands) {
    const byBuilding = new Map<string, number>();
    for (const entry of island.entries) for (const [guid, amount] of Object.entries(entry.buildings)) {
      byBuilding.set(guid, Math.max(byBuilding.get(guid) || 0, amount));
    }
    for (const [guid, amount] of byBuilding) {
      const candidates = island.entries.filter((entry) => entry.buildings[guid]);
      const best = candidates.find((entry) => Object.keys(entry.buildings).length === 1) || candidates[0];
      if (!best) continue;
      const sourceCount = best.buildings[guid];
      const share = Object.keys(best.buildings).length === 1 ? 1 : sourceCount / Math.max(1, best.amountOfBuildings);
      for (const [tier, workers] of Object.entries(best.workforces)) {
        total[tier] = (total[tier] || 0) + workers * share * amount / Math.max(1, sourceCount);
      }
    }
  }
  return total;
}

function App() {
  const { state, maps, online } = useDashboard();
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('rationarium.language') === 'en' ? 'en' : 'de');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('rationarium.theme') === 'light' ? 'light' : 'dark');
  const [tab, setTab] = useState<Tab>('overview');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [deficitsOnly, setDeficitsOnly] = useState(false);
  const [sort, setSort] = useState<'category' | 'name' | 'delta' | 'production' | 'productivity'>('category');
  const [sound, setSound] = useState(false);
  const [manualStocks, setManualStocks] = useState<ManualStocks>(() => {
    try { return readManualStocks(localStorage.getItem('rationarium.manualStocks')); } catch { return {}; }
  });
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState('');
  const [port, setPort] = useState('53117');
  const lastAlert = useRef('');
  const t = translator(language);
  const map = maps[language];
  const islands = state?.islands || [];
  const selected = scope === 'all' ? islands : islands.filter((island) => island.key === scope);
  const rows = useMemo(() => aggregate(selected), [state, scope]);
  const deficits = rows.filter((row) => row.delta < -0.05).sort((a, b) => a.delta - b.delta);
  const essentialDeficits = deficits.filter((row) => map[row.productGuid]?.essential);
  const totalProfit = rows.reduce((sum, row) => sum + row.totalProfit, 0);
  const workforceTiers = useMemo(() => workforceByTier(selected), [state, scope]);
  const workforce = Object.values(workforceTiers).reduce((a, b) => a + b, 0);
  const nameOf = (guid: number) => map[guid]?.name || `${t('unknown')} · ${guid}`;
  const categoryOf = (guid: number) => map[guid]?.category || 'other';

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('rationarium.theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.lang = language; localStorage.setItem('rationarium.language', language); }, [language]);
  useEffect(() => { try { localStorage.setItem('rationarium.manualStocks', JSON.stringify(manualStocks)); } catch { /* Keep values for this tab. */ } }, [manualStocks]);
  useEffect(() => {
    if (scope !== 'all' && islands.length && !islands.some((island) => island.key === scope)) setScope('all');
  }, [scope, islands]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  useEffect(() => { fetch('/api/config').then((r) => r.json()).then((value) => setPort(String(value.port))).catch(() => {}); }, []);
  useEffect(() => {
    if (!sound || !essentialDeficits.length) return;
    const signature = essentialDeficits.map((item) => item.productGuid).join(',');
    if (signature === lastAlert.current) return;
    lastAlert.current = signature;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.36);
      oscillator.onended = () => { void context.close(); };
    } catch { /* Browser may block audio outside a user gesture. */ }
  }, [sound, essentialDeficits.map((item) => item.productGuid).join(',')]);

  async function action(path: string, payload: unknown = {}) {
    try { await post(path, payload); setNotice(''); } catch (error) { setNotice((error as Error).message); }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setNotice('Replay file is too large'); return; }
    await action('/api/replay/upload', { name: file.name, text: await file.text() });
  }
  function saveManualStock(key: string, value: number | null) {
    setNow(Date.now());
    setManualStocks((current) => {
      const next = { ...current };
      if (value === null) delete next[key];
      else next[key] = { value, recordedAt: Date.now() };
      return next;
    });
  }
  const statusLabel = state?.mode === 'demo' ? t('replay') : state?.connection === 'connected' ? t('connected') : state?.connection === 'connecting' ? t('connecting') : t('disconnected');
  const statusTone = state?.mode === 'demo' ? 'demo' : state?.connection === 'connected' ? 'connected' : 'offline';
  const titleKey = tab === 'overview' ? 'overviewLead' : tab === 'production' ? 'productionLead' : tab === 'radar' ? 'radarLead' : tab === 'workforce' ? 'workforceLead' : 'settingsLead';
  const textKey = tab === 'overview' ? 'overviewText' : tab === 'production' ? 'productionText' : tab === 'radar' ? 'radarText' : tab === 'workforce' ? 'workforceText' : 'settingsText';
  const trendSource = deficits[0] || rows[0];
  const trend = trendSource ? (state?.trends[`${scope === 'all' ? 'empire' : scope}:${trendSource.productGuid}`] || []) : [];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Landmark size={28} strokeWidth={1.5} /></div><div><strong>RATIONARIUM</strong><small>{t('subtitle')}</small></div></div>
      <div className="sidebar-label">NAVIGATIO</div>
      <nav className="navigation" aria-label="Main navigation">
        {nav.map(({ key, icon: Icon }) => <button className={`nav-item ${tab === key ? 'active' : ''}`} key={key} onClick={() => setTab(key)}><Icon size={19} strokeWidth={1.7} /><span>{t(key)}</span>{key === 'radar' && deficits.length > 0 && <b>{deficits.length}</b>}</button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-card"><span className="eyebrow">STATUS IMPERII</span><div className="side-status"><span className={`status-dot ${statusTone}`} />{statusLabel}</div><p>{state?.mode === 'demo' ? `${state.replay.name} · ${state.replay.index}/${state.replay.length}` : state?.error || t('liveDescription')}</p></div>
      <div className="sidebar-footer"><Leaf size={15} /> ANNO 117 COMPANION <span>v1.0</span></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs">IMPERIUM <span>/</span> {t(tab).toUpperCase()}</div><div className="topbar-actions"><div className={`connection-pill ${statusTone}`}><span className={`status-dot ${statusTone}`} />{statusLabel}</div><button className="icon-button" aria-label={t('settings')} onClick={() => setTab('settings')}><Settings2 size={18}/></button></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="overline">{tab === 'overview' ? 'CONSPECTUS PROVINCIARUM' : tab === 'production' ? 'RATIONARIUM BONORUM' : tab === 'radar' ? 'SPECULA ET ALARMAE' : tab === 'workforce' ? 'OPERARII ET FABRICAE' : 'CONFIGURATIONES'}</div><h1>{t(titleKey)}</h1><p>{t(textKey)}</p></div><div className="heading-right">{tab !== 'settings' && <label className="scope-select"><Globe2 size={17}/><select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">{t('allIslands')}</option>{islands.map((island) => <option value={island.key} key={island.key}>{island.areaName} · {island.sessionGuid}</option>)}</select><ChevronDown size={16}/></label>}</div></div>
        {notice && <div className="notice" role="alert"><AlertTriangle size={17}/>{notice}<button onClick={() => setNotice('')}>×</button></div>}
        {state?.error && state.mode === 'live' && <div className="info-banner"><CircleHelp size={18}/>{state.error}</div>}
        {!islands.length && tab !== 'settings' ? <div className="empty-state"><div className="empty-symbol"><Waves size={32}/></div><h2>{t('emptyTitle')}</h2><p>{t('emptyText')}</p><button className="primary-button" onClick={() => action('/api/replay/sample')}>{t('startDemo')}</button></div> : null}

        {!!islands.length && tab === 'overview' && <>
          <div className="metric-grid">
            <Metric icon={Coins} label={t('netProfit')} value={compact(totalProfit, 0, language)} suffix="¤" tone={tone(totalProfit)} detail={t('empire')} />
            <Metric icon={Users} label={t('workforceTotal')} value={compact(workforce, 0, language)} tone="neutral" detail={t('workforce')} />
            <Metric icon={AlertTriangle} label={t('critical')} value={String(deficits.length)} tone={deficits.length ? 'negative' : 'positive'} detail={`${essentialDeficits.length} ${t('essentials').toLowerCase()}`} />
            <Metric icon={Landmark} label={t('islands')} value={String(selected.length)} tone="neutral" detail={`${rows.length} ${t('goods').toLowerCase()}`} />
          </div>
          <div className="two-column"><section className="panel large-panel"><div className="panel-heading"><div><span className="eyebrow">FLUXUS BONORUM</span><h2>{t('balance')}</h2></div><Activity size={20}/></div><div className="balance-list">{[...rows].sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta)).slice(0, 7).map((row) => <div className="balance-row" key={row.productGuid}><div className="balance-name"><span>{nameOf(row.productGuid)}</span><small>{t(categoryOf(row.productGuid))}</small></div><div className="balance-track"><span className={tone(row.delta)} style={{ width: `${Math.min(100, Math.max(8, Math.abs(row.delta) / 25 * 100))}%` }}/></div><strong className={tone(row.delta)}>{row.delta > 0 ? '+' : ''}{compact(row.delta, 1, language)}</strong></div>)}</div></section>
          <section className="panel"><div className="panel-heading"><div><span className="eyebrow">VIGILIA</span><h2>{t('topDeficits')}</h2></div><ShieldAlert size={20}/></div>{deficits.length ? <div className="deficit-list">{deficits.slice(0, 5).map((row, index) => <div className="deficit-row" key={row.productGuid}><span className="deficit-rank">{String(index+1).padStart(2,'0')}</span><div><strong>{nameOf(row.productGuid)}</strong><small>{t(categoryOf(row.productGuid))}</small></div><b>{compact(row.delta, 1, language)}</b></div>)}</div> : <div className="panel-empty">{t('noDeficits')}</div>}<button className="text-link" onClick={() => setTab('radar')}>{t('viewDetails')} <ArrowUpRight size={15}/></button></section></div>
          <div className="two-column lower-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">PROVINCIAE</span><h2>{t('islandStatus')}</h2></div><Landmark size={20}/></div><div className="island-list">{islands.map((island) => { const list = aggregate([island]); const bad = list.filter((row) => row.delta < -0.05).length; const profit = list.reduce((sum,row)=>sum+row.totalProfit,0); return <button key={island.key} className="island-row" onClick={() => { setScope(island.key); setTab('production'); }}><div className="island-icon"><Landmark size={18}/></div><div><strong>{island.areaName}</strong><small>{island.sessionGuid} · {list.length} {t('goods').toLowerCase()}</small></div><span className={bad ? 'negative' : 'positive'}>{bad} {t('deficit').toLowerCase()}</span><b>{compact(profit,0,language)} ¤</b></button> })}</div></section>
          <section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">TENDENTIA</span><h2>{trendSource ? nameOf(trendSource.productGuid) : t('balance')}</h2></div><Activity size={20}/></div><div className="chart-wrap">{trend.length > 1 ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d6b678" stopOpacity={0.3}/><stop offset="100%" stopColor="#d6b678" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#313640" strokeDasharray="3 5"/><XAxis dataKey="at" tickFormatter={(value) => new Date(value).toLocaleTimeString(language, { minute:'2-digit', second:'2-digit' })} tick={{fill:'#929aa6',fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background:'#20252f', border:'1px solid #41454e', color:'#ece6d7' }} labelFormatter={(value) => new Date(Number(value)).toLocaleTimeString(language)}/><Area type="monotone" dataKey="delta" stroke="#d6b678" strokeWidth={2} fill="url(#trendFill)"/></AreaChart></ResponsiveContainer> : <div className="panel-empty">{t('unavailable')}</div>}</div></section></div>
        </>}

        {!!islands.length && tab === 'production' && <section className="panel table-panel"><div className="table-toolbar"><label className="search-field"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')}/></label><label className="filter-select"><SlidersHorizontal size={16}/><select value={category} onChange={(event) => setCategory(event.target.value as Category | 'all')}><option value="all">{t('allCategories')}</option>{categoryOrder.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label><label className="check-filter"><input type="checkbox" checked={deficitsOnly} onChange={(event) => setDeficitsOnly(event.target.checked)}/>{t('onlyDeficits')}</label></div><div className="table-scroll"><table><thead><tr><th><button onClick={() => setSort('name')}>{t('good')}</button></th><th><button onClick={() => setSort('category')}>{t('category')}</button></th><th><button onClick={() => setSort('production')}>{t('generation')}</button></th><th>{t('potential')}</th><th>{t('consumption')}</th><th>{t('demand')}</th><th><button onClick={() => setSort('delta')}>{t('delta')}</button></th><th>{t('buildings')}</th><th><button onClick={() => setSort('productivity')}>{t('productivity')}</button></th></tr></thead><tbody>{rows.filter((row) => (!deficitsOnly || row.delta < -0.05) && (category === 'all' || categoryOf(row.productGuid) === category) && (!query || `${nameOf(row.productGuid)} ${row.productGuid}`.toLowerCase().includes(query.toLowerCase()))).sort((a,b) => sort === 'category' ? categoryOrder.indexOf(categoryOf(a.productGuid))-categoryOrder.indexOf(categoryOf(b.productGuid)) || nameOf(a.productGuid).localeCompare(nameOf(b.productGuid)) : sort === 'name' ? nameOf(a.productGuid).localeCompare(nameOf(b.productGuid)) : sort === 'production' ? b.generation-a.generation : sort === 'productivity' ? a.averageProductivity-b.averageProductivity : a.delta-b.delta).map((row) => <tr key={row.productGuid}><td><div className="good-cell"><div className="good-icon"><Factory size={17}/></div><div><strong>{nameOf(row.productGuid)}</strong><small>GUID {row.productGuid}</small></div></div></td><td><span className="category-tag">{t(categoryOf(row.productGuid))}</span></td><td>{compact(row.generation,1,language)}</td><td className="muted-cell">{compact(row.perfectGeneration,1,language)}</td><td>{compact(row.consumption,1,language)}</td><td className="muted-cell">{compact(row.perfectConsumption,1,language)}</td><td><span className={`delta-pill ${tone(row.delta)}`}>{row.delta > 0 ? '+' : ''}{compact(row.delta,1,language)} {row.delta < 0 ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>}</span></td><td>{compact(row.amountOfBuildings,0,language)}</td><td><span className={row.averageProductivity < 100 ? 'warning' : 'positive'}>{compact(row.averageProductivity,0,language)} %</span></td></tr>)}</tbody></table></div>{!rows.length && <div className="panel-empty">{t('noResults')}</div>}</section>}

        {!!islands.length && tab === 'radar' && <><div className="metric-grid radar-metrics"><Metric icon={Bell} label={t('activeAlerts')} value={String(deficits.length)} tone={deficits.length ? 'negative' : 'positive'} detail={t('deficit')}/><Metric icon={ShieldAlert} label={t('essentials')} value={String(essentialDeficits.length)} tone={essentialDeficits.length ? 'negative' : 'positive'} detail={t('warning')}/><Metric icon={Landmark} label={t('islands')} value={String(selected.length)} tone="neutral" detail={t('empire')}/></div><div className="radar-header"><div><span className="eyebrow">MONITOR SUPPLII</span><h2>{t('topDeficits')}</h2></div><button className={`sound-button ${sound ? 'enabled' : ''}`} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>} {t('sound')}</button></div>{deficits.length ? <div className="alert-grid">{deficits.map((row) => {
          const key = stockKey(state?.sessionInstance || null, scope, row.productGuid);
          const manual = state?.mode === 'live' ? manualStocks[key] : undefined;
          const stock = row.stock ?? (isFreshStock(manual, now) ? manual!.value : undefined);
          const eta = minutesUntilEmpty(stock, row.delta);
          return <article className={`alert-card ${map[row.productGuid]?.essential ? 'essential' : ''}`} key={row.productGuid}><div className="alert-top"><span className="alert-icon"><AlertTriangle size={18}/></span><span className="category-tag">{t(categoryOf(row.productGuid))}</span></div><h3>{nameOf(row.productGuid)}</h3><p>{map[row.productGuid]?.essential ? t('essentials') : t('deficit')}</p><div className="alert-values"><div><small>{t('delta')}</small><strong className="negative">{compact(row.delta,1,language)}</strong></div><div><small>{t('stock')}</small><strong>{stock === undefined ? '—' : compact(stock,0,language)}</strong></div><div><small>{t('timeToEmpty')}</small><strong>{eta === null ? '—' : eta > 0 && eta < 1 ? '< 1 min' : `${compact(eta,0,language)} min`}</strong></div></div>{row.stock === undefined && state?.mode === 'live' && <StockEditor key={key} value={manual?.value} recordedAt={manual?.recordedAt} stale={!!manual && !isFreshStock(manual, now)} label={t('manualStock')} staleLabel={t('staleStock')} onSave={(value) => saveManualStock(key, value)} />}</article>;
        })}</div> : <div className="panel panel-empty spacious">{t('noDeficits')}</div>}<div className="info-banner"><CircleHelp size={18}/>{t('noStock')}</div></>}

        {!!islands.length && tab === 'workforce' && <div className="two-column workforce-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">POPULUS</span><h2>{t('tiers')}</h2></div><Users size={20}/></div>{Object.entries(workforceTiers).sort((a,b)=>b[1]-a[1]).map(([guid,amount]) => <div className="workforce-row" key={guid}><div className="workforce-avatar"><Users size={18}/></div><div><strong>{map[guid]?.name || `GUID ${guid}`}</strong><small>{guid}</small></div><b>{compact(amount,0,language)}</b></div>)}<div className="workforce-total"><span>{t('workforceTotal')}</span><strong>{compact(workforce,0,language)}</strong></div></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">FABRICAE</span><h2>{t('inefficient')}</h2></div><Building2 size={20}/></div>{rows.filter((row) => row.amountOfBuildings > 0 && row.averageProductivity < 100).sort((a,b)=>a.averageProductivity-b.averageProductivity).slice(0, 12).map((row) => <div className="factory-row" key={row.productGuid}><div className="good-icon"><Factory size={17}/></div><div><strong>{nameOf(row.productGuid)}</strong><small>{row.amountOfBuildings} {t('buildings').toLowerCase()} · {t('maintenance')} {compact(row.totalMaintenance,0,language)} ¤</small></div><div className="factory-progress"><span style={{width:`${Math.max(2,row.averageProductivity)}%`}}/></div><b className="warning">{compact(row.averageProductivity,0,language)} %</b></div>)}{!rows.some((row)=>row.amountOfBuildings > 0 && row.averageProductivity < 100) && <div className="panel-empty">{t('noInefficient')}</div>}</section></div>}

        {tab === 'settings' && <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">FONS DATARUM</span><h2>{t('source')}</h2></div><Waves size={20}/></div><div className="mode-grid"><button className={`mode-card ${state?.mode === 'live' ? 'selected' : ''}`} onClick={() => action('/api/mode',{mode:'live'})}><Activity size={23}/><strong>{t('liveMode')}</strong><span>{t('liveDescription')}</span></button><button className={`mode-card ${state?.mode === 'demo' ? 'selected' : ''}`} onClick={() => action('/api/mode',{mode:'demo'})}><Play size={23}/><strong>{t('demoMode')}</strong><span>{t('demoDescription')}</span></button></div><div className="settings-actions"><button className="secondary-button" onClick={() => action('/api/replay/sample')}><RotateCcw size={16}/>{t('sample')}</button><button className="secondary-button" onClick={() => action('/api/replay/real')}><Activity size={16}/>{t('realSample')}</button><label className="secondary-button file-label"><FileUp size={16}/>{t('upload')}<input type="file" accept=".jsonl,.txt,application/json" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label></div>{state?.mode === 'demo' && <div className="replay-controls"><div><strong>{state.replay.name}</strong><small>{state.replay.index} / {state.replay.length} {t('frames').toLowerCase()}</small></div><button className="icon-button" aria-label={state.replay.playing ? t('pause') : t('play')} onClick={() => action('/api/replay/control',{action:state.replay.playing?'pause':'play'})}>{state.replay.playing?<Pause size={18}/>:<Play size={18}/>}</button><button className="icon-button" aria-label={t('step')} onClick={() => action('/api/replay/control',{action:'step'})}><ArrowUpRight size={18}/></button><select value={state.replay.intervalMs} onChange={(event) => action('/api/replay/control',{action:'speed',intervalMs:Number(event.target.value)})}><option value="500">0.5 s</option><option value="1000">1 s</option><option value="1800">1.8 s</option><option value="3000">3 s</option><option value="5000">5 s</option></select></div>}</section><section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">PRAEFERENTIAE</span><h2>{t('theme')}</h2></div><SlidersHorizontal size={20}/></div><div className="field"><label>{t('language')}</label><select value={language} onChange={(event)=>setLanguage(event.target.value as Language)}><option value="de">Deutsch</option><option value="en">English</option></select></div><div className="field"><label>{t('theme')}</label><select value={theme} onChange={(event)=>setTheme(event.target.value as 'dark'|'light')}><option value="dark">{t('dark')}</option><option value="light">{t('light')}</option></select></div><div className="field"><label>{t('port')}</label><div className="input-action"><input type="number" min="1024" max="65535" value={port} onChange={(event)=>setPort(event.target.value)}/><button className="secondary-button" onClick={async()=>{try { const nextPort=Number(port); await post('/api/config',{port:nextPort}); setNotice(t('restart')); if (nextPort !== Number(location.port)) setTimeout(() => { location.port = String(nextPort); }, 1200); } catch(error) { setNotice((error as Error).message); }}}>{t('save')}</button></div></div><div className="network-note"><Globe2 size={18}/><div><strong>{t('network')}</strong><p>{t('networkHelp')}</p></div></div></section></div>}
        <footer className="content-footer"><span>RATIONARIUM · ANNO 117 COMPANION · <a href='/licenses/index.html'>Lizenzen / Licenses</a></span><span>{state?.sessionName && `${t('session')}: ${state.sessionName} · `}{t('protocol')}: {state?.protocolVersion || '—'} · {online ? 'LIVE' : 'OFFLINE'}</span></footer>
      </div>
    </main>
  </div>;
}

function Metric({ icon: Icon, label, value, suffix, tone: valueTone, detail }: { icon: typeof Coins; label: string; value: string; suffix?: string; tone: 'positive'|'negative'|'warning'|'neutral'; detail: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><div className={`metric-icon ${valueTone}`}><Icon size={19}/></div></div><div className={`metric-value ${valueTone}`}>{value}{suffix && <em> {suffix}</em>}</div><div className="metric-detail">{detail}</div></div>;
}

function StockEditor({ value, recordedAt, stale, label, staleLabel, onSave }: { value?: number; recordedAt?: number; stale: boolean; label: string; staleLabel: string; onSave: (value: number | null) => void }) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);
  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { if (value !== undefined) onSave(null); return; }
    const next = Number(trimmed);
    if (!Number.isFinite(next) || next < 0) { setDraft(value === undefined ? '' : String(value)); return; }
    onSave(next);
  }
  return <label className="stock-editor"><span>{label}{recordedAt && <small className={stale ? 'stock-stale' : ''}> · {stale ? `${staleLabel} · ` : ''}{new Date(recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>}</span><input type="number" min="0" step="1" inputMode="numeric" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
