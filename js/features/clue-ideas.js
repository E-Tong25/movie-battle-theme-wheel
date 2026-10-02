/* ==========================================================================
   CLUE IDEAS
   Turns TMDB facts about a movie into clue suggestions, in three levels
   that match how the clues unlock during the countdown:
     1 = vague (decade, length, how people rated it)
     2 = medium (genre, plot keywords, where it was made)
     3 = a real hint (director's initials, a star's first name, the tagline)
   Spoiler guard: nothing containing a word from the title, and names are
   only ever shown as initials or first names.

     ClueIdeas.generate(details) -> { 1: [...], 2: [...], 3: [...] }
   ========================================================================== */
const SMALL = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'to', 'for', 'at', 'is', 'it', 'with', 'part', 'movie', 'film']);

// Plot keywords TMDB uses that make better clues when reworded
const KEYWORD_PHRASES = {
    'based on novel or book': 'Based on a book',
    'based on comic': 'Based on a comic',
    'based on true story': 'Inspired by a true story',
    'based on a true story': 'Inspired by a true story',
    'biography': 'About a real person',
    'sequel': 'It\u2019s a sequel',
    'remake': 'It\u2019s a remake',
    'woman director': 'Directed by a woman',
    'duringcreditsstinger': 'Stay for the credits',
    'aftercreditsstinger': 'Stay for the credits',
    'musical': 'Expect singing',
    'time travel': 'Involves time travel',
    'heist': 'Features a heist',
    'bank robbery': 'Features a bank robbery',
    'serial killer': 'There\u2019s a serial killer on the loose',
    'dystopia': 'Set in a dystopia',
    'post-apocalyptic future': 'Set after the end of the world',
    'female protagonist': 'Led by a woman',
    'coming of age': 'A coming-of-age story',
    'high school': 'High school is involved',
    'alien': 'Aliens are involved',
    'zombie': 'Zombies are involved',
    'vampire': 'Vampires are involved',
    'road trip': 'There\u2019s a road trip',
    'revenge': 'Someone wants revenge',
    'christmas': 'Christmas is involved',
    'wedding': 'There\u2019s a wedding',
    'dog': 'A dog plays a part'
};
const SKIP_KEYWORDS = /^(duringcreditsstinger|aftercreditsstinger)$/;   // only used via KEYWORD_PHRASES
const LANGUAGES = { fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', cn: 'Cantonese',
                    hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', nl: 'Dutch',
                    pl: 'Polish', tr: 'Turkish', ar: 'Arabic', fa: 'Persian', th: 'Thai', he: 'Hebrew', id: 'Indonesian' };

const titleWords = title => (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 3 && !SMALL.has(w));
const mentionsTitle = (text, words) => {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ') + ' ';
    return words.some(w => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's '));
};
const initials = name => name.split(/\s+/).filter(Boolean).map(p => p[0].toUpperCase() + '.').join('');
const firstName = name => name.split(/\s+/)[0];
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const article = word => (/^[aeiou]/i.test(word) ? 'an' : 'a');
// Countries that read as "the United Kingdom", "the Netherlands"...
const place = c => (/^(United|Netherlands|Czech|Philippines|Bahamas|Dominican|Gambia|Maldives)/.test(c) ? `the ${c}` : c);
// Ranks and titles in character names ("Lt. Vincent Hanna" -> "Vincent")
const TITLES = /^(lt|lieutenant|dr|doctor|mr|mrs|ms|miss|detective|det|captain|capt|sgt|sergeant|officer|agent|professor|prof|sir|lord|lady|king|queen|prince|princess|uncle|aunt|father|mother|sister|brother|general|colonel|major|judge|coach|young|old|little|big)\.?$/i;

function decade(year) {
    const y = Number(year);
    if (!y) return null;
    const d = Math.floor(y / 10) * 10, part = y % 10 <= 3 ? 'early' : y % 10 <= 6 ? 'mid' : 'late';
    const label = d >= 2000 ? `${d}s` : `\u2019${String(d).slice(2)}s`;
    return { plain: `Came out in the ${label}`, finer: `Came out in the ${part} ${label}` };
}

function runtimeLine(minutes) {
    if (!minutes) return null;
    if (minutes < 90) return 'Short and sweet: under an hour and a half';
    if (minutes <= 105) return 'About an hour and a half long';
    if (minutes <= 125) return 'Just about two hours long';
    if (minutes < 150) return 'A bit over two hours';
    if (minutes < 175) return 'Bring snacks: it\u2019s nearly three hours';
    return 'Bring snacks: it\u2019s over three hours';
}

