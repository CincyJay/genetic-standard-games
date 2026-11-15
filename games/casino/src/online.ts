/**
 * Online features (Firebase): an account per device (anonymous sign-in), a
 * public profile with a unique username, online status, chat rooms, friends,
 * blocking, reports and direct messages. Everything degrades quietly when
 * there is no connection: the casino itself never depends on it.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where, type Firestore, type Unsubscribe,
} from 'firebase/firestore';
import { getDatabase, onDisconnect, onValue, ref, serverTimestamp as rtdbTime, set, type Database } from 'firebase/database';
import config from '../firebase/web-config.json';
import { player, save, trophies } from './services.ts';

export interface Profile {
  uid: string;
  name: string;
  /** Preset face key ('av-ava') or a small photo data URL. */
  avatar: string;
  level: number;
  vip: string;
  favorite: string;
  achievements: number;
  since: number;
}

export interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  avatar: string;
  vip: string;
  text: string;
  at: number;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  fromName: string;
  status: 'pending' | 'accepted';
}

export interface Presence {
  online: boolean;
  where: string;
  at: number;
}

// a short list of words that never reach the chat (the rest is caught by reports)
const BLOCKED_WORDS = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'retard', 'whore', 'slut', 'dick', 'pussy', 'cock'];

/** Masks offensive words with asterisks. */
export function cleanText(text: string): string {
  let out = text.replace(/\s+/g, ' ').trim().slice(0, 200);
  for (const w of BLOCKED_WORDS) out = out.replace(new RegExp(w + '\\w*', 'gi'), (m) => '*'.repeat(m.length));
  return out;
}

/** Usernames: 3-20 letters, digits, underscores or dots. */
export function validName(name: string): string | null {
  if (!/^[A-Za-z0-9_.]{3,20}$/.test(name)) return 'Use 3-20 letters, numbers, _ or .';
  if (cleanText(name) !== name) return 'Please choose another name';
  return null;
}

class Online {
  app: FirebaseApp | null = null;
  db: Firestore | null = null;
  rtdb: Database | null = null;
  user: User | null = null;
  profile: Profile | null = null;
  blocked = new Set<string>();
  private readyWaiters: (() => void)[] = [];
  private lastSend = 0;

  get uid(): string | null {
    return this.user?.uid ?? null;
  }

  get ready(): boolean {
    return !!this.user;
  }

  /** Signs in (once per device) and keeps the profile and online status fresh. Safe to call when offline. */
  start(): void {
    if (this.app) return;
    try {
      this.app = initializeApp(config);
      this.db = getFirestore(this.app);
      this.rtdb = getDatabase(this.app);
      const auth = getAuth(this.app);
      onAuthStateChanged(auth, (u) => {
        this.user = u;
        if (u) void this.afterSignIn();
      });
      if (!auth.currentUser) void signInAnonymously(auth).catch(() => {});
    } catch {
      /* offline or misconfigured: the casino keeps working */
    }
  }

  /** Resolves once signed in (or immediately if already). */
  whenReady(): Promise<void> {
    if (this.ready && this.profile !== undefined) return Promise.resolve();
    return new Promise((r) => this.readyWaiters.push(r));
  }

  private async afterSignIn(): Promise<void> {
    const uid = this.uid!;
    try {
      const snap = await getDoc(doc(this.db!, 'profiles', uid));
      this.profile = snap.exists() ? (snap.data() as Profile) : null;
      const blocks = await getDocs(collection(this.db!, 'profiles', uid, 'blocked'));
      this.blocked = new Set(blocks.docs.map((d) => d.id));
    } catch {
      this.profile = null;
    }
    this.setWhere('lobby');
    if (this.profile) void this.publish();
    this.readyWaiters.splice(0).forEach((r) => r());
  }

  /** Has this player picked a username yet? */
  get hasName(): boolean {
    return !!this.profile?.name;
  }

  /**
   * Claims a username (unique, case-insensitive) and creates the profile.
   * Returns an error message, or null on success.
   */
  async claimName(name: string): Promise<string | null> {
    const bad = validName(name);
    if (bad) return bad;
    if (!this.db || !this.uid) return 'Not connected. Check your internet and try again.';
    const uid = this.uid;
    const key = name.toLowerCase();
    try {
      await runTransaction(this.db, async (tx) => {
        const claim = await tx.get(doc(this.db!, 'usernames', key));
        if (claim.exists() && claim.data().uid !== uid) throw new Error('taken');
        const old = this.profile?.name?.toLowerCase();
        if (old && old !== key) tx.delete(doc(this.db!, 'usernames', old));
        tx.set(doc(this.db!, 'usernames', key), { uid });
      });
    } catch (e) {
      return (e as Error).message === 'taken' ? 'That name is taken' : 'Could not save. Try again.';
    }
    save.update((d) => {
      d.name = name;
    });
    await this.publish(name);
    return null;
  }

