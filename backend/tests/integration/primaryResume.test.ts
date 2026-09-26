import { jest, it, expect, beforeEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: db.pool }));

// completeResumeUpload re-extracts text from S3. An empty body short-circuits the parse,
// so the upload path runs end to end against Postgres without a bucket or a PDF.
jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
    S3Client: class {
        async send() {
            return { Body: (async function* () {})() };
        }
    },
    GetObjectCommand: class {},
    PutObjectCommand: class {},
}));

const { getPrimaryResume, completeResumeUpload, listResumes, setPrimaryResume } = await import('../../src/services/resume/resume.service.ts');
const { getCandidateContext } = await import('../../src/services/candidateContext/candidateContext.service.ts');

const createUser = async () => {
    const { rows } = await db.pool.query(
        `INSERT INTO auth.users (raw_user_meta_data)
         VALUES ('{"first_name":"Test","last_name":"User","graduation_year":"2027"}'::jsonb)
         RETURNING id`
    );
    return rows[0].id as string;
};

const addResume = async (user_id: string, file_name: string, created_at: string) => {
    const resume_id = randomUUID();
    await db.pool.query(
        `INSERT INTO resumes (resume_id, key, created_at, user_id, file_name, file_size_bytes, resume_text, upload_complete, search_terms, interests)
         VALUES ($1, $2, $3, $4, $5, 1024, $6, true, '{}', '{}')`,
        [resume_id, `resumes/${resume_id}.pdf`, created_at, user_id, file_name, `text of ${file_name}`]
    );
    return resume_id;
};

const setPrimary = (user_id: string, resume_id: string | null) =>
    db.pool.query(`UPDATE preferences SET primary_resume_id = $1 WHERE user_id = $2`, [resume_id, user_id]);

const readPrimary = async (user_id: string) => {
    const { rows } = await db.pool.query(`SELECT primary_resume_id FROM preferences WHERE user_id = $1`, [user_id]);
    return rows[0]?.primary_resume_id ?? null;
};

describeWithDatabase('primary resume against Postgres', () => {
    let user: string;
    let older: string;
    let newer: string;

    beforeEach(async () => {
        user = await createUser();
        older = await addResume(user, 'older.pdf', '2026-01-01T00:00:00Z');
        newer = await addResume(user, 'newer.pdf', '2026-06-01T00:00:00Z');
    });

    it('rejects a primary that belongs to another user', async () => {
        const stranger = await createUser();
        const theirResume = await addResume(stranger, 'stranger.pdf', '2026-03-01T00:00:00Z');

        await expect(setPrimary(user, theirResume)).rejects.toMatchObject({ code: '23503' });
    });

    it('clears the pointer rather than failing when the chosen resume is deleted', async () => {
        await setPrimary(user, older);

        await db.pool.query(`DELETE FROM resumes WHERE resume_id = $1`, [older]);

        expect(await readPrimary(user)).toBeNull();
        const { rows } = await db.pool.query(`SELECT user_id FROM preferences WHERE user_id = $1`, [user]);
        expect(rows).toHaveLength(1);
    });

    it('getPrimaryResume prefers the chosen resume over a newer one', async () => {
        await setPrimary(user, older);

        expect((await getPrimaryResume(user)).resume_id).toBe(older);
    });

    it('getPrimaryResume falls back to the newest when no primary is set', async () => {
        expect(await readPrimary(user)).toBeNull();

        expect((await getPrimaryResume(user)).resume_id).toBe(newer);
    });

    it('getCandidateContext renders the chosen resume, not the newest', async () => {
        await setPrimary(user, older);

        const context = await getCandidateContext(user);

        expect(context.resume.resume_text).toBe('text of older.pdf');
    });

    it('getCandidateContext falls back to the newest when no primary is set', async () => {
        const context = await getCandidateContext(user);

        expect(context.resume.resume_text).toBe('text of newer.pdf');
    });

    it('listResumes returns the resumes newest first, flagging the chosen one', async () => {
        await setPrimary(user, older);

        const rows = await listResumes(user);

        expect(rows.map((row) => row.resume_id)).toEqual([newer, older]);
        expect(rows.map((row) => row.is_primary)).toEqual([false, true]);
    });

    it('listResumes flags nothing when no primary is set', async () => {
        const rows = await listResumes(user);

        expect(rows.every((row) => row.is_primary === false)).toBe(true);
    });

    it('setPrimaryResume moves the pointer', async () => {
        expect(await setPrimaryResume(older, user)).toEqual({ primary_resume_id: older });

        expect(await readPrimary(user)).toBe(older);
    });

    it('setPrimaryResume 404s on a resume the caller does not own, leaving the pointer alone', async () => {
        await setPrimary(user, older);
        const stranger = await createUser();
        const theirResume = await addResume(stranger, 'stranger.pdf', '2026-03-01T00:00:00Z');

        await expect(setPrimaryResume(theirResume, user)).rejects.toMatchObject({ status: 404 });

        expect(await readPrimary(user)).toBe(older);
    });

    it('setPrimaryResume rejects a resume whose upload never completed', async () => {
        const pending = randomUUID();
        await db.pool.query(
            `INSERT INTO resumes (resume_id, key, created_at, user_id, file_name, file_size_bytes, resume_text, upload_complete)
             VALUES ($1, $2, '2026-02-01T00:00:00Z', $3, 'pending.pdf', 1024, '', false)`,
            [pending, `resumes/${pending}.pdf`, user]
        );

        await expect(setPrimaryResume(pending, user)).rejects.toMatchObject({ status: 400 });

        expect(await readPrimary(user)).toBeNull();
    });

    it('completing an upload makes that resume the primary', async () => {
        await setPrimary(user, older);
        const uploaded = randomUUID();
        await db.pool.query(
            `INSERT INTO resumes (resume_id, key, created_at, user_id, file_name, file_size_bytes, resume_text, upload_complete, search_terms, interests)
             VALUES ($1, $2, '2026-02-01T00:00:00Z', $3, 'uploaded.pdf', 1024, '', false, '{}', '{}')`,
            [uploaded, `resumes/${uploaded}.pdf`, user]
        );

        await completeResumeUpload(uploaded, `resumes/${uploaded}.pdf`, user);

        expect(await readPrimary(user)).toBe(uploaded);
        expect((await getPrimaryResume(user)).resume_id).toBe(uploaded);
    });
});
