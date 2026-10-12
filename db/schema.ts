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
  state: text('state').notNull(), preV2State:text('pre_v2_state'), version: integer('version').notNull(),
  mutation: text('mutation').notNull(), updated: integer('updated').notNull(),
  lastHumanActivityAt: integer('last_human_activity_at').notNull().default(0),
  expiresAt: integer('expires_at').notNull().default(0),
  activityVersion: integer('activity_version').notNull().default(0),
}, t => [index('room_updated').on(t.updated)]);

export const connections = sqliteTable('connections', {id:text('id').primaryKey(),session:text('session').notNull(),expires:integer('expires').notNull()},t=>[index('connection_session').on(t.session)]);

export const appControl = sqliteTable('app_control', {
  singleton: integer('singleton').primaryKey(), maintenance: integer('maintenance').notNull().default(0),
  resetId: text('reset_id'), startedAt: integer('started_at'),
});
export const resetSnapshots = sqliteTable('reset_snapshots', {
  id: text('id').primaryKey(), createdAt: integer('created_at').notNull(), completedAt: integer('completed_at'),
  roomCount: integer('room_count').notNull(), sessionCount: integer('session_count').notNull(),
});
export const resetRoomSnapshots = sqliteTable('reset_room_snapshots', {
  resetId: text('reset_id').notNull(), roomId: text('room_id').notNull(), payload: text('payload').notNull(),
});
export const resetSessionSnapshots = sqliteTable('reset_session_snapshots', {
  resetId: text('reset_id').notNull(), sessionId: text('session_id').notNull(), activeRoom: text('active_room').notNull(),
  controller: text('controller'), lease: integer('lease').notNull(), seen: integer('seen').notNull(),
});
