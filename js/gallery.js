async function loadChallenge() {
    const gallery = document.getElementById('challenge-gallery');
    if (!gallery) return;
    const count = document.getElementById('gallery-count');
    const siteRoot = new URL(gallery.dataset.root || './', document.baseURI);
    try {
        const catalogUrl = new URL('data/maps.json', siteRoot);
        catalogUrl.searchParams.set('_', Date.now().toString());
        const response = await fetch(catalogUrl, { cache: 'no-store' });
        if (!response.ok) throw Error('Maps unavailable');
        const entries = await response.json();
        const maps = entries.filter(map => map.status === 'published')
            .sort((a, b) => b.edition - a.edition || a.day - b.day);
        if (count) count.textContent = `${maps.length} published ${maps.length === 1 ? 'map' : 'maps'}`;
        if (!maps.length) {
            gallery.className = 'empty-state';
            gallery.textContent = 'Collection in progress. New maps and methods will appear here.';
            return;
        }
        for (const map of maps) {
            const card = document.createElement('a');
            card.className = 'card map-card';
            card.href = new URL(map.url, siteRoot).href;
            const image = document.createElement('img');
            image.src = new URL(map.thumbnail, siteRoot).href;
            image.alt = map.title;
            image.loading = 'lazy';
            image.width = 636;
            image.height = 900;
            const meta = document.createElement('small');
            meta.textContent = `${map.edition} / DAY ${String(map.day).padStart(2, '0')} / ${map.theme}`;
            const heading = document.createElement('h2');
            heading.textContent = map.title;
            const description = document.createElement('p');
            description.textContent = map.description;
            const action = document.createElement('span');
            action.className = 'card-cta';
            action.textContent = 'View map & methods ↗';
            card.append(image, meta, heading, description, action);
            gallery.append(card);
        }
    } catch (error) {
        if (count) count.textContent = '';
        gallery.textContent = 'The map collection could not be loaded. Please try again later.';
    }
}
loadChallenge();
