import { jest, it, expect } from '@jest/globals';
import { describeWithDatabase, useTestDatabase } from './support/db.ts';

const db = useTestDatabase();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: db.pool }));

const { updateUser, getUser } = await import('../../src/services/user/user.service.ts');

const createUser = async () => {
    const { rows } = await db.pool.query(
        `INSERT INTO auth.users (raw_user_meta_data)
         VALUES ('{"first_name":"Ada","last_name":"Lovelace","graduation_year":"2027"}'::jsonb)
         RETURNING id`
    );
    return rows[0].id as string;
};

describeWithDatabase('updateUser against Postgres', () => {
    it('changes only the field it is given', async () => {
        const user = await createUser();

        const updated = await updateUser(user, 'Grace');

        expect(updated).toMatchObject({ first_name: 'Grace', last_name: 'Lovelace', grad_year: 2027 });
        expect(await getUser(user)).toMatchObject({ first_name: 'Grace', last_name: 'Lovelace', grad_year: 2027 });
    });

    it('keeps an edit made elsewhere when a later save touches a different field', async () => {
        const user = await createUser();

        await updateUser(user, undefined, 'Hopper');
        await updateUser(user, undefined, undefined, 2028);

        expect(await getUser(user)).toMatchObject({ first_name: 'Ada', last_name: 'Hopper', grad_year: 2028 });
    });
});
