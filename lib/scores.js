import { supabase } from './supabase';

// Today's date on this device, as YYYY-MM-DD. Everyone's daily board rolls over at their own midnight.
export const scoreDay = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Sends a finished run. The database keeps only each person's best time of the day.
export async function submitScore(game, ms) {
  const { error } = await supabase.rpc('submit_score', { p_game: game, p_day: scoreDay(), p_score: Math.round(ms) });
  if (error) console.error(error);
  return !error;
}

export async function topThree(game) {
  const { data, error } = await supabase.from('game_scores').select('user_id,user_name,score')
    .eq('game', game).eq('day', scoreDay()).order('score', { ascending: true }).limit(3);
  if (error) { console.error(error); return []; }
  return data || [];
}
