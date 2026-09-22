import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Award,
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  Compass,
  Flag,
  Gamepad2,
  Home,
  Map,
  Menu,
  Settings,
  Target,
  Volume2,
  VolumeX,
  WalletCards,
  X,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import TownGame from '../game/phaser/TownGame';
import { ACHIEVEMENTS } from '../game/data/achievements';
import { LEARNING_ACTIVITIES, LOCATION_LABELS, MARKET_ITEMS, TRAVEL_DESTINATIONS } from '../game/data/activities';
import { isLocationId, LOCATION_EVENT, WORLD_LOCATIONS, type LocationInteractionDetail } from '../game/data/locations';
import { EVENTS } from '../game/data/events';
import { GOAL_CATALOG } from '../game/data/goals';
import { AGENTS, recommendationFor } from '../gameTheory/agents';
import { bestResponses, humanPreferences, matrix, nashEquilibria, paretoFrontier } from '../gameTheory/engine';
import { STRATEGIES, STRATEGY_IDS } from '../gameTheory/strategies';
import type { Allocation, BackendAction, Goal, LocationId, Profile, StrategyId } from '../game/types';
import { audioManager } from '../audio/audioManager';
import { useGameStore } from '../store/gameStore';
import { totalAllocation } from '../game/engine/financeEngine';
import { useGamePersistence } from '../services/useGamePersistence';

const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
const AVATARS = ['🧑🏽‍💻', '👩🏽‍🎨', '🧑🏻‍🔬', '👩🏾‍💼'];
const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const spring = { type: 'spring', stiffness: 260, damping: 22 } as const;

type Panel = 'journey' | 'goals' | 'achievements' | 'inventory' | 'agents' | 'minigames' | 'settings' | 'map' | 'location' | 'compare';

function Progress({ value, max = 100, tone = 'mint' }: { value: number; max?: number; tone?: 'mint' | 'gold' | 'coral' | 'lavender' }) {
  return <i className={`progress ${tone}`}><em style={{ width: `${Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100))}%` }} /></i>;
}

function Modal({ title, subtitle, kicker, onClose, wide, children }: { title: string; subtitle?: string; kicker?: string; onClose?: () => void; wide?: boolean; children: ReactNode }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.section className={`paper modal ${wide ? 'wide' : ''}`} initial={{ y: 35, scale: 0.96 }} animate={{ y: 0, scale: 1 }} transition={spring}>
      <div className="modal-head">
        <div>{kicker && <p className="eyebrow">{kicker}</p>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {onClose && <button aria-label="Close" className="modal-close" onClick={onClose}><X /></button>}
      </div>
      {children}
    </motion.section>
  </motion.div>;
}

function FeedbackToast() {
  const notice = useGameStore((state) => state.feedback);
  const clear = useGameStore((state) => state.clearFeedback);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clear, 5200);
    return () => window.clearTimeout(timer);
  }, [notice?.id, clear]);
  if (!notice) return null;
  return <motion.button className={`feedback ${notice.tone}`} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} onClick={clear}>
    <b>{notice.title}</b><span>{notice.message}</span><small>Dismiss</small>
  </motion.button>;
}

function Confirm({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title={title} subtitle={body} onClose={onCancel}>
    <div className="confirm-actions"><button onClick={onCancel}>Keep my progress</button><button className="danger" onClick={onConfirm}>Yes, reset it</button></div>
  </Modal>;
}

function SettingsPanel({ onReset }: { onReset: () => void }) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const updateMusic = (musicVolume: number) => { audioManager.setMusicVolume(musicVolume); setSettings({ musicVolume }); };
  const updateSfx = (sfxVolume: number) => { audioManager.setSfxVolume(sfxVolume); setSettings({ sfxVolume }); };
  const toggleMute = () => { audioManager.setMuted(!settings.muted); setSettings({ muted: !settings.muted }); };
  const toggleMusic = () => {
    if (settings.musicPlaying) audioManager.pauseAmbient();
    else audioManager.startAmbient(settings.musicTrack);
    setSettings({ musicPlaying: !settings.musicPlaying });
  };
  const nextTrack = () => {
    const musicTrack = (settings.musicTrack + 1) % audioManager.trackCount;
    if (settings.musicPlaying) audioManager.startAmbient(musicTrack);
    setSettings({ musicTrack });
  };
  return <div className="settings-panel functional-settings">
    <section className="music-widget"><div><small>ORIGINAL AMBIENT PLAYER</small><b>Pastel Town Loop {settings.musicTrack + 1}</b><span>Gentle synthesized original audio, generated in the browser.</span></div><div><button onClick={toggleMusic}>{settings.musicPlaying ? 'Pause' : 'Play'}</button><button onClick={nextTrack}>Next track</button></div></section>
    <label>Music volume <input type="range" min="0" max="1" step="0.05" value={settings.musicVolume} onChange={(event) => updateMusic(+event.target.value)} /><b>{Math.round(settings.musicVolume * 100)}%</b></label>
    <label>Sound effects volume <input type="range" min="0" max="1" step="0.05" value={settings.sfxVolume} onChange={(event) => updateSfx(+event.target.value)} /><b>{Math.round(settings.sfxVolume * 100)}%</b></label>
    <label><input type="checkbox" checked={settings.muted} onChange={toggleMute} /> Mute all audio</label>
    <label><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings({ reducedMotion: event.target.checked })} /> Reduce major animation</label>
    <label>Text size <select value={settings.textSize} onChange={(event) => setSettings({ textSize: event.target.value as 'standard' | 'large' })}><option value="standard">Standard</option><option value="large">Large</option></select></label>
    <button className="danger" onClick={onReset}>Reset active game</button>
  </div>;
}

function TitleScreen() {
  const hasActive = useGameStore((state) => state.hasActiveSession);
  const backendStatus = useGameStore((state) => state.backendStatus);
  const beginNewGame = useGameStore((state) => state.beginNewGame);
  const start = useGameStore((state) => state.start);
  const continueGame = useGameStore((state) => state.continueGame);
  const resetActiveSave = useGameStore((state) => state.resetActiveSave);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const presentationProfile: Profile = { name: 'Asha', age: 24, occupation: 'Product Analyst', appearance: 3, living: 'Living independently', scenario: 'steady' };
  return <main className="title-screen">
    <div className="title-sun" /><div className="title-city"><span>🏠</span><span>🌳</span><span>🏦</span><span>☕</span><span>🚋</span><span>📚</span></div>
    <motion.section initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="title-board">
      <p className="eyebrow">WELCOME TO LIFEWAY</p><h1>LifeStrategy</h1><p className="tagline">Plan. Decide. Experience. Grow.</p>
      <p className="intro">Live one financial year in twelve playable chapters. Your choices change your money, goals, relationships, town, and strategy results.</p>
      <div className="title-actions">
        <button className="primary big" onClick={beginNewGame}>New game <ChevronRight /></button>
        <button disabled={!hasActive || backendStatus === 'loading'} onClick={continueGame}>{backendStatus === 'loading' ? 'Checking save…' : 'Continue'}</button>
        <button onClick={() => start(presentationProfile, ['emergency', 'travel', 'certificate'], 'presentation')}>▶ Presentation mode</button>
      </div>
      <div className="title-mini-actions"><button onClick={() => setSettingsOpen(true)}>Settings</button><button disabled={!hasActive} onClick={() => setConfirm(true)}>Reset save</button></div>
      <small>{backendStatus === 'offline' ? 'Local progress is safe and will retry the database connection.' : '12 chapters · 30–45 minutes · progress saves automatically'}</small>
    </motion.section>
    <AnimatePresence>{settingsOpen && <Modal title="Settings" onClose={() => setSettingsOpen(false)}><SettingsPanel onReset={() => { setSettingsOpen(false); setConfirm(true); }} /></Modal>}{confirm && <Confirm title="Reset active save?" body="This removes only the unfinished current journey. Completed runs stay available for comparison." onCancel={() => setConfirm(false)} onConfirm={() => { resetActiveSave(); setConfirm(false); }} />}</AnimatePresence><FeedbackToast />
  </main>;
}

