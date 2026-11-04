import { createContext, useContext, type ReactNode } from 'react';

/**
 * G1 «Focus» has no WebGL background: it was slow and fought with the paper look.
 * This file keeps the old tiny API (useWorld / useWorldScene) as no-ops so older pages compile unchanged.
 */
export type Scene = { shape: string; x?: number; y?: number; scale?: number; opacity?: number; anchor?: HTMLElement | null; anchorFit?: number; corner?: 'end-bottom' | 'center' };
type Ctx = { setScene: (s: Scene) => void; burst: () => void; setDimmed: (d: boolean) => void };
const noop = () => {};
const WorldCtx = createContext<Ctx>({ setScene: noop, burst: noop, setDimmed: noop });

export function WorldProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export const useWorld = () => useContext(WorldCtx);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useWorldScene(_scene: Scene, _deps: unknown[] = []) { /* no background scene in G1 */ }
