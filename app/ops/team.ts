'use client';

import { useEffect, useState } from 'react';
import type { UserInfo } from '@/app/context/SessionContext';
import type { OpsPerson } from './types';

/** People who can be assigned to an OPS project (IT-system usernames). Keep in sync with AssignInput in the schema. */
export const OPS_TEAM_USERNAMES = ['patcharapan.p', 'narongkorn.a', 'sutiwat.c', 'kittaboon.l'] as const;

/** Admins and the OPS team may move cards and assign people. */
export const canManageOps = (user: UserInfo | null) =>
    Boolean(user && (user.role === 'a' || (OPS_TEAM_USERNAMES as readonly string[]).includes(user.username?.toLowerCase())));

interface ItUser {
    employee_id: string;
    username?: string | null;
    email?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    position?: string | null;
    department?: string | null;
    image_url?: string | null;
}

const placeholder = (username: string): OpsPerson => ({ employee_id: username, username, name: username, image_url: null });

// One fetch per page load, shared by every card
let teamPromise: Promise<OpsPerson[]> | null = null;

function loadTeam(): Promise<OpsPerson[]> {
    teamPromise ??= fetch('/api/organization/user')
        .then(res => (res.ok ? res.json() : []))
        .then((users: ItUser[]) => OPS_TEAM_USERNAMES.map(username => {
            const u = users.find(x =>
                x.username?.toLowerCase() === username || x.email?.toLowerCase().split('@')[0] === username);
            if (!u) return placeholder(username);
            return {
                employee_id: u.employee_id,
                username,
                name: `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || username,
                image_url: u.image_url ?? null,
                department: u.department ?? null,
                position: u.position ?? null,
            };
        }))
        .catch(() => {
            teamPromise = null; // allow a retry on next mount
            return OPS_TEAM_USERNAMES.map(placeholder);
        });
    return teamPromise;
}

/** The assignable OPS team with names/photos from the IT system (placeholders until loaded). */
export function useOpsTeam() {
    const [team, setTeam] = useState<OpsPerson[]>(() => OPS_TEAM_USERNAMES.map(placeholder));
    useEffect(() => {
        let alive = true;
        loadTeam().then(t => { if (alive) setTeam(t); });
        return () => { alive = false; };
    }, []);
    return team;
}

/** Prefer the live IT-system profile (photo, current name) over the snapshot stored on the project. */
export const resolvePerson = (p: OpsPerson, team: OpsPerson[]) =>
    team.find(t => t.username && t.username === p.username) ?? p;
