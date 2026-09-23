import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { FrameDecoder, MAX_MESSAGE_SIZE, MessageType, parseMessage } from '../src/shared/protocol';
import { parseReplay } from '../src/server/mock-server';
import { StateManager } from '../src/server/state-manager';
import { encodeArea, encodeSessionStart, encodeVersion, startMockPipe } from '../src/server/pipe-mock';
import { PipeClient } from '../src/server/pipe-client';

function frame(body: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeInt32LE(body.length);
  return Buffer.concat([header, body]);
}

function areaBody(sessionGuid: number, islandId: number): Buffer {
  const chunks: Buffer[] = [];
  const u8 = (value: number) => { const b = Buffer.alloc(1); b.writeUInt8(value); chunks.push(b); };
  const i32 = (value: number) => { const b = Buffer.alloc(4); b.writeInt32LE(value); chunks.push(b); };
  const i64 = (value: bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(value); chunks.push(b); };
  const f32 = (value: number) => { const b = Buffer.alloc(4); b.writeFloatLE(value); chunks.push(b); };
  u8(MessageType.AreaProductionStatistics); u8(1); u8(islandId); u8(0); i32(sessionGuid);
  const name = Buffer.from('Nova Roma'); u8(name.length); chunks.push(name);
  i64(123456789n); i32(1);
  i32(2068); f32(12.5); f32(15); f32(-2.5); f32(14); f32(16);
  i32(2); i32(50); f32(120); i32(70); f32(1.8); f32(90);
  i32(1); i32(2181); i32(24); i32(1); i32(2200); i32(2);
  return Buffer.concat(chunks);
}

test('frame decoder handles fragmented and concatenated pipe messages', () => {
  const version = Buffer.alloc(5); version.writeUInt8(MessageType.Version, 0); version.writeInt32LE(2, 1);
  const message = Buffer.concat([frame(version), frame(areaBody(3245, 5))]);
  const decoder = new FrameDecoder();
  assert.deepEqual(decoder.push(message.subarray(0, 2)), []);
  assert.deepEqual(decoder.push(message.subarray(2, 7)), []);
  const result = decoder.push(message.subarray(7));
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { type: MessageType.Version, version: 2 });
  assert.equal(result[1].type, MessageType.AreaProductionStatistics);
  if (result[1].type === MessageType.AreaProductionStatistics) {
    assert.equal(result[1].area.sessionGuid, 3245);
    assert.equal(result[1].area.islandId, 5);
    assert.equal(result[1].area.entries[0].delta, -2.5);
    assert.deepEqual(result[1].area.entries[0].workforces, { '2181': 24 });
    assert.deepEqual(result[1].area.entries[0].buildings, { '2200': 2 });
  }
});

test('malformed frames and truncated nested counts are rejected', () => {
  const huge = Buffer.alloc(4); huge.writeInt32LE(MAX_MESSAGE_SIZE + 1);
  assert.throws(() => new FrameDecoder().push(huge), /Invalid pipe frame length/);
  assert.throws(() => parseMessage(areaBody(1, 1).subarray(0, -1)), /Truncated pipe message|Invalid pipe entry count/);
});

test('state keys remain unique across game regions', () => {
  const state = new StateManager();
  const areaA = parseMessage(areaBody(3245, 1));
  const areaB = parseMessage(areaBody(9876, 1));
  if (areaA.type !== MessageType.AreaProductionStatistics || areaB.type !== MessageType.AreaProductionStatistics) throw new Error('wrong fixture');
  state.putArea(areaA.area); state.putArea(areaB.area);
  assert.deepEqual(state.snapshot().islands.map((island) => island.key).sort(), ['3245_1', '9876_1']);
  state.endSession();
  assert.equal(state.snapshot().islands.length, 0);
  assert.equal(state.snapshot().sessionInstance, null);
});

test('manual stock session identity changes when a game session starts', () => {
  const state = new StateManager();
  state.setSession('Roma');
  const first = state.snapshot().sessionInstance;
  assert.ok(first);
  state.setSession('Roma');
  assert.notEqual(state.snapshot().sessionInstance, first);
  state.endSession();
  assert.equal(state.snapshot().sessionInstance, null);
});

test('area updates identify a session even when reconnect has no session start', () => {
  const state = new StateManager();
  const area = parseMessage(areaBody(3245, 1));
  if (area.type !== MessageType.AreaProductionStatistics) throw new Error('wrong fixture');
  state.putArea(area.area);
  const first = state.snapshot().sessionInstance;
  assert.ok(first);
  state.putArea(area.area);
  assert.equal(state.snapshot().sessionInstance, first);
});

test('community replay schema imports building and workforce data', () => {
  const real = readFileSync(new URL('../data/samples/replay_real.jsonl', import.meta.url), 'utf8');
  const frames = parseReplay(real);
  assert.equal(frames.length, 12);
  assert.equal(frames[0].sessionGuid, 3245);
  assert.equal(frames[0].entries[0].productGuid, 2068);
  assert.equal(frames[0].entries[0].amountOfBuildings, 6);
  assert.deepEqual(frames[0].entries[0].buildings, { '2200': 6 });
  assert.deepEqual(frames[0].entries[0].workforces, { '2181': 18 });
});

test('real replay frame survives binary mock encoding', () => {
  const real = readFileSync(new URL('../data/samples/replay_real.jsonl', import.meta.url), 'utf8');
  const area = parseReplay(real)[0];
  const messages = new FrameDecoder().push(Buffer.concat([encodeVersion(), encodeSessionStart('Test'), encodeArea(area)]));
  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0], { type: MessageType.Version, version: 2 });
  assert.deepEqual(messages[1], { type: MessageType.SessionStart, name: 'Test' });
  if (messages[2].type !== MessageType.AreaProductionStatistics) throw new Error('wrong message');
  assert.equal(messages[2].area.areaName, area.areaName);
  assert.equal(messages[2].area.entries.length, area.entries.length);
  assert.equal(messages[2].area.entries[0].productGuid, area.entries[0].productGuid);
});

test('pipe client receives mock frames end to end', { skip: process.platform !== 'win32' }, async () => {
  const real = readFileSync(new URL('../data/samples/replay_real.jsonl', import.meta.url), 'utf8');
  const area = parseReplay(real)[0];
  const path = String.raw`\\.\pipe\rationarium-test-${process.pid}-${Date.now()}`;
  const server = await startMockPipe(JSON.stringify(area), path, 250);
  const state = new StateManager();
  const client = new PipeClient(state, path);
  try {
    client.start();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for mock pipe')), 3000);
      state.on('change', (snapshot) => {
        if (snapshot.islands.length === 1) { clearTimeout(timeout); resolve(); }
      });
    });
    assert.equal(state.snapshot().connection, 'connected');
    assert.equal(state.snapshot().protocolVersion, 2);
    assert.equal(state.snapshot().islands[0].areaName, area.areaName);
    assert.equal(state.snapshot().islands[0].entries[0].productGuid, 2068);
  } finally {
    client.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
