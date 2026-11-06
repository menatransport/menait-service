'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, Loader2, PencilLine, ThumbsUp, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Mascot } from '@/components/mascot';
import { useSessionContext } from '@/app/context/SessionContext';
import {
    getMe, getMyItems, getReview, getReviewItems, saveLines, submitReview, decideReview, AccessReviewError,
    adminPreviewMe, adminPreviewItems,
} from './api';
import { Checklist, checklistSections, sectionTitle, type ChecklistSystemData } from './checklist';
import { Field, InlineConfirm, ReviewStatusPill, formatThaiDateTime } from './components';
import type { CatalogRole, Decision, ItemsResponse, MeResponse, ReviewDetail, ReviewLineInput, RoleItem, SystemCode } from './types';

const showAlert = (opts: Record<string, unknown>) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ confirmButtonText: 'ตกลง', ...opts }));
const showSuccess = (title: string) => import('sweetalert2').then(({ default: Swal }) => Swal.fire({ icon: 'success', title, timer: 1500, showConfirmButton: false }));

interface TickState {
    unchecked: Map<number, Set<number>>;
    decisions: Map<number, Decision>;
    /** user_role_id → items asked to be ADDED ("ต้องการเพิ่มสิทธิ์") */
    requested: Map<number, RoleItem[]>;
}

function initTicks(
    roles: { user_role_id: number; unchecked_item_ids?: number[]; decision: Decision | null }[],
    requested: Map<number, RoleItem[]>,
): TickState {
    const unchecked = new Map<number, Set<number>>();
    const decisions = new Map<number, Decision>();
    for (const r of roles) {
        unchecked.set(r.user_role_id, new Set(r.unchecked_item_ids ?? []));
        decisions.set(r.user_role_id, r.decision ?? 'keep');
    }
    return { unchecked, decisions, requested };
}

const requestedMap = (res: ItemsResponse) =>
    new Map(res.roles.filter(r => r.requested_items?.length).map(r => [r.user_role_id, r.requested_items!]));

function countRequested(ticks: TickState): number {
    let n = 0;
    for (const items of ticks.requested.values()) n += items.length;
    return n;
}

function countRemovals(systems: ChecklistSystemData[], ticks: TickState): number {
    let n = 0;
    for (const sys of systems) {
        for (const role of sys.roles) {
            if (role.items.length > 0) n += ticks.unchecked.get(role.user_role_id)?.size ?? 0;
            else if ((ticks.decisions.get(role.user_role_id) ?? 'keep') === 'remove') n += 1;
        }
    }
    return n;
}

function toLines(systems: ChecklistSystemData[], ticks: TickState): ReviewLineInput[] {
    const lines: ReviewLineInput[] = [];
    for (const sys of systems) {
        for (const role of sys.roles) {
            if (role.items.length > 0) {
                lines.push({
                    user_role_id: role.user_role_id,
                    unchecked_item_ids: Array.from(ticks.unchecked.get(role.user_role_id) ?? []),
                    requested_item_ids: (ticks.requested.get(role.user_role_id) ?? []).map(i => i.id),
                });
            } else {
                lines.push({ user_role_id: role.user_role_id, unchecked_item_ids: [], decision: ticks.decisions.get(role.user_role_id) ?? 'keep' });
            }
        }
    }
    return lines;
}

