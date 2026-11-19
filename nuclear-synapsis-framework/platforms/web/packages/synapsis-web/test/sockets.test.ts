// The repository's adapter over a WebSocket and over the host's bridge, what the server pushes, and the embedded
// mode (ADR-synapsis-0008, ADR-synapsis-0009). The server is a fake that answers the platform's frames.
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  AppConfig,
  Bridge,
  Decode,
  Frame,
  HttpMethod,
  mountApp,
  Repository,
  StateManager,
  Synapsis,
  WebSocket,
  buildRouter,
  createElement,
  RouterProvider,
} from '../src/index.js';

class Note {
  constructor(readonly id: number, readonly title: string) {}

  static fromJson(json: Record<string, unknown>): Note {
    return new Note(json['id'] as number, json['title'] as string);
  }
}

/** What the transpiler writes for `@get(path = ":id") one(id: int) Note` and `@on("notes.added") added() Stream<Note>`. */
class NoteRepository extends Repository {
  constructor() {
    super({ path: 'notes' });
  }

  one(id: number): Promise<Note> {
    return this.send(HttpMethod.get, ':id', { params: { id }, decode: Decode.one(Note.fromJson) });
  }

  added() {
    return this.stream('notes.added', (data) => Note.fromJson(data as Record<string, unknown>));
  }
}

/** A server that answers the frames: a request gets its note back, a subscription gets one event. */
function serve(send: (frame: Frame) => void, frame: Frame, seen: Frame[]): void {
  seen.push(frame);
  if (frame.subscribe) queueMicrotask(() => send({ event: frame.subscribe, data: { id: 9, title: 'pushed' } }));
  if (frame.id !== undefined) {
    const id = Number(String(frame.path).split('/').pop());
    queueMicrotask(() => send({ id: frame.id, status: id === 404 ? 404 : 200, body: id === 404 ? { message: 'no note' } : { id, title: 'over the socket' } }));
  }
}

class FakeSocket {
  static seen: Frame[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send(raw: string): void {
    serve((f) => this.onmessage?.({ data: JSON.stringify(f) }), JSON.parse(raw) as Frame, FakeSocket.seen);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

class SocketConfig extends AppConfig {
  override readonly connections = [new WebSocket({ url: 'ws://api.test/ws', headers: { 'x-token': 't' } })];
}

class NotesManager extends StateManager<string[]> {
  constructor(repo: NoteRepository) {
    super([]);
    this.listen(repo.added(), (n) => this.emit([...this.state, n.title]));
  }
}

afterEach(async () => {
  await Synapsis.reset();
  vi.unstubAllGlobals();
  FakeSocket.seen = [];
});

describe('the repository over a WebSocket', () => {
  test('a call is a request frame and its answer; an error status is an HttpError; a stream receives the pushed', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    await Synapsis.start(new SocketConfig());
    const repo = new NoteRepository();
    expect(await repo.one(3)).toEqual(new Note(3, 'over the socket'));
    expect(FakeSocket.seen[0]).toMatchObject({ method: 'GET', path: '/notes/3', headers: { 'x-token': 't' } });
    await expect(repo.one(404)).rejects.toMatchObject({ statusCode: 404, message: 'no note' });
    const manager = new NotesManager(repo);
    await vi.waitFor(() => expect(manager.state).toEqual(['pushed']));
    await manager.close();
    expect(FakeSocket.seen.at(-1)).toEqual({ unsubscribe: 'notes.added' });
  });

  test('a connection that cannot push says so', async () => {
    const { Http } = await import('../src/index.js');
    class HttpConfig extends AppConfig {
      override readonly connections = [new Http({ baseUrl: 'https://api.test/' })];
    }
    await Synapsis.start(new HttpConfig());
    expect(() => new NoteRepository().added().listen(() => undefined)).toThrow(/cannot receive/);
  });
});

describe('the embedded mode', () => {
  test('mounted with a bridge: a shadow root with the styles, a memory router, every call through the bridge', async () => {
    const seen: Frame[] = [];
    let back: (f: Frame) => void = () => undefined;
    const bridge: Bridge = {
      send: (f) => serve((x) => back(x), f, seen),
      onMessage: (on) => (back = on),
    };
    class HttpConfig extends AppConfig {}
    const element = document.createElement('div');
    document.body.append(element);
    const screen = () => createElement('p', null, 'mounted');
    const unmount = await mountApp(
      element,
      { bridge, path: '/notes' },
      () => createElement(RouterProvider, { router: buildRouter([{ path: '/notes', screen }]) }),
      async () => Synapsis.start(new HttpConfig()),
      ':host { color: var(--host-color, black); }',
    );
    await vi.waitFor(() => expect(element.shadowRoot?.textContent).toContain('mounted'));
    expect(element.shadowRoot?.querySelector('style')?.textContent).toContain('--host-color');
    expect(element.textContent).toBe(''); // nothing outside the shadow root
    expect(await new NoteRepository().one(5)).toEqual(new Note(5, 'over the socket'));
    expect(seen[0]).toMatchObject({ method: 'GET', path: '/notes/5' });
    unmount();
    expect(element.shadowRoot?.childNodes.length).toBe(0);
  });
});

describe('found by the chat UI', () => {
  test('a screen gets the query parameters the path does not name', async () => {
    const { render } = await import('@testing-library/react');
    const screen = (props: { channel: string; thread: string }) => createElement('p', null, `${props.channel}/${props.thread}`);
    const router = buildRouter(
      [{ path: '/c/:channel', screen, build: (a) => ({ channel: a['channel'] ?? '', thread: a['thread'] ?? '' }) }],
      { memory: true, initial: '/c/general?thread=t1' },
    );
    const view = render(createElement(RouterProvider, { router }));
    await vi.waitFor(() => expect(view.container.textContent).toBe('general/t1'));
    view.unmount();
  });

  test('thenReturn of a Stream method answers the Stream itself', async () => {
    const { when } = await import('../src/testing.js');
    const { Stream } = await import('../src/index.js');
    const fn = vi.fn() as unknown as () => InstanceType<typeof Stream<number>>;
    const s = new Stream<number>(() => () => undefined);
    when(fn).thenReturn(s);
    expect(fn()).toBe(s);
  });
});
