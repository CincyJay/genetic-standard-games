/**
 * Is this the 3D-floor prototype? True in the separate prototype app (`vite build --mode proto`,
 * installed as com.thegeneticstandard.velvetace.proto3d) and in the dev server with `?floor3d`.
 * The prototype opens on the 3D floor and stays out of the live online features; its only
 * sign-in to the live Firebase project is an anonymous one for dealer chat (dealerChat.ts).
 */
export const PROTO: boolean =
  import.meta.env.MODE === 'proto' || (import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('floor3d'));
