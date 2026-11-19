// Wording of the birthday push notifications. A different line each day and for each person. Funny, but nice.
const OTHERS = [
  (n) => `Be nice to ${n} today, it's their birthday. Send a wish!`,
  (n) => `Quick, before ${n} notices nobody has wished them yet. Say happy birthday!`,
  (n) => `${n} is a year wiser today, allegedly. Send a wish.`,
  (n) => `Today ${n} is the main character. Drop a wish.`,
  (n) => `Make ${n}'s phone buzz more than the group chat today. Send a wish!`,
  (n) => `${n} is a year older and still on the team. Go say happy birthday.`,
  (n) => `${n} deserves a good day. Send a wish and add a line to their card.`,
  (n) => `Big day for ${n}. Say happy birthday, they'll pretend not to be thrilled.`,
];
const SELF = [
  'Today you are the main character. Open IKE Ops to see who wished you.',
  'One year older, still one of the best on the team. See who wished you in IKE Ops.',
  'A year wiser today, allegedly. The team left you a few things in IKE Ops.',
  'Your phone is about to get busy. Open IKE Ops to see your birthday card.',
  'Many happy returns! The team has been busy wishing you in IKE Ops.',
];

const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function birthdayPush({ self, nm, email, dayOfYear }) {
  const i = (dayOfYear + hash(email)) >>> 0;
  return self
    ? { title: `🎉 Happy birthday, ${nm}!`, body: SELF[i % SELF.length], url: '/' }
    : { title: `🎂 It's ${nm}'s birthday today`, body: OTHERS[i % OTHERS.length](nm), url: '/' };
}
