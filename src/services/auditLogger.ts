import { AuditLogEntry, UserRole } from '../types/ops';

/**
 * Fast simulated cryptographic hash (FNV-1a / Murmur derived 64-bit hex digest)
 * suitable for synchronous browser & node execution without async delays.
 */
function computeHashHex(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const part4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}`;
}

export const GENESIS_HASH = '00000000000000000000000000000000';

export function createAuditEntry(
  entries: AuditLogEntry[],
  actorRole: UserRole,
  action: string,
  details: string
): AuditLogEntry {
  const index = entries.length + 1;
  const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : GENESIS_HASH;
  const now = new Date();
  const timestamp = `${now.toISOString().replace('T', ' ').slice(0, 19)}Z`;

  const rawPayload = `${index}|${timestamp}|${actorRole}|${action}|${details}|${previousHash}`;
  const hash = computeHashHex(rawPayload);

  return {
    index,
    timestamp,
    actorRole,
    action,
    details,
    previousHash,
    hash,
  };
}

export function getInitialAuditLog(): AuditLogEntry[] {
  const initialActions: Array<{ role: UserRole; action: string; details: string; timeOffsetSec: number }> = [
    {
      role: 'Commander',
      action: 'SYSTEM_BOOT',
      details: 'VAYU-OPS Decision Support Engine initialized. Air-gapped enclave verified.',
      timeOffsetSec: 360,
    },
    {
      role: 'Planner',
      action: 'TELEMETRY_INGEST',
      details: 'Baseline feeds synchronized (Fleet: 10, Crew: 12, Ordnance: 3 Bases, Threat: 4 contacts).',
      timeOffsetSec: 240,
    },
    {
      role: 'Planner',
      action: 'OPTIMISER_EXEC',
      details: 'CP-SAT constraint assignment solver generated ATO Plan A (100% P1 coverage).',
      timeOffsetSec: 120,
    },
  ];

  let entries: AuditLogEntry[] = [];
  initialActions.forEach((item) => {
    const entry = createAuditEntry(entries, item.role, item.action, item.details);
    entries = [...entries, entry];
  });

  return entries;
}
