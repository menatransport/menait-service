'use client';

import { AccessReviewHome } from './home-view';

/** "ระบบทบทวนสิทธิ์" — one page, no checklist dialog open. See app/access-review/[id]/page.tsx. */
export default function AccessReviewPage() {
    return <AccessReviewHome dialogId={null} />;
}