function Setup() {
  const start = useGameStore((state) => state.start);
  const [profile, setProfile] = useState<Profile>({ name: 'Alex', age: 23, occupation: 'Junior Software Developer', appearance: 0, living: 'Living independently', scenario: 'steady' });
  const [goals, setGoals] = useState<string[]>(['emergency', 'travel', 'certificate']);
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const toggleGoal = (goalId: string) => setGoals((current) => current.includes(goalId) ? current.filter((id) => id !== goalId) : current.length < 3 ? [...current, goalId] : current);
  const scenarioCopy = {
    starter: ['New start', '₹38K salary · ₹12K cash · ₹8K savings'],
    steady: ['Steady footing', '₹45K salary · ₹20K cash · ₹20K savings'],
    career: ['Career momentum', '₹56K salary · ₹30K cash · ₹12K savings'],
  } as const;
  return <main className="setup-screen"><section className="paper setup">
    <p className="eyebrow">YOUR FIRST DAY IN LIFEWAY</p><h1>Who are you becoming?</h1>
    <div className="setup-grid"><div className="avatar-picker">{AVATARS.map((avatar, index) => <button aria-label={`Avatar ${index + 1}`} className={profile.appearance === index ? 'selected' : ''} onClick={() => update('appearance', index)} key={avatar}>{avatar}</button>)}</div>
      <label>Your name<input value={profile.name} onChange={(event) => update('name', event.target.value)} /></label>
      <label>Age<input type="number" min="18" max="80" value={profile.age} onChange={(event) => update('age', +event.target.value)} /></label>
      <label>Occupation<input value={profile.occupation} onChange={(event) => update('occupation', event.target.value)} /></label>
      <label>Living situation<select value={profile.living} onChange={(event) => update('living', event.target.value)}><option>Living independently</option><option>Living with family</option><option>Sharing with roommates</option></select></label>
    </div>
    <h2>Choose a starting scenario</h2><div className="scenario-choices">{Object.entries(scenarioCopy).map(([id, copy]) => <button key={id} className={profile.scenario === id ? 'selected' : ''} onClick={() => update('scenario', id as Profile['scenario'])}><b>{copy[0]}</b><small>{copy[1]}</small></button>)}</div>
    <h2>Choose two or three hopes for this year</h2><div className="goal-choices">{GOAL_CATALOG.map((goal) => <button className={goals.includes(goal.id) ? 'selected' : ''} key={goal.id} onClick={() => toggleGoal(goal.id)}><span>{goal.icon}</span><b>{goal.name}</b><small>{money(goal.target)}</small></button>)}</div>
    <button disabled={!profile.name.trim() || goals.length < 2 || goals.length > 3} className="primary big" onClick={() => start(profile, goals)}>Begin April <ChevronRight /></button>
  </section><FeedbackToast /></main>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <div className="stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function Topbar({ openPanel }: { openPanel: (panel: Panel) => void }) {
  const state = useGameStore();
  const { settings } = state;
  const toggleMute = () => { audioManager.setMuted(!settings.muted); state.setSettings({ muted: !settings.muted }); };
  return <header className="topbar"><button className="menu-button" onClick={() => openPanel('map')}><Menu /></button>
    <div className="month-sign"><small>MONTH {state.month} / 12</small><strong>{MONTHS[state.month - 1]}</strong></div>
    <Stat label="Cash" value={money(state.state.cash)} icon="🪙" /><Stat label="Salary" value={money(state.state.monthlyIncome)} icon="💼" />
    <button className="xp-chip" onClick={() => openPanel('minigames')}><b>Lv. {state.level}</b><Progress value={state.xp % 100} /><small>{state.xp % 100}/100 XP</small></button>
    <div className="profile-chip"><span>{AVATARS[state.profile.appearance]}</span><div><b>{state.profile.name}</b><small>{state.profile.occupation}</small></div></div>
    <span className={`persistence-status ${state.backendStatus}`} title={state.backendError || 'Durable FastAPI + SQLite save status'}>{state.backendStatus === 'loading' ? 'Restoring save…' : state.backendStatus === 'saving' ? 'Saving…' : state.backendStatus === 'ready' ? 'Saved' : 'Local retry'}</span>
    <button aria-label="Mute audio" className="icon-button" onClick={toggleMute}>{settings.muted ? <VolumeX /> : <Volume2 />}</button>
  </header>;
}

function Sidebar({ openPanel, openLocation }: { openPanel: (panel: Panel) => void; openLocation: (location: LocationId) => void }) {
  return <aside className="sidebar"><div className="brand"><span>🌱</span><b>LifeStrategy</b><small>A richer you is a kinder you.</small></div>
    <nav>{[
      ['Home', 'home'], ['Journey', 'journey'], ['Budget', 'budget'], ['Life Events', 'events'], ['Financial Agents', 'agents'], ['Goals', 'goals'], ['Strategy Lab', 'strategy'], ['Achievements', 'achievements'], ['Inventory', 'inventory'], ['Mini-games', 'minigames'], ['Settings', 'settings'],
    ].map(([label, target]) => <button key={label} onClick={() => {
      if (target === 'home') openLocation('home');
      else if (target === 'budget') useGameStore.getState().setPhase('allocation');
      else if (target === 'events') useGameStore.getState().setPhase('event');
      else if (target === 'strategy') useGameStore.getState().setPhase('strategy');
      else openPanel(target as Panel);
    }}>{label === 'Home' ? <Home /> : label === 'Journey' ? <Compass /> : label === 'Budget' ? <WalletCards /> : label === 'Life Events' ? <Flag /> : label === 'Goals' ? <Target /> : label === 'Strategy Lab' ? <ChartNoAxesCombined /> : label === 'Achievements' ? <Award /> : label === 'Mini-games' ? <Gamepad2 /> : label === 'Settings' ? <Settings /> : <BookOpen />}{label}</button>)}</nav>
    <div className="sidebar-note">SAME MONEY.<br />DIFFERENT CHOICES.<br /><b>A BRIGHTER YOU.</b></div>
  </aside>;
}

function GoalStrip() {
  const goals = useGameStore((state) => state.goals);
  return <div className="goal-strip"><div className="strip-title"><Target /> Your goals</div>{goals.map((goal) => <div className="mini-goal" key={goal.id}><span>{goal.icon}</span><div><b>{goal.name}</b><Progress value={goal.progress} max={goal.target} tone={goal.complete ? 'gold' : 'mint'} /><small>{goal.complete ? 'Completed' : `${money(goal.progress)} / ${money(goal.target)}`}</small></div></div>)}</div>;
}

