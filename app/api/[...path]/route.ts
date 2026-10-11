import { env } from 'cloudflare:workers';
import { handle } from '@/game/server.mjs';
export const GET = (request: Request) => handle(request, env);
export const POST = (request: Request) => handle(request, env);
