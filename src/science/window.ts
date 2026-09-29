// Build 043: how far back the Discovery Test and Prosecutor look. Was hard-coded to 180 days.
// If less history exists, stages simply use what is there.
export const RESEARCH_WINDOW_DAYS = Number(process.env.RESEARCH_WINDOW_DAYS ?? 1095);
export const researchWindowStartMs = () => Date.now() - RESEARCH_WINDOW_DAYS * 24 * 3600_000;
