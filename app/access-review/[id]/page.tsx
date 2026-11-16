'use client';

import { useParams } from 'next/navigation';
import { AccessReviewHome } from '../home-view';

/**
 * Same home as /access-review, with the "ยืนยันสิทธิ์การเข้าถึง" dialog open for this id — so an
 * email link ("ดูรายละเอียด") lands on a real page. id is either "me" (the signed-in user's own
 * current-cycle review, edited through /me*) or a review id (someone else's submission, or an
 * approver's queue item) — see ReviewDialog for how the two are told apart.
 */
export default function AccessReviewDetailPage() {
    const params = useParams<{ id: string }>();
    return <AccessReviewHome dialogId={params.id} />;
}
