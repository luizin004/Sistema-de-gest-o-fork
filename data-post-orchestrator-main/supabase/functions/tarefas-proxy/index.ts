import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id, x-user-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TAREFAS_ADMIN_URL = Deno.env.get("TAREFAS_ADMIN_URL");
const TAREFAS_ADMIN_KEY = Deno.env.get("TAREFAS_ADMIN_KEY");

// Debug: log environment variables (remove in production)
console.log("ENV CHECK:", {
  SUPABASE_URL: !!SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY,
  TAREFAS_ADMIN_URL: TAREFAS_ADMIN_URL ? "SET" : "MISSING",
  TAREFAS_ADMIN_KEY: TAREFAS_ADMIN_KEY ? "SET" : "MISSING"
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verificar env vars primeiro
  if (!TAREFAS_ADMIN_URL || !TAREFAS_ADMIN_KEY) {
    console.error("Missing env vars:", {
      TAREFAS_ADMIN_URL: !!TAREFAS_ADMIN_URL,
      TAREFAS_ADMIN_KEY: !!TAREFAS_ADMIN_KEY
    });
    return new Response(JSON.stringify({ 
      error: "Server configuration error - Missing environment variables",
      details: {
        TAREFAS_ADMIN_URL: TAREFAS_ADMIN_URL ? "SET" : "MISSING",
        TAREFAS_ADMIN_KEY: TAREFAS_ADMIN_KEY ? "SET" : "MISSING"
      },
      message: "Configure TAREFAS_ADMIN_URL and TAREFAS_ADMIN_KEY in Supabase Dashboard"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // O sistema usa autenticação customizada, então o tenant_id vem nos headers
    const tenantId = req.headers.get("X-Tenant-Id");
    const userId = req.headers.get("X-User-Id");

    if (!tenantId || !userId) {
      return new Response(JSON.stringify({ error: "Missing tenant or user ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Proxy request:", { tenantId, userId, method: req.method });

    const url = new URL(req.url);
    const targetUrl = new URL(TAREFAS_ADMIN_URL);
    url.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    // Adicionar cliente_id aos query params para GET requests
    if (req.method === "GET") {
      targetUrl.searchParams.set("cliente_id", tenantId);
    }

    let body: any = undefined;
    let targetBody: string | undefined = undefined;

    if (req.method === "POST") {
      body = await req.json();
      if (body.action === "create") {
        body.cliente_id = tenantId;
      }
      targetBody = JSON.stringify(body);
    }

    const targetHeaders: HeadersInit = {
      "Authorization": `Bearer ${TAREFAS_ADMIN_KEY}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: targetHeaders,
      body: targetBody,
    });

    const responseData = await response.text();

    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    console.error("tarefas-proxy error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
