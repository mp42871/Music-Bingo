import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PhoneDef } from '../core/phone';
import { randomCode, type LiveBackend } from './types';

const friendly = (e: { message?: string } | null, fallback: string) =>
  new Error(
    e?.message?.includes('relation') ? 'Live play isn’t set up yet — run the setup script in Supabase (Settings → Live play).'
      : e?.message?.includes('permission denied') ? 'Supabase is blocking access — run the latest setup script again in Supabase → SQL Editor (Settings → Live play → Copy setup script).'
        : e?.message || fallback,
  );

/** Live play on the host's own free Supabase project. */
export function createSupabaseBackend(url: string, key: string): LiveBackend {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: true, storageKey: 'mb.live.auth' } });

  const ensureHost = async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: d, error } = await sb.auth.signInAnonymously();
    if (error || !d.user) throw new Error('Couldn’t sign in to Supabase. In Supabase → Authentication → Sign In / Providers, turn on “Anonymous sign-ins”.');
    return d.user.id;
  };

  return {
    async publish(title: string, def: PhoneDef, reuse?: string) {
      const uid = await ensureHost();
      if (reuse) {
        const { data } = await sb.from('live_games').update({ title, def, status: 'open' }).eq('code', reuse).eq('host', uid).select('code');
        if (data?.length) return reuse;
      }
      // Tidy up this host's old games, then claim a free 4-digit code.
      await sb.from('live_games').delete().eq('host', uid).lt('created_at', new Date(Date.now() - 48 * 3600_000).toISOString());
      for (let i = 0; i < 20; i++) {
        const code = randomCode();
        const { error } = await sb.from('live_games').insert({ code, title, def, status: 'open' });
        if (!error) return code;
        if (!/duplicate|unique/i.test(error.message)) throw friendly(error, 'Couldn’t start live play.');
      }
      throw new Error('Couldn’t find a free game code — try again.');
    },
    async close(code) {
      await ensureHost();
      await sb.from('live_games').update({ status: 'closed' }).eq('code', code);
    },
    watch(code, on) {
      const count = async () => {
        const { count: n } = await sb.from('live_players').select('id', { count: 'exact', head: true }).eq('code', code);
        on.players(n ?? 0);
      };
      void count();
      const ch = sb.channel(`live-${code}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_players', filter: `code=eq.${code}` }, () => void count())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_claims', filter: `code=eq.${code}` }, (p) => {
          const r = p.new as { id: number; code: string; card_number: number; name: string | null; created_at: string };
          on.claim({ id: String(r.id), code: r.code, cardNumber: r.card_number, name: r.name ?? '', at: Date.parse(r.created_at) });
        })
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
    async getGame(code) {
      const { data, error } = await sb.from('live_games').select('code,title,def,status').eq('code', code).maybeSingle();
      if (error) throw friendly(error, 'Couldn’t reach the game.');
      return data as never;
    },
    async takenNumbers(code) {
      const { data } = await sb.from('live_players').select('card_number').eq('code', code);
      return (data ?? []).map((r: { card_number: number }) => r.card_number);
    },
    async join(code, cardNumber, name) {
      const { error } = await sb.from('live_players').insert({ code, card_number: cardNumber, name: name || null });
      if (error) throw friendly(error, 'Couldn’t join — the game may have ended.');
    },
    async claim(code, cardNumber, name) {
      const { error } = await sb.from('live_claims').insert({ code, card_number: cardNumber, name: name || null });
      if (error) throw friendly(error, 'Couldn’t send your BINGO — check your connection and try again.');
    },
  };
}
