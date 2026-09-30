# Acesso administrativo

## 1. Variáveis do ambiente

Configure no ambiente de publicação:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use a URL e a chave **anon/public** do projeto Supabase. Nunca coloque a service role key no frontend.

## 2. Criar o usuário administrador

No Supabase, abra **Authentication > Users** e crie o usuário com e-mail e senha.

Depois copie o UUID desse usuário e execute no SQL Editor:

```sql
insert into public.catalog_admins (user_id, active)
values ('UUID_DO_USUARIO_AUTH', true)
on conflict (user_id) do update set active = true;
```

As migrations da pasta `supabase/migrations` criam as tabelas, RLS e permissões necessárias.

## 3. Acesso

O painel fica em:

`/admin`

O rodapé do site também possui um link discreto **Admin**.

O login aceita somente uma sessão do Supabase cujo usuário esteja cadastrado em `public.catalog_admins` e ativo.

## 4. Segurança

O frontend não considera apenas o login: ele verifica também a autorização na tabela `catalog_admins`. As operações de catálogo são protegidas por RLS no Supabase.

