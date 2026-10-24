import type { IncomingMessage, ServerResponse } from 'node:http';

export type Role = 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  index_number?: string | null;
}

export interface ApiRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
  user?: SessionUser;
}

export interface ApiResponse extends ServerResponse {
  status: (statusCode: number) => ApiResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string | number | readonly string[]) => this;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<any> | any;
