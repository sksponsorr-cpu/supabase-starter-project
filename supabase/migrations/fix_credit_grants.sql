-- Correction : le solde dépensable doit venir des lots de crédits (credit_grants), comme spend_credits.
-- À exécuter une fois dans le SQL Editor de Supabase.

-- 1. Solde dépensable : somme des lots non expirés
create or replace function public.spendable_credits(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(remaining), 0)::integer
  from public.credit_grants
  where user_id = p_user and expires_at > now() and remaining > 0;
$$;
revoke all on function public.spendable_credits(uuid) from public, anon, authenticated;
grant execute on function public.spendable_credits(uuid) to service_role;

-- 2. Retrait admin : consomme les lots dans l'ordre d'expiration, puis met le solde à jour
create or replace function public.admin_remove_credits(p_user uuid, p_amount integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  left_to_remove integer := p_amount;
  take integer;
  g record;
  removed integer := 0;
begin
  for g in
    select id, remaining from public.credit_grants
    where user_id = p_user and expires_at > now() and remaining > 0
    order by expires_at, created_at
    for update
  loop
    exit when left_to_remove <= 0;
    take := least(g.remaining, left_to_remove);
    update public.credit_grants set remaining = remaining - take where id = g.id;
    left_to_remove := left_to_remove - take;
    removed := removed + take;
  end loop;

  update public.profiles set credits_balance = greatest(0, credits_balance - removed) where id = p_user;
  insert into public.credit_ledger (user_id, kind, amount, reason)
    values (p_user, 'admin_retrait', -removed, p_reason);
  return removed;
end;
$$;
revoke all on function public.admin_remove_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.admin_remove_credits(uuid, integer, text) to service_role;

-- 3. Correction immédiate pour marettpeace@gmail.com : un lot de 30 crédits qui couvre le solde actuel
--    (le solde ne change pas). Ne l'exécutez qu'une fois.
insert into public.credit_grants (user_id, amount, remaining, expires_at, kind, ref)
select id, 30, 30, now() + interval '10 days', 'correction', 'correction-marettpeace'
from public.profiles
where email = 'marettpeace@gmail.com';

-- 4. Vérifier que l'expiration automatique tourne (sinon le solde reste faux)
select * from cron.job where jobname = 'expire-credits';
-- Si aucune ligne n'apparaît, activez pg_cron puis lancez :
-- select cron.schedule('expire-credits', '0 * * * *', 'select public.expire_credits();');