function WorldOverlay({ openLocation }: { openLocation: (location: LocationId) => void }) {
  const game = useGameStore();
  const ready = game.salaryProcessedForMonth && game.allocationConfirmedForMonth && game.eventResolvedForMonth && (game.month < 7 || game.strategyResolvedForMonth);
  const headline = !game.salaryProcessedForMonth ? 'Start at the Workplace' : !game.allocationConfirmedForMonth ? 'Your salary is ready to plan' : !game.eventResolvedForMonth ? 'A life event is waiting' : game.month >= 7 && !game.strategyResolvedForMonth ? 'The Strategy Lab is ready' : 'Your month is complete';
  const callToAction = !game.salaryProcessedForMonth ? 'Receive salary' : !game.allocationConfirmedForMonth ? 'Plan this month' : !game.eventResolvedForMonth ? 'Resolve event' : game.month >= 7 && !game.strategyResolvedForMonth ? 'Visit Strategy Lab' : 'Finish month';
  const act = () => {
    if (!game.salaryProcessedForMonth) openLocation('workplace');
    else if (!game.allocationConfirmedForMonth) game.setPhase('allocation');
    else if (!game.eventResolvedForMonth) game.setPhase('event');
    else if (game.month >= 7 && !game.strategyResolvedForMonth) game.setPhase('strategy');
    else if (ready) game.finishMonth();
  };
  return <><div className="world-caption"><p>MONTHLY CHAPTER</p><h2>{MONTHS[game.month - 1]} is yours to shape</h2><span>{headline}. Explore a location, then make the next meaningful choice.</span><button className="primary" onClick={act}>{callToAction} <ChevronRight /></button>{game.mode === 'presentation' && <button className="demo-button" onClick={game.presentationBeat}>Demo controls: next beat</button>}</div>
    <div className="progress-ribbon"><span>Year journey</span><Progress value={game.month - (ready ? 0 : 1)} max={12} /><b>{Math.round(((game.month - (ready ? 0 : 1)) / 12) * 100)}%</b></div><GoalStrip /></>;
}

function AllocationPanel() {
  const game = useGameStore();
  const items: [keyof Allocation, string, string][] = [['needs', 'Needs', '🏠'], ['savings', 'Savings', '🐷'], ['investments', 'Investments', '🌱'], ['emergency', 'Emergency Fund', '🛡️'], ['lifestyle', 'Lifestyle cash', '☕'], ['skills', 'Skill Development', '📚']];
  const total = totalAllocation(game.allocation);
  const left = game.state.monthlyIncome - total;
  return <Modal title="Allocate your income" kicker="MONTHLY PLAN" subtitle={game.salaryProcessedForMonth ? 'Every rupee must have a job. Lifestyle becomes cash to use in town; skills stay earmarked for learning.' : 'Receive salary at the Workplace first.'} onClose={() => game.setPhase('world')}>
    <div className="salary-pile"><span>🪙</span><div><small>Salary to place</small><strong>{money(game.state.monthlyIncome)}</strong></div><b className={left === 0 ? 'done' : ''}>{left === 0 ? 'Everything has a home' : `${money(Math.abs(left))} ${left > 0 ? 'left' : 'over'}`}</b></div>
    <div className="allocation-list">{items.map(([key, label, icon]) => <div className="allocation-row" key={key}><span className="jar">{icon}</span><div><label htmlFor={key}><b>{label}</b><em>{Math.round((game.allocation[key] / Math.max(game.state.monthlyIncome, 1)) * 100)}%</em></label><input id={key} type="range" min="0" max={game.state.monthlyIncome} step="500" value={game.allocation[key]} disabled={game.allocationConfirmedForMonth} onChange={(event) => game.setAllocation(key, +event.target.value)} /></div><strong>{money(game.allocation[key])}</strong></div>)}</div>
    <div className="allocation-footer"><button onClick={game.autoBalance} disabled={game.allocationConfirmedForMonth}>Suggested Balance</button><b>{money(total)} / {money(game.state.monthlyIncome)} allocated</b><button disabled={!game.salaryProcessedForMonth || left !== 0 || game.allocationConfirmedForMonth} className="primary" onClick={() => { audioManager.coin(); game.confirmAllocation(); }}>Confirm allocation <ChevronRight /></button></div>
  </Modal>;
}

function EventPanel() {
  const game = useGameStore();
  const event = EVENTS.find((item) => item.id === game.activeEventId);
  if (!event) return <Modal title="No active life event" subtitle="Confirm this month’s allocation to draw the deterministic event for the chapter." onClose={() => game.setPhase('world')}><button className="primary" onClick={() => game.setPhase('allocation')}>Open budget</button></Modal>;
  return <Modal title={event.title} kicker={`${event.icon} ${event.type.toUpperCase()}`} subtitle={event.story}>
    <div className={`event-art ${event.type}`}><span>{event.icon}</span><div className="event-scene">{event.type === 'problem' ? 'The town pauses. Your plan meets real life.' : event.type === 'positive' ? 'A bright little surprise arrives!' : 'A new door opens across town.'}</div></div>
    <div className="choices">{event.choices.map((choice, index) => <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} disabled={game.eventResolvedForMonth} onClick={() => game.chooseEvent(index)} key={choice.label}><span>{index + 1}</span><div><b>{choice.label}</b><small>{choice.hint}</small></div><ChevronRight /></motion.button>)}</div>
  </Modal>;
}

