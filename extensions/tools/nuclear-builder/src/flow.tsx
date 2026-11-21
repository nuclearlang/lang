// The run as a living work diagram (React Flow), drawn inside the Builder page (panel.ts), in C4's four levels:
// *Context*, for a product owner (spec 024): what is being built and five business steps in plain words (understand,
// design, build, check, deliver: `story.ts`), each with what it produced and its state, you asked when it needs you, *Containers* (the pipeline: a node per stage, the role that has control
// on each, the hand-over animated along the edges), *Components* (inside a stage: its steps in the stage's boundary,
// the steps each agent followed under them, the stages before and after as neighbours) and *Code* (inside a step: what
// its agent followed, its decisions, its files; its tool calls only with *Technical details* on, as on Components). The breadcrumb walks the levels; a double
// click goes down. The page owns the state (the run, what is picked, the level) and calls `NuclearFlow.render`; this
// file only draws it and reports clicks. Its texts are the page's (`t`). No `vscode` import.
import { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  Background, BackgroundVariant, BaseEdge, Controls, Edge, EdgeProps, getBezierPath, getSmoothStepPath, Handle, MiniMap,
  Node, NodeChange, NodeProps, Panel, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './flow.css';
import type { Run, Stage, Step } from './runs';
import { isToolCall, storyOf, type StoryBeat } from './story';

export type Level = 'context' | 'containers' | 'components' | 'code';

/** A role of the team as the context draws it: who it is and who does its work. */
export interface ContextRole {
  role: string;
  /** The employee hired (the roster's funny name), or '' when the run does not say. */
  name: string;
  /** The employee's portrait as a `data:` URL, when the roster has one. */
  face?: string | null;
  provider: string;
  model?: string;
  kind?: string;
  employee?: string;
}

export interface FlowProps {
  run: Run;
  level: Level;
  /** The stage opened (its inside is drawn at Components and Code). */
  open: string | null;
  /** The step opened (Code). */
  step: string | null;
  /** The team of the run, when the page knows it (else drawn from today's actors). */
  context: { team: string | null; roles: ContextRole[] } | null;
  t: (key: string, ...args: unknown[]) => string;
  picked: { stage: string | null; step: string | null; trace: number | null };
  /** The page's helpers: an actor's avatar (trusted HTML of the page; an employee's own face when given), what it is
   * (its role and who does its work) and its name (the employee hired, else the role). */
  avatar: (actor: string, employee?: string) => string;
  role: (actor: string) => string;
  name: (actor: string) => string;
  /** Who does a piece of work, one label everywhere: "Neo · Developer · Claude Code · haiku" (a step's own provider and
   * model when given). */
  who: (actor: string, work?: { provider?: string; model?: string }) => string;
  onPick: (stage: string | null, step?: string | null, trace?: number | null) => void;
  onOpen: (stage: string | null) => void;
  onLevel: (level: Level, stage?: string | null, step?: string | null) => void;
  onFile?: (file: string) => void;
}

const ICON: Record<string, string> = { analysis: '◎', design: '◫', tests: '✓', quality: '⛨', delivery: '⇪', spec: '◎', generate: '⚙', plan: '◫', test: '✓', code: '⟨⟩', verify: '▶', security: '⛨', artifacts: '▣', deploy: '⇪' };
const dur = (s?: { started?: number; ended?: number }) => {
  if (!s?.started) return '';
  const ms = (s.ended ?? Date.now()) - s.started;
  return ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + ' min ' + Math.round((ms % 60000) / 1000) + ' s';
};
const status = (ctx: FlowProps, s: string) => ctx.t('flow.status.' + s);
/** Who does a station's or a step's work: "Claude Code · haiku". */
/** The label without the name the card already shows in bold. */
const rest = (label: string, name: string) => (label === name ? '' : label.startsWith(name + ' · ') ? label.slice(name.length + 3) : label);
const paid = (provider?: string) => !!provider && provider !== 'nuclear-developer' && provider !== 'shell';

function Face({ html, size, live }: { html: string; size: number; live?: boolean }) {
  return <span className={'fx-face' + (live ? ' live' : '')} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}
const Typing = () => <span className="fx-typing"><i /><i /><i /></span>;

// ---------- the pipeline: a node per stage ----------
type StationData = { stage: Stage; index: number; ctx: FlowProps; picked: boolean };
function StationNode({ data }: NodeProps<Node<StationData>>) {
  const { stage: s, index, ctx, picked } = data;
  const live = s.steps.find((x) => x.status === 'running');
  const last = live ?? [...s.steps].reverse().find((x) => x.status !== 'pending');
  // the shell and the Smart Graph only when a step of theirs took part (requirement 22)
  const crew = [...new Set([...(s.role ? [s.role] : []), ...s.steps.map((x) => x.actor)])];
  const done = s.steps.filter((x) => x.status === 'passed').length;
  const decisions = s.steps.reduce((n, x) => n + (x.decisions?.length ?? 0), 0);
  const pct = s.status === 'passed' ? 100 : s.steps.length ? Math.round((done / s.steps.length) * 100) : 0;
  return (
    <div className={`fx-card fx-station is-${s.status}${picked ? ' picked' : ''}`}>
      <div className="fx-ring" />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="fx-head">
        <span className="fx-idx">{index + 1}</span>
        <span className={`fx-pill is-${s.status}`}>{status(ctx, s.status)}</span>
        <span className="fx-time">{dur(s)}</span>
      </div>
      <div className="fx-title"><span className="fx-ico">{ICON[s.id] ?? '•'}</span>{s.title}</div>
      {s.role ? <div className={'fx-assign' + (paid(s.provider) ? ' fx-paid' : '')} title={ctx.role(s.role)}>{ctx.who(s.role, s)}</div> : null}
      <div className="fx-crew">
        {crew.map((a) => <span key={a} className={'fx-member' + (live?.actor === a ? ' on' : s.steps.some((x) => x.actor === a) ? ' did' : '')} title={ctx.who(a)}><Face html={ctx.avatar(a)} size={live?.actor === a ? 30 : 24} live={live?.actor === a} /></span>)}
      </div>
      <div className="fx-now">
        {live ? <><Typing /><b>{ctx.name(live.actor)}</b> {live.title}</> : s.status === 'waiting' ? <><span className="fx-ask">?</span> {ctx.t('flow.status.waiting')}</> : last ? <>{last.status === 'failed' ? '✕ ' : '✓ '}{last.summary || last.title}</> : <span className="fx-muted">{s.about}</span>}
      </div>
      <div className="fx-bar"><i style={{ width: pct + '%' }} /></div>
      <div className="fx-foot">
        <span>{ctx.t('flow.steps', done, s.steps.length)}</span>
        {decisions ? <span className="fx-dec">◆ {decisions}</span> : null}
        <button className="fx-open nodrag" title={ctx.t('flow.insideHint')} onClick={(e) => { e.stopPropagation(); ctx.onOpen(s.id); }}>⤢ {ctx.t('flow.inside')}</button>
      </div>
    </div>
  );
}

// ---------- inside a stage (C4 components) ----------
type BoundaryData = { title: string; kind: string; status: string; about: string; w: number; h: number; ctx: FlowProps; time: string };
function BoundaryNode({ data }: NodeProps<Node<BoundaryData>>) {
  return (
    <div className={`fx-boundary is-${data.status}`} style={{ width: data.w, height: data.h }}>
      <div className="fx-blabel"><b>{data.title}</b> <span>[{data.kind} · {status(data.ctx, data.status)}{data.time ? ' · ' + data.time : ''}]</span><div className="fx-muted">{data.about}</div></div>
    </div>
  );
}
type StepData = { stage: Stage; step: Step; ctx: FlowProps; picked: boolean };
function StepNode({ data }: NodeProps<Node<StepData>>) {
  const { step: x, ctx, picked } = data;
  const live = x.status === 'running';
  return (
    <div className={`fx-card fx-step is-${x.status}${picked ? ' picked' : ''}`}>
      <div className="fx-ring" />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="source" id="down" position={Position.Bottom} />
      <div className="fx-who">
        <Face html={ctx.avatar(x.actor, x.employee)} size={34} live={live} />
        <div title={ctx.role(x.actor)}><b>{ctx.name(x.actor)}</b><small>{rest(ctx.who(x.actor, x), ctx.name(x.actor))}</small></div>
        <span className={`fx-pill is-${x.status}`}>{status(ctx, x.status)}</span>
      </div>
      <div className="fx-title fx-sm">{x.title}</div>
      <div className="fx-now">{live ? <><Typing />{x.summary || ctx.t('flow.status.running')}</> : x.summary}</div>
      <div className="fx-foot">
        <span>{dur(x)}</span>
        {x.decisions?.length ? <span className="fx-dec">◆ {x.decisions.length}</span> : null}
        {x.costUsd ? <span className="fx-paid">USD {x.costUsd.toFixed(3)}</span> : x.tool ? <span className="fx-muted">{x.tool}</span> : null}
        <button className="fx-open nodrag" title={ctx.t('flow.codeHint')} onClick={(e) => { e.stopPropagation(); ctx.onLevel('code', data.stage.id, x.id); }}>⤢ {ctx.t('flow.inside')}</button>
      </div>
    </div>
  );
}
type TraceData = { k: number; label: string; detail: string; picked: boolean; last: boolean; live: boolean };
function TraceNode({ data }: NodeProps<Node<TraceData>>) {
  return (
    <div className={'fx-trace' + (data.picked ? ' picked' : '') + (data.live && data.last ? ' live' : '')} title={data.detail}>
      <Handle type="target" position={Position.Left} />
      <span className="fx-k">{data.k + 1}</span><b>{data.label}</b><span className="fx-detail">{data.detail}</span>
    </div>
  );
}
type GhostData = { stage: Stage; side: 'before' | 'after'; ctx: FlowProps };
function GhostNode({ data }: NodeProps<Node<GhostData>>) {
  return (
    <div className={`fx-ghost is-${data.stage.status}`} title={data.ctx.t('flow.openStage', data.stage.title)}>
      <Handle type={data.side === 'before' ? 'source' : 'target'} position={data.side === 'before' ? Position.Right : Position.Left} />
      <span className="fx-muted">{data.ctx.t(data.side === 'before' ? 'flow.from' : 'flow.then')}</span>
      <b>{ICON[data.stage.id]} {data.stage.title}</b>
      <span className={`fx-pill is-${data.stage.status}`}>{status(data.ctx, data.stage.status)}</span>
    </div>
  );
}

// ---------- the context (C4 level 1): the project and who talks to it ----------
type Side = 'top' | 'bottom' | 'left' | 'right';
const SIDES: [Side, Position][] = [['top', Position.Top], ['bottom', Position.Bottom], ['left', Position.Left], ['right', Position.Right]];
/** Every side can send and receive: the context's edges leave each node by the side that faces the other one. */
const Sides = () => <>{SIDES.map(([id, p]) => <Handle key={'s' + id} id={'s-' + id} type="source" position={p} />)}{SIDES.map(([id, p]) => <Handle key={'t' + id} id={'t-' + id} type="target" position={p} />)}</>;
type ProjectData = { ctx: FlowProps };
function ProjectNode({ data: { ctx } }: NodeProps<Node<ProjectData>>) {
  const r = ctx.run, live = r.stages.find((s) => s.status === 'running');
  const done = r.stages.filter((s) => s.status === 'passed').length;
  return (
    <div className={`fx-card fx-project is-${r.status}`}>
      <div className="fx-ring" />
      <Sides />
      <div className="fx-kind">{ctx.t('flow.kind.project')}</div>
      <div className="fx-title"><span className="fx-ico">◈</span>{r.project}</div>
      <div className="fx-muted">{[r.platform, r.dialect].filter(Boolean).join(' · ')}</div>
      <div className="fx-spec">“{r.spec.title}”</div>
      <div className="fx-now">{live ? <><Typing /><b>{live.title}</b> · {ctx.t('flow.steps', live.steps.filter((x) => x.status === 'passed').length, live.steps.length)}</> : <>{status(ctx, r.status)} · {ctx.t('flow.stagesDone', done, r.stages.length)}</>}</div>
      <div className="fx-bar"><i style={{ width: Math.round((done / Math.max(1, r.stages.length)) * 100) + '%' }} /></div>
      <div className="fx-foot"><span>{dur({ started: r.created, ended: r.ended ?? undefined })}</span>{r.costUsd ? <span className="fx-dec">USD {r.costUsd.toFixed(3)}</span> : null}<button className="fx-open nodrag" title={ctx.t('flow.pipelineHint')} onClick={(e) => { e.stopPropagation(); ctx.onLevel('containers'); }}>⤢ {ctx.t('flow.pipeline')}</button></div>
    </div>
  );
}
type ActorData = { kind: 'person' | 'role' | 'provider' | 'system'; title: string; sub: string; icon: string; color: string; live: boolean; used: boolean; ctx: FlowProps; face?: string };
function ActorNode({ data: d }: NodeProps<Node<ActorData>>) {
  return (
    <div className={`fx-actor k-${d.kind}${d.live ? ' live' : ''}${d.used ? '' : ' unused'}`} style={{ ['--ac' as string]: d.color }}>
      <Sides />
      {d.face ? <Face html={d.face} size={d.kind === 'role' ? 52 : 34} live={d.live} /> : <span className="fx-aico">{d.icon}</span>}
      <div><div className="fx-kind">{d.ctx.t('flow.kind.' + d.kind)}</div><b>{d.title}</b><small>{d.sub}</small></div>
    </div>
  );
}

// ---------- the story (C4 level 1, for a product owner): a business step, what it produced, its state ----------
/** A step's state as the cards draw a station's (the ring of work, the amber that waits for you, the red that stopped). */
const BEAT_CARD: Record<string, string> = { waiting: 'pending', working: 'running', needsYou: 'waiting', done: 'passed', failed: 'failed', skipped: 'skipped' };
const BEAT_ICON: Record<string, string> = { understand: '◎', design: '◫', build: '⚒', check: '✓', deliver: '⇪' };
type BeatData = { beat: StoryBeat; ctx: FlowProps };
function BeatNode({ data: { beat: b, ctx } }: NodeProps<Node<BeatData>>) {
  const who = b.stations.find((s) => s.status === 'running' || s.status === 'waiting') ?? b.stations[0];
  return (
    <div className={`fx-card fx-beat is-${BEAT_CARD[b.state]}`}>
      <Sides />
      <div className="fx-kind">{ctx.t('flow.story.state.' + b.state)}</div>
      <div className="fx-title"><span className="fx-ico">{BEAT_ICON[b.id]}</span>{ctx.t('flow.story.' + b.id)}</div>
      <div className="fx-muted">{ctx.t('flow.story.about.' + b.id)}</div>
      <div className="fx-made">{b.state === 'working' ? <Typing /> : null}{ctx.t(b.made.key, ...b.made.args)}</div>
      {who && b.stations.length ? <div className="fx-foot"><span>{ctx.name(who.role ?? who.actors[0] ?? '')}</span><button className="fx-open nodrag" title={ctx.t('flow.story.zoom')} onClick={(e) => { e.stopPropagation(); ctx.onLevel('containers'); ctx.onPick(who.id); }}>⤢ {ctx.t('flow.inside')}</button></div> : null}
    </div>
  );
}

// ---------- inside a step (C4 level 4, code): what its agent followed, decided, wrote and called ----------
type BitData = { kind: 'trace' | 'decision' | 'file' | 'tool'; k: number; title: string; detail: string; picked: boolean; live: boolean; ctx: FlowProps };
function BitNode({ data: d }: NodeProps<Node<BitData>>) {
  return (
    <div className={`fx-bit k-${d.kind}${d.picked ? ' picked' : ''}${d.live ? ' live' : ''}`} title={d.detail}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" id="l" position={Position.Left} />
      <Handle type="source" id="r" position={Position.Right} />
      <span className="fx-bico">{d.kind === 'trace' ? d.k + 1 : d.kind === 'decision' ? '◆' : d.kind === 'file' ? '▤' : '⚒'}</span>
      <div><div className="fx-kind">{d.ctx.t('flow.kind.' + d.kind)}</div><b>{d.title}</b>{d.detail ? <small>{d.detail}</small> : null}</div>
    </div>
  );
}

// ---------- edges: a hand-over in progress flows, a finished one is solid, one to come is dashed ----------
type FlowEdgeData = { state: 'live' | 'done' | 'idle' | 'failed'; step?: boolean; label?: string };
function FlowEdge(p: EdgeProps<Edge<FlowEdgeData>>) {
  const [path, lx, ly] = p.data?.step
    ? getSmoothStepPath({ sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition, borderRadius: 10 })
    : getBezierPath({ sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition });
  const state = p.data?.state ?? 'idle';
  return (
    <>
      <BaseEdge id={p.id} path={path} className={'fx-edge ' + state} markerEnd={p.markerEnd} label={p.data?.label || undefined} labelX={lx} labelY={ly} labelShowBg labelBgPadding={[7, 3]} labelBgBorderRadius={6} labelStyle={{ fill: 'var(--muted)', fontSize: 11 }} labelBgStyle={{ fill: 'var(--card)', stroke: 'var(--line)' }} />
      {state === 'live' ? <circle className="fx-pulse" r={4}><animateMotion dur="1.4s" repeatCount="indefinite" path={path} /></circle> : null}
    </>
  );
}

const nodeTypes = { station: StationNode, boundary: BoundaryNode, step: StepNode, trace: TraceNode, ghost: GhostNode, project: ProjectNode, actor: ActorNode, bit: BitNode, beat: BeatNode };
const edgeTypes = { flow: FlowEdge };
const edgeState = (from: { status: string }, to: { status: string }): FlowEdgeData['state'] =>
  to.status === 'running' || to.status === 'waiting' ? 'live' : to.status === 'failed' ? 'failed' : to.status === 'pending' || from.status === 'pending' ? 'idle' : 'done';

const SW = 270, SGAP = 80, STEPW = 260, STEPGAP = 70, TRACEH = 34;
function pipeline(ctx: FlowProps): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = ctx.run.stages.map((s, i) => ({ id: s.id, type: 'station', position: { x: i * (SW + SGAP), y: 0 }, data: { stage: s, index: i, ctx, picked: ctx.picked.stage === s.id && !ctx.picked.step } satisfies StationData }));
  const edges: Edge[] = ctx.run.stages.slice(1).map((s, i) => {
    const from = ctx.run.stages[i];
    return { id: from.id + '>' + s.id, source: from.id, target: s.id, type: 'flow', data: { state: edgeState(from, s) } };
  });
  return { nodes, edges };
}
function inside(ctx: FlowProps, s: Stage, technical: boolean): { nodes: Node[]; edges: Edge[] } {
  const at = ctx.run.stages.indexOf(s);
  // what each agent followed; its tool calls (Glob, Read, Write…) only in the technical details
  const traceOf = (x: Step) => (x.trace ?? []).filter((t) => technical || !isToolCall(t));
  const tallest = Math.max(0, ...s.steps.map((x) => traceOf(x).length));
  const w = Math.max(STEPW + 80, s.steps.length * (STEPW + STEPGAP) - STEPGAP + 80), h = 110 + 150 + tallest * (TRACEH + 8) + 40;
  const nodes: Node[] = [{ id: 'boundary', type: 'boundary', position: { x: 0, y: 0 }, data: { title: s.title, kind: ctx.t('flow.kind.stage'), status: s.status, about: s.about, w, h, ctx, time: dur(s) } satisfies BoundaryData, selectable: false, draggable: false, zIndex: -1 }];
  const edges: Edge[] = [];
  s.steps.forEach((x, k) => {
    const id = 'step:' + x.id, left = 40 + k * (STEPW + STEPGAP);
    nodes.push({ id, type: 'step', position: { x: left, y: 100 }, data: { stage: s, step: x, ctx, picked: ctx.picked.stage === s.id && ctx.picked.step === x.id && ctx.picked.trace === null } satisfies StepData });
    if (k) edges.push({ id: 'e' + k, source: 'step:' + s.steps[k - 1].id, target: id, type: 'flow', data: { state: edgeState(s.steps[k - 1], x) } });
    const shown = traceOf(x);
    shown.forEach((t, j) => {
      const tid = id + ':' + j;
      nodes.push({ id: tid, type: 'trace', position: { x: left + 26, y: 100 + 160 + j * (TRACEH + 8) }, data: { k: j, label: t.step, detail: t.detail, picked: ctx.picked.step === x.id && ctx.picked.trace === j, last: j === shown.length - 1, live: x.status === 'running' } satisfies TraceData });
      edges.push({ id: tid + 'e', source: id, sourceHandle: 'down', target: tid, type: 'flow', data: { step: true, state: x.status === 'running' && j === shown.length - 1 ? 'live' : 'done' } });
    });
  });
  const before = ctx.run.stages[at - 1], after = ctx.run.stages[at + 1];
  if (before) {
    nodes.push({ id: 'ghost:' + before.id, type: 'ghost', position: { x: -280, y: 130 }, data: { stage: before, side: 'before', ctx } satisfies GhostData });
    if (s.steps[0]) edges.push({ id: 'gb', source: 'ghost:' + before.id, target: 'step:' + s.steps[0].id, type: 'flow', data: { state: edgeState(before, s.steps[0]) } });
  }
  if (after) {
    nodes.push({ id: 'ghost:' + after.id, type: 'ghost', position: { x: w + 80, y: 130 }, data: { stage: after, side: 'after', ctx } satisfies GhostData });
    const end = s.steps.at(-1);
    if (end) edges.push({ id: 'ga', source: 'step:' + end.id, target: 'ghost:' + after.id, type: 'flow', data: { state: edgeState(end, after) } });
  }
  return { nodes, edges };
}

