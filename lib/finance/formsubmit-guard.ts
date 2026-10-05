/** ADV (finance advance) detection + session-id forcing for /api/formsubmit. */
export function isAdvTarget(opts: { formCode?: unknown; formId?: unknown }): boolean {
  const code = typeof opts.formCode === 'string' ? opts.formCode.trim().toUpperCase() : '';
  const id = typeof opts.formId === 'string' ? opts.formId.trim().toUpperCase() : '';
  return code === 'ADV' || id.startsWith('ADV-');
}

/** Returns a copy of body with created_by/updated_by forced to the session user when the target is ADV. */
export function forceAdvActor<T extends Record<string, any>>(
  body: T,
  employeeId: string,
  opts: { formId?: unknown },
): T {
  if (!body || typeof body !== 'object') return body;
  if (!isAdvTarget({ formCode: body.form_code, formId: opts.formId ?? body.form_id })) return body;
  const out: Record<string, any> = { ...body };
  if ('created_by' in out || !('updated_by' in out)) out.created_by = employeeId;
  out.updated_by = employeeId;
  return out as T;
}