function StrategyLab() {
  const game = useGameStore();
  const rawAgent = AGENTS.find((agent) => agent.id === game.currentAgentId) || AGENTS.filter((agent) => agent.month <= game.month).at(-1) || AGENTS[0];
  const outcomes = useMemo(() => matrix(game.state, humanPreferences(game.allocationHistory, game.goals), rawAgent), [game.state, game.allocationHistory, game.goals, rawAgent]);
  const best = useMemo(() => bestResponses(outcomes), [outcomes]);
  const nash = useMemo(() => nashEquilibria(outcomes), [outcomes]);
  const pareto = useMemo(() => paretoFrontier(outcomes), [outcomes]);
  const [human, setHuman] = useState<StrategyId>('BALANCED');
  const [agentChoice, setAgentChoice] = useState<StrategyId>('SECURITY');
  const [tab, setTab] = useState<'board' | 'pareto'>('board');
  const [proof, setProof] = useState(false);
  const selected = outcomes.find((outcome) => outcome.human === human && outcome.agent === agentChoice)!;
  const selectedNash = nash.some((outcome) => outcome.human === human && outcome.agent === agentChoice);
  const selectedPareto = pareto.some((outcome) => outcome.human === human && outcome.agent === agentChoice);
  const humanAlternatives = outcomes.filter((outcome) => outcome.agent === agentChoice).sort((a, b) => b.humanPayoff - a.humanPayoff);
  const agentAlternatives = outcomes.filter((outcome) => outcome.human === human).sort((a, b) => b.agentPayoff - a.agentPayoff);
  if (game.month < 7) return <Modal title="Strategy Lab unlocks in Month 7" subtitle="Meet the financial agents through life first. Months 7–12 turn their different priorities into real 4×4 games." onClose={() => game.setPhase('world')}><button className="primary" onClick={() => game.setPhase('world')}>Back to town</button></Modal>;
  return <Modal wide title="The Strategy Lab" kicker={`${rawAgent.portrait} A CONVERSATION WITH ${rawAgent.name.toUpperCase()}`} subtitle={`“${rawAgent.quote}”`} onClose={() => game.setPhase('world')}>
    <div className="lab-top"><div><small>Your move</small><div className="strategy-cards">{STRATEGY_IDS.map((id) => <button className={human === id ? 'selected' : ''} onClick={() => setHuman(id)} key={id}><span>{STRATEGIES[id].icon}</span>{STRATEGIES[id].label}</button>)}</div></div><div className="negotiated"><span>YOU</span><i>50 / 50</i><span>{rawAgent.short.toUpperCase()}</span><strong>Negotiated plan</strong><small>{Math.round(selected.allocation.security * 100)}% security · {Math.round(selected.allocation.savings * 100)}% savings · {Math.round(selected.allocation.growth * 100)}% growth · {Math.round(selected.allocation.lifestyle * 100)}% lifestyle</small></div></div>
    <div className="lab-tabs"><button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}>Payoff board</button><button className={tab === 'pareto' ? 'active' : ''} onClick={() => setTab('pareto')}>Pareto map</button></div>
    {tab === 'board' ? <div className="matrix-wrap"><div className="matrix-board"><div className="matrix-corner">You ↓ · {rawAgent.short} →</div>{STRATEGY_IDS.map((agent) => <b key={agent}>{STRATEGIES[agent].icon}<small>{STRATEGIES[agent].label}</small></b>)}{STRATEGY_IDS.map((humanStrategy) => <><b key={`row-${humanStrategy}`}>{STRATEGIES[humanStrategy].icon}<small>{STRATEGIES[humanStrategy].label}</small></b>{STRATEGY_IDS.map((agentStrategy) => { const outcome = outcomes.find((item) => item.human === humanStrategy && item.agent === agentStrategy)!; const key = `${humanStrategy}|${agentStrategy}`; const isNash = nash.some((item) => item.human === humanStrategy && item.agent === agentStrategy); return <button key={key} className={`${best.human.has(key) ? 'human-best ' : ''}${best.agent.has(key) ? 'agent-best ' : ''}${isNash ? 'nash ' : ''}${human === humanStrategy && agentChoice === agentStrategy ? 'selected-cell' : ''}`} onClick={() => { setHuman(humanStrategy); setAgentChoice(agentStrategy); setProof(false); }}><span>{outcome.humanPayoff}</span><span>{outcome.agentPayoff}</span>{isNash && <em>◆ Nash</em>}</button>; })}</> )}</div>
      <div className="explain-card"><p>SELECTED OUTCOME</p><h3>{STRATEGIES[human].label} × {STRATEGIES[agentChoice].label}</h3><div><b>You {selected.humanPayoff}</b><b>{rawAgent.short} {selected.agentPayoff}</b></div><p>These utilities combine each side’s current preference weights with your live emergency cover, savings, investments, debt, and the negotiated allocation shown above.</p><p>{selectedNash ? 'Neither player can improve by switching alone. This is a pure-strategy Nash equilibrium.' : 'At least one player could improve by switching alone, so this is not Nash.'}</p><p>{selectedPareto ? 'This point is Pareto-efficient.' : 'A different result improves someone without hurting the other player.'}</p><small>Mint edge = your best response · coral dash = agent best response · diamond = both</small>{selectedNash && <button className="text-button" onClick={() => setProof((visible) => !visible)}>Why is this Nash?</button>}</div>
    </div> : <div className="pareto-view"><ResponsiveContainer width="100%" height={280}><ScatterChart margin={{ top: 15, right: 20, bottom: 15, left: 5 }}><CartesianGrid strokeDasharray="4 4" stroke="#9cb9ad" /><XAxis type="number" dataKey="humanPayoff" name="You" tick={{ fill: '#365b58' }} /><YAxis type="number" dataKey="agentPayoff" name={rawAgent.short} tick={{ fill: '#365b58' }} /><Tooltip formatter={(value) => Number(value).toFixed(1)} /><Scatter data={outcomes} fill="#e78ca0" /><Scatter data={pareto} fill="#2f927c" /></ScatterChart></ResponsiveContainer><p><b>{pareto.length} Pareto-efficient outcomes.</b> Click a listed point to inspect its real allocation and utilities.</p><div className="pareto-points">{pareto.map((outcome) => <button key={`${outcome.human}|${outcome.agent}`} onClick={() => { setHuman(outcome.human); setAgentChoice(outcome.agent); setTab('board'); }}><b>{STRATEGIES[outcome.human].label} × {STRATEGIES[outcome.agent].label}</b><small>You {outcome.humanPayoff} · {rawAgent.short} {outcome.agentPayoff}</small></button>)}</div></div>}
    {proof && <div className="nash-proof"><b>Human alternatives while {rawAgent.short} keeps {STRATEGIES[agentChoice].label}</b>{humanAlternatives.map((outcome) => <span key={outcome.human}>{STRATEGIES[outcome.human].label}: {outcome.humanPayoff}{outcome.human === human ? ' ← current' : ''}</span>)}<b>{rawAgent.short}'s alternatives while you keep {STRATEGIES[human].label}</b>{agentAlternatives.map((outcome) => <span key={outcome.agent}>{STRATEGIES[outcome.agent].label}: {outcome.agentPayoff}{outcome.agent === agentChoice ? ' ← current' : ''}</span>)}</div>}
    <div className="lab-footer"><div>{nash.length ? `${nash.length} pure Nash equilibrium${nash.length > 1 ? 's' : ''} found` : 'No pure Nash equilibrium in this month’s game'}</div><button className="primary" disabled={game.strategyResolvedForMonth} onClick={() => game.recordStrategy(human, agentChoice)}>Choose this plan <ChevronRight /></button></div>
  </Modal>;
}

function Reflection() {
  const game = useGameStore();
  const monthEntries = game.journal.filter((entry) => entry.month === game.month);
  return <Modal title={`${MONTHS[game.month - 1]} complete`} kicker="A PAGE FOR YOUR JOURNAL" subtitle="No judgement—just what changed, and what you can try next.">
    <div className="reflection-grid"><Stat label="Saved" value={money(game.allocation.savings)} icon="🐷" /><Stat label="Invested" value={money(game.allocation.investments)} icon="🌱" /><Stat label="Emergency" value={money(game.allocation.emergency)} icon="🛡️" /><Stat label="Cash to enjoy" value={money(game.allocation.lifestyle)} icon="☕" /></div>
    <div className="journal-note"><span>📓</span><div><small>WHAT HAPPENED?</small><b>{monthEntries.filter((entry) => entry.kind === 'event').at(-1)?.title || 'Your monthly choices took root.'}</b><p>{monthEntries.filter((entry) => entry.kind === 'event').at(-1)?.message || 'Visit the journal to see every recorded action.'}</p></div></div>
    <ScoreRow /><button className="primary next-month" onClick={game.finishMonth}>{game.month === 12 ? 'See my financial year' : `Finish ${MONTHS[game.month - 1]}`} <ChevronRight /></button>
  </Modal>;
}

function ScoreRow() {
  const scores = useGameStore((state) => state.scores);
  return <div className="scores">{Object.entries(scores).map(([key, value]) => <div key={key}><label>{key}</label><Progress value={value} tone={key === 'goals' ? 'gold' : 'mint'} /><b>{value}</b></div>)}</div>;
}

function HomeLocation({ openPanel }: { openPanel: (panel: Panel) => void }) {
  const game = useGameStore();
  const tasks: [string, boolean][] = [['Salary', game.salaryProcessedForMonth], ['Allocation', game.allocationConfirmedForMonth], ['Event', game.eventResolvedForMonth], ...(game.month >= 7 ? [['Strategy', game.strategyResolvedForMonth] as [string, boolean]] : [])];
  return <div className="location-content"><div className="location-hero"><span>🏡</span><div><small>YOUR PLANNING ROOM</small><b>{game.profile.name}'s home</b><p>Your room reacts to earned items: {game.inventory.length ? game.inventory.map((item) => item.icon).join(' ') : 'complete goals, travel, or learning to decorate it.'}</p></div></div><div className="checklist">{tasks.map(([label, done]) => <span key={label} className={done ? 'done' : ''}>{done ? '✓' : '○'} {label}</span>)}</div><div className="location-actions"><button className="primary" onClick={() => game.setPhase('allocation')}>Plan monthly budget</button><button onClick={() => openPanel('goals')}>Review goals</button><button onClick={() => openPanel('journey')}>Open journal</button>{tasks.every(([, done]) => done) && <button className="primary" onClick={game.finishMonth}>Finish month</button>}</div></div>;
}

