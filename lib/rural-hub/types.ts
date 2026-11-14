/** Result of sending the village feedback form. Lives outside the "use server"
 *  file because that file may export only async functions. */
export type FeedbackState = { ok: boolean; message: string };