/** Header chrome shared by every state of the dialog — gradient hero + mascot, like gas-modal.png. */
function DialogHero({ title, sub, onClose }: { title: string; sub: string; onClose: () => void }) {
    return (
        <div className="relative shrink-0 overflow-hidden bg-linear-to-r from-brand-700 via-brand-600 to-brand-400 px-5 py-4 sm:px-6 sm:py-5">
            <div aria-hidden className="v2-orb absolute -right-10 -top-14 size-36 opacity-70" />
            <div className="relative flex items-start gap-3">
                <Mascot size={44} motion="none" className="shrink-0" />
                <div className="min-w-0 flex-1">
                    <DialogTitle className="font-display text-base sm:text-lg font-semibold text-white leading-tight">{title}</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm text-white/80">{sub}</DialogDescription>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-full bg-white/15 hover:bg-white/25 text-white p-1.5 transition-colors cursor-pointer"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}

function buildMineSystems(me: MeResponse, itemsByRole: Map<number, import('./types').RoleItem[]>): ChecklistSystemData[] {
    return me.systems.map(sys => ({
        code: sys.code,
        name: sys.name,
        roles: sys.roles.map(r => ({
            user_role_id: r.user_role_id,
            role_id: r.role_id,
            role_name: r.role_name,
            account_name: r.account_name,
            item_count: r.item_count,
            items: itemsByRole.get(r.user_role_id) ?? [],
        })),
    }));
}

function buildReviewSystems(detail: ReviewDetail, itemsByRole: Map<number, import('./types').RoleItem[]>): ChecklistSystemData[] {
    const map = new Map<string, ChecklistSystemData>();
    for (const l of detail.lines) {
        if (!map.has(l.system_code)) map.set(l.system_code, { code: l.system_code, name: l.system_name, roles: [] });
        map.get(l.system_code)!.roles.push({
            user_role_id: l.user_role_id,
            role_id: l.role_id,
            role_name: l.role_name,
            account_name: l.account_name,
            item_count: l.item_count,
            items: itemsByRole.get(l.user_role_id) ?? [],
        });
    }
    return Array.from(map.values());
}

const itemsMap = (res: { roles: { user_role_id: number; items: import('./types').RoleItem[] }[] }) =>
    new Map(res.roles.map(r => [r.user_role_id, r.items]));

/**
 * `previewEmployee` (IT admin only, used with dialogId="me"): shows that employee's own dialog exactly as
 * they see it, loaded from the read-only /admin/preview endpoints. Ticks work locally; nothing is saved.
 */
export function ReviewDialog({ dialogId, onClose, onChanged, previewEmployee }: {
    dialogId: string;
    onClose: () => void;
    onChanged: () => void;
    previewEmployee?: { employee_id: string; name: string };
}) {
    const { user } = useSessionContext();

    // 'mine' = editing/viewing my own current-cycle review via /me*; 'review' = someone else's
    // submitted review via /{id} (an approver's queue item, my own decided history, or an email link).
    const [mode, setMode] = useState<'loading' | 'mine' | 'review' | 'error' | 'forbidden'>('loading');
    const [errorText, setErrorText] = useState<string | null>(null);

    const [me, setMe] = useState<MeResponse | null>(null);
    const [detail, setDetail] = useState<ReviewDetail | null>(null);
    const [systems, setSystems] = useState<ChecklistSystemData[]>([]);
    const [ticks, setTicks] = useState<TickState>({ unchecked: new Map(), decisions: new Map(), requested: new Map() });
    const [requesterNote, setRequesterNote] = useState('');
    /** "ต้องการเพิ่มอีเมลกลุ่ม" — whole roles to join */
    const [requestedRoles, setRequestedRoles] = useState<CatalogRole[]>([]);
    const [approverComment, setApproverComment] = useState('');
    /** The approver changed the requester's ticks / add-requests — sent with the approval. */
    const [approverEdited, setApproverEdited] = useState(false);
    const [saving, setSaving] = useState(false);

    const loadMine = () => {
        const load = previewEmployee
            ? Promise.all([adminPreviewMe(previewEmployee.employee_id), adminPreviewItems(previewEmployee.employee_id)])
            : Promise.all([getMe(), getMyItems()]);
        load.then(([meRes, itemsRes]) => {
            setMe(meRes);
            const sys = buildMineSystems(meRes, itemsMap(itemsRes));
            setSystems(sys);
            setTicks(initTicks(sys.flatMap(s => s.roles).map(r => {
                const line = meRes.systems.flatMap(s => s.roles).find(x => x.user_role_id === r.user_role_id);
                return { user_role_id: r.user_role_id, unchecked_item_ids: line?.unchecked_item_ids ?? [], decision: line?.decision ?? null };
            }), requestedMap(itemsRes)));
            setRequesterNote(meRes.requester_note ?? '');
            setRequestedRoles(meRes.requested_roles ?? []);
            setMode('mine');
        }).catch(err => {
            setErrorText(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
            setMode('error');
        });
    };

    useEffect(() => {
        if (dialogId === 'me') { loadMine(); return; }
        const numId = Number(dialogId);
        if (!Number.isFinite(numId)) { setMode('error'); setErrorText('ไม่พบคำขอนี้'); return; }

        getReview(numId).then(d => {
            // If this numeric id turns out to be my own (still draft, or sent back for edits),
            // editing only works through the /me endpoints — hand off to the 'mine' flow.
            if (user && d.requester.employee_id === user.employee_id && (d.status === 'draft' || d.status === 'rejected')) {
                loadMine();
                return;
            }
            setDetail(d);
            setRequestedRoles(d.requested_roles ?? []);
            getReviewItems(numId).then(itemsRes => {
                const sys = buildReviewSystems(d, itemsMap(itemsRes));
                setSystems(sys);
                setTicks(initTicks(d.lines.map(l => ({ user_role_id: l.user_role_id, unchecked_item_ids: l.unchecked_item_ids ?? [], decision: l.decision })), requestedMap(itemsRes)));
                setMode('review');
            }).catch(err => { setErrorText(err instanceof Error ? err.message : 'โหลดรายละเอียดสิทธิ์ไม่สำเร็จ'); setMode('error'); });
        }).catch(err => {
            if (err instanceof AccessReviewError && err.status === 403) { setMode('forbidden'); setErrorText(err.message || 'คุณไม่มีสิทธิ์ดูคำขอนี้'); }
            else { setErrorText(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ'); setMode('error'); }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogId]);

    // Tabs of my own (editable) checklist — every one must be opened before "ยืนยัน".
    const [activeTab, setActiveTab] = useState<SystemCode | null>(null);
    const [visitedTabs, setVisitedTabs] = useState<Set<SystemCode>>(new Set());
    const mineTabs = useMemo(() => checklistSections(systems, true), [systems]);
    const currentTab = mineTabs.find(s => s.code === activeTab)?.code ?? mineTabs[0]?.code;
    const unseenTabs = useMemo(
        () => mineTabs.filter(s => s.code !== currentTab && !visitedTabs.has(s.code)),
        [mineTabs, currentTab, visitedTabs],
    );
    const selectTab = (code: SystemCode) => {
        setVisitedTabs(prev => new Set(prev).add(code).add(currentTab ?? code));
        setActiveTab(code);
    };
    const ensureAllTabsSeen = async () => {
        if (unseenTabs.length === 0) return true;
        await showAlert({
            icon: 'warning',
            title: 'กรุณาตรวจสอบสิทธิ์ให้ครบทุกแท็บ',
            text: `ยังไม่ได้เปิดดู: ${unseenTabs.map(sectionTitle).join(', ')} — ระบบจะเปิดแท็บให้ตรวจสอบก่อนยืนยัน`,
        });
        selectTab(unseenTabs[0].code);
        return false;
    };

    const removalCount = useMemo(() => countRemovals(systems, ticks), [systems, ticks]);
    const requestedCount = useMemo(() => countRequested(ticks) + requestedRoles.length, [ticks, requestedRoles]);

    const toggleItem = (userRoleId: number, itemId: number) => setTicks(prev => {
        const next = new Set(prev.unchecked.get(userRoleId) ?? []);
        if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
        const unchecked = new Map(prev.unchecked);
        unchecked.set(userRoleId, next);
        return { ...prev, unchecked };
    });

    const toggleMany = (userRoleId: number, itemIds: number[], checked: boolean) => setTicks(prev => {
        const next = new Set(prev.unchecked.get(userRoleId) ?? []);
        for (const id of itemIds) { if (checked) next.delete(id); else next.add(id); }
        const unchecked = new Map(prev.unchecked);
        unchecked.set(userRoleId, next);
        return { ...prev, unchecked };
    });

    const setRequested = (userRoleId: number, items: RoleItem[]) => setTicks(prev => {
        const requested = new Map(prev.requested);
        requested.set(userRoleId, items);
        return { ...prev, requested };
    });

    const setDecision = (userRoleId: number, decision: Decision) => setTicks(prev => {
        const decisions = new Map(prev.decisions);
        decisions.set(userRoleId, decision);
        return { ...prev, decisions };
    });

    const approverText = me
        ? (me.route_preview === 'bypass' ? 'อนุมัติทันทีหลังส่ง' : me.route_preview === 'it_queue' ? 'ส่งให้ฝ่าย IT ตรวจสอบ'
            : me.approvers_preview.length ? `ส่งให้: ${me.approvers_preview.map(a => a.name).join(', ')}` : 'ระบบจะหาผู้อนุมัติให้โดยอัตโนมัติ')
        : '';

    const saveDraft = async () => {
        setSaving(true);
        try {
            const data = await saveLines(toLines(systems, ticks), requesterNote, requestedRoles.map(r => r.id));
            setMe(data);
            await showSuccess('บันทึกร่างแล้ว');
        } catch (err) {
            await showAlert({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
        } finally {
            setSaving(false);
        }
    };

    const submit = async () => {
        try {
            await submitReview(toLines(systems, ticks), requesterNote, requestedRoles.map(r => r.id));
            await showSuccess(me?.review?.status === 'rejected' ? 'ส่งทบทวนใหม่แล้ว' : 'ยืนยันสิทธิ์แล้ว');
            onChanged();
            onClose();
        } catch (err) {
            await showAlert({ icon: 'error', title: 'ยืนยันไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
            throw err;
        }
    };

    /** Approve — with the approver's edits when they changed anything (no reject: the approver fixes instead). */
    const approve = async () => {
        try {
            await decideReview(
                Number(dialogId), 'approve', approverComment.trim() || undefined,
                approverEdited ? { lines: toLines(systems, ticks), requested_role_ids: requestedRoles.map(r => r.id) } : undefined,
            );
            await showSuccess(approverEdited ? 'บันทึกการแก้ไขและอนุมัติแล้ว' : 'อนุมัติแล้ว');
            onChanged();
            onClose();
        } catch (err) {
            await showAlert({ icon: 'error', title: 'อนุมัติไม่สำเร็จ', text: err instanceof Error ? err.message : undefined });
            throw err;
        }
    };

    // Approver-side handlers: same edits as the requester's, flagging the review as edited.
    const edited = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => { setApproverEdited(true); fn(...args); };

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-3xl sm:max-w-3xl w-[calc(100%-1.5rem)] sm:w-full h-[92dvh] sm:h-[90vh] p-0 gap-0 rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col">
                {mode === 'loading' && (
                    <>
                        <DialogHero title="ยืนยันสิทธิ์การเข้าถึง" sub="กำลังโหลดข้อมูล..." onClose={onClose} />
                        <div className="flex flex-1 items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-brand-500" /></div>
                    </>
                )}

                {(mode === 'error' || mode === 'forbidden') && (
                    <>
                        <DialogHero title="ยืนยันสิทธิ์การเข้าถึง" sub=" " onClose={onClose} />
                        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 px-6 text-center">
                            <Mascot size={72} motion="bob" />
                            <p className="text-sm text-gray-600">{errorText}</p>
                        </div>
                    </>
                )}

                {mode === 'mine' && me && (() => {
                    const editable = !me.review || me.review.status === 'draft' || me.review.status === 'rejected';
                    return (
                        <>
                            <DialogHero
                                title="ยืนยันสิทธิ์การเข้าถึง"
                                sub={editable ? 'ติ๊กเลือกสิทธิ์ที่ต้องการ แล้วกดยืนยัน' : 'สรุปสิทธิ์ที่คุณส่งทบทวนแล้ว'}
                                onClose={onClose}
                            />
                            {previewEmployee && (
                                <div className="shrink-0 bg-amber-50 border-b border-amber-100 px-5 py-2.5 flex items-center gap-2 text-xs text-amber-800">
                                    <Eye className="size-4 shrink-0" />
                                    <span>ตัวอย่างหน้าจอของ <span className="font-semibold">{previewEmployee.name}</span> ({previewEmployee.employee_id}) · ดูอย่างเดียว การติ๊กในหน้านี้ไม่ถูกบันทึก</span>
                                </div>
                            )}
                            {me.review?.status === 'rejected' && me.review.comment && (
                                <div className="shrink-0 bg-rose-50 border-b border-rose-100 px-5 py-2.5 text-xs text-rose-700">
                                    <span className="font-semibold">เหตุผลที่ไม่อนุมัติ: </span>{me.review.comment}
                                </div>
                            )}
                            {!editable && me.review && (
                                <div className="shrink-0 bg-gray-50 border-b border-gray-100 px-5 py-2.5 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                                    <ReviewStatusPill status={me.review.status} />
                                    {me.review.status === 'pending' && (
                                        <span>{(me.review.next_approver_names?.length ? `รออนุมัติจาก: ${me.review.next_approver_names.join(', ')}` : approverText)}</span>
                                    )}
                                    {me.review.status === 'approved' && me.review.decided_at && <span>อนุมัติโดย {me.review.decided_by_name ?? '-'} · {formatThaiDateTime(me.review.decided_at)}</span>}
                                    {me.review.status === 'approved' && me.review.comment && <span>ความเห็นผู้อนุมัติ: {me.review.comment}</span>}
                                </div>
                            )}
                            <Checklist
                                systems={systems}
                                readOnly={!editable}
                                unchecked={ticks.unchecked}
                                decisions={ticks.decisions}
                                onToggleItem={editable ? toggleItem : undefined}
                                onToggleMany={editable ? toggleMany : undefined}
                                onDecision={editable ? setDecision : undefined}
                                requested={ticks.requested}
                                onRequestChange={editable ? setRequested : undefined}
                                requestedRoles={requestedRoles}
                                onRequestRolesChange={editable ? setRequestedRoles : undefined}
                                activeTab={currentTab}
                                onTabChange={selectTab}
                                unseenTabs={editable && !previewEmployee ? unseenTabs.map(s => s.code) : undefined}
                            />
                            <div className="shrink-0 border-t border-gray-100 px-5 py-3 space-y-2.5 bg-white">
                                <label className="block text-xs font-medium text-gray-500">ข้อเสนอแนะ (ผู้แจ้ง)
                                    <Textarea
                                        value={requesterNote}
                                        onChange={e => setRequesterNote(e.target.value)}
                                        disabled={!editable || Boolean(previewEmployee)}
                                        placeholder="พิมพ์ข้อความของคุณ..."
                                        className="mt-1 min-h-16 text-sm"
                                    />
                                </label>
                                {editable && !previewEmployee && (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <button type="button" disabled={saving} onClick={saveDraft} className="text-xs font-medium text-gray-400 hover:text-brand-600 cursor-pointer disabled:opacity-50">
                                            บันทึกร่าง
                                        </button>
                                        <InlineConfirm
                                            label={<><CheckCircle2 className="size-4" /> ยืนยัน</>}
                                            confirmLabel="ยืนยันส่ง"
                                            summary={<>จะยกเลิกสิทธิ์ {removalCount} รายการ{requestedCount > 0 && <> · ขอเพิ่ม {requestedCount} รายการ</>} · {approverText}</>}
                                            onConfirm={submit}
                                            onBeforeOpen={ensureAllTabsSeen}
                                            className="!bg-linear-to-r !from-mint-600 !to-mint-500 hover:!from-mint-700 hover:!to-mint-600 rounded-full px-6"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    );
                })()}

                {mode === 'review' && detail && (
                    <>
                        <DialogHero
                            title="ยืนยันสิทธิ์การเข้าถึง"
                            sub={detail.can_decide ? 'ตรวจสอบสิทธิ์ แก้ไขได้หากจำเป็น แล้วกดอนุมัติ' : `คำขอของ ${detail.requester.name}`}
                            onClose={onClose}
                        />
                        <div className="shrink-0 bg-gray-50 border-b border-gray-100 px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                            <ReviewStatusPill status={detail.status} />
                            <Field label="ผู้แจ้ง" value={detail.requester.name} />
                            <Field label="ส่งเมื่อ" value={formatThaiDateTime(detail.submitted_at)} />
                            {detail.requester_note && <Field label="ข้อเสนอแนะ (ผู้แจ้ง)" value={detail.requester_note} />}
                            {!detail.can_decide && detail.decided_at && <Field label={detail.status === 'approved' ? 'อนุมัติโดย' : 'ไม่อนุมัติโดย'} value={`${detail.decided_by_name ?? '-'} · ${formatThaiDateTime(detail.decided_at)}`} />}
                            {!detail.can_decide && detail.comment && <Field label="ความเห็น" value={detail.comment} />}
                        </div>
                        {detail.can_decide && (
                            <div className={`shrink-0 border-b px-5 py-2.5 flex items-start gap-2 text-xs ${approverEdited ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-brand-600/5 border-brand-100 text-brand-700'}`}>
                                <PencilLine className="size-4 shrink-0 mt-px" />
                                <span>
                                    {approverEdited
                                        ? <><span className="font-semibold">คุณแก้ไขสิทธิ์ของผู้ขอแล้ว</span> · ระบบจะบันทึกตามที่แก้ไขเมื่อกดอนุมัติ และผู้ขอจะเห็นว่าสิทธิ์ถูกแก้ไขโดยผู้อนุมัติ</>
                                        : <><span className="font-semibold">ผู้อนุมัติสามารถแก้ไขสิทธิ์ของผู้ขอได้</span> · ติ๊กออกรายการที่ไม่ควรได้รับ ติ๊กคืน หรือเพิ่มรายการที่ขอ แล้วกดอนุมัติ</>}
                                </span>
                            </div>
                        )}
                        <Checklist
                            systems={systems}
                            readOnly={!detail.can_decide}
                            unchecked={ticks.unchecked}
                            decisions={ticks.decisions}
                            onToggleItem={detail.can_decide ? edited(toggleItem) : undefined}
                            onToggleMany={detail.can_decide ? edited(toggleMany) : undefined}
                            onDecision={detail.can_decide ? edited(setDecision) : undefined}
                            requested={ticks.requested}
                            onRequestChange={detail.can_decide ? edited(setRequested) : undefined}
                            requestedRoles={requestedRoles}
                            onRequestRolesChange={detail.can_decide ? edited(setRequestedRoles) : undefined}
                        />
                        {detail.can_decide && (
                            <div className="shrink-0 border-t border-gray-100 px-5 py-3 space-y-2.5 bg-white">
                                <label className="block text-xs font-medium text-gray-500">ข้อเสนอแนะ (ผู้อนุมัติ)
                                    <Textarea
                                        value={approverComment}
                                        onChange={e => setApproverComment(e.target.value)}
                                        placeholder="ไม่บังคับ — เช่น เหตุผลที่แก้ไขสิทธิ์..."
                                        className="mt-1 min-h-16 text-sm"
                                    />
                                </label>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <InlineConfirm
                                        label={<><ThumbsUp className="size-4" /> อนุมัติ</>}
                                        confirmLabel="ยืนยันอนุมัติ"
                                        summary={approverEdited
                                            ? <>บันทึกสิทธิ์ตามที่คุณแก้ไข (ยกเลิก {removalCount} รายการ{requestedCount > 0 && <> · ขอเพิ่ม {requestedCount} รายการ</>}) และอนุมัติ?</>
                                            : 'ยืนยันอนุมัติคำขอทบทวนสิทธิ์นี้ตามที่ผู้ขอส่งมา?'}
                                        onConfirm={approve}
                                        className="!bg-linear-to-r !from-mint-600 !to-mint-500 hover:!from-mint-700 hover:!to-mint-600 rounded-full px-6"
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