function genreLine(genres) {
    const g = genres.map(x => x.toLowerCase());
    if (!g.length) return null;
    if (g.length === 1) return `${capitalize(article(g[0]))} ${g[0]} movie at heart`;
    const [a, b] = g;
    const joined = ['drama', 'comedy', 'thriller'].includes(b) ? `${a} ${b}` : `${a}-meets-${b}`;
    return `${capitalize(article(joined))} ${joined}`;
}

function generate(d) {
    if (!d) return { 1: [], 2: [], 3: [] };
    const words = titleWords(d.title);
    const ok = text => text && !mentionsTitle(text, words);
    const out = { 1: [], 2: [], 3: [] };
    const add = (level, text) => { if (ok(text) && !out[level].includes(text)) out[level].push(text); };

    // ----- Level 1: vague -----
    const dec = decade(d.year);
    if (dec) add(1, dec.plain);
    add(1, runtimeLine(d.runtime));
    if (d.votes >= 50 && d.rating) {
        const r = Math.round(d.rating * 2) / 2;
        add(1, r >= 7.5 ? `Audiences love it: about ${r} out of 10` : r >= 6 ? `Audiences rate it about ${r} out of 10` : `Audiences were\u2026 unkind: about ${r} out of 10`);
    }
    if (d.language && d.language !== 'en') add(1, LANGUAGES[d.language] ? `Not in English: it\u2019s in ${LANGUAGES[d.language]}` : 'Not in English');
    if (d.budget >= 150e6) add(1, 'A big-budget blockbuster');
    else if (d.budget > 0 && d.budget <= 5e6) add(1, 'Made on a shoestring budget');

    // ----- Level 2: medium -----
    add(2, genreLine(d.genres));
    if (d.collection) add(2, 'Part of a franchise');
    const nonUS = d.countries.filter(c => c !== 'United States of America');
    if (nonUS.length && d.countries.length) add(2, nonUS.length === d.countries.length ? `Made in ${place(nonUS[0])}` : `A co-production with ${place(nonUS[0])}`);
    const plain = [];
    d.keywords.forEach(k => {
        const key = k.toLowerCase();
        if (KEYWORD_PHRASES[key]) add(2, KEYWORD_PHRASES[key]);
        else if (key.startsWith('based on ')) add(2, capitalize(key.replace(/^based on (?!a |an |the )/, 'based on a ')));
        else if (!SKIP_KEYWORDS.test(key) && !key.includes(',') && key.length <= 28 && ok(key)) plain.push(key);
        // TMDB writes places as "los angeles, california"
        else if (key.includes(',')) { const place = key.split(',')[0].trim(); if (ok(place)) add(2, `Set in ${place.replace(/\b\w/g, c => c.toUpperCase())}`); }
    });
    if (plain.length >= 2) add(2, `Think: ${plain[0]}, ${plain[1]}`);
    if (plain.length >= 4) add(2, `Think: ${plain[2]}, ${plain[3]}`);
    if (dec) add(2, dec.finer);                       // last: it mostly narrows down clue 1's decade

    // ----- Level 3: a real hint -----
    if (d.directors[0]) add(3, `Directed by someone with the initials ${initials(d.directors[0])}`);
    if (d.cast[0] && d.cast[1]) {
        const [x, y] = [firstName(d.cast[0].name), firstName(d.cast[1].name)];
        add(3, `Stars ${article(x)} \u201C${x}\u201D and ${article(y)} \u201C${y}\u201D`);
    }
    else if (d.cast[0]) add(3, `One of the stars goes by ${firstName(d.cast[0].name)}`);
    d.cast.slice(0, 3).forEach(c => {
        const parts = (c.character || '').replace(/\(.*?\)/g, '').replace(/^(the|a)\s+/i, '').trim().split(/\s+/).filter(p => !TITLES.test(p));
        const ch = parts[0] || '';
        if (ch && ch.length > 2 && !/^(himself|herself|narrator|voice)$/i.test(ch)) add(3, `One character is named ${capitalize(ch)}`);
    });
    if (d.tagline && d.tagline.length <= 90) {
        if (ok(d.tagline)) add(3, `Its tagline: \u201C${d.tagline}\u201D`);
    }
    if (d.year) add(3, `Released in ${d.year}`);

    return out;
}

export const ClueIdeas = { generate };
