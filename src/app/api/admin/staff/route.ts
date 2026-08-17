import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  adminAuthErrorResponse,
  requireAdminMfa,
} from "@/lib/auth/requireAdminMfa";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdminMfa(request);

    const { adminDb } = getFirebaseAdmin();

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "staff")
      .get();

    const staff = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    return Response.json({ staff });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHENTICATED") {
      return Response.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (message === "FORBIDDEN") {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    console.error("ERRO LISTAR STAFF:", error);

    return Response.json(
      {
        error: "Não foi possível carregar os funcionários.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminMfa(request);

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password || "";

    if (!name || !email || password.length < 6) {
      return Response.json(
        {
          error:
            "Nome, email e password de pelo menos 6 caracteres são obrigatórios.",
        },
        { status: 400 },
      );
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: "staff",
    });

    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      name,
      email,
      role: "staff",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      uid: userRecord.uid,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    console.error("ERRO CRIAR STAFF:", error);

    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHENTICATED") {
      return Response.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (message === "FORBIDDEN") {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    return Response.json(
      {
        error: "Não foi possível criar o funcionário.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminMfa(request);

    const body = (await request.json()) as {
      uid?: string;
      name?: string;
      email?: string;
      password?: string;
      active?: boolean;
    };

    const uid = body.uid?.trim();

    if (!uid) {
      return Response.json({ error: "Funcionário inválido." }, { status: 400 });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const currentUser = await adminAuth.getUser(uid);

    const authUpdate: {
      displayName?: string;
      email?: string;
      password?: string;
      disabled?: boolean;
    } = {};

    const firestoreUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.name === "string") {
      const name = body.name.trim();

      if (!name) {
        return Response.json(
          { error: "O nome é obrigatório." },
          { status: 400 },
        );
      }

      authUpdate.displayName = name;
      firestoreUpdate.name = name;
    }

    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();

      if (!email) {
        return Response.json(
          { error: "O email é obrigatório." },
          { status: 400 },
        );
      }

      authUpdate.email = email;
      firestoreUpdate.email = email;
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) {
        return Response.json(
          {
            error: "A nova password deve ter pelo menos 6 caracteres.",
          },
          { status: 400 },
        );
      }

      authUpdate.password = body.password;
    }

    if (typeof body.active === "boolean") {
      authUpdate.disabled = !body.active;
      firestoreUpdate.active = body.active;
    }

    await adminAuth.updateUser(uid, authUpdate);

    // Garantir que continua sempre Staff.
    await adminAuth.setCustomUserClaims(uid, {
      ...(currentUser.customClaims || {}),
      role: "staff",
    });

    await adminDb
      .collection("users")
      .doc(uid)
      .set(
        {
          ...firestoreUpdate,
          role: "staff",
        },
        { merge: true },
      );

    return Response.json({
      success: true,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    console.error("ERRO ATUALIZAR STAFF:", error);

    const message = error instanceof Error ? error.message : "UNKNOWN";

    if (message === "UNAUTHENTICATED") {
      return Response.json({ error: "Sessão inválida." }, { status: 401 });
    }

    if (message === "FORBIDDEN") {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    return Response.json(
      {
        error: "Não foi possível atualizar o funcionário.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminMfa(request);

    const body = (await request.json()) as {
      uid?: string;
    };

    const uid = body.uid?.trim();

    if (!uid) {
      return Response.json({ error: "Funcionário inválido." }, { status: 400 });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const userRecord = await adminAuth.getUser(uid);

    if (userRecord.customClaims?.role !== "staff") {
      return Response.json(
        {
          error: "Apenas contas de funcionário podem ser eliminadas aqui.",
        },
        { status: 403 },
      );
    }

    await adminAuth.deleteUser(uid);

    await adminDb.collection("users").doc(uid).delete();

    return Response.json({
      success: true,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    console.error("ERRO ELIMINAR STAFF:", error);

    return Response.json(
      {
        error: "Não foi possível eliminar o funcionário.",
      },
      { status: 500 },
    );
  }
}
