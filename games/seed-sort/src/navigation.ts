import type Phaser from 'phaser';
import { save } from './services.ts';
import { pendingBeats } from './story.ts';

/** Start a level, playing any story beats that are due first. Use this for every "play" path. */
export function goToLevel(scene: Phaser.Scene, level: number): void {
  const beats = pendingBeats(level, save.get().storySeen);
  if (beats.length > 0) scene.scene.start('story', { beats: beats.map((b) => b.key), level });
  else scene.scene.start('game', { level });
}
