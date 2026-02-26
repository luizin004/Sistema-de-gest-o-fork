-- Inserir cards de teste para hoje no Kanban de agendamentos
-- Data: 05/02/2026 (hoje)

-- 1. Teste - João Silva - Pendente (09:00)
INSERT INTO agendamento (
  id, 
  nome, 
  telefone, 
  dentista, 
  tratamento, 
  data, 
  data_marcada, 
  horario, 
  confirmado, 
  presenca, 
  source, 
  author_id,
  created_at, 
  updated_at
) VALUES (
  gen_random_uuid(),
  'Teste - João Silva',
  '31987654321',
  'Dr. Carlos Alberto',
  'Clareamento',
  '2026-02-05',
  '2026-02-05 09:00:00',
  '09:00',
  false,
  NULL,
  NULL,
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
);

-- 2. Teste - Maria Santos - Confirmado (10:30)
INSERT INTO agendamento (
  id, 
  nome, 
  telefone, 
  dentista, 
  tratamento, 
  data, 
  data_marcada, 
  horario, 
  confirmado, 
  presenca, 
  source, 
  author_id,
  created_at, 
  updated_at
) VALUES (
  gen_random_uuid(),
  'Teste - Maria Santos',
  '31912345678',
  'Dra. Ana Paula',
  'Aparelho Ortodôntico',
  '2026-02-05',
  '2026-02-05 10:30:00',
  '10:30',
  true,
  NULL,
  NULL,
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
);

-- 3. Teste - Pedro Oliveira - Não compareceu (14:00)
INSERT INTO agendamento (
  id, 
  nome, 
  telefone, 
  dentista, 
  tratamento, 
  data, 
  data_marcada, 
  horario, 
  confirmado, 
  presenca, 
  source, 
  author_id,
  created_at, 
  updated_at
) VALUES (
  gen_random_uuid(),
  'Teste - Pedro Oliveira',
  '31998765432',
  'Dr. Roberto Mendes',
  'Implante Dentário',
  '2026-02-05',
  '2026-02-05 14:00:00',
  '14:00',
  true,
  'Não compareceu',
  NULL,
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
);

-- 4. Teste - Carla Costa - Compareceu/Cadência (15:30)
INSERT INTO agendamento (
  id, 
  nome, 
  telefone, 
  dentista, 
  tratamento, 
  data, 
  data_marcada, 
  horario, 
  confirmado, 
  presenca, 
  source, 
  author_id,
  created_at, 
  updated_at
) VALUES (
  gen_random_uuid(),
  'Teste - Carla Costa',
  '31955554444',
  'Dra. Fernanda Lima',
  'Restauração',
  '2026-02-05',
  '2026-02-05 15:30:00',
  '15:30',
  false,
  'compareceu',
  NULL,
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
);

-- 5. Teste - Lucas Ferreira - Desistiu (16:45)
INSERT INTO agendamento (
  id, 
  nome, 
  telefone, 
  dentista, 
  tratamento, 
  data, 
  data_marcada, 
  horario, 
  confirmado, 
  presenca, 
  source, 
  author_id,
  created_at, 
  updated_at
) VALUES (
  gen_random_uuid(),
  'Teste - Lucas Ferreira',
  '31911112222',
  'Dr. Carlos Alberto',
  'Limpeza',
  '2026-02-05',
  '2026-02-05 16:45:00',
  '16:45',
  false,
  'desistiu',
  NULL,
  '00000000-0000-0000-0000-000000000000',
  NOW(),
  NOW()
);

-- Verificar inserção
SELECT 
  nome,
  horario,
  dentista,
  tratamento,
  confirmado,
  presenca,
  CASE 
    WHEN confirmado = false AND presenca IS NULL THEN 'Pendente'
    WHEN confirmado = true AND presenca IS NULL THEN 'Confirmado'
    WHEN presenca = 'Não compareceu' OR presenca = 'desistiu' THEN 'Desistiu'
    WHEN presenca = 'compareceu' OR presenca = 'cadência' THEN 'Cadência'
    ELSE 'Outro'
  END as status_kanban
FROM agendamento 
WHERE DATE(data_marcada) = CURRENT_DATE
ORDER BY data_marcada;
