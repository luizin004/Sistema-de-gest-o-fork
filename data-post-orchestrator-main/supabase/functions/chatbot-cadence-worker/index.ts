import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tenant-id, x-user-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip all non-digits, remove leading zeros, and ensure the number starts
 * with the Brazilian country code 55.
 */
function normalizePhone(rawPhone: string): string {
  const digits = (rawPhone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// ---------------------------------------------------------------------------
// check_cadence: find conversations that are overdue and enqueue cadence msgs
// ---------------------------------------------------------------------------

async function checkCadence(
  supabase: ReturnType<typeof createClient>
): Promise<{ enqueued: number; errors: string[] }> {
  let enqueued = 0;
  const errors: string[] = [];

  console.log("[CADENCE-CHECK] Starting cadence check...");

  // Fetch all active chatbot configs so we can look up per-tenant settings.
  const { data: configs, error: configsError } = await supabase
    .from("chatbot_config")
    .select(
      "id, tenant_id, cadence_timeout_hours, cadence_max_attempts, cadence_templates"
    );

  if (configsError) {
    const msg = `Failed to fetch chatbot_config: ${configsError.message}`;
    console.error(`[CADENCE-CHECK] ${msg}`);
    return { enqueued: 0, errors: [msg] };
  }

  if (!configs || configs.length === 0) {
    console.log("[CADENCE-CHECK] No chatbot configs found, nothing to check.");
    return { enqueued: 0, errors: [] };
  }

  for (const config of configs) {
    const tenantId: string = config.tenant_id;
    const cadenceTimeoutHours: number = config.cadence_timeout_hours ?? 24;
    const cadenceMaxAttempts: number = config.cadence_max_attempts ?? 3;
    const cadenceTemplates: string[] = Array.isArray(config.cadence_templates)
      ? config.cadence_templates
      : [];

    if (cadenceTemplates.length === 0) {
      console.log(
        `[CADENCE-CHECK] Tenant ${tenantId}: no cadence_templates configured, skipping.`
      );
      continue;
    }

    // Cutoff time: conversations whose last patient message is older than timeout
    const cutoffTime = new Date(
      Date.now() - cadenceTimeoutHours * 60 * 60 * 1000
    ).toISOString();

    const { data: conversations, error: convsError } = await supabase
      .from("chatbot_conversations")
      .select(
        "id, tenant_id, phone_number, cadence_attempts, last_patient_message_at, post_id"
      )
      .eq("tenant_id", tenantId)
      .eq("bot_active", true)
      .lt("last_patient_message_at", cutoffTime)
      .lt("cadence_attempts", cadenceMaxAttempts);

    if (convsError) {
      const msg = `Tenant ${tenantId}: failed to query conversations: ${convsError.message}`;
      console.error(`[CADENCE-CHECK] ${msg}`);
      errors.push(msg);
      continue;
    }

    if (!conversations || conversations.length === 0) {
      console.log(
        `[CADENCE-CHECK] Tenant ${tenantId}: no overdue conversations.`
      );
      continue;
    }

    console.log(
      `[CADENCE-CHECK] Tenant ${tenantId}: ${conversations.length} conversation(s) need cadence.`
    );

    for (const conv of conversations) {
      // Check whether there is already an unprocessed queue item for this
      // conversation to avoid double-enqueuing.
      const { data: existing, error: existingError } = await supabase
        .from("chatbot_cadence_queue")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("processed", false)
        .maybeSingle();

      if (existingError) {
        const msg = `Tenant ${tenantId}: error checking existing queue for conv ${conv.id}: ${existingError.message}`;
        console.error(`[CADENCE-CHECK] ${msg}`);
        errors.push(msg);
        continue;
      }

      if (existing) {
        console.log(
          `[CADENCE-CHECK] Conv ${conv.id}: already has pending queue item, skipping.`
        );
        continue;
      }

      // Rotate through templates based on how many attempts have been made.
      const templateIndex =
        (conv.cadence_attempts ?? 0) % cadenceTemplates.length;
      const messageTemplate = cadenceTemplates[templateIndex];

      const { error: insertError } = await supabase
        .from("chatbot_cadence_queue")
        .insert({
          tenant_id: tenantId,
          conversation_id: conv.id,
          phone_number: conv.phone_number,
          message_template: messageTemplate,
          post_id: conv.post_id ?? null,
          processed: false,
          created_at: new Date().toISOString(),
        });

      if (insertError) {
        const msg = `Tenant ${tenantId}: failed to insert queue item for conv ${conv.id}: ${insertError.message}`;
        console.error(`[CADENCE-CHECK] ${msg}`);
        errors.push(msg);
        continue;
      }

      enqueued++;
      console.log(
        `[CADENCE-CHECK] Conv ${conv.id}: enqueued cadence attempt ${(conv.cadence_attempts ?? 0) + 1} with template index ${templateIndex}.`
      );
    }
  }

  console.log(
    `[CADENCE-CHECK] Done. Enqueued: ${enqueued}, Errors: ${errors.length}.`
  );
  return { enqueued, errors };
}

// ---------------------------------------------------------------------------
// processQueue: send messages for all unprocessed queue items
// ---------------------------------------------------------------------------

async function processQueue(
  supabase: ReturnType<typeof createClient>
): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log("[CADENCE-QUEUE] Starting queue processing...");

  // Fetch all unprocessed queue items ordered oldest-first.
  const { data: queueItems, error: queueError } = await supabase
    .from("chatbot_cadence_queue")
    .select("*")
    .eq("processed", false)
    .order("created_at", { ascending: true });

  if (queueError) {
    const msg = `Failed to fetch cadence queue: ${queueError.message}`;
    console.error(`[CADENCE-QUEUE] ${msg}`);
    return { processed: 0, succeeded: 0, failed: 0, errors: [msg] };
  }

  if (!queueItems || queueItems.length === 0) {
    console.log("[CADENCE-QUEUE] No pending queue items.");
    return { processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  console.log(`[CADENCE-QUEUE] ${queueItems.length} item(s) to process.`);

  for (const item of queueItems) {
    const tenantId: string = item.tenant_id;
    const conversationId: string = item.conversation_id;
    const rawPhone: string = item.phone_number ?? "";
    const messageTemplate: string = item.message_template ?? "";
    const postId: string | null = item.post_id ?? null;

    const phoneNumber = normalizePhone(rawPhone);

    if (!phoneNumber) {
      const msg = `Queue item ${item.id}: empty phone number after normalization (raw: "${rawPhone}"), skipping.`;
      console.warn(`[CADENCE-QUEUE] ${msg}`);
      errors.push(msg);
      // Mark as processed to avoid infinite loop on bad data.
      await supabase
        .from("chatbot_cadence_queue")
        .update({ processed: true, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      processed++;
      failed++;
      continue;
    }

    // -----------------------------------------------------------------------
    // a) Fetch UAZAPI instance for tenant
    // -----------------------------------------------------------------------
    const { data: instance, error: instanceError } = await supabase
      .from("uazapi_instances")
      .select("token, api_url")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (instanceError || !instance) {
      const msg = `Queue item ${item.id}: no uazapi_instance found for tenant ${tenantId}: ${instanceError?.message ?? "no row"}`;
      console.error(`[CADENCE-QUEUE] ${msg}`);
      errors.push(msg);
      // Do not mark as processed; will retry next run.
      continue;
    }

    const uazapiToken: string = instance.token;
    const uazapiApiUrl: string =
      instance.api_url || "https://oralaligner.uazapi.com";
    const uazapiSendUrl = `${uazapiApiUrl}/send/text`;

    // -----------------------------------------------------------------------
    // b) Send message via UAZAPI
    // -----------------------------------------------------------------------
    let sendSuccess = false;
    let sendError = "";
    let uazapiResponse: Record<string, unknown> | null = null;

    try {
      const payload = {
        number: phoneNumber,
        text: messageTemplate,
      };

      console.log(
        `[CADENCE-QUEUE] Sending cadence to ${phoneNumber} via ${uazapiSendUrl}`
      );

      const response = await fetch(uazapiSendUrl, {
        method: "POST",
        headers: {
          "token": uazapiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (response.ok) {
        try {
          uazapiResponse = JSON.parse(responseText) as Record<string, unknown>;
        } catch {
          uazapiResponse = { raw: responseText };
        }
        sendSuccess = true;
        console.log(
          `[CADENCE-QUEUE] Sent to ${phoneNumber}: ${responseText.slice(0, 200)}`
        );
      } else {
        sendError = `HTTP ${response.status} | URL: ${uazapiSendUrl} | Response: ${responseText}`;
        console.error(
          `[CADENCE-QUEUE] Failed sending to ${phoneNumber}: ${sendError}`
        );
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendError = `Network error: ${errMsg} | URL: ${uazapiSendUrl}`;
      console.error(
        `[CADENCE-QUEUE] Network error for ${phoneNumber}: ${errMsg}`
      );
    }

    const now = new Date().toISOString();

    // -----------------------------------------------------------------------
    // c) Store sent message in uazapi_chat_messages
    // -----------------------------------------------------------------------
    const { error: msgInsertError } = await supabase
      .from("uazapi_chat_messages")
      .insert({
        tenant_id: tenantId,
        lead_id: null,
        phone_number: phoneNumber,
        direction: "outbound",
        sender: "bot",
        content: messageTemplate,
        media_url: null,
        media_type: null,
        status: sendSuccess ? "sent" : "failed",
        provider_id:
          (uazapiResponse?.messageid as string) ??
          (uazapiResponse?.id as string) ??
          null,
        message_type: "text",
        metadata: {
          wasSentByApi: true,
          source: "chatbot_cadence",
          conversation_id: conversationId,
          queue_item_id: item.id,
          post_id: postId,
          uazapi_response: uazapiResponse,
          error: sendSuccess ? undefined : sendError,
          sent_at: now,
        },
      });

    if (msgInsertError) {
      console.error(
        `[CADENCE-QUEUE] Failed to insert chat message for conv ${conversationId}: ${msgInsertError.message}`
      );
      // Non-fatal: continue with conversation update.
    }

    // -----------------------------------------------------------------------
    // d) Update chatbot_conversations: increment cadence_attempts, timestamp
    // -----------------------------------------------------------------------
    const { data: conversation, error: convFetchError } = await supabase
      .from("chatbot_conversations")
      .select("cadence_attempts")
      .eq("id", conversationId)
      .maybeSingle();

    if (convFetchError || !conversation) {
      const msg = `Queue item ${item.id}: conversation ${conversationId} not found: ${convFetchError?.message ?? "no row"}`;
      console.error(`[CADENCE-QUEUE] ${msg}`);
      errors.push(msg);
    } else {
      const newAttempts = (conversation.cadence_attempts ?? 0) + 1;

      // -----------------------------------------------------------------------
      // e) Fetch cadence_max_attempts from chatbot_config for this tenant
      // -----------------------------------------------------------------------
      const { data: config } = await supabase
        .from("chatbot_config")
        .select("cadence_max_attempts")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      const configMaxAttempts: number = config?.cadence_max_attempts ?? 3;
      const botShouldDeactivate = newAttempts >= configMaxAttempts;

      const convUpdate: Record<string, unknown> = {
        cadence_attempts: newAttempts,
        last_cadence_sent_at: now,
        updated_at: now,
      };

      if (botShouldDeactivate) {
        convUpdate.bot_active = false;
        console.log(
          `[CADENCE-QUEUE] Conv ${conversationId}: reached max attempts (${newAttempts}/${configMaxAttempts}), deactivating bot.`
        );
      }

      const { error: convUpdateError } = await supabase
        .from("chatbot_conversations")
        .update(convUpdate)
        .eq("id", conversationId);

      if (convUpdateError) {
        console.error(
          `[CADENCE-QUEUE] Failed to update conversation ${conversationId}: ${convUpdateError.message}`
        );
        errors.push(
          `Conv ${conversationId} update error: ${convUpdateError.message}`
        );
      }

      // -----------------------------------------------------------------------
      // e cont.) If max attempts reached and post exists, set posts.status = 'cadencia'
      // -----------------------------------------------------------------------
      if (botShouldDeactivate && postId) {
        const { error: postUpdateError } = await supabase
          .from("posts")
          .update({ status: "cadencia", updated_at: now })
          .eq("id", postId);

        if (postUpdateError) {
          console.error(
            `[CADENCE-QUEUE] Failed to update post ${postId} to 'cadencia': ${postUpdateError.message}`
          );
          errors.push(`Post ${postId} update error: ${postUpdateError.message}`);
        } else {
          console.log(
            `[CADENCE-QUEUE] Post ${postId} status set to 'cadencia'.`
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // f) Mark queue item as processed
    // -----------------------------------------------------------------------
    const { error: queueUpdateError } = await supabase
      .from("chatbot_cadence_queue")
      .update({ processed: true, updated_at: now })
      .eq("id", item.id);

    if (queueUpdateError) {
      console.error(
        `[CADENCE-QUEUE] Failed to mark queue item ${item.id} as processed: ${queueUpdateError.message}`
      );
      errors.push(`Queue item ${item.id} mark error: ${queueUpdateError.message}`);
    }

    processed++;
    if (sendSuccess) {
      succeeded++;
    } else {
      failed++;
      errors.push(
        `Queue item ${item.id} (phone: ${phoneNumber}): ${sendError}`
      );
    }

    // Small delay between sends to avoid rate limiting.
    await sleep(500);
  }

  console.log(
    `[CADENCE-QUEUE] Done. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${failed}.`
  );
  return { processed, succeeded, failed, errors };
}

// ---------------------------------------------------------------------------
// serve
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Basic auth gate: require the service role Authorization header or the
  // Supabase apikey header so that only authorised callers (cron / internal)
  // can trigger this worker.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: check cadence — find overdue conversations and enqueue messages.
    const checkResult = await checkCadence(supabase);

    // Step 2: process the queue — send all pending cadence messages.
    const processResult = await processQueue(supabase);

    return jsonResponse({
      ok: true,
      check_cadence: checkResult,
      process_queue: processResult,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[CADENCE-WORKER] Fatal error:", errMsg);
    return jsonResponse({ error: errMsg }, 500);
  }
});