/** The run told to a product owner (C4 level 1, spec 024): what is being built on top, you on its left, and the five
 * business steps under it as a story read downwards (a column fits the editor's narrow pages without shrinking the
 * words), each with what it produced and its state; the hand-over flows along them. The people, the stations and the
 * providers are the next level's. */
function contextOf(ctx: FlowProps): { nodes: Node[]; edges: Edge[] } {
  const r = ctx.run, beats = storyOf(r);
  const W = 252, H = 150, GAP = 46, px = 0;
  const nodes: Node[] = [], edges: Edge[] = [];
  nodes.push({ id: 'project', type: 'project', position: { x: px, y: 0 }, data: { ctx } satisfies ProjectData });
  const asks = !!r.waiting;
  nodes.push({ id: 'you', type: 'actor', position: { x: px - W - 150, y: 50 }, data: { kind: 'person', title: ctx.t('flow.you'), sub: ctx.t('flow.youSub'), icon: '★', color: '#6b7280', live: asks, used: true, ctx, face: ctx.avatar('you') } satisfies ActorData });
  beats.forEach((b, i) => {
    nodes.push({ id: 'beat:' + b.id, type: 'beat', position: { x: px + (300 - W) / 2, y: 240 + i * (H + GAP) }, data: { beat: b, ctx } satisfies BeatData });
    if (i) edges.push({ id: 'b' + i, source: 'beat:' + beats[i - 1].id, sourceHandle: 's-bottom', target: 'beat:' + b.id, targetHandle: 't-top', type: 'flow', data: { state: b.state === 'working' || b.state === 'needsYou' ? 'live' : b.state === 'failed' ? 'failed' : b.state === 'waiting' ? 'idle' : 'done' } });
  });
  // you give the request (the first step reads it); a step that needs you asks you
  const asking = beats.find((b) => b.state === 'needsYou');
  if (asking) edges.push({ id: 'ask', source: 'beat:' + asking.id, sourceHandle: 's-left', target: 'you', targetHandle: 't-bottom', type: 'flow', data: { state: 'live', label: ctx.t('flow.e.asks') } });
  else edges.push({ id: 'you', source: 'you', sourceHandle: 's-right', target: 'project', targetHandle: 't-left', type: 'flow', data: { state: 'done', label: ctx.t('flow.e.spec') } });
  edges.push({ id: 'story', source: 'project', sourceHandle: 's-bottom', target: 'beat:' + beats[0].id, targetHandle: 't-top', type: 'flow', data: { state: 'done' } });
  return { nodes, edges };
}

