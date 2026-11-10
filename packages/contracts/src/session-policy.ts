/**
 * Session preset admission for the WorkDSH Host boundary.
 *
 * The source marker is a non-enumerable Symbol. It cannot arrive through the
 * JSON/HTTP client surface, so a caller must be a trusted Host plugin that
 * deliberately selects the expert or workbench creation path.
 */
export type TrustedSessionSource = 'expert' | 'workbench';

const sourceMarker = Symbol('workdsh.session-source');
const expertMarker = Symbol('workdsh.expert-session');
const workbenchMarker = Symbol('workdsh.workbench-session');

type SessionPresetRequest = { readonly agentPreset?: string };
type MarkedRequest = SessionPresetRequest & { readonly [sourceMarker]?: symbol };

function mark<T extends SessionPresetRequest>(request: T, marker: symbol): T {
  const copy = { ...request } as T & { [sourceMarker]?: symbol };
  Object.defineProperty(copy, sourceMarker, { configurable: false, enumerable: false, writable: false, value: marker });
  return copy;
}

export function withExpertSessionSource<T extends SessionPresetRequest>(request: T): T { return mark(request, expertMarker); }
export function withWorkbenchSessionSource<T extends SessionPresetRequest>(request: T): T { return mark(request, workbenchMarker); }

/** Return the effective preset, or throw for an untrusted exception preset. */
export function assertSessionPresetAdmission(request: SessionPresetRequest): string {
  const preset = request.agentPreset?.trim() || 'standard';
  const marker = (request as MarkedRequest)[sourceMarker];
  if (preset === 'standard' && marker === undefined) return preset;
  if (/^wd-exp-[a-z0-9-]+$/.test(preset) && marker === expertMarker) return preset;
  if (preset === 'cordis' && marker === workbenchMarker) return preset;
  throw new Error('session/preset-source-denied');
}