function WorkplaceLocation() {
  const game = useGameStore();
  const salary = game.salaryHistory.at(-1);
  const certComplete = game.learning.some((item) => item.id === 'certificate' && item.status === 'completed');
  return <div className="location-content"><div className="location-hero"><span>💼</span><div><small>WORKPLACE</small><b>Your career changes your income</b><p>Salary is processed once per month. Opportunities persist and salary rises stay in the simulation.</p></div></div><div className="salary-sheet"><div><small>CURRENT BASE SALARY</small><b>{money(game.state.monthlyIncome)}</b></div><div><small>THIS MONTH</small><b>{salary ? `${money(salary.paid)} processed` : 'Not processed'}</b></div><button className="primary" disabled={game.salaryProcessedForMonth} onClick={() => { audioManager.coin(); game.processSalary(); }}>{game.salaryProcessedForMonth ? 'Salary processed' : 'Check salary'}</button></div><h3>Career opportunities</h3><div className="choice-grid"><button onClick={() => game.acceptCareerOpportunity('overtime')}><b>⏱️ Paid overtime</b><small>+₹2,500 cash · Lifestyle −2</small></button><button onClick={() => game.acceptCareerOpportunity('freelance')}><b>🧑🏽‍💻 Freelance project</b><small>Available Month 3 · +₹5,500 cash · Growth +3</small></button><button onClick={() => game.acceptCareerOpportunity('network')}><b>🤝 Networking event</b><small>Available Month 2 · Growth +4</small></button><button disabled={game.month < 6 || !(game.scores.growth >= 50 || certComplete)} onClick={() => game.acceptCareerOpportunity('promotion')}><b>🏅 Promotion conversation</b><small>Month 6 + skill evidence · permanent +₹5,000 salary</small></button></div><div className="tiny-history">Salary history: {game.salaryHistory.length ? game.salaryHistory.map((record) => `M${record.month} ${money(record.paid)}`).join(' · ') : 'No salary processed yet.'}</div></div>;
}

function BankLocation() {
  const game = useGameStore();
  const [from, setFrom] = useState<'cash' | 'savings' | 'emergencyFund'>('cash');
  const [to, setTo] = useState<'cash' | 'savings' | 'emergencyFund'>('savings');
  const [amount, setAmount] = useState(2000);
  const coverage = game.state.emergencyFund / Math.max(game.state.essentialExpenses, 1);
  return <div className="location-content"><div className="account-grid"><Stat label="Cash" value={money(game.state.cash)} icon="🪙" /><Stat label="Savings" value={money(game.state.savings)} icon="🐷" /><Stat label="Emergency fund" value={money(game.state.emergencyFund)} icon="🛡️" /></div><div className="transfer-box"><h3>Move money</h3><p>Emergency cover: <b>{coverage.toFixed(1)} months</b> of essential expenses.</p><div><select value={from} onChange={(event) => setFrom(event.target.value as typeof from)}><option value="cash">Cash</option><option value="savings">Savings</option><option value="emergencyFund">Emergency fund</option></select><span>→</span><select value={to} onChange={(event) => setTo(event.target.value as typeof to)}><option value="cash">Cash</option><option value="savings">Savings</option><option value="emergencyFund">Emergency fund</option></select><input type="number" min="500" step="500" value={amount} onChange={(event) => setAmount(+event.target.value)} /><button className="primary" onClick={() => game.transferMoney(from, to, amount)}>Transfer</button></div></div><div className="tiny-history">Recent transfers: {game.transactions.filter((item) => item.type === 'transfer').slice(-4).map((item) => item.description).join(' · ') || 'None yet.'}</div></div>;
}

function InvestmentLocation() {
  const game = useGameStore();
  const [amount, setAmount] = useState(2000);
  const contributions = game.transactions.filter((item) => item.type === 'investment').reduce((total, item) => total + item.amount, 0);
  return <div className="location-content"><div className="location-hero"><span>🌱</span><div><small>SIMULATED INVESTMENT CORNER</small><b>{money(game.state.investments)} portfolio</b><p>Returns use a seeded monthly simulation—never live markets—and are recorded at month-end.</p></div></div><div className="account-grid"><Stat label="Cumulative contributed" value={money(contributions)} icon="📈" /><Stat label="Spendable cash" value={money(game.state.cash)} icon="🪙" /></div><div className="transfer-box"><input type="number" min="500" step="500" value={amount} onChange={(event) => setAmount(+event.target.value)} /><button className="primary" onClick={() => game.contributeInvestment(amount)}>Contribute</button><button onClick={() => game.withdrawFromInvestment(amount)}>Withdraw to cash</button></div><div className="tiny-history">Investment history: {game.transactions.filter((item) => item.type === 'investment' || item.type === 'withdrawal' || item.type === 'return').slice(-5).map((item) => item.description).join(' · ') || 'Your first contribution starts the history.'}</div></div>;
}

function LearningLocation() {
  const game = useGameStore();
  return <div className="location-content"><div className="account-grid"><Stat label="Skill fund" value={money(game.state.skillFund)} icon="📚" /><Stat label="Growth" value={`${game.scores.growth}/100`} icon="🌟" /></div><p>Activities take real funds now and schedule one delayed completion effect. Completion can change salary, goals, inventory, and growth.</p><div className="catalog-grid">{LEARNING_ACTIVITIES.map((activity) => { const enrollment = game.learning.find((item) => item.id === activity.id); return <article key={activity.id}><span>{activity.icon}</span><b>{activity.name}</b><p>{activity.description}</p><small>{money(activity.cost)} · {activity.duration} month{activity.duration > 1 ? 's' : ''} · Growth +{activity.growth}{activity.salaryBoost ? ` · future salary +${money(activity.salaryBoost)}` : ''}</small><button disabled={enrollment?.status === 'active' || enrollment?.status === 'completed'} onClick={() => game.enrollLearning(activity.id)}>{enrollment?.status === 'active' ? `Completes M${enrollment.completionMonth}` : enrollment?.status === 'completed' ? 'Completed' : 'Start activity'}</button></article>; })}</div></div>;
}

function MarketLocation() {
  const game = useGameStore();
  return <div className="location-content"><div className="location-hero"><span>🛍️</span><div><small>SHOPPING STREET</small><b>Spend intentionally, not invisibly</b><p>Every purchase uses real lifestyle cash, changes Lifestyle, and some objects follow you home.</p></div></div><div className="catalog-grid">{MARKET_ITEMS.map((item) => <article key={item.id}><span>{item.icon}</span><b>{item.name}</b><p>{item.note}</p><small>{money(item.cost)} · Lifestyle +{item.lifestyle}{item.collectible ? ' · collectible' : ''}</small><button onClick={() => game.buyMarketItem(item.id)}>Buy with cash</button></article>)}</div></div>;
}

