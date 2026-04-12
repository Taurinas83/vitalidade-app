-- =============================================================
-- Vitalidade 40+ — Schema do Banco de Dados
-- Execute este arquivo no Supabase SQL Editor do seu projeto:
-- Supabase Dashboard > SQL Editor > New query > Cole e execute
-- =============================================================

-- -----------------------------------------------------------
-- Tabela: profiles
-- Armazena o perfil de saúde/treino de cada usuário
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  age         INTEGER,
  weight      NUMERIC,
  level       TEXT        CHECK (level IN ('iniciante', 'intermediario', 'avancado')),
  objective   TEXT        CHECK (objective IN ('hipertrofia', 'perda_gordura')),
  has_injury  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: cada usuário só acessa seu próprio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------
-- Tabela: workout_history
-- Armazena os treinos gerados e salvos por cada usuário
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_data JSONB       NOT NULL,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security: cada usuário só acessa seus próprios treinos
ALTER TABLE workout_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own workouts"
  ON workout_history
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice para acelerar buscas por usuário na listagem de histórico
CREATE INDEX IF NOT EXISTS workout_history_user_id_idx
  ON workout_history (user_id, created_at DESC);

-- -----------------------------------------------------------
-- Tabela: programs
-- Armazena o programa semanal ativo de cada usuário
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_data JSONB       NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own programs"
  ON programs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS programs_user_id_idx
  ON programs (user_id, created_at DESC);

-- -----------------------------------------------------------
-- Tabela: checkins
-- Armazena o feedback pós-treino de cada sessão
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID        REFERENCES programs(id) ON DELETE SET NULL,
  day_key    TEXT        NOT NULL,
  fatigue    INTEGER     CHECK (fatigue BETWEEN 1 AND 10),
  rpe        INTEGER     CHECK (rpe BETWEEN 1 AND 10),
  weight     NUMERIC,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own checkins"
  ON checkins
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkins_user_id_idx
  ON checkins (user_id, created_at DESC);
