/**
 * Tiny persistent JSON store: zero external dependencies.
 *
 * Good enough for a single-instance deployment: users, their libraries and their
 * preferences live in one file, written atomically (tmp + rename) through a
 * serialized queue so concurrent requests can't corrupt it. Swap for
 * Postgres/Redis when you scale horizontally (see ROADMAP).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'store.json');

const emptyState = () => ({ users: {}, libraries: {}, libraryRevs: {}, preferences: {} });

let state = emptyState();
let writeQueue = Promise.resolve();

function load() {
    try {
        if (fs.existsSync(FILE)) {
            const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
            // Every collection is defaulted individually: a store written by an
            // older version simply has no `preferences` / `libraryRevs` key, and
            // must keep working instead of needing a migration step.
            state = {
                users: parsed.users || {},
                libraries: parsed.libraries || {},
                libraryRevs: parsed.libraryRevs || {},
                preferences: parsed.preferences || {},
            };
        }
    } catch (err) {
        console.error('Could not read data store, starting fresh:', err.message);
        state = emptyState();
    }
}

function persist() {
    // The write runs after any previously-queued write (serialized so concurrent
    // requests can't interleave and corrupt the file). It *rejects* on failure so
    // the caller (and therefore the API route) learns the data was not saved
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
    const normalizedEmail = email.trim().toLowerCase();
    // Atomic uniqueness backstop: this check and the state mutation below run
    // synchronously (no await between them), so two concurrent registrations for
    // the same email (which can both clear the route-level check while awaiting
    // bcrypt) can't both create an account. The second one loses here.
    if (findUserByEmail(normalizedEmail)) {
        const err = new Error('Un compte existe déjà avec cet e-mail.');
        err.status = 409;
        err.code = 'AUTH_EMAIL_TAKEN';
        throw err;
    }
    const id = crypto.randomUUID();
    const user = {
        id,
        email: normalizedEmail,
        passwordHash,
        // Stamped into every token this account signs. Bumping it invalidates
        // all tokens already out there, which is how "log out everywhere" and
        // "changing the password kicks out the thief" work without a session
        // table: the check is one integer comparison, still stateless per token.
        tokenVersion: 0,
        createdAt: Date.now(),
    };
    state.users[id] = user;
    state.libraries[id] = [];
    await persist();
    return user;
}

/** Replaces the password hash and revokes every token signed before now. */
async function setPassword(userId, passwordHash) {
    const user = state.users[userId];
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await persist();
    return user;
}

/** Invalidates every token currently in circulation for this account. */
async function revokeSessions(userId) {
    const user = state.users[userId];
    if (!user) return null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await persist();
    return user;
}

/** Erases the account and everything attached to it. No tombstone, no orphans. */
async function deleteUser(userId) {
    if (!state.users[userId]) return false;
    delete state.users[userId];
    delete state.libraries[userId];
    delete state.libraryRevs[userId];
    delete state.preferences[userId];
    await persist();
    return true;
}

/** Strips secrets before sending a user to the client. */
function publicUser(user) {
    return { id: user.id, email: user.email, createdAt: user.createdAt };
}

/* ------------------------------ libraries ----------------------------- */

function getLibrary(userId) {
    return state.libraries[userId] || [];
}

/**
 * Monotonic counter bumped on every write, used for optimistic concurrency:
 * a client that PUTs against a stale revision is told to re-merge instead of
 * overwriting what another device just saved.
 */
function getLibraryRev(userId) {
    return state.libraryRevs[userId] || 0;
}

async function setLibrary(userId, entries) {
    state.libraries[userId] = entries;
    state.libraryRevs[userId] = getLibraryRev(userId) + 1;
    await persist();
    return { entries, rev: state.libraryRevs[userId] };
}

/* ----------------------------- preferences ---------------------------- */

function getPreferences(userId) {
    return state.preferences[userId] || null;
}

async function setPreferences(userId, preferences) {
    state.preferences[userId] = preferences;
    await persist();
    return preferences;
}

module.exports = {
    findUserByEmail,
    getUserById,
    createUser,
    setPassword,
    revokeSessions,
    deleteUser,
    publicUser,
    getLibrary,
    getLibraryRev,
    setLibrary,
    getPreferences,
    setPreferences,
};
