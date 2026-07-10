/**
 * Tiny persistent JSON store — zero external dependencies.
 *
 * Good enough for a single-instance deployment: users + their libraries live in
 * one file, written atomically (tmp + rename) through a serialized queue so
 * concurrent requests can't corrupt it. Swap for Postgres/Redis when you scale
 * horizontally (see ROADMAP).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'store.json');

let state = { users: {}, libraries: {} };
let writeQueue = Promise.resolve();

function load() {
    try {
        if (fs.existsSync(FILE)) {
            const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
            state = { users: parsed.users || {}, libraries: parsed.libraries || {} };
        }
    } catch (err) {
        console.error('Could not read data store, starting fresh:', err.message);
        state = { users: {}, libraries: {} };
    }
}

function persist() {
    // The write runs after any previously-queued write (serialized so concurrent
    // requests can't interleave and corrupt the file). It *rejects* on failure so
    // the caller — and therefore the API route — learns the data was not saved
    // instead of reporting a false success.
    const run = writeQueue.then(
        () =>
            new Promise((resolve, reject) => {
                fs.mkdir(DATA_DIR, { recursive: true }, (mkErr) => {
                    if (mkErr) return reject(mkErr);
                    const tmp = `${FILE}.${process.pid}.tmp`;
                    fs.writeFile(tmp, JSON.stringify(state), (wErr) => {
                        if (wErr) return reject(wErr);
                        fs.rename(tmp, FILE, (rErr) => {
                            if (rErr) return reject(rErr);
                            resolve();
                        });
                    });
                });
            }),
    );
    // Keep the serialization chain alive regardless of this write's outcome: a
    // single failed write must not break every subsequent one. Errors surface
    // through the returned `run`, not through the queue.
    writeQueue = run.catch(() => {});
    return run;
}

load();

/* ------------------------------- users -------------------------------- */

function findUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return Object.values(state.users).find((u) => u.email === normalized) || null;
}

function getUserById(id) {
    return state.users[id] || null;
}

async function createUser({ email, passwordHash }) {
    const id = crypto.randomUUID();
    const user = {
        id,
        email: email.trim().toLowerCase(),
        passwordHash,
        createdAt: Date.now(),
    };
    state.users[id] = user;
    state.libraries[id] = [];
    await persist();
    return user;
}

/** Strips secrets before sending a user to the client. */
function publicUser(user) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
}

/* ------------------------------ libraries ----------------------------- */

function getLibrary(userId) {
    return state.libraries[userId] || [];
}

async function setLibrary(userId, entries) {
    state.libraries[userId] = entries;
    await persist();
    return entries;
}

module.exports = {
    findUserByEmail,
    getUserById,
    createUser,
    publicUser,
    getLibrary,
    setLibrary,
};