function codeOf(ctx: FlowProps, s: Stage, x: Step, technical: boolean): { nodes: Node[]; edges: Edge[] } {
  const all = (x.trace ?? []) as ({ step: string; detail: string; kind?: string })[];
  const trace = all.filter((tr) => !isToolCall(tr)), tools = technical ? all.filter(isToolCall) : [];
  const decisions = x.decisions ?? [], files = [...new Set([...(x.file ? [x.file] : []), ...(x.files ?? [])])];
  const COL = 300, ROW = 84, top = 96;
  const rows = Math.max(trace.length, decisions.length, files.length + tools.length + (x.tool && technical ? 1 : 0), 1);
  const w = COL * 3 + 40, h = top + rows * ROW + 40;
  const nodes: Node[] = [{ id: 'boundary', type: 'boundary', position: { x: 0, y: 0 }, data: { title: x.title, kind: ctx.t('flow.kind.step') + ' · ' + ctx.who(x.actor, x), status: x.status, about: x.summary || s.title, w, h, ctx, time: dur(x) } satisfies BoundaryData, selectable: false, draggable: false, zIndex: -1 }];
  const edges: Edge[] = [];
  const live = x.status === 'running';
  const bit = (id: string, col: number, row: number, d: Omit<BitData, 'ctx'>) => nodes.push({ id, type: 'bit', position: { x: 20 + col * COL, y: top + row * ROW }, data: { ...d, ctx } satisfies BitData });
  trace.forEach((tr, k) => {
    bit('t:' + k, 0, k, { kind: 'trace', k, title: tr.step, detail: tr.detail, picked: ctx.picked.step === x.id && ctx.picked.trace === k, live: live && k === trace.length - 1 });
    if (k) edges.push({ id: 'te' + k, source: 't:' + (k - 1), target: 't:' + k, type: 'flow', data: { state: live && k === trace.length - 1 ? 'live' : 'done', step: true } });
  });
  if (!trace.length) bit('t:0', 0, 0, { kind: 'trace', k: 0, title: ctx.t('flow.oneThing'), detail: x.summary, picked: false, live });
  decisions.forEach((d, k) => bit('d:' + k, 1, k, { kind: 'decision', k, title: d.what, detail: ctx.t('flow.because', d.why), picked: false, live: false }));
  files.forEach((f, k) => bit('f:' + k, 2, k, { kind: 'file', k, title: f.split('/').pop() ?? f, detail: f, picked: false, live: false }));
  tools.forEach((tr, k) => bit('c:' + k, 2, files.length + k, { kind: 'tool', k, title: tr.step, detail: tr.detail.slice(0, 140), picked: false, live: live && k === tools.length - 1 }));
  if (x.tool && technical) bit('tool', 2, files.length + tools.length, { kind: 'tool', k: 0, title: x.tool, detail: (x.input ?? '').slice(0, 140), picked: false, live });
  // what it followed leads to what it decided, and that to what it wrote: row by row, left to right
  const traceAt = (k: number) => 't:' + Math.min(k, Math.max(0, trace.length - 1));
  decisions.forEach((_, k) => edges.push({ id: 'de' + k, source: traceAt(k), sourceHandle: 'r', target: 'd:' + k, targetHandle: 'l', type: 'flow', data: { state: 'done' } }));
  const rightOf = (k: number) => (decisions.length ? 'd:' + Math.min(k, decisions.length - 1) : traceAt(k));
  files.forEach((_, k) => edges.push({ id: 'fe' + k, source: rightOf(k), sourceHandle: 'r', target: 'f:' + k, targetHandle: 'l', type: 'flow', data: { state: x.status === 'failed' ? 'failed' : 'done' } }));
  tools.forEach((_, k) => edges.push({ id: 'ce' + k, source: rightOf(files.length + k), sourceHandle: 'r', target: 'c:' + k, targetHandle: 'l', type: 'flow', data: { state: live && k === tools.length - 1 ? 'live' : 'done' } }));
  if (x.tool && technical) edges.push({ id: 'tool', source: rightOf(files.length), sourceHandle: 'r', target: 'tool', targetHandle: 'l', type: 'flow', data: { state: live ? 'live' : 'done' } });
  return { nodes, edges };
}

