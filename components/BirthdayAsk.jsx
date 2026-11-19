'use client';
import { useState } from 'react';
import Sheet from './Sheet';
import BirthdayFields from './BirthdayFields';
import { useAuth } from './AuthProvider';

// Shown once, the first time someone signs in. Optional: skipping is remembered, and it can be added later on the Profile page.
export default function BirthdayAsk() {
  const { member, saveBirthday } = useAuth();
  const [hidden, setHidden] = useState(false);
  // Only ask if the database has the birthday columns (birthday_asked is undefined before it is migrated).
  if (hidden || !member || member.birthday_asked !== false) return null;
  const skip = async () => { setHidden(true); await saveBirthday(null, null); };
  return (
    <Sheet onClose={skip}>
      <h1 className="sh">When is your birthday? 🎂</h1>
      <div className="m" style={{ marginBottom: 14 }}>Totally optional. Only the day and month, no year. You can skip this and add or change it any time on your Profile.</div>
      <BirthdayFields onSave={async (mo, d) => { const e = await saveBirthday(mo, d); if (!e) setHidden(true); return e; }} saveLabel="Save" onSkip={skip} skipLabel="Skip for now" />
    </Sheet>
  );
}
