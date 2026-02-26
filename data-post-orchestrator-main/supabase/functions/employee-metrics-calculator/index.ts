import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();
    const targetDate = date ? new Date(date) : new Date();
    
    console.log(`Calculating metrics for date: ${targetDate.toISOString()}`);
    
    // Definir período do dia
    const startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);
    
    const sources = ['crm', 'web', 'android'];
    const results = [];
    
    for (const source of sources) {
      console.log(`Processing source: ${source}`);
      
      // Buscar todas as mensagens do dia para esta fonte
      const { data: messages, error: messagesError } = await supabase
        .from('uazapi_chat_messages')
        .select('*')
        .eq('direction', 'outbound')
        .eq('metadata->>wasSentByApi', 'false')
        .eq('metadata->>source', source)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (messagesError) {
        console.error(`Error fetching messages for ${source}:`, messagesError);
        continue;
      }
      
      if (!messages || messages.length === 0) {
        console.log(`No messages found for ${source}`);
        continue;
      }
      
      console.log(`Found ${messages.length} messages for ${source}`);
      
      // Calcular métricas
      const metrics = calculateMetrics(messages, targetDate, source);
      
      // Salvar métricas
      const { error: insertError } = await supabase
        .from('employee_metrics')
        .upsert(metrics, { onConflict: 'metric_date,employee_source' });
      
      if (insertError) {
        console.error(`Error saving metrics for ${source}:`, insertError);
        continue;
      }
      
      results.push(metrics);
      console.log(`Metrics saved for ${source}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        date: targetDate.toISOString().split('T')[0],
        metrics: results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error("Error calculating metrics:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function calculateMetrics(messages: any[], date: Date, source: string) {
  if (messages.length === 0) {
    return createEmptyMetrics(date, source);
  }
  
  // 1. Calcular tempos de ociosidade (tempo entre mensagens)
  const idleTimes = [];
  for (let i = 1; i < messages.length; i++) {
    const prevTime = new Date(messages[i-1].created_at).getTime();
    const currTime = new Date(messages[i].created_at).getTime();
    const diffSeconds = (currTime - prevTime) / 1000;
    
    // Considerar apenas intervalos razoáveis (até 4 horas)
    if (diffSeconds > 0 && diffSeconds <= 14400) {
      idleTimes.push(diffSeconds);
    }
  }
  
  // Estatísticas de tempo de ociosidade
  let avgIdleTime = 0;
  let medianIdleTime = 0;
  let minIdleTime = 0;
  let maxIdleTime = 0;
  let totalIdleTime = 0;
  
  if (idleTimes.length > 0) {
    idleTimes.sort((a: number, b: number) => a - b);
    avgIdleTime = idleTimes.reduce((sum: number, time: number) => sum + time, 0) / idleTimes.length;
    medianIdleTime = idleTimes[Math.floor(idleTimes.length / 2)];
    minIdleTime = idleTimes[0];
    maxIdleTime = idleTimes[idleTimes.length - 1];
    totalIdleTime = idleTimes.reduce((sum: number, time: number) => sum + time, 0);
  }
  
  // 2. Métricas de horário
  const firstMessageTime = new Date(messages[0].created_at);
  const lastMessageTime = new Date(messages[messages.length - 1].created_at);
  const workDurationMinutes = Math.round((lastMessageTime.getTime() - firstMessageTime.getTime()) / (1000 * 60));
  const messagesPerHour = workDurationMinutes > 0 ? (messages.length / workDurationMinutes) * 60 : 0;
  
  // 3. Distribuição por turno
  const shiftCounts = {
    morning: 0,    // 6h-12h
    afternoon: 0,  // 12h-18h
    evening: 0,    // 18h-24h
    night: 0       // 0h-6h
  };
  
  const hourlyCounts: { [key: number]: number } = {};
  
  messages.forEach(msg => {
    const hour = new Date(msg.created_at).getHours();
    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    
    if (hour >= 6 && hour < 12) shiftCounts.morning++;
    else if (hour >= 12 && hour < 18) shiftCounts.afternoon++;
    else if (hour >= 18 && hour < 24) shiftCounts.evening++;
    else shiftCounts.night++;
  });
  
  // 4. Hora de pico
  let peakHour = 0;
  let peakHourMessages = 0;
  for (const [hour, count] of Object.entries(hourlyCounts)) {
    const hourNum = parseInt(hour);
    const countNum = count as number;
    if (countNum > peakHourMessages) {
      peakHourMessages = countNum;
      peakHour = hourNum;
    }
  }
  
  // 5. Métricas adicionais
  const uniqueClients = new Set(messages.map(m => m.phone_number)).size;
  
  return {
    metric_date: date.toISOString().split('T')[0],
    employee_source: source,
    
    // Métricas de tempo
    avg_idle_time_seconds: Math.round(avgIdleTime * 100) / 100,
    median_idle_time_seconds: Math.round(medianIdleTime * 100) / 100,
    min_idle_time_seconds: Math.round(minIdleTime * 100) / 100,
    max_idle_time_seconds: Math.round(maxIdleTime * 100) / 100,
    total_idle_time_seconds: Math.round(totalIdleTime * 100) / 100,
    
    // Métricas de horário
    first_message_time: firstMessageTime.toTimeString().split(' ')[0],
    last_message_time: lastMessageTime.toTimeString().split(' ')[0],
    work_duration_minutes: workDurationMinutes,
    messages_per_hour: Math.round(messagesPerHour * 100) / 100,
    
    // Distribuição por turno
    morning_messages: shiftCounts.morning,
    afternoon_messages: shiftCounts.afternoon,
    evening_messages: shiftCounts.evening,
    night_messages: shiftCounts.night,
    
    // Métricas adicionais
    total_messages: messages.length,
    unique_clients: uniqueClients,
    peak_hour: peakHour,
    peak_hour_messages: peakHourMessages,
    
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function createEmptyMetrics(date: Date, source: string) {
  return {
    metric_date: date.toISOString().split('T')[0],
    employee_source: source,
    
    // Métricas de tempo
    avg_idle_time_seconds: 0,
    median_idle_time_seconds: 0,
    min_idle_time_seconds: 0,
    max_idle_time_seconds: 0,
    total_idle_time_seconds: 0,
    
    // Métricas de horário
    first_message_time: null,
    last_message_time: null,
    work_duration_minutes: 0,
    messages_per_hour: 0,
    
    // Distribuição por turno
    morning_messages: 0,
    afternoon_messages: 0,
    evening_messages: 0,
    night_messages: 0,
    
    // Métricas adicionais
    total_messages: 0,
    unique_clients: 0,
    peak_hour: null,
    peak_hour_messages: 0,
    
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
