import type { DecodedIdToken } from "firebase-admin/auth";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = "AdminAuthError";
    this.status = status;
  }
}

export async function requireAdminMfa(
  request: Request,
): Promise<DecodedIdToken> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AdminAuthError("Sessão de administrador inválida.", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AdminAuthError("Sessão de administrador inválida.", 401);
  }

  const { adminAuth } = getFirebaseAdmin();

  let decoded: DecodedIdToken;

  try {
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new AdminAuthError("Sessão expirada ou inválida.", 401);
  }

  const email = decoded.email?.toLowerCase();

  const isAdmin =
    email === ADMIN_EMAIL.toLowerCase() || decoded.role === "admin";

  if (!isAdmin) {
    throw new AdminAuthError("Acesso administrativo não autorizado.", 403);
  }

  const secondFactor = decoded.firebase?.sign_in_second_factor;

  if (!secondFactor) {
    throw new AdminAuthError(
      "É necessária autenticação em dois fatores para esta operação.",
      403,
    );
  }

  return decoded;
}

export function adminAuthErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return null;
}
