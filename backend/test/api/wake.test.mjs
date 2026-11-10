// /health never touches the database; /wake runs one trivial query and is
// rate-limited.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { api, pool, uniqueIp } from '../helpers.mjs';

afterAll(() => pool.end());

describe('/health', () => {
  it('answers without any database query', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      const res = await api().get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('still answers when the database is unavailable', async () => {
    const spy = vi.spyOn(pool, 'query').mockRejectedValue(new Error('database asleep'));
    try {
      expect((await api().get('/health')).status).toBe(200);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('/wake', () => {
  it('runs exactly one trivial query and says the server is awake', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      const res = await api().get('/wake');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'awake' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('SELECT 1');
    } finally {
      spy.mockRestore();
    }
  });

  it('reports a database failure as a clean 500', async () => {
    const spy = vi.spyOn(pool, 'query').mockRejectedValue(new Error('connection refused'));
    try {
      const res = await api().get('/wake');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    } finally {
      spy.mockRestore();
    }
  });

  it('is rate-limited (30 a minute per address)', async () => {
    const ip = uniqueIp();
    const statuses = [];
    for (let i = 0; i < 31; i += 1) statuses.push((await api(undefined, { ip }).get('/wake')).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});

describe('/config', () => {
  it('needs no session and no database', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      expect((await api().get('/config')).status).toBe(200);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
