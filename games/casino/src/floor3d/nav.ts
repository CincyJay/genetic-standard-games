/**
 * Walking on the 3D floor: a walkability grid built from the layout's obstacles (inflated by
 * the avatar's radius), A* pathfinding over it, and string-pulling so the avatar walks in
 * straight lines instead of grid steps. Pure logic, no Three.js, so it is unit-tested.
 */
import { AGENT_RADIUS, OBSTACLES, ROOM, type Obstacle, type Vec2 } from './layout.ts';

export const CELL = 0.2;

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  readonly bounds: { x0: number; x1: number; z0: number; z1: number };
  readonly radius: number;
  private readonly obstacles: Obstacle[];

  constructor(bounds: { x0: number; x1: number; z0: number; z1: number } = ROOM, obstacles: Obstacle[] = OBSTACLES, radius = AGENT_RADIUS) {
    this.bounds = bounds;
    this.obstacles = obstacles;
    this.radius = radius;
    this.cols = Math.round((bounds.x1 - bounds.x0) / CELL);
    this.rows = Math.round((bounds.z1 - bounds.z0) / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const p = this.center(c, r);
        if (!this.pointFree(p)) this.blocked[r * this.cols + c] = 1;
      }
  }

  /** Is a point clear of walls and obstacles for an avatar standing there? */
  pointFree(p: Vec2): boolean {
    const r = this.radius;
    const b = this.bounds;
    if (p.x < b.x0 + r || p.x > b.x1 - r || p.z < b.z0 + r || p.z > b.z1 - r) return false;
    for (const o of this.obstacles) {
      if (o.kind === 'circle') {
        if (Math.hypot(p.x - o.x, p.z - o.z) < o.r + r) return false;
      } else {
        const dx = Math.max(o.x0 - p.x, 0, p.x - o.x1);
        const dz = Math.max(o.z0 - p.z, 0, p.z - o.z1);
        if (Math.hypot(dx, dz) < r) return false;
      }
    }
    return true;
  }

  center(c: number, r: number): Vec2 {
    return { x: this.bounds.x0 + (c + 0.5) * CELL, z: this.bounds.z0 + (r + 0.5) * CELL };
  }

  cellOf(p: Vec2): [number, number] {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((p.x - this.bounds.x0) / CELL)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((p.z - this.bounds.z0) / CELL)));
    return [c, r];
  }

  walkable(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked[r * this.cols + c] === 0;
  }

  walkableAt(p: Vec2): boolean {
    const [c, r] = this.cellOf(p);
    return this.walkable(c, r) && this.pointFree(p);
  }

  /** The walkable cell centre nearest to p (for taps on a table, a wall or outside the room). */
  nearestWalkable(p: Vec2): Vec2 | null {
    const [c0, r0] = this.cellOf(p);
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let ring = 0; ring < Math.max(this.cols, this.rows); ring++) {
      for (let r = r0 - ring; r <= r0 + ring; r++)
        for (let c = c0 - ring; c <= c0 + ring; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== ring || !this.walkable(c, r)) continue;
          const q = this.center(c, r);
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < bestD) [best, bestD] = [q, d];
        }
      // anything in a further ring is at least ring*CELL away
      if (best && bestD <= ring * CELL) break;
    }
    return best;
  }

  /** Can the avatar walk straight from a to b? Samples the line every half cell. */
  lineClear(a: Vec2, b: Vec2): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(d / (CELL / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.pointFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
    }
    return true;
  }

  /**
   * A walking path from `from` to `to` as a list of waypoints (excluding `from`), or null if
   * there is none. If `to` isn't walkable the path ends at the nearest walkable point.
   */
  findPath(from: Vec2, to: Vec2): Vec2[] | null {
    const goal = this.walkableAt(to) ? to : this.nearestWalkable(to);
    if (!goal) return null;
    if (this.lineClear(from, goal)) return [goal];
    const start = this.walkableAt(from) ? from : this.nearestWalkable(from);
    if (!start) return null;
    const [sc, sr] = this.cellOf(start);
    const [gc, gr] = this.cellOf(goal);
    const n = this.cols * this.rows;
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open = new MinHeap();
    const h = (c: number, r: number) => {
      const dx = Math.abs(c - gc);
      const dr = Math.abs(r - gr);
      return Math.max(dx, dr) + (Math.SQRT2 - 1) * Math.min(dx, dr);
    };
    const s = sr * this.cols + sc;
    if (s === gr * this.cols + gc) return [goal];
    g[s] = 0;
    open.push(s, h(sc, sr));
    const goalIdx = gr * this.cols + gc;
    while (open.size) {
      const cur = open.pop();
      if (cur === goalIdx) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cc = cur % this.cols;
      const cr = (cur - cc) / this.cols;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (!this.walkable(nc, nr)) continue;
          // no cutting corners between two blocked cells
          if (dc && dr && (!this.walkable(cc + dc, cr) || !this.walkable(cc, cr + dr))) continue;
          const ni = nr * this.cols + nc;
          const cost = g[cur] + (dc && dr ? Math.SQRT2 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            open.push(ni, cost + h(nc, nr));
          }
        }
    }
    if (came[goalIdx] === -1 && goalIdx !== s) return null;
    const cells: Vec2[] = [];
    for (let i = goalIdx; i !== -1 && i !== s; i = came[i]) cells.push(this.center(i % this.cols, Math.floor(i / this.cols)));
    cells.reverse();
    cells[cells.length - 1] = goal;
    return this.smooth(from, cells);
  }

  /** String-pulling: drop every waypoint the avatar can skip with a straight walk. */
  smooth(from: Vec2, pts: Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    let anchor = from;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(anchor, pts[j])) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /**
   * Moves from p by (dx, dz), sliding along walls and obstacles instead of stopping dead
   * (joystick walking). Returns the new position.
   */
  slide(p: Vec2, dx: number, dz: number): Vec2 {
    const full = { x: p.x + dx, z: p.z + dz };
    if (this.pointFree(full)) return full;
    const xOnly = { x: p.x + dx, z: p.z };
    if (this.pointFree(xOnly)) return xOnly;
    const zOnly = { x: p.x, z: p.z + dz };
    if (this.pointFree(zOnly)) return zOnly;
    return p;
  }
}

/** A small binary heap of (index, priority) for A*. */
class MinHeap {
  private idx: number[] = [];
  private pri: number[] = [];
  get size(): number {
    return this.idx.length;
  }
  push(i: number, p: number): void {
    this.idx.push(i);
    this.pri.push(p);
    let k = this.idx.length - 1;
    while (k > 0) {
      const up = (k - 1) >> 1;
      if (this.pri[up] <= this.pri[k]) break;
      this.swap(k, up);
      k = up;
    }
  }
  pop(): number {
    const top = this.idx[0];
    const lastI = this.idx.pop()!;
    const lastP = this.pri.pop()!;
    if (this.idx.length) {
      this.idx[0] = lastI;
      this.pri[0] = lastP;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < this.idx.length && this.pri[l] < this.pri[m]) m = l;
        if (r < this.idx.length && this.pri[r] < this.pri[m]) m = r;
        if (m === k) break;
        this.swap(k, m);
        k = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.idx[a], this.idx[b]] = [this.idx[b], this.idx[a]];
    [this.pri[a], this.pri[b]] = [this.pri[b], this.pri[a]];
  }
}
