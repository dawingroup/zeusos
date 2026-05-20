/**
 * Firebase Interactive Login
 *
 * Signs in with email/password and saves credentials to .env
 * so other scripts (like seed-advisory-vendors.cjs) can reuse them.
 *
 * Run:  node scripts/firebase-login.cjs
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function prompt(question, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      const stdin = process.openStdin();
      let pwd = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (ch) => {
        if (ch === '\n' || ch === '\r' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(pwd);
        } else if (ch === '\u0003') {
          // Ctrl+C
          process.exit(1);
        } else if (ch === '\u007F' || ch === '\b') {
          // Backspace
          if (pwd.length > 0) {
            pwd = pwd.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(pwd.length));
          }
        } else {
          pwd += ch;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

async function main() {
  console.log('=== Firebase Login ===\n');
  console.log(`Project: ${firebaseConfig.projectId}\n`);

  const email = await prompt('Email: ');
  const password = await prompt('Password: ', true);

  if (!email || !password) {
    console.error('\nEmail and password are required.');
    process.exit(1);
  }

  console.log('\nSigning in...');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    console.log(`\nLogged in as: ${user.email} (uid: ${user.uid})`);

    // Save to .env
    const envPath = path.resolve(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or append FIREBASE_USER_EMAIL
    if (envContent.includes('FIREBASE_USER_EMAIL=')) {
      envContent = envContent.replace(/FIREBASE_USER_EMAIL=.*/, `FIREBASE_USER_EMAIL=${email}`);
    } else {
      envContent += `\n\n# Firebase script authentication\nFIREBASE_USER_EMAIL=${email}`;
    }

    // Update or append FIREBASE_USER_PASSWORD
    if (envContent.includes('FIREBASE_USER_PASSWORD=')) {
      envContent = envContent.replace(/FIREBASE_USER_PASSWORD=.*/, `FIREBASE_USER_PASSWORD=${password}`);
    } else {
      envContent += `\nFIREBASE_USER_PASSWORD=${password}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('\nCredentials saved to .env');
    console.log('You can now run: node scripts/seed-advisory-vendors.cjs');

    process.exit(0);
  } catch (err) {
    console.error(`\nLogin failed: ${err.message}`);
    process.exit(1);
  }
}

main();
