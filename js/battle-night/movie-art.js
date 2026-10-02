/* Battle Night: movie backdrops and title logos from TMDB */
import { MovieDB } from '../features/movie-lookup.js';

// ---------- Backdrops and title logos (from TMDB, when available) ----------
// Loads the images first, so nothing pops in half-drawn; quietly does nothing
// if there's no key, no TMDB movie, or the movie has no artwork.
export async function movieArt(movie) {
    if (!movie || !movie.id || !MovieDB || !MovieDB.hasKey()) return null;
    try { return await MovieDB.details(movie.id); } catch (e) { return null; }
}
function loadImage(src) {
    return new Promise(resolve => {
        if (!src) return resolve(false);
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
    });
}
export async function dress(movie, { bg, logo, title, onBackdrop, posterFallback }) {
    const d = await movieArt(movie);
    const backdrop = d && (window.innerWidth < 700 ? d.backdropSmall : d.backdrop);
    if (bg) {
        if (backdrop && await loadImage(backdrop)) {
            bg.style.backgroundImage = `url("${backdrop}")`;
            bg.classList.add('loaded');
            if (onBackdrop) onBackdrop();
        } else if (posterFallback && movie && (movie.posterLarge || movie.poster) && await loadImage(movie.posterLarge || movie.poster)) {
            bg.style.backgroundImage = `url("${movie.posterLarge || movie.poster}")`;
            bg.classList.add('loaded', 'from-poster');           // blurred poster instead
        }
    }
    if (logo && d && d.logo && await loadImage(d.logo)) {
        logo.src = d.logo;
        logo.hidden = false;
        if (title) title.classList.add('has-logo');                // keep the text for screen readers
    }
}
