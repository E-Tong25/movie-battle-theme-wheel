/* ==========================================================================
   MOVIE LOOKUP (posters)
   Searches TMDB (themoviedb.org), a free movie database, for titles, years and
   posters. Needs a free API key, pasted into Battle Night > Posters, and
   saved only in this browser. Without a key, the app shows stand-in posters.

   This product uses the TMDB API but is not endorsed or certified by TMDB.

     MovieDB.hasKey()                 -> true if a key is saved
     MovieDB.setKey(key) / clearKey()
     await MovieDB.search('heat')     -> [{ id, title, year, poster, posterLarge }]
     await MovieDB.test()             -> true if the key works
     await MovieDB.details(id)        -> facts for clue ideas, plus backdrop, title logo and trailer
   ========================================================================== */
const KEY = 'movieBattle.tmdbKey';
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const cache = new Map();
const detailCache = new Map();

const getKey = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };

// TMDB offers two kinds of credentials: a short "API key" and a long "read access token"
function request(path, params = {}) {
    const key = getKey();
    const url = new URL(API + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const options = { headers: { accept: 'application/json' } };
    if (key.length > 40) options.headers.Authorization = `Bearer ${key}`;
    else url.searchParams.set('api_key', key);
    return fetch(url.toString(), options);
}

function toMovie(r) {
    return {
        id: r.id,
        title: r.title || r.name || '',
        year: (r.release_date || '').slice(0, 4),
        poster: r.poster_path ? `${IMG}w185${r.poster_path}` : '',
        posterLarge: r.poster_path ? `${IMG}w500${r.poster_path}` : ''
    };
}

export const MovieDB = {
    hasKey: () => !!getKey(),
    setKey(key) { try { localStorage.setItem(KEY, key.trim()); } catch (e) { /* ignore */ } cache.clear(); },
    clearKey() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } cache.clear(); },

    async search(query) {
        const q = query.trim();
        if (!q || !getKey()) return [];
        if (cache.has(q.toLowerCase())) return cache.get(q.toLowerCase());
        const res = await request('/search/movie', { query: q, include_adult: 'false', page: '1' });
        if (!res.ok) throw new Error(res.status === 401 ? 'bad-key' : `http-${res.status}`);
        const data = await res.json();
        const movies = (data.results || []).slice(0, 6).map(toMovie);
        cache.set(q.toLowerCase(), movies);
        return movies;
    },

    // Everything clue-ideas.js needs, in one request
    async details(id) {
        if (!id || !getKey()) return null;
        if (detailCache.has(id)) return detailCache.get(id);
        const job = (async () => {
            // One request: details + cast/crew + keywords + images + videos.
            // include_image_language: English images, plus ones with no text at all ("null")
            const res = await request(`/movie/${id}`, { append_to_response: 'credits,keywords,images,videos', include_image_language: 'en,null' });
            if (!res.ok) throw new Error(res.status === 401 ? 'bad-key' : `http-${res.status}`);
            const d = await res.json();
            const crew = (d.credits && d.credits.crew) || [];
            const cast = ((d.credits && d.credits.cast) || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
            const images = d.images || {};
            // Backdrops: prefer clean stills with no text on them, then the best-rated
            const backdrops = (images.backdrops || []).slice().sort((a, b) =>
                ((a.iso_639_1 === null ? 1 : 0) - (b.iso_639_1 === null ? 1 : 0)) * -10 + ((b.vote_average || 0) - (a.vote_average || 0)));
            const backdropPath = (backdrops[0] && backdrops[0].file_path) || d.backdrop_path || '';
            // Title logos: the English one with the best rating
            const logos = (images.logos || []).filter(l => l.iso_639_1 === 'en' || l.iso_639_1 === null)
                .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
            // Trailers: official YouTube trailers first, then teasers, sharpest first
            const videos = ((d.videos && d.videos.results) || []).filter(v => v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type))
                .sort((a, b) => (b.type === 'Trailer') - (a.type === 'Trailer') || (b.official === true) - (a.official === true) || (b.size || 0) - (a.size || 0));
            // Stills for the reveal montage: images from the movie itself. Only backdrops with
            // no text on them (iso_639_1 null); posters and titled key art are never used.
            const stillPaths = [...new Set((images.backdrops || [])
                .filter(b => b.iso_639_1 === null && b.file_path)
                .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
                .map(b => b.file_path))].slice(0, 15);
            return {
                stills: stillPaths.map(p => `${IMG}w780${p}`),
                stillsSmall: stillPaths.map(p => `${IMG}w300${p}`),     // phones and Arcade's pixel look
                backdrop: backdropPath ? `${IMG}w1280${backdropPath}` : '',
                backdropSmall: backdropPath ? `${IMG}w780${backdropPath}` : '',
                logo: logos[0] ? `${IMG}w500${logos[0].file_path}` : '',
                trailerKey: videos[0] ? videos[0].key : '',
                id: d.id,
                title: d.title || '',
                year: (d.release_date || '').slice(0, 4),
                runtime: d.runtime || 0,
                genres: (d.genres || []).map(g => g.name),
                directors: crew.filter(c => c.job === 'Director').map(c => c.name),
                cast: cast.slice(0, 4).map(c => ({ name: c.name, character: c.character || '' })),
                countries: (d.production_countries || []).map(c => c.name),
                language: d.original_language || '',
                keywords: ((d.keywords && (d.keywords.keywords || d.keywords.results)) || []).map(k => k.name),
                tagline: d.tagline || '',
                collection: d.belongs_to_collection ? d.belongs_to_collection.name : '',
                budget: d.budget || 0,
                rating: d.vote_average || 0,
                votes: d.vote_count || 0
            };
        })();
        detailCache.set(id, job);
        job.catch(() => detailCache.delete(id));        // let a failed lookup be retried
        return job;
    },

    async test() {
        try { const res = await request('/configuration'); return res.ok; }
        catch (e) { return false; }
    }
};
