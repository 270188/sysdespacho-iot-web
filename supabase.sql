-- SysDespacho IoT · Tabla de lecturas para Supabase
-- Ejecuta este script en Supabase → SQL Editor → New query → Run.

create table if not exists public.lecturas (
  id               bigint generated always as identity primary key,
  dispositivo      text        not null default 'CONT-IOT-001',
  tipo_sensor      text        not null,
  eje_x            double precision not null,
  eje_y            double precision not null,
  eje_z            double precision not null,
  magnitud         double precision not null,
  variacion        double precision not null,
  estado           text        not null check (estado in ('NORMAL', 'MOVIMIENTO', 'IMPACTO')),
  timestamp_sensor bigint,
  recibido_en      timestamptz not null default now()
);

-- Evita guardar dos veces la misma lectura si hay varios paneles abiertos.
create unique index if not exists lecturas_dispositivo_ts_unico
  on public.lecturas (dispositivo, timestamp_sensor);

create index if not exists lecturas_dispositivo_fecha
  on public.lecturas (dispositivo, recibido_en desc);

-- Seguridad a nivel de fila: el panel (clave anon) solo puede leer e insertar.
alter table public.lecturas enable row level security;

drop policy if exists "panel puede leer" on public.lecturas;
create policy "panel puede leer" on public.lecturas
  for select to anon using (true);

drop policy if exists "panel puede insertar" on public.lecturas;
create policy "panel puede insertar" on public.lecturas
  for insert to anon with check (estado in ('NORMAL', 'MOVIMIENTO', 'IMPACTO'));