function TravelLocation() {
  const game = useGameStore();
  const [amount, setAmount] = useState(2000);
  const travelGoal = game.goals.find((goal) => goal.id === 'travel');
  const selected = TRAVEL_DESTINATIONS.find((item) => item.id === game.selectedTravelId)!;
  return <div className="location-content"><div className="location-hero"><span>🚉</span><div><small>TRAVEL STATION</small><b>Turn a plan into a memory</b><p>Fund travel with cash, choose a destination, and book only when its genuine cost is covered.</p></div></div>{travelGoal ? <><div className="travel-fund"><b>Travel fund {money(game.goalFunds.travel || 0)}</b><Progress value={game.goalFunds.travel || 0} max={selected.cost} tone="gold" /><small>{money(selected.cost)} needed for {selected.name}</small><input type="number" min="500" step="500" value={amount} onChange={(event) => setAmount(+event.target.value)} /><button onClick={() => game.fundGoal('travel', amount)}>Set aside cash</button></div><div className="destination-grid">{TRAVEL_DESTINATIONS.map((trip) => <button className={game.selectedTravelId === trip.id ? 'selected' : ''} key={trip.id} onClick={() => game.setTravelDestination(trip.id)}><span>{trip.icon}</span><b>{trip.name}</b><small>{money(trip.cost)} · {trip.description}</small></button>)}</div><button className="primary" disabled={travelGoal.complete || (game.goalFunds.travel || 0) < selected.cost} onClick={game.bookTravel}>{travelGoal.complete ? 'Travel completed' : `Book ${selected.name}`}</button></> : <div className="empty-note">Travel is not one of this run’s chosen goals. Start another run with it selected to fund and book a trip.</div>}</div>;
}

function CafeLocation() {
  const game = useGameStore();
  return <div className="location-content"><div className="location-hero"><span>☕</span><div><small>CAFÉ CONVERSATIONS</small><b>Meet people with different priorities</b><p>Every conversation updates an agent’s recommendation, relationship state, and the Strategy Lab’s current counterparty.</p></div></div><div className="agent-grid">{AGENTS.map((agent) => { const progress = game.agents.find((item) => item.id === agent.id)!; const unlocked = game.month >= agent.month; return <article className={!unlocked ? 'locked' : game.currentAgentId === agent.id ? 'selected' : ''} key={agent.id}><span>{agent.portrait}</span><b>{agent.name}</b><small>{unlocked ? `${agent.short}'s priority unlocks in Month ${agent.month}` : `Unlocks Month ${agent.month}`}</small>{unlocked && <><Progress value={progress.satisfaction} tone="coral" /><p>{progress.latestRecommendation || recommendationFor(agent, game.state)}</p><button onClick={() => game.talkToAgent(agent.id)}>Talk to {agent.short}</button><em>{progress.interactions} conversation{progress.interactions === 1 ? '' : 's'} · satisfaction {progress.satisfaction}</em></>}</article>; })}</div></div>;
}

function LocationPanel({ openPanel, close }: { openPanel: (panel: Panel) => void; close: () => void }) {
  const game = useGameStore();
  const labels: Record<LocationId, string> = LOCATION_LABELS;
  const content: Record<LocationId, ReactNode> = {
    home: <HomeLocation openPanel={openPanel} />, workplace: <WorkplaceLocation />, bank: <BankLocation />, investments: <InvestmentLocation />, learning: <LearningLocation />, market: <MarketLocation />, cafe: <CafeLocation />, travel: <TravelLocation />, strategy: <div className="location-content"><p>The Strategy Lab converts this month’s financial state and the selected agent’s priorities into a genuine 4×4 payoff game.</p><button className="primary" onClick={() => game.setPhase('strategy')}>Enter Strategy Lab</button></div>,
  };
  return <Modal title={labels[game.currentLocation]} kicker="TOWN LOCATION" subtitle="This is an active part of your financial year—not a decorative scene." onClose={close}>{content[game.currentLocation]}</Modal>;
}

function JourneyPanel({ close }: { close: () => void }) {
  const game = useGameStore();
  const [view, setView] = useState<'balances' | 'scores'>('balances');
  const [month, setMonth] = useState<number | 'all'>('all');
  const hasBackendHistory = game.backendHistory.length > 0;
  const localEntries = game.journal.map((entry) => ({ id: entry.id, month: entry.month, type: entry.kind.toUpperCase(), title: entry.title, description: entry.message, amount: entry.amount, createdAt: '' }));
  const sourceEntries = (hasBackendHistory ? game.backendHistory : localEntries) as Array<Pick<BackendAction, 'id' | 'month' | 'type' | 'title' | 'description' | 'amount' | 'createdAt'>>;
  const entries = sourceEntries.filter((entry) => month === 'all' || entry.month === month);
  const groupedEntries = entries.reduce<Record<number, typeof entries>>((groups, entry) => {
    groups[entry.month] = [...(groups[entry.month] || []), entry];
    return groups;
  }, {});
  const historyNote = game.backendStatus === 'loading' ? 'Restoring the saved Journey from the database…' : hasBackendHistory ? 'Database-backed gameplay history' : game.backendStatus === 'offline' ? 'Local actions are queued safely and will sync when the backend returns.' : 'Your first meaningful action will be recorded here.';
  return <Modal wide title="Journey notebook" subtitle="Charts use only monthly snapshots created by this actual run. Journal pages are written automatically by real actions." onClose={close}>
    <div className="journal-tabs"><button className={view === 'balances' ? 'active' : ''} onClick={() => setView('balances')}>Money journey</button><button className={view === 'scores' ? 'active' : ''} onClick={() => setView('scores')}>Life scores</button><select value={month} onChange={(event) => setMonth(event.target.value === 'all' ? 'all' : +event.target.value)}><option value="all">All months</option>{Array.from({ length: game.month }, (_, index) => <option key={index + 1} value={index + 1}>{MONTHS[index]}</option>)}</select></div>
    <div className={`history-source ${hasBackendHistory ? 'database' : 'local'}`}>{historyNote}</div>
    {game.monthlyHistory.length ? <ResponsiveContainer width="100%" height={270}><LineChart data={game.monthlyHistory}><CartesianGrid strokeDasharray="4 4" /><XAxis dataKey="month" tickFormatter={(value) => MONTHS[Number(value) - 1]?.slice(0, 3)} /><YAxis /><Tooltip formatter={(value) => money(Number(value))} labelFormatter={(value) => MONTHS[Number(value) - 1]} />{view === 'balances' ? <><Line type="monotone" dataKey="savings" stroke="#4ca887" strokeWidth={3} /><Line type="monotone" dataKey="investments" stroke="#efb453" strokeWidth={3} /><Line type="monotone" dataKey="emergencyFund" stroke="#6f90d9" strokeWidth={3} /><Line type="monotone" dataKey="debt" stroke="#dc7887" strokeWidth={3} /></> : <><Line type="monotone" dataKey="wealth" stroke="#4ca887" strokeWidth={3} /><Line type="monotone" dataKey="security" stroke="#6f90d9" strokeWidth={3} /><Line type="monotone" dataKey="lifestyle" stroke="#dc7887" strokeWidth={3} /><Line type="monotone" dataKey="growth" stroke="#efb453" strokeWidth={3} /><Line type="monotone" dataKey="goals" stroke="#9a78ce" strokeWidth={3} /></>}</LineChart></ResponsiveContainer> : <div className="empty-note">Finish your first month to create the first chart point.</div>}
    <div className="journal-months">{entries.length ? Object.entries(groupedEntries).sort(([first], [second]) => +second - +first).map(([entryMonth, monthEntries]) => <section key={entryMonth}><h3>{MONTHS[+entryMonth - 1]} <small>Month {entryMonth}</small></h3><div className="journal-pages">{monthEntries.slice().reverse().map((entry) => <article key={entry.id}><small>{entry.type.replaceAll('_', ' ')}</small><b>{entry.title}</b><p>{entry.description}</p>{typeof entry.amount === 'number' && <em>{money(entry.amount)}</em>}</article>)}</div></section>) : <div className="empty-note">No stored actions match this month yet.</div>}</div>
  </Modal>;
}

