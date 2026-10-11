import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), name: text('name').notNull(),
  activeRoom: text('active_room'), controller: text('controller'),
  lease: integer('lease').notNull().default(0), seen: integer('seen').notNull(),
  created: integer('created').notNull(), rateAt: integer('rate_at').notNull().default(0),
  rateCount: integer('rate_count').notNull().default(0),
}, t => [index('session_room').on(t.activeRoom)]);
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(), name: text('name').notNull(),
  capacity: integer('capacity').notNull(), status: text('status').notNull(),
  state: text('state').notNull(), version: integer('version').notNull(),
  mutation: text('mutation').notNull(), updated: integer('updated').notNull(),
}, t => [index('room_updated').on(t.updated)]);
