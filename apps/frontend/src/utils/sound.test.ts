import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playShotSound, __resetAudioContextForTests } from './sound';

function makeMockContext(state: 'running' | 'suspended' = 'running') {
  const osc = {
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const ctx = {
    state,
    currentTime: 0,
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => osc),
    createGain: vi.fn(() => gain),
    destination: {},
  };
  return { ctx, osc, gain };
}

describe('playShotSound', () => {
  beforeEach(() => {
    __resetAudioContextForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetAudioContextForTests();
  });

  it('plays a sound via the Web Audio API when available (AC14)', () => {
    const { ctx, osc } = makeMockContext();
    const Ctor = vi.fn(function (this: unknown) { return ctx; });
    vi.stubGlobal('AudioContext', Ctor);

    playShotSound();

    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalled();
    expect(osc.stop).toHaveBeenCalled();
  });

  it('resumes a suspended context (autoplay policy)', () => {
    const { ctx } = makeMockContext('suspended');
    vi.stubGlobal('AudioContext', vi.fn(function (this: unknown) { return ctx; }));

    playShotSound();

    expect(ctx.resume).toHaveBeenCalled();
  });

  it('does not throw when no AudioContext is available (AC16)', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    expect(() => playShotSound()).not.toThrow();
  });

  it('does not throw when audio construction fails (AC16)', () => {
    vi.stubGlobal('AudioContext', vi.fn(() => {
      throw new Error('autoplay blocked');
    }));

    expect(() => playShotSound()).not.toThrow();
  });
});
