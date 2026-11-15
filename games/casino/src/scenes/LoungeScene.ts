import Phaser from 'phaser';
import { avatarTexture } from '../ui/avatar.ts';
import { popIn } from '@tgs/kit';
import { online, type ChatMessage, type FriendRequest, type Presence, type Profile } from '../online.ts';
import { DISPLAY_FONT, GOLD, THEME, audio, haptics } from '../services.ts';
import { VW, backdrop, coinBar, frame, makeButton, screenDim, text } from '../ui/common.ts';
import { textInput } from '../ui/domInput.ts';

type Tab = 'chat' | 'friends' | 'messages';
const TAB_NAMES: Record<Tab, string> = { chat: 'LOBBY CHAT', friends: 'FRIENDS', messages: 'MESSAGES' };
const VIP_COLORS: Record<string, string> = { Bronze: '#e0a060', Silver: '#d8dde6', Gold: '#ffd75e', Platinum: '#9fe3e0', Diamond: '#c8b4ff' };
const QUICK = ['Good luck! 🍀', 'Nice win! 🎉', 'GG 👏', 'So close 😅', 'Hot table 🔥', 'Hi all 👋'];
const WHERE: Record<string, string> = {
  lobby: 'In the lobby', lounge: 'In the lounge', room: 'Browsing rooms', slots: 'Playing slots', blackjack: 'Playing blackjack', roulette: 'Playing roulette',
  baccarat: 'Playing baccarat', threecard: 'Playing Three Card Poker', war: 'Playing Casino War', craps: 'Playing craps', uth: "Playing Ultimate Hold'em",
  holdem: "Playing Hold'em", pokerlobby: 'In the poker room', videopoker: 'Playing video poker',
};

/**
 * The Lounge: lobby chat, friends (with online status and where they are),
 * and private messages. Tapping anyone opens their player card with Add friend,
 * Message, Block and Report. Works only with a connection; says so otherwise.
 */
