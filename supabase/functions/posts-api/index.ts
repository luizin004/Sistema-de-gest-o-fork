import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const POSTS_API_TOKEN = Deno.env.get("POSTS_API_TOKEN") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase service credentials in environment variables");
}

const allowedFields = [
  "nome",
  "status",
  "data",
  "horario",
  "tratamento",
  "author_id",
  "telefone",
  "dentista",
  "data_marcada",
  "feedback",
  "campanha_id",
  "campanha_nome",
  "agendamento_id",
  "ultima_mensagem_at",
  "nao_respondeu",
  "source",
  "metadata"
];

function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, "");
  if (!cleaned) return null;
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `55${cleaned}`;
  }
  return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
}

function requireTenant(headers: Headers) {
  const tenantId = headers.get("x-tenant-id")?.trim();
  if (!tenantId) {
    throw new Response(JSON.stringify({ error: "Missing x-tenant-id header" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const providedToken = headers.get("x-api-key")?.trim();
  if (POSTS_API_TOKEN && providedToken !== POSTS_API_TOKEN) {
    throw new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return tenantId;
}

function sanitizePayload(input: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in input) {
      payload[key] = input[key];
    }
  }
  if (payload.telefone && typeof payload.telefone === "string") {
    payload.telefone = normalizePhone(payload.telefone) ?? payload.telefone;
  }
  return payload;
}

async function handleCreate(req: Request, tenantId: string) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!("nome" in body)) {
    return new Response(JSON.stringify({ error: "Field 'nome' is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const payload = sanitizePayload(body as Record<string, unknown>);
  const supabase = createServiceClient();

  const insertPayload = {
    ...payload,
    tenant_id: tenantId,
    telefone: payload.telefone ?? null
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("[posts-api] Error inserting post", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 201,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleList(req: Request, tenantId: string) {
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");
  const statusFilter = url.searchParams.get("status");
  const limit = Number(url.searchParams.get("limit")) || 50;

  let query = supabase
    .from("posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (phone) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      query = query.eq("telefone", normalized);
    } else {
      query = query.eq("telefone", phone);
    }
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[posts-api] Error fetching posts", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleUpdate(req: Request, tenantId: string) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("id" in body)) {
    return new Response(JSON.stringify({ error: "Field 'id' is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const id = (body as Record<string, unknown>)["id"];
  if (typeof id !== "string") {
    return new Response(JSON.stringify({ error: "Field 'id' must be a string" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const payload = sanitizePayload(body as Record<string, unknown>);
  delete payload.id;

  if (Object.keys(payload).length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("posts")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    console.error("[posts-api] Error updating post", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let tenantId: string;
  try {
    tenantId = requireTenant(req.headers);
  } catch (resp) {
    if (resp instanceof Response) {
      return resp;
    }
    console.error("[posts-api] Unexpected auth error", resp);
    return new Response(JSON.stringify({ error: "Authentication error" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    if (req.method === "POST") {
      return await handleCreate(req, tenantId);
    }

    if (req.method === "GET") {
      return await handleList(req, tenantId);
    }

    if (req.method === "PATCH") {
      return await handleUpdate(req, tenantId);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[posts-api] Unexpected error", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
