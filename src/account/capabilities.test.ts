import { describe, expect, it } from 'vitest';
import type { Organization } from '../core';
import { capabilitiesOf, isFaction, type CapabilityInput } from './capabilities';

const MVD: Organization = { id: 'mvd', name: 'МВД', kind: 'state', documents: [] };
const NONE: Organization = { id: 'none', name: 'Без организации', documents: [] };
const player: CapabilityInput = { signedIn: true, roles: [], admin: false, server: 'tverskoi', organization: MVD };
const all = (input: CapabilityInput) => [...capabilitiesOf(input)].sort();

describe('what a player may do (roadmap 1А)', () => {
  it('gives nothing signed out, whatever was known of them', () => {
    expect(all({ ...player, signedIn: false, admin: true, roles: [{ server: 'tverskoi', organization: 'mvd', role: 'leader' }] })).toEqual([]);
  });

  it('lets a player of a faction read its memos and ask to lead it', () => {
    expect(all(player)).toEqual(['faction.lead-request', 'memos.read']);
  });

  it('gives a player without a faction nothing of one', () => {
    expect(all({ ...player, organization: NONE })).toEqual([]);
    expect(all({ ...player, organization: undefined })).toEqual([]);
    expect(isFaction(NONE)).toBe(false);
    expect(isFaction(MVD)).toBe(true);
  });

  it('lets the leader write, remove any memo and name deputies — no request for what they are', () => {
    const leader = { ...player, roles: [{ server: 'tverskoi', organization: 'mvd', role: 'leader' as const }] };
    expect(all(leader)).toEqual(['faction.deputies', 'memos.moderate', 'memos.read', 'memos.write']);
  });

  it('lets a deputy write', () => {
    const deputy = { ...player, roles: [{ server: 'tverskoi', organization: 'mvd', role: 'deputy' as const }] };
    expect(all(deputy)).toEqual(['memos.read', 'memos.write']);
  });

  it('counts a role only where it was given: on its server, in its faction', () => {
    const elsewhere = { ...player, roles: [{ server: 'arbatskiy', organization: 'mvd', role: 'leader' as const }, { server: 'tverskoi', organization: 'fsb', role: 'leader' as const }] };
    expect(all(elsewhere)).toEqual(['faction.lead-request', 'memos.read']);
  });

  it('gives the admin their part of the settings, with or without a faction', () => {
    expect(all({ ...player, organization: NONE, admin: true })).toEqual(['admin']);
  });
});
