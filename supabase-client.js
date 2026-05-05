/**
 * Apex Architect — Supabase Client
 * ─────────────────────────────────────────────────────────────
 * STEP 1: Go to https://supabase.com → New Project
 * STEP 2: Settings → API → copy Project URL + anon/public key
 * STEP 3: Paste them below
 * STEP 4: Run the SQL in the Supabase SQL Editor (see setup-guide.md)
 * ─────────────────────────────────────────────────────────────
 */
const SUPABASE_URL      = 'https://vcjkedqlbxyvjcolooyo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rS2TORkgOK074ebHTXPbtw_q6p-FOWH';

// Create Supabase client (loaded via CDN in each HTML page)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storageKey: 'apex_sb_session',
        autoRefreshToken: true
    }
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const ApexAuth = {
    async signUp(email, password, displayName) {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName || email.split('@')[0] } }
        });
        if (error) return { ok: false, error: error.message };
        // Clear local data to prevent collisions when switching accounts
        localStorage.removeItem(LOCAL_KEY);
        return { ok: true, user: _fmt(data.user) };
    },

    async signIn(email, password) {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: error.message };
        // Clear local data to prevent collisions when switching accounts
        localStorage.removeItem(LOCAL_KEY);
        return { ok: true, user: _fmt(data.user) };
    },

    async signOut() {
        await db.auth.signOut();
        localStorage.removeItem(LOCAL_KEY);
    },

    /** Reads from cached session — no network call needed */
    async getUser() {
        const { data: { session } } = await db.auth.getSession();
        return session ? _fmt(session.user) : null;
    }
};

function _fmt(u) {
    if (!u) return null;
    return {
        id: u.id,
        email: u.email,
        displayName: u.user_metadata?.display_name || u.email.split('@')[0]
    };
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────

const LOCAL_KEY = 'apex_projects_v1';

const ApexProjects = {
    /** Fetch all projects from Supabase, cache to localStorage for the editor */
    async fetchAll() {
        const { data, error } = await db
            .from('projects')
            .select('id, name, data, last_modified')
            .order('last_modified', { ascending: false });

        if (error) throw error;

        const projects = data.map(r => ({
            id: r.id,
            name: r.name,
            lastModified: r.last_modified,
            data: r.data
        }));

        // Write to localStorage so f1track.js can read it directly
        localStorage.setItem(LOCAL_KEY, JSON.stringify(projects));
        return projects;
    },

    /** Upsert a single project to Supabase */
    async upsert(project) {
        const { data: { session } } = await db.auth.getSession();
        if (!session) return;
        const { error } = await db.from('projects').upsert({
            id: project.id,
            user_id: session.user.id,
            name: project.name,
            data: project.data,
            last_modified: project.lastModified
        }, { onConflict: 'id' });
        if (error) throw error;
    },

    /** Delete from Supabase and local cache */
    async delete(id) {
        const { error } = await db.from('projects').delete().eq('id', id);
        if (error) console.warn('[ApexProjects] delete failed:', error.message);
        try {
            const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
            localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.filter(p => p.id !== id)));
        } catch {}
    }
};