function Diagram(ctx: FlowProps) {
  const flow = useReactFlow();
  const stage = ctx.level !== 'context' && ctx.level !== 'containers' && ctx.open ? ctx.run.stages.find((s) => s.id === ctx.open) ?? null : null;
  const inStep = ctx.level === 'code' && stage ? stage.steps.find((x) => x.id === ctx.step) ?? null : null;
  const lv: Level = ctx.level === 'context' ? 'context' : inStep ? 'code' : stage ? 'components' : 'containers';
  const level = ctx.run.id + '|' + lv + '|' + (stage?.id ?? '') + '|' + (inStep?.id ?? '');
  // where the user dragged a node, per level: the run is redrawn many times a second and keeps it
  const [moved, setMoved] = useState<{ level: string; at: Record<string, XYPosition> }>({ level, at: {} });
  // the size React Flow measured of each node, per level (a level's 'boundary' is not another's): the minimap, the
  // edges and the framing need it on the nodes it is given
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
  const sized = (id: string) => sizes[level + '#' + id];
  const at = moved.level === level ? moved.at : {};
  // the tool calls (Glob, Read, Write…) are for debugging: drawn only with *Technical details* on (spec 024)
  const [technical, setTechnical] = useState(false);
  const drawn = lv === 'context' ? contextOf(ctx) : inStep && stage ? codeOf(ctx, stage, inStep, technical) : stage ? inside(ctx, stage, technical) : pipeline(ctx);
  const nodes = drawn.nodes.map((n) => ({ ...n, position: at[n.id] ?? n.position, measured: sized(n.id) }));
  const edges = drawn.edges;
  const onNodesChange = (changes: NodeChange[]) => {
    const go: Record<string, XYPosition> = {}, grown: Record<string, { width: number; height: number }> = {};
    for (const c of changes) {
      if (c.type === 'position' && c.position) go[c.id] = c.position;
      if (c.type === 'dimensions' && c.dimensions) grown[level + '#' + c.id] = c.dimensions;
    }
    if (Object.keys(go).length) setMoved({ level, at: { ...at, ...go } });
    if (Object.keys(grown).length) setSizes((old) => ({ ...old, ...grown }));
  };
  // a new level, or a new run, is framed whole (an animated zoom); a step that appears leaves the user's view alone
  const framed = useRef('');
  const ready = useNodesInitialized();
  useEffect(() => {
    // only once every node of the level is measured: framing before frames the wrong box
    if (!ready || framed.current === level) return;
    framed.current = level;
    // framed readable, as in n8n (the rest is a pan away): the station that works, asks or failed and its neighbours;
    // inside a station its step that works or failed and its neighbours (a short station whole); inside a step, all
    const working = ctx.run.stages.findIndex((s) => s.status === 'running' || s.status === 'waiting');
    const live = working >= 0 ? working : ctx.run.stages.findIndex((s) => s.status === 'failed');
    const around = <T,>(list: T[], at: number) => list.slice(Math.max(0, at - 1), at + 2);
    const stepAt = stage ? Math.max(stage.steps.findIndex((x) => x.status === 'running'), [...stage.steps].map((x) => x.status).lastIndexOf('failed'), 0) : -1;
    const near = lv === 'context' || lv === 'code' ? undefined
      : stage ? (stage.steps.length <= 3 ? [{ id: 'boundary' }] : around(stage.steps, stepAt).map((x) => ({ id: 'step:' + x.id })))
      : live >= 0 ? around(ctx.run.stages, live).map((s) => ({ id: s.id })) : undefined;
    requestAnimationFrame(() => requestAnimationFrame(() => void flow.fitView({ nodes: near, padding: { top: '72px', bottom: '28px', x: '28px' }, duration: 550, minZoom: lv === 'context' ? 0.35 : 0.5, maxZoom: 1.1 })));
  }, [level, ready, flow]);
  const live = ctx.run.stages.find((s) => s.status === 'running');
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      colorMode={document.body.classList.contains('vscode-light') ? 'light' : 'dark'}
      fitView
      fitViewOptions={{ minZoom: 0.72, maxZoom: 1.1 }}
      minZoom={0.2}
      maxZoom={1.75}
      nodesConnectable={false}
      nodesDraggable
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_, n) => {
        if (n.type === 'station') ctx.onPick(n.id);
        else if (n.type === 'step') ctx.onPick(ctx.open, (n.data as StepData).step.id, null);
        else if (n.type === 'trace') ctx.onPick(ctx.open, n.id.split(':').slice(1, -1).join(':'), (n.data as TraceData).k);
        else if (n.type === 'ghost') ctx.onOpen((n.data as GhostData).stage.id);
        else if (n.type === 'bit' && inStep) {
          const b = n.data as BitData;
          if (b.kind === 'file') ctx.onFile?.(b.detail);
          else ctx.onPick(ctx.open, inStep.id, b.kind === 'trace' && inStep.trace?.length ? b.k : null);
        }
      }}
      onNodeDoubleClick={(_, n) => {
        if (n.type === 'project') ctx.onLevel('containers');
        else if (n.type === 'beat') { const b = (n.data as BeatData).beat; ctx.onLevel('containers'); if (b.stations[0]) ctx.onPick(b.stations[0].id); }
        else if (n.type === 'station') ctx.onOpen(n.id);
        else if (n.type === 'step') ctx.onLevel('code', ctx.open, (n.data as StepData).step.id);
      }}
      onPaneClick={() => lv === 'code' && inStep ? ctx.onPick(ctx.open, inStep.id) : ctx.onPick(lv === 'context' ? null : ctx.open)}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" nodeStrokeWidth={3} nodeClassName={(n) => n.type === 'boundary' ? 'mm-boundary' : 'mm-' + ((n.data as { stage?: Stage; step?: Step }).step?.status ?? (n.data as { stage?: Stage }).stage?.status ?? 'pending')} />
      <Panel position="top-left" className="fx-crumbs">
        <button className={lv === 'context' ? 'here' : ''} onClick={() => ctx.onLevel('context')} title={ctx.t('flow.c4.context')}>◈ {ctx.t('flow.context')}</button>
        <span>›</span><button className={lv === 'containers' ? 'here' : ''} onClick={() => ctx.onLevel('containers')} title={ctx.t('flow.c4.containers')}>{ctx.t('flow.pipeline')}</button>
        {stage ? <><span>›</span><button className={lv === 'components' ? 'here' : ''} onClick={() => ctx.onLevel('components', stage.id)} title={ctx.t('flow.c4.components')}>{ICON[stage.id]} {stage.title}</button></> : null}
        {inStep ? <><span>›</span><button className="here" title={ctx.t('flow.c4.code')}>{inStep.title.length > 34 ? inStep.title.slice(0, 34) + '…' : inStep.title}</button></> : null}
        {live && live !== stage ? <button className="fx-follow" onClick={() => ctx.onOpen(live.id)} title={ctx.t('flow.followHint')}><Typing /> {live.title}</button> : null}
      </Panel>
      <Panel position="top-right" className="fx-level">
        {lv === 'components' || lv === 'code' ? <button className={'fx-tech nodrag' + (technical ? ' on' : '')} aria-pressed={technical} title={ctx.t('flow.technicalHint')} onClick={() => setTechnical(!technical)}>⚙ {ctx.t('flow.technical')}</button> : null}
        {ctx.t('flow.level.' + lv)}
      </Panel>
    </ReactFlow>
  );
}

let root: Root | null = null;
let host: HTMLElement | null = null;
/** Draws (or draws again) the diagram in `el`: React keeps what did not change, so the animations run on. */
function render(el: HTMLElement, props: FlowProps): void {
  if (host !== el) {
    root?.unmount();
    host = el;
    root = createRoot(el);
  }
  root!.render(<ReactFlowProvider><Diagram {...props} /></ReactFlowProvider>);
}

(window as unknown as { NuclearFlow: { render: typeof render } }).NuclearFlow = { render };
