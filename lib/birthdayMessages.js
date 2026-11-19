// Wording of the birthday push notifications. A different line each day and for each person. Funny, but nice.
const OTHERS = [
  (n) => `Send ${n} a wish and make their day a little better.`,
  (n) => `${n} is part of what makes this team work. Wish them a happy birthday!`,
  (n) => `A quick wish goes a long way. Say happy birthday to ${n}!`,
  (n) => `Today is ${n}'s day. Add a line to their birthday card.`,
  (n) => `Let's make ${n}'s phone buzz today. Send a wish!`,
  (n) => `Wish ${n} a great year ahead in IKE Ops.`,
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