export class LoungeScene extends Phaser.Scene {
  private tab: Tab = 'chat';
  private view: Phaser.GameObjects.Container | null = null;
  private tabBar: Phaser.GameObjects.Container | null = null;
  private subs: (() => void)[] = [];
  private inputs: HTMLElement[] = [];
  private top = 0;
  private bottom = 0;
  private dmWith: Profile | null = null;
  private requests: FriendRequest[] = [];
  private status!: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('lounge');
  }

  create(): void {
    const v = frame(this);
    this.top = v.top + 210;
    this.bottom = v.bottom;
    backdrop(this, 'room-lobby');
    this.add.rectangle(VW / 2, (v.top + v.bottom) / 2, v.right - v.left, v.bottom - v.top, 0x07030c, 0.72);
    coinBar(this, 'Lounge', () => this.scene.start('lobby'));
    this.status = text(this, VW / 2, this.top + 400, 'Connecting to the casino...', 36, '700', '#cbb6d6');
    this.events.once('shutdown', () => this.cleanup());
    online.start();
    void online.whenReady().then(() => {
      if (!this.scene.isActive()) return;
      this.status.setText('');
      if (!online.hasName) this.namePrompt();
      else this.open();
    });
    this.time.delayedCall(9000, () => {
      if (!online.ready && this.scene.isActive()) this.status.setText('No connection right now.\nThe Lounge needs the internet; the casino works without it.');
    });
    if (import.meta.env.DEV) (globalThis as Record<string, unknown>).__online = online;
    (globalThis as Record<string, unknown>).__lounge = {
      tab: (t: Tab) => this.switchTab(t),
      send: (t: string) => online.send('lobby', t),
      name: (n: string) => online.claimName(n).then((e) => (e ? e : (this.open(), null))),
    };
  }

  private cleanup(): void {
    this.subs.forEach((u) => u());
    this.subs = [];
    this.clearInputs();
  }

  private clearInputs(): void {
    this.inputs.forEach((i) => i.remove());
    this.inputs = [];
  }

  // ---------------------------------------------------------------- first visit
  private namePrompt(): void {
    const c = this.add.container(VW / 2, this.top + 520);
    this.prompt = c;
    const g = this.add.graphics();
    g.fillStyle(0x140a1e, 0.96);
    g.fillRoundedRect(-460, -330, 920, 660, 36);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(-460, -330, 920, 660, 36);
    c.add([g, text(this, 0, -250, 'Choose your name', 60, '900', GOLD, DISPLAY_FONT)]);
    c.add(text(this, 0, -170, 'This is how other players will see you\nin chat, at the tables and in the friends list.', 30, '600', '#cbb6d6'));
    const err = text(this, 0, 90, '', 30, '800', '#ff8a9a');
    c.add(err);
    const submit = async () => {
      const name = input.value.trim();
      err.setText('Saving...');
      const e = await online.claimName(name);
      if (e) {
        err.setText(e);
        audio.invalid();
        return;
      }
      audio.complete();
      c.destroy();
      this.clearInputs();
      this.open();
    };
    const input = textInput(this, VW / 2, this.top + 520 - 10, 700, 100, 'e.g. HighRoller77', () => void submit(), 20);
    this.inputs.push(input);
    c.add(makeButton(this, 0, 220, 'Save name', () => void submit(), { width: 460, height: 120, fontSize: 46, theme: THEME }));
    popIn(this, c);
  }

  // ---------------------------------------------------------------- tabs
  private open(): void {
    this.status.setText('');
    this.prompt?.destroy();
    this.prompt = null;
    online.setWhere('lounge');
    this.switchTab(this.tab);
  }

  private drawTabs(): void {
    this.tabBar?.destroy();
    const c = this.add.container(0, this.top + 40);
    this.tabBar = c;
    (Object.keys(TAB_NAMES) as Tab[]).forEach((t, i) => {
      const x = 60 + i * 330;
      const on = t === this.tab;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x6b2fb3 : 0x1a0e26, on ? 1 : 0.9);
      g.fillRoundedRect(x, -40, 310, 80, 16);
      g.lineStyle(3, 0xe9c86a, on ? 1 : 0.35);
      g.strokeRoundedRect(x, -40, 310, 80, 16);
      const z = this.add.zone(x + 155, 0, 310, 80).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        audio.tap();
        this.dmWith = null;
        this.switchTab(t);
      });
      c.add([g, text(this, x + 155, 0, TAB_NAMES[t], 28, '900', on ? '#ffffff' : '#b8a0d0').setLetterSpacing(2), z]);
      if (t === 'friends' && this.requests.length) {
        const b = this.add.graphics();
        b.fillStyle(0xff3b5c, 1);
        b.fillCircle(x + 290, -34, 22);
        c.add([b, text(this, x + 290, -34, String(this.requests.length), 24, '900', '#ffffff')]);
      }
    });
  }

  private switchTab(t: Tab): void {
    this.tab = t;
    this.subs.forEach((u) => u());
    this.subs = [];
    this.clearInputs();
    // keep the friend-request listener across tabs
    this.subs.push(
      online.watchRequests((r) => {
        const changed = r.map((x) => x.id).join() !== this.requests.map((x) => x.id).join();
        this.requests = r;
        if (!changed) return;
        // the friends list shows the requests, so redraw it; elsewhere just the badge
        if (this.tab === 'friends') this.time.delayedCall(0, () => this.switchTab('friends'));
        else this.drawTabs();
      }),
    );
    this.drawTabs();
    this.view?.destroy();
    this.view = this.add.container(0, 0);
    if (t === 'chat') this.chatView('lobby');
    else if (t === 'friends') this.friendsView();
    else if (this.dmWith) this.chatView(null, this.dmWith);
    else this.messagesView();
  }

  // ---------------------------------------------------------------- chat
  /** A chat feed with an input bar: the lobby room, or a private conversation. */
  private chatView(room: string | null, dm?: Profile): void {
    const v = this.view!;
    const listTop = this.top + 110 + (dm ? 70 : 0);
    const listBottom = this.bottom - 330;
    if (dm) {
      v.add(text(this, VW / 2, this.top + 125, `Private chat with ${dm.name}`, 32, '800', GOLD));
      const back = this.add.zone(110, this.top + 125, 200, 60).setInteractive({ useHandCursor: true });
      back.on('pointerup', () => {
        this.dmWith = null;
        this.switchTab('messages');
      });
      v.add([back, text(this, 110, this.top + 125, '‹ Back', 30, '800', '#cbb6d6')]);
    }
    const feed = this.add.container(0, 0);
    v.add(feed);
    const draw = (msgs: ChatMessage[]) => {
      feed.removeAll(true);
      if (!msgs.length) feed.add(text(this, VW / 2, (listTop + listBottom) / 2, dm ? 'Say hello!' : 'No messages yet. Be the first to say hi!', 32, '600', '#9a8aa8'));
      // newest at the bottom; fill upward until the space runs out
      let y = listBottom;
      for (let i = msgs.length - 1; i >= 0 && y > listTop + 60; i--) {
        const m = msgs[i]!;
        const mine = m.uid === online.uid;
        const body = text(this, 0, 0, m.text, 30, '600', '#f4ecf8').setWordWrapWidth(760).setOrigin(0, 0);
        const h = Math.max(96, body.height + 62);
        y -= h + 10;
        if (y < listTop) break;
        const row = this.add.container(0, y);
        const bg = this.add.graphics();
        bg.fillStyle(mine ? 0x3a1a5a : 0x1a1024, 0.88);
        bg.fillRoundedRect(40, 0, VW - 80, h, 22);
        row.add(bg);
        row.add(this.avatarImage(m.uid, m.avatar, 100, 48, 70));
        row.add(text(this, 156, 26, m.name, 28, '900', VIP_COLORS[m.vip] ?? '#ffffff').setOrigin(0, 0.5));
        const ago = Math.max(0, Math.round((Date.now() - m.at) / 60000));
        row.add(text(this, VW - 64, 26, ago < 1 ? 'now' : ago < 60 ? `${ago}m` : `${Math.round(ago / 60)}h`, 22, '600', '#8a7a98').setOrigin(1, 0.5));
        body.setPosition(156, 48);
        row.add(body);
        if (!mine) {
          const z = this.add.zone(VW / 2, h / 2, VW - 80, h).setInteractive({ useHandCursor: true });
          z.on('pointerup', () => void this.playerCard(m.uid, m));
          row.add(z);
        }
        feed.add(row);
      }
    };
    this.subs.push(dm ? online.watchDm(dm.uid, draw) : online.watchRoom(room!, draw));
    // quick chat chips
    QUICK.forEach((q, i) => {
      const x = 40 + (i % 3) * 336;
      const y = this.bottom - 290 + Math.floor(i / 3) * 74;
      const g = this.add.graphics();
      g.fillStyle(0x2a1a3a, 0.95);
      g.fillRoundedRect(x, y - 30, 320, 60, 30);
      g.lineStyle(2, 0xe9c86a, 0.5);
      g.strokeRoundedRect(x, y - 30, 320, 60, 30);
      const z = this.add.zone(x + 160, y, 320, 60).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => void this.post(q, dm));
      v.add([g, text(this, x + 160, y, q, 26, '700', '#ffffff'), z]);
    });
    const send = (val: string) => {
      void this.post(val, dm).then((ok) => {
        if (ok) input.value = '';
      });
    };
    const input = textInput(this, 410, this.bottom - 105, 740, 100, dm ? `Message ${dm.name}` : 'Say something to the casino...', send);
    this.inputs.push(input);
    v.add(makeButton(this, 905, this.bottom - 105, 'Send', () => send(input.value), { width: 230, height: 100, fontSize: 40, theme: THEME }));
  }

  private async post(t: string, dm?: Profile): Promise<boolean> {
    const err = dm ? await online.sendDm(dm.uid, t) : await online.send('lobby', t);
    if (err) {
      this.toast(err);
      audio.invalid();
      return false;
    }
    audio.tap();
    return true;
  }

  // ---------------------------------------------------------------- friends
  private friendsView(): void {
    const v = this.view!;
    let y = this.top + 130;
    // add a friend by username
    v.add(text(this, 60, y, 'Add a friend by name', 28, '800', '#cbb6d6').setOrigin(0, 0.5));
    y += 70;
    const find = async (val: string) => {
      const name = val.trim().toLowerCase();
      if (!name) return;
      const { doc, getDoc } = await import('firebase/firestore');
      const s = await getDoc(doc(online.db!, 'usernames', name)).catch(() => null);
      if (!s?.exists()) return this.toast('No player with that name');
      void this.playerCard(s.data().uid as string);
    };
    const input = textInput(this, 410, y, 740, 90, 'Username', (val) => void find(val), 20);
    this.inputs.push(input);
    v.add(makeButton(this, 905, y, 'Find', () => void find(input.value), { width: 230, height: 90, fontSize: 38, color: 0x5a1a8a, theme: THEME }));
    y += 90;
    // requests
    for (const r of this.requests) {
      const row = this.add.container(0, y);
      const g = this.add.graphics();
      g.fillStyle(0x2a1238, 0.95);
      g.fillRoundedRect(40, 0, VW - 80, 110, 22);
      row.add([g, text(this, 70, 55, `${r.fromName} wants to be friends`, 30, '800', '#ffffff').setOrigin(0, 0.5)]);
      row.add([
        makeButton(this, 760, 55, 'Accept', () => void online.accept(r).then(() => this.toast(`You and ${r.fromName} are friends`)), { width: 190, height: 80, fontSize: 30, color: 0x18a050, theme: THEME }),
        makeButton(this, 950, 55, 'Decline', () => void online.decline(r), { width: 170, height: 80, fontSize: 30, color: 0x2a2430, theme: THEME }),
      ]);
      v.add(row);
      y += 125;
    }
    const list = this.add.container(0, 0);
    v.add(list);
    const startY = y + 10;
    this.subs.push(
      online.watchFriends((uids) => {
        list.removeAll(true);
        if (!uids.length) {
          list.add(text(this, VW / 2, startY + 120, 'No friends yet.\nFind players by name, or tap someone in the chat.', 32, '600', '#9a8aa8'));
          return;
        }
        uids.slice(0, 9).forEach((uid, i) => {
          const ry = startY + i * 124;
          const row = this.add.container(0, ry);
          list.add(row);
          void online.getProfile(uid).then((p) => {
            if (!p || !row.active) return;
            const g = this.add.graphics();
            g.fillStyle(0x1a1024, 0.9);
            g.fillRoundedRect(40, 0, VW - 80, 110, 22);
            const dot = this.add.circle(150, 86, 13, 0x6a6a6a).setStrokeStyle(3, 0x1a1024);
            const where = text(this, 190, 76, 'Offline', 24, '600', '#8a7a98').setOrigin(0, 0.5);
            row.add([g, this.avatarImage(uid, p.avatar, 100, 55, 84), dot, text(this, 190, 36, p.name, 32, '900', VIP_COLORS[p.vip] ?? '#ffffff').setOrigin(0, 0.5), where]);
            this.subs.push(
              online.watchPresence(uid, (s: Presence | null) => {
                if (!row.active) return;
                const on = !!s?.online;
                dot.setFillStyle(on ? 0x2ee070 : 0x6a6a6a);
                where.setText(on ? (WHERE[s!.where] ?? 'Online') : 'Offline').setColor(on ? '#7dffb0' : '#8a7a98');
              }),
            );
            const z = this.add.zone(VW / 2, 55, VW - 80, 110).setInteractive({ useHandCursor: true });
            z.on('pointerup', () => void this.playerCard(uid));
            row.add(z);
          });
        });
      }),
    );
  }

  private messagesView(): void {
    const v = this.view!;
    v.add(text(this, VW / 2, this.top + 130, 'Private messages are between friends.\nPick a friend to chat with:', 30, '600', '#cbb6d6'));
    const list = this.add.container(0, 0);
    v.add(list);
    this.subs.push(
      online.watchFriends((uids) => {
        list.removeAll(true);
        if (!uids.length) list.add(text(this, VW / 2, this.top + 330, 'Add friends first (Friends tab).', 30, '600', '#9a8aa8'));
        uids.slice(0, 10).forEach((uid, i) => {
          const row = this.add.container(0, this.top + 230 + i * 124);
          list.add(row);
          void online.getProfile(uid).then((p) => {
            if (!p || !row.active) return;
            const g = this.add.graphics();
            g.fillStyle(0x1a1024, 0.9);
            g.fillRoundedRect(40, 0, VW - 80, 110, 22);
            row.add([g, this.avatarImage(uid, p.avatar, 100, 55, 84), text(this, 170, 55, p.name, 34, '900', '#ffffff').setOrigin(0, 0.5), text(this, VW - 80, 55, 'Chat ›', 30, '800', GOLD).setOrigin(1, 0.5)]);
            const z = this.add.zone(VW / 2, 55, VW - 80, 110).setInteractive({ useHandCursor: true });
            z.on('pointerup', () => {
              audio.tap();
              this.dmWith = p;
              this.switchTab('messages');
            });
            row.add(z);
          });
        });
      }),
    );
  }

  // ---------------------------------------------------------------- player card
  /** Another player's card: profile, online status, and Add friend / Message / Block / Report. */
  private async playerCard(uid: string, msg?: ChatMessage): Promise<void> {
    audio.tap();
    const p = await online.getProfile(uid);
    if (!p) return this.toast('Could not load that player');
    if (uid === online.uid) return this.toast("That's you!");
    this.inputs.forEach((i) => (i.style.visibility = 'hidden'));
    const dim = screenDim(this, 0.7, 300);
    const c = this.add.container(VW / 2, this.top + 640).setDepth(301);
    const g = this.add.graphics();
    g.fillStyle(0x140a1e, 0.98);
    g.fillRoundedRect(-460, -520, 920, 1040, 36);
    g.lineStyle(4, 0xe9c86a, 0.9);
    g.strokeRoundedRect(-460, -520, 920, 1040, 36);
    c.add(g);
    c.add(this.avatarImage(uid, p.avatar, 0, -390, 190));
    c.add(text(this, 0, -250, p.name, 56, '900', VIP_COLORS[p.vip] ?? GOLD, DISPLAY_FONT));
    const pres = text(this, 0, -195, '', 28, '700', '#8a7a98');
    c.add(pres);
    const unsub = online.watchPresence(uid, (s) => pres.setText(s?.online ? `● ${WHERE[s.where] ?? 'Online'}` : '○ Offline').setColor(s?.online ? '#7dffb0' : '#8a7a98'));
    const fav = WHERE[p.favorite]?.replace('Playing ', '') ?? '—';
    const stats: [string, string][] = [
      ['VIP level', `${p.vip} · Level ${p.level}`],
      ['Favorite game', fav.charAt(0).toUpperCase() + fav.slice(1)],
      ['Achievements', String(p.achievements)],
      ['Member since', new Date(p.since).toLocaleDateString()],
    ];
    stats.forEach(([k, val], i) => {
      const y = -120 + i * 66;
      c.add(text(this, -380, y, k, 30, '700', '#a898b0').setOrigin(0, 0.5));
      c.add(text(this, 380, y, val, 32, '900', '#ffffff').setOrigin(1, 0.5));
    });
    const close = () => {
      unsub();
      dim.destroy();
      c.destroy();
      this.inputs.forEach((i) => (i.style.visibility = 'visible'));
    };
    const act = (label: string, x: number, y: number, color: number, fn: () => void) =>
      c.add(makeButton(this, x, y, label, fn, { width: 400, height: 104, fontSize: 36, color, theme: THEME }));
    act('Add friend', -215, 200, 0x18a050, () => void online.requestFriend(uid).then((e) => (this.toast(e ?? 'Friend request sent'), close())));
    act('Message', 215, 200, 0x1a5ac8, () => {
      close();
      this.dmWith = p;
      this.switchTab('messages');
    });
    act(online.blocked.has(uid) ? 'Unblock' : 'Block', -215, 320, 0x2a2430, () => {
      const was = online.blocked.has(uid);
      void (was ? online.unblock(uid) : online.block(uid)).then(() => {
        this.toast(was ? `${p.name} unblocked` : `${p.name} is blocked. You won't see their messages.`);
        close();
        this.switchTab(this.tab);
      });
    });
    act('Report', 215, 320, 0xb8101e, () => {
      close();
      this.reportDialog(p, msg);
    });
    c.add(makeButton(this, 0, 445, 'Close', close, { width: 320, height: 90, fontSize: 34, color: 0x2a2430, theme: THEME }));
    popIn(this, c);
  }

  private reportDialog(p: Profile, msg?: ChatMessage): void {
    this.inputs.forEach((i) => (i.style.visibility = 'hidden'));
    const dim = screenDim(this, 0.7, 300);
    const c = this.add.container(VW / 2, this.top + 600).setDepth(301);
    const g = this.add.graphics();
    g.fillStyle(0x140a1e, 0.98);
    g.fillRoundedRect(-440, -420, 880, 840, 36);
    g.lineStyle(4, 0xb8101e, 0.9);
    g.strokeRoundedRect(-440, -420, 880, 840, 36);
    c.add([g, text(this, 0, -340, `Report ${p.name}`, 50, '900', '#ffffff', DISPLAY_FONT), text(this, 0, -270, 'What is the problem?', 30, '600', '#cbb6d6')]);
    const close = () => {
      dim.destroy();
      c.destroy();
      this.inputs.forEach((i) => (i.style.visibility = 'visible'));
    };
    ['Spam or scam', 'Harassment or hate', 'Inappropriate photo or name', 'Something else'].forEach((reason, i) => {
      c.add(
        makeButton(this, 0, -170 + i * 125, reason, () => {
          void online.report(p.uid, reason, msg).then(() => {
            this.toast('Thanks. Our team will review this report.');
            haptics.fire('success');
          });
          close();
        }, { width: 700, height: 104, fontSize: 34, color: 0x2a2430, theme: THEME }),
      );
    });
    c.add(makeButton(this, 0, 340, 'Cancel', close, { width: 320, height: 90, fontSize: 34, color: 0x5a1a8a, theme: THEME }));
    popIn(this, c);
  }

  // ---------------------------------------------------------------- helpers
  /** A round avatar: preset portrait, the player's photo where they allow it, or the monogram while loading or on failure. */
  private avatarImage(uid: string, avatar: string, x: number, y: number, size: number): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, 'av-default').setDisplaySize(size, size);
    // small faces (chat rows, lists) use the art pack's thumbnails; big ones the portraits
    const show = (v: string) => avatarTexture(this, v, (key) => img.active && img.setTexture(key).setDisplaySize(size, size), size <= 100);
    show(avatar);
    // a chat message carries the picture from when it was sent: swap in the sender's current one
    void online.currentAvatar(uid).then((now) => now && now !== avatar && show(now));
    return img;
  }

  private toast(msg: string): void {
    const t = text(this, VW / 2, this.top + 100, msg, 30, '800', '#ffffff').setDepth(400);
    const bg = this.add.graphics().setDepth(399);
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(VW / 2 - t.width / 2 - 24, this.top + 72, t.width + 48, 56, 28);
    this.tweens.add({ targets: [t, bg], alpha: 0, delay: 2200, duration: 400, onComplete: () => (t.destroy(), bg.destroy()) });
  }
}