function GoalsPanel({ close }: { close: () => void }) {
  const game = useGameStore();
  const [fundAmounts, setFundAmounts] = useState<Record<string, number>>({ travel: 2000, laptop: 2000, purchase: 2000 });
  const fundable = new Set(['travel', 'laptop', 'purchase']);
  return <Modal title="Your goals" subtitle="Each card is connected to a real balance, learning result, or dedicated cash fund." onClose={close}><div className="large-goals">{game.goals.map((goal: Goal) => <div key={goal.id}><span>{goal.icon}</span><div><b>{goal.name}</b><p>{goal.complete ? 'Completed' : `${money(goal.progress)} of ${money(goal.target)} · target Month ${goal.deadline}`}</p><Progress value={goal.progress} max={goal.target} tone={goal.complete ? 'gold' : 'mint'} />{fundable.has(goal.id) && !goal.complete && <div className="goal-actions"><input type="number" min="500" step="500" value={fundAmounts[goal.id] || 1000} onChange={(event) => setFundAmounts((current) => ({ ...current, [goal.id]: +event.target.value }))} /><button onClick={() => game.fundGoal(goal.id, fundAmounts[goal.id] || 1000)}>Fund from cash</button>{goal.progress >= goal.target && goal.id !== 'travel' && <button className="primary" onClick={() => game.completeFundedGoal(goal.id)}>Complete goal</button>}</div>}</div></div>)}</div></Modal>;
}

function AchievementsPanel({ close }: { close: () => void }) {
  const unlocks = useGameStore((state) => state.achievements);
  return <Modal title="Achievements" subtitle="Every visible achievement has a condition and unlocks at most once." onClose={close}><div className="achievements">{ACHIEVEMENTS.map((achievement) => { const unlock = unlocks.find((item) => item.id === achievement.id); return <div className={unlock ? 'earned' : ''} key={achievement.id}><span>{achievement.icon}</span><b>{achievement.name}</b><small>{achievement.description}</small><em>{unlock ? `Unlocked Month ${unlock.unlockedMonth}` : 'Locked'}</em></div>; })}</div></Modal>;
}

function InventoryPanel({ close }: { close: () => void }) {
  const inventory = useGameStore((state) => state.inventory);
  return <Modal title="Inventory & room keepsakes" subtitle="These items come from real goals, learning, travel, career choices, and selected purchases." onClose={close}><div className="inventory-grid">{inventory.length ? inventory.map((item) => <article key={item.id}><span>{item.icon}</span><b>{item.name}</b><small>Earned Month {item.earnedMonth}</small><p>{item.note}</p></article>) : <div className="empty-note">Your room is waiting for its first story: complete a goal, learning activity, trip, career opportunity, or collectible purchase.</div>}</div></Modal>;
}

function AgentsPanel({ close }: { close: () => void }) {
  const game = useGameStore();
  return <Modal wide title="Financial agents" subtitle="Recommendations are deterministic responses to your current balances—not placeholder advice." onClose={close}><div className="agent-grid">{AGENTS.map((agent) => { const progress = game.agents.find((item) => item.id === agent.id)!; return <article className={progress.unlocked ? '' : 'locked'} key={agent.id}><span>{agent.portrait}</span><b>{agent.name}</b><small>Priority: {Object.entries(agent.weights).sort((a, b) => b[1] - a[1])[0][0]}</small>{progress.unlocked ? <><Progress value={progress.satisfaction} tone="coral" /><p>{progress.latestRecommendation}</p><button onClick={() => game.talkToAgent(agent.id)}>Talk at Café</button><em>{progress.interactions} conversation{progress.interactions === 1 ? '' : 's'} · satisfaction {progress.satisfaction}</em></> : <p>Unlocks in Month {agent.month}.</p>}</article>; })}</div><h3 className="history-heading">Repeated-game history</h3>{game.strategicHistory.length ? <div className="strategy-history">{game.strategicHistory.slice().reverse().map((record) => { const agent = AGENTS.find((item) => item.id === record.agentId)!; return <article key={record.id}><b>Month {record.month} · {agent.short}</b><span>{STRATEGIES[record.human].label} × {STRATEGIES[record.agent].label}</span><small>You {record.humanPayoff} · {agent.short} {record.agentPayoff} · {record.nash ? 'Nash' : 'Not Nash'} · {record.pareto ? 'Pareto-efficient' : 'Dominated'}</small></article>; })}</div> : <div className="empty-note">Strategy interactions from Months 7–12 will be recorded here with allocations, utilities, Nash status, and Pareto status.</div>}</Modal>;
}

function SalarySplitGame() {
  const game = useGameStore();
  const [pots, setPots] = useState<Record<string, number>>({ needs: 0, savings: 0, growth: 0, lifestyle: 0 });
  const total = Object.values(pots).reduce((sum, value) => sum + value, 0);
  const addCoin = (pot: string) => setPots((current) => total >= 10000 ? current : { ...current, [pot]: current[pot] + 1000 });
  const reset = () => setPots({ needs: 0, savings: 0, growth: 0, lifestyle: 0 });
  return <section className="minigame-card"><div><span>🪙</span><h3>Salary Split</h3><p>Drag or click ten ₹1,000 coins into four life buckets. It rewards planning practice, never free money.</p></div><b>{money(10000 - total)} remaining</b><div className="coin" draggable onDragStart={(event) => event.dataTransfer.setData('coin', '1000')}>₹1K</div><div className="split-buckets">{[['needs', 'Needs'], ['savings', 'Savings'], ['growth', 'Growth'], ['lifestyle', 'Lifestyle']].map(([id, label]) => <button key={id} onDragOver={(event) => event.preventDefault()} onDrop={() => addCoin(id)} onClick={() => addCoin(id)}><b>{label}</b><span>{money(pots[id])}</span></button>)}</div><div><button onClick={reset}>Reset board</button><button className="primary" disabled={total !== 10000} onClick={() => game.completeMiniGame('salary-split', true)}>Confirm split</button></div></section>;
}

function StrategyMatchGame() {
  const game = useGameStore();
  const rawAgent = AGENTS.find((agent) => agent.id === game.currentAgentId) || AGENTS[0];
  const expected = Object.entries(rawAgent.weights).sort((a, b) => b[1] - a[1])[0][0];
  const strategyFor = expected === 'security' || expected === 'savings' ? 'SECURITY' : expected === 'growth' ? 'GROWTH' : 'LIFESTYLE';
  const [answered, setAnswered] = useState(false);
  return <section className="minigame-card"><div><span>{rawAgent.portrait}</span><h3>Strategy Match</h3><p>Which strategy best represents {rawAgent.short}'s current preference? This uses the agent’s actual adaptive weights.</p></div><div className="strategy-cards">{STRATEGY_IDS.map((strategy) => <button disabled={answered} key={strategy} onClick={() => { setAnswered(true); game.completeMiniGame('strategy-match', strategy === strategyFor); }}><span>{STRATEGIES[strategy].icon}</span>{STRATEGIES[strategy].label}</button>)}</div>{answered && <p className="answer-note">{rawAgent.short}'s strongest current priority is <b>{strategyFor.toLowerCase()}</b>.</p>}</section>;
}

function MiniGamesPanel({ close }: { close: () => void }) {
  return <Modal wide title="Mini-games" subtitle="Two small practice games that reinforce financial allocation and Game Theory without creating an infinite-money exploit." onClose={close}><div className="minigame-grid"><SalarySplitGame /><StrategyMatchGame /></div></Modal>;
}

