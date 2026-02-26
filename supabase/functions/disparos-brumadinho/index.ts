// Deno Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const contentType = req.headers.get('content-type');
    
    // Se for FormData (arquivo CSV)
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'Arquivo não encontrado' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Ler conteúdo do CSV
      const csvText = await file.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        return new Response(JSON.stringify({ error: 'CSV inválido ou vazio' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Processar CSV (assumindo primeira linha como cabeçalho)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const records = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record: any = {};
        
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        
        // Mapear campos para o formato esperado
        const insertRecord: any = {
          nome: record.nome || record.name || '',
          telefone: record.telefone || record.phone || record.whatsapp || '',
        };
        
        // Adicionar campos de data se existirem
        if (record.data_nascimento || record.nascimento) {
          insertRecord.data_nascimento = record.data_nascimento || record.nascimento;
        }
        if (record.data_limpeza || record.limpeza) {
          insertRecord.data_limpeza = record.data_limpeza || record.limpeza;
        }
        if (record.data_clareamento || record.clareamento) {
          insertRecord.data_clareamento = record.data_clareamento || record.clareamento;
        }
        if (record.data_consulta || record.consulta) {
          insertRecord.data_consulta = record.data_consulta || record.consulta;
        }
        
        // Só adicionar se tiver nome e telefone
        if (insertRecord.nome && insertRecord.telefone) {
          records.push(insertRecord);
        }
      }
      
      if (records.length === 0) {
        return new Response(JSON.stringify({ error: 'Nenhum registro válido encontrado no CSV' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Inserir todos os registros
      const { error } = await supabase.from('disparos').insert(records);
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        ok: true, 
        inserted: records.length,
        message: `${records.length} registros inseridos com sucesso`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Se for JSON (registro individual)
    const body = await req.json();
    const { nome, telefone } = body;

    if (!nome || !telefone) {
      return new Response(JSON.stringify({ error: 'nome e telefone são obrigatórios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Escolhe a data presente (apenas uma deve ser enviada por chamada)
    const dataField = ['data_nascimento', 'data_limpeza', 'data_clareamento', 'data_consulta']
      .find((k) => (body as any)[k]);

    if (!dataField) {
      return new Response(JSON.stringify({ error: 'Informe uma data: nascimento/limpeza/clareamento/consulta' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const insertPayload = {
      nome,
      telefone,
      [dataField]: (body as any)[dataField],
    };

    const { error } = await supabase.from('disparos').insert([insertPayload]);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