  /** Writes the public profile from the local save (level, VIP, avatar, favourite game, achievements). */
  async publish(name = this.profile?.name ?? save.get().name ?? ''): Promise<void> {
    if (!this.db || !this.uid || !name) return;
    const d = save.get();
    const counts = d.gameCounts ?? {};
    const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    const p: Profile = {
      uid: this.uid,
      name,
      avatar: await smallAvatar(d.avatar ?? ''),
      level: player.level,
      vip: player.vip().name,
      favorite,
      achievements: trophies.all().length + Math.floor(player.level / 5),
      since: this.profile?.since ?? Date.now(),
    };
    this.profile = p;
    try {
      await setDoc(doc(this.db, 'profiles', this.uid), p);
    } catch {
      /* offline */
    }
  }

  /** Current profile pictures by player, re-read at most once a minute (chat rows show the latest picture). */
  private avatars = new Map<string, { at: number; p: Promise<string | null> }>();
  currentAvatar(uid: string): Promise<string | null> {
    if (uid === this.uid) return Promise.resolve(this.profile?.avatar ?? null);
    const hit = this.avatars.get(uid);
    if (hit && Date.now() - hit.at < 60_000) return hit.p;
    const p = this.getProfile(uid).then((pr) => pr?.avatar ?? null).catch(() => null);
    this.avatars.set(uid, { at: Date.now(), p });
    return p;
  }

