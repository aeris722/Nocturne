import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { key: text('key').primaryKey(), value: text('value').notNull() });
