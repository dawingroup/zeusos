/**
 * compileDKB — Cloud Function (HTTPS Callable)
 *
 * Reads wiki markdown files from Cloud Storage, parses YAML frontmatter,
 * validates, and writes to the `designKnowledgeBase` Firestore collection.
 *
 * Timeout: 120s (batch compile can be slow)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const COLLECTION = 'designKnowledgeBase';
const BATCH_SIZE = 500;

const compileDKB = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    logger.info('compileDKB called', { uid: request.auth.uid });

    // Read wiki files from Cloud Storage
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'design-kb/wiki/' });
    const mdFiles = files.filter(f => f.name.endsWith('.md'));

    logger.info(`Found ${mdFiles.length} wiki markdown files`);

    const compiled = [];
    const skipped = [];
    const errors = [];

    for (const file of mdFiles) {
      const articlePath = file.name.replace('design-kb/', '');
      try {
        const [buffer] = await file.download();
        const content = buffer.toString('utf-8');
        const parsed = parseFrontmatter(content);

        if (!parsed) {
          errors.push({ articlePath, error: 'No valid frontmatter' });
          continue;
        }

        if (!parsed.data.dkbEntryType) {
          skipped.push(articlePath);
          continue;
        }

        const doc = transformToFirestoreDoc(parsed.data, parsed.body, articlePath);
        if (!doc) {
          skipped.push(articlePath);
          continue;
        }

        compiled.push({ id: parsed.data.id || articlePath.replace(/\//g, '-').replace('.md', ''), data: doc });
      } catch (err) {
        errors.push({ articlePath, error: err.message });
      }
    }

    // Write in batches
    for (let i = 0; i < compiled.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = compiled.slice(i, i + BATCH_SIZE);
      for (const { id, data } of chunk) {
        batch.set(db.collection(COLLECTION).doc(id), data, { merge: true });
      }
      await batch.commit();
    }

    const result = {
      compiled: compiled.length,
      skipped: skipped.length,
      errors,
    };

    logger.info('DKB compilation complete', result);
    return result;
  },
);

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const yamlStr = match[1];
  const body = match[2];
  const data = {};

  // Simple line-by-line YAML parser for wiki frontmatter
  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        data[key] = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else if (value === 'true') {
        data[key] = true;
      } else if (value === 'false') {
        data[key] = false;
      } else if (!isNaN(Number(value)) && value.length > 0) {
        data[key] = Number(value);
      } else {
        data[key] = value;
      }
    }
  }

  return { data, body };
}

function transformToFirestoreDoc(data, body, articlePath) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const summaryMatch = body.match(/##\s+Summary\s*\n([\s\S]*?)(?=\n##|\n*$)/);
  const description = summaryMatch ? summaryMatch[1].trim().split('\n')[0] : '';

  return {
    entryType: data.dkbEntryType,
    name: data.title || data.id || '',
    description,
    tags: data.tags || [],
    isActive: true,
    version: 1,
    sourceArticlePath: articlePath,
    lastCompiled: now,
    updatedAt: now,
    createdBy: 'compileDKB-function',
  };
}

module.exports = { compileDKB };
