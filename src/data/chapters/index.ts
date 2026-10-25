import sample from './sample.json';

/** Raw chapter JSON, validated by `validateChapter` before use. */
export const CHAPTERS: Readonly<Record<string, unknown>> = { [sample.id]: sample };
export const SAMPLE_CHAPTER_ID = sample.id;