function MapPanel({ openLocation, close }: { openLocation: (location: LocationId) => void; close: () => void }) {
  const game = useGameStore();
  return <Modal title="Lifeway map" subtitle="Visit a place once to discover it, then use fast travel. The highlighted marker is your current location." onClose={close}><div className="map-grid">{WORLD_LOCATIONS.map((location) => { const discovered = game.discoveredLocations.includes(location.id); return <button className={`${discovered ? '' : 'locked'} ${game.currentLocation === location.id ? 'current' : ''}`} disabled={!discovered} key={location.id} onClick={() => { game.fastTravel(location.id); openLocation(location.id); }}><span>{location.icon}</span><b>{location.label}</b><small>{game.currentLocation === location.id ? 'You are here' : discovered ? 'Fast travel' : 'Discover in town'}</small></button>; })}</div></Modal>;
}

function CompareRuns({ close }: { close: () => void }) {
  const completedRuns = useGameStore((state) => state.completedRuns);
  const runs = completedRuns.slice(-2);
  return <Modal wide title="Compare journeys" subtitle="Different choices create different outcomes. This compares the latest two completed runs." onClose={close}>{runs.length < 2 ? <div className="empty-note">Complete a second 12-month journey to unlock the comparison. Your first completed run is safely stored.</div> : <div className="compare-grid">{runs.map((run) => <article key={run.id}><small>{run.playerName} · {new Date(run.completedAt).toLocaleDateString()}</small><h3>{run.classification}</h3><p>{run.completedGoals}/{run.totalGoals} goals completed</p><dl><dt>Cash</dt><dd>{money(run.finalState.cash)}</dd><dt>Savings</dt><dd>{money(run.finalState.savings)}</dd><dt>Investments</dt><dd>{money(run.finalState.investments)}</dd><dt>Emergency fund</dt><dd>{money(run.finalState.emergencyFund)}</dd><dt>Debt</dt><dd>{money(run.finalState.debt)}</dd><dt>Overall score</dt><dd>{Math.round(Object.values(run.finalScores).reduce((sum, score) => sum + score, 0) / 5)}</dd></dl><small>Major events: {run.events.slice(0, 4).join(' · ') || 'None recorded'}</small></article>)}</div>}</Modal>;
}

function PanelHost({ panel, openPanel, openLocation, close, requestReset }: { panel: Panel; openPanel: (panel: Panel) => void; openLocation: (location: LocationId) => void; close: () => void; requestReset: () => void }) {
  if (panel === 'location') return <LocationPanel openPanel={openPanel} close={close} />;
  if (panel === 'journey') return <JourneyPanel close={close} />;
  if (panel === 'goals') return <GoalsPanel close={close} />;
  if (panel === 'achievements') return <AchievementsPanel close={close} />;
  if (panel === 'inventory') return <InventoryPanel close={close} />;
  if (panel === 'agents') return <AgentsPanel close={close} />;
  if (panel === 'minigames') return <MiniGamesPanel close={close} />;
  if (panel === 'map') return <MapPanel close={close} openLocation={openLocation} />;
  if (panel === 'compare') return <CompareRuns close={close} />;
  return <Modal title="Settings" onClose={close}><SettingsPanel onReset={requestReset} /></Modal>;
}

function FinalScreen() {
  const game = useGameStore();
  const beginNewGame = useGameStore((state) => state.beginNewGame);
  const [compare, setCompare] = useState(false);
  const classification = game.completedRuns.at(-1)?.classification || 'Balanced Planner';
  const overall = Math.round(Object.values(game.scores).reduce((sum, value) => sum + value, 0) / 5);
  const insights = [
    `You finish with ${money(game.state.cash)} cash, ${money(game.state.savings)} savings, and ${money(game.state.investments)} invested.`,
    `Emergency reserve: ${money(game.state.emergencyFund)}—${(game.state.emergencyFund / Math.max(game.state.essentialExpenses, 1)).toFixed(1)} months of needs.`,
    `You completed ${game.goals.filter((goal) => goal.complete).length} of ${game.goals.length} goals and recorded ${game.strategicHistory.length} strategy interactions.`,
    game.state.debt ? `You carry ${money(game.state.debt)} debt into the next chapter.` : 'You finish the year without debt.',
  ];
  return <main className="final-screen"><div className="sunset">🌇</div><motion.section initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="paper final-card"><p className="eyebrow">YOUR FINANCIAL YEAR</p><h1>{classification}</h1><p>{game.profile.name}, your city changed because your choices did.</p><div className="overall"><span>{overall}</span><small>OVERALL</small></div><ScoreRow /><div className="insights">{insights.map((insight) => <p key={insight}>✦ {insight}</p>)}</div><div className="title-actions"><button className="primary" onClick={beginNewGame}>Start another run</button><button onClick={() => setCompare(true)}>Compare journeys</button></div></motion.section><AnimatePresence>{compare && <CompareRuns close={() => setCompare(false)} />}</AnimatePresence><FeedbackToast /></main>;
}

export default function App() {
  const game = useGameStore();
  useGamePersistence();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => {
    audioManager.setMuted(game.settings.muted);
    audioManager.setMusicVolume(game.settings.musicVolume);
    audioManager.setSfxVolume(game.settings.sfxVolume);
  }, [game.settings.muted, game.settings.musicVolume, game.settings.sfxVolume]);
  const openLocation = useCallback((location: LocationId) => {
    if (!isLocationId(location)) return;
    useGameStore.getState().visitLocation(location);
    setPanel('location');
  }, []);
  useEffect(() => {
    const onLocation = (event: Event) => {
      const detail = (event as CustomEvent<LocationInteractionDetail>).detail;
      if (!detail || !isLocationId(detail.locationId)) return;
      openLocation(detail.locationId);
    };
    window.addEventListener(LOCATION_EVENT, onLocation);
    return () => window.removeEventListener(LOCATION_EVENT, onLocation);
  }, [openLocation]);
  const openPanel = (next: Panel) => {
    if (next === 'settings') { setPanel('settings'); return; }
    setPanel(next);
  };
  if (game.phase === 'title') return <TitleScreen />;
  if (game.phase === 'setup') return <Setup />;
  if (game.phase === 'final') return <FinalScreen />;
  return <div className={`game-shell ${game.settings.reducedMotion ? 'reduce-motion' : ''} ${game.settings.textSize === 'large' ? 'text-large' : ''}`}>
    <Sidebar openPanel={openPanel} openLocation={openLocation} /><div className="game-main"><Topbar openPanel={openPanel} /><section className="world"><TownGame /><WorldOverlay openLocation={openLocation} /></section><footer className="dock">{[[Map, 'Map', 'map'], [BookOpen, 'Journal', 'journey'], [Target, 'Goals', 'goals'], [Award, 'Achievements', 'achievements']].map(([Icon, label, target]) => { const IconComponent = Icon as typeof Map; return <button key={label as string} onClick={() => openPanel(target as Panel)}><IconComponent />{label as string}</button>; })}</footer></div>
    <AnimatePresence>{game.phase === 'allocation' && <AllocationPanel />}{game.phase === 'event' && <EventPanel />}{game.phase === 'strategy' && <StrategyLab />}{game.phase === 'reflection' && <Reflection />}{panel && <PanelHost panel={panel} openPanel={openPanel} openLocation={openLocation} close={() => setPanel(null)} requestReset={() => { setPanel(null); setConfirmReset(true); }} />}{confirmReset && <Confirm title="Reset active save?" body="This removes your unfinished journey; completed runs remain." onCancel={() => setConfirmReset(false)} onConfirm={() => { game.resetActiveSave(); setConfirmReset(false); }} />}</AnimatePresence><FeedbackToast />
  </div>;
}
