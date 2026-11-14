-- ORBiS: banned user names. Paste everything into the SQL Editor and Run. Safe to run again.
-- (Run 01-setup.sql and 05-app-roles.sql first.)
-- The word list is the same as NAME_NG / NAME_NG_EXACT in src/js/02-util.js (readable there).
-- Words are written as Unicode escapes so that copy and paste cannot break them.
-- - New account with a banned name: the name is replaced by user_xxxxxxxx (sign-up itself is not stopped).
-- - Changing to a banned name: refused with ORBIS_NAME_BANNED (the app shows a message).
-- - Names that already exist are left alone. Masters can use any name.

create or replace function public.username_key(name text) returns text
language sql immutable set search_path = public as $$
  select translate(
    translate(lower(normalize(coalesce(name, ''), NFKC)), U&'\30A1\30A2\30A3\30A4\30A5\30A6\30A7\30A8\30A9\30AA\30AB\30AC\30AD\30AE\30AF\30B0\30B1\30B2\30B3\30B4\30B5\30B6\30B7\30B8\30B9\30BA\30BB\30BC\30BD\30BE\30BF\30C0\30C1\30C2\30C3\30C4\30C5\30C6\30C7\30C8\30C9\30CA\30CB\30CC\30CD\30CE\30CF\30D0\30D1\30D2\30D3\30D4\30D5\30D6\30D7\30D8\30D9\30DA\30DB\30DC\30DD\30DE\30DF\30E0\30E1\30E2\30E3\30E4\30E5\30E6\30E7\30E8\30E9\30EA\30EB\30EC\30ED\30EE\30EF\30F0\30F1\30F2\30F3\30F4\30F5\30F6', U&'\3041\3042\3043\3044\3045\3046\3047\3048\3049\304A\304B\304C\304D\304E\304F\3050\3051\3052\3053\3054\3055\3056\3057\3058\3059\305A\305B\305C\305D\305E\305F\3060\3061\3062\3063\3064\3065\3066\3067\3068\3069\306A\306B\306C\306D\306E\306F\3070\3071\3072\3073\3074\3075\3076\3077\3078\3079\307A\307B\307C\307D\307E\307F\3080\3081\3082\3083\3084\3085\3086\3087\3088\3089\308A\308B\308C\308D\308E\308F\3090\3091\3092\3093\3094\3095\3096'),
    U&' _-.*\30FB\3000', '');
$$;

create or replace function public.username_banned(name text) returns boolean
language sql immutable set search_path = public as $$
  select public.username_key(name) = any (array[U&'orbis', U&'\304A\308B\3073\3059'])
      or exists (
        select 1 from unnest(array[
          U&'\904B\55B6', U&'\516C\5F0F', U&'\7BA1\7406\8005', U&'\7BA1\7406\4EBA', U&'\4E8B\52D9\5C40', U&'\3046\3093\3048\3044',
          U&'\3053\3046\3057\304D', U&'\304B\3093\308A\3057\3083', U&'\304B\3093\308A\306B\3093', U&'\3055\307D\30FC\3068', U&'\3059\305F\3063\3075', U&'\3082\3067\308C\30FC\305F\30FC',
          U&'admin', U&'official', U&'staff', U&'support', U&'moderator', U&'operator',
          U&'\6B7B\306D', U&'\6C0F\306D', U&'\6BBA\3059', U&'\3053\308D\3059\305E', U&'\81EA\6BBA', U&'\304F\305F\3070\308C',
          U&'\308C\3044\3077', U&'\305B\3063\304F\3059', U&'\3061\3093\3053', U&'\3061\3093\307D', U&'\307E\3093\3053', U&'\304D\3061\304C\3044',
          U&'\57FA\5730\5916', U&'\304C\3044\3058', U&'\652F\90A3', U&'\571F\4EBA', U&'\306B\304C\30FC', U&'fuck',
          U&'nigger', U&'nigga', U&'porn'
        ]) as w where position(w in public.username_key(name)) > 0);
$$;
revoke all on function public.username_key(text) from public, anon;
revoke all on function public.username_banned(text) from public, anon;
grant execute on function public.username_key(text) to authenticated;
grant execute on function public.username_banned(text) to authenticated;

create or replace function public.check_username() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.username_banned(new.username) then
      new.username := 'user_' || left(new.id::text, 8);
    end if;
    return new;
  end if;
  if new.username is distinct from old.username
     and public.username_banned(new.username)
     and auth.uid() is not null
     and not exists (select 1 from public.app_admins a where a.user_id = new.id and a.role = 'master') then
    raise exception 'ORBIS_NAME_BANNED';
  end if;
  return new;
end;
$$;
revoke all on function public.check_username() from public, anon, authenticated;
drop trigger if exists profiles_check_username on public.profiles;
create trigger profiles_check_username before insert or update of username on public.profiles
  for each row execute function public.check_username();
