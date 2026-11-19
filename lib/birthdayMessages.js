// Wording of the birthday push notifications. A different line each day and for each person.
const OTHERS = [
  (n) => `Drop ${n} a wish in IKE Ops, it takes ten seconds.`,
  (n) => `Make ${n}'s day: send a wish and leave a note on their card.`,
  (n) => `Today is ${n}'s day. Say happy birthday!`,
  (n) => `Somebody owes ${n} a cake. Wish them a happy birthday!`,
  (n) => `${n} would love to hear from you today. Add a line to their card.`,
];
const SELF = [
  'The team left you a few things in IKE Ops. Open it to see who wished you.',
  'Many happy returns! See who wished you in IKE Ops.',
  'Have a great one. Your team has been thinking of you today.',
];

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function birthdayPush({ self, nm, email, dayOfYear }) {
  const i = (dayOfYear + hash(email)) >>> 0;
  return self
    ? { title: `🎉 Happy birthday, ${nm}!`, body: SELF[i % SELF.length], url: '/' }
    : { title: `🎂 It's ${nm}'s birthday today`, body: OTHERS[i % OTHERS.length](nm), url: '/' };
}