  async getProfile(uid: string): Promise<Profile | null> {
    if (!this.db) return null;
    try {
      const s = await getDoc(doc(this.db, 'profiles', uid));
      return s.exists() ? (s.data() as Profile) : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------- presence
  /** Where the player is (lobby, blackjack, lounge...), shown to friends. */
  setWhere(where: string): void {
    if (!this.rtdb || !this.uid) return;
    const r = ref(this.rtdb, `status/${this.uid}`);
    void set(r, { online: true, where, at: rtdbTime() }).catch(() => {});
    void onDisconnect(r).set({ online: false, where: '', at: rtdbTime() }).catch(() => {});
  }

  watchPresence(uid: string, cb: (p: Presence | null) => void): Unsubscribe {
    if (!this.rtdb) return () => {};
    return onValue(ref(this.rtdb, `status/${uid}`), (s) => cb(s.val() as Presence | null), () => cb(null));
  }

  // ---------------------------------------------------------------- chat
  /** Live feed of the newest messages in a room (oldest first), without blocked players. */
  watchRoom(room: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
    if (!this.db) return () => {};
    const q = query(collection(this.db, 'rooms', room, 'messages'), orderBy('at', 'desc'), limit(40));
    return onSnapshot(
      q,
      (s) => {
        const msgs = s.docs
          .map((d) => {
            const v = d.data();
            return { id: d.id, uid: v.uid, name: v.name, avatar: v.avatar ?? '', vip: v.vip ?? '', text: v.text, at: v.at?.toMillis?.() ?? Date.now() } as ChatMessage;
          })
          .filter((m) => !this.blocked.has(m.uid))
          .reverse();
        cb(msgs);
      },
      () => cb([]),
    );
  }

  /** Sends a chat message (cleaned, at most one every two seconds). Returns an error message or null. */
  async send(room: string, text: string): Promise<string | null> {
    if (!this.db || !this.uid || !this.profile) return 'Not connected';
    const t = cleanText(text);
    if (!t) return 'Type a message first';
    if (Date.now() - this.lastSend < 2000) return 'Slow down a little';
    this.lastSend = Date.now();
    try {
      await addDoc(collection(this.db, 'rooms', room, 'messages'), {
        uid: this.uid, name: this.profile.name, avatar: this.profile.avatar, vip: this.profile.vip, text: t, at: serverTimestamp(),
      });
      return null;
    } catch {
      return 'Could not send. Try again.';
    }
  }

  // ---------------------------------------------------------------- friends, blocks, reports
  async requestFriend(to: string): Promise<string | null> {
    if (!this.db || !this.uid || !this.profile) return 'Not connected';
    if (to === this.uid) return "That's you!";
    try {
      await setDoc(doc(this.db, 'friendRequests', `${this.uid}_${to}`), { from: this.uid, to, fromName: this.profile.name, status: 'pending' });
      return null;
    } catch {
      return 'Could not send the request';
    }
  }

  /** Incoming requests, and accepted ones you sent (so you can add the friend on your side too). */
  watchRequests(cb: (incoming: FriendRequest[]) => void): Unsubscribe {
    if (!this.db || !this.uid) return () => {};
    const db = this.db;
    const uid = this.uid;
    const unIn = onSnapshot(query(collection(db, 'friendRequests'), where('to', '==', uid)), (s) =>
      cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FriendRequest, 'id'>) })).filter((r) => r.status === 'pending' && !this.blocked.has(r.from))),
    );
    // when someone accepts your request, add them to your own list and tidy up
    const unOut = onSnapshot(query(collection(db, 'friendRequests'), where('from', '==', uid), where('status', '==', 'accepted')), (s) => {
      for (const d of s.docs) {
        const r = d.data() as FriendRequest;
        void setDoc(doc(db, 'profiles', uid, 'friends', r.to), { since: Date.now() }).then(() => deleteDoc(d.ref)).catch(() => {});
      }
    });
    return () => {
      unIn();
      unOut();
    };
  }

  async accept(r: FriendRequest): Promise<void> {
    if (!this.db || !this.uid) return;
    await setDoc(doc(this.db, 'profiles', this.uid, 'friends', r.from), { since: Date.now() });
    await updateDoc(doc(this.db, 'friendRequests', r.id), { status: 'accepted' });
  }

  async decline(r: FriendRequest): Promise<void> {
    if (!this.db) return;
    await deleteDoc(doc(this.db, 'friendRequests', r.id));
  }

  watchFriends(cb: (uids: string[]) => void): Unsubscribe {
    if (!this.db || !this.uid) return () => {};
    return onSnapshot(collection(this.db, 'profiles', this.uid, 'friends'), (s) => cb(s.docs.map((d) => d.id)), () => cb([]));
  }

  async unfriend(uid: string): Promise<void> {
    if (!this.db || !this.uid) return;
    await deleteDoc(doc(this.db, 'profiles', this.uid, 'friends', uid));
  }

  async block(uid: string): Promise<void> {
    if (!this.db || !this.uid) return;
    this.blocked.add(uid);
    await setDoc(doc(this.db, 'profiles', this.uid, 'blocked', uid), { at: Date.now() });
    await this.unfriend(uid).catch(() => {});
  }

  async unblock(uid: string): Promise<void> {
    if (!this.db || !this.uid) return;
    this.blocked.delete(uid);
    await deleteDoc(doc(this.db, 'profiles', this.uid, 'blocked', uid));
  }

  /** Files a report for the moderators (the owner reads them in the Firebase console). */
  async report(target: string, reason: string, message?: ChatMessage): Promise<void> {
    if (!this.db || !this.uid) return;
    await addDoc(collection(this.db, 'reports'), {
      by: this.uid, target, reason, message: message ? { id: message.id, text: message.text } : null, at: serverTimestamp(),
    });
  }

  // ---------------------------------------------------------------- direct messages
  pairId(other: string): string {
    return [this.uid!, other].sort().join('_');
  }

  watchDm(other: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe {
    if (!this.db || !this.uid) return () => {};
    const q = query(collection(this.db, 'dms', this.pairId(other), 'messages'), orderBy('at', 'desc'), limit(40));
    return onSnapshot(
      q,
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, 'id'>), at: d.data().at?.toMillis?.() ?? Date.now() })).reverse()),
      () => cb([]),
    );
  }

  async sendDm(other: string, text: string): Promise<string | null> {
    if (!this.db || !this.uid || !this.profile) return 'Not connected';
    const t = cleanText(text);
    if (!t) return 'Type a message first';
    try {
      await addDoc(collection(this.db, 'dms', this.pairId(other), 'messages'), {
        uid: this.uid, name: this.profile.name, avatar: this.profile.avatar, vip: this.profile.vip, text: t, at: serverTimestamp(),
      });
      return null;
    } catch {
      return 'Could not send';
    }
  }
}

/**
 * Profile pictures go online small: a preset key as is, a photo shrunk to a
 * 96px round WebP (PNG where WebP isn't available), after it has decoded.
 */
async function smallAvatar(v: string): Promise<string> {
  if (!v.startsWith('data:')) return v;
  try {
    const img = new Image();
    img.src = v;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    c.getContext('2d')!.drawImage(img, 0, 0, 96, 96);
    const webp = c.toDataURL('image/webp', 0.82);
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png');
  } catch {
    return '';
  }
}

export const online = new Online();
