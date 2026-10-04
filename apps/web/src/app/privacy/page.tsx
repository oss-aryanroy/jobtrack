import type { Metadata } from "next";
import Link from "next/link";
import { AppMark } from "@jobtrack/ui/mark";

export const metadata: Metadata = { title: "Privacy · JobTrack" };
export const dynamic = "force-dynamic";

const UPDATED = "4 October 2026";

export default function Privacy() {
  return (
    <main className="doc">
      <header className="doc-head">
        <Link href="/" aria-label="JobTrack home"><AppMark size={40} /></Link>
        <div>
          <h1>Privacy</h1>
          <p className="muted">Last updated {UPDATED}</p>
        </div>
      </header>

      <p className="lead">
        JobTrack is built so that the people running it can't read your job search. Your applications are encrypted in your browser
        before they're saved, and the key never leaves your device.
      </p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your username.</b> We never ask for an email, name or phone number.</li>
        <li>
          <b>Proof of your password, not the password.</b> Your browser turns your password into two separate keys. One proves
          it's you and is stored only as a one-way hash. The other unlocks your data and is never sent to us.
        </li>
        <li>
          <b>Your applications, encrypted.</b> Every application, interview, follow-up, note and setting is encrypted with
          AES-256 in your browser. We store only the scrambled result.
        </li>
        <li><b>A sign-in session</b> for each device you're signed in on, so you don't have to sign in on every visit.</li>
      </ul>

      <h2>What we can see</h2>
      <p>
        Because of the encryption, we can't see company names, roles, salaries, notes or anything else you enter. We can see that
        your account exists, when it was created, roughly how many records it holds, and when you sign in. Like any website, the
        hosting provider records IP addresses and request times in its logs. To stop password guessing, we also keep failed sign-in attempts (the username tried and the IP address) for up to a day.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        JobTrack sets one cookie: your sign-in session. There are no analytics, advertising or tracking cookies, and no
        third-party scripts.
      </p>

      <h2>Who else is involved</h2>
      <ul>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Neon</b> hosts the database that holds the encrypted records.</li>
        <li>
          <b>Greenhouse and Lever.</b> When you paste one of their job links, your browser asks them for that job's details
          directly. They see that request and your IP address; we don't.
        </li>
      </ul>
      <p>None of them can read your applications, because they only ever handle encrypted data.</p>

      <h2>Keeping and deleting your data</h2>
      <p>
        Your data stays until you delete it. Settings → <b>Delete account</b> removes your account, sessions and every record
        immediately. The database provider may keep encrypted backups for a limited time before they expire. Before deleting,
        you can export a <code>.jobtrack</code> file from Settings to keep a copy or move it to the Mac or Windows app.
      </p>

      <h2>If you forget your password</h2>
      <p>
        We can't reset it for you, because we can't unlock your data. The recovery code shown when you signed up is the only way
        back in. Keep it somewhere safe.
      </p>

      <h2>The Mac and Windows apps</h2>
      <p>
        The desktop apps don't use an account or a server. Everything stays on your computer, and nothing is sent anywhere except
        the Greenhouse and Lever lookups described above.
      </p>

      <h2>Questions</h2>
      <p>
        JobTrack is open source, so you can check all of this in the code. Questions or concerns:{" "}
        <a href="https://github.com/oss-aryanroy/jobtrack/issues">open an issue on GitHub</a>.
      </p>
    </main>
  );
}
