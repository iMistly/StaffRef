// API URL
const url = 'https://graphql.anilist.co';

let debounceTimer;

let selection = {};

// Wait for document to load
document.addEventListener('DOMContentLoaded', () => {
    const searchFields = document.getElementsByClassName('search-field');
    // Add event listeners to each search field
    for (let i = 0; i < searchFields.length; i++) {
        const input = searchFields[i];
        const list = input.parentElement.querySelector('.suggestions');

        // Add event listeners to each search field
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = input.value.trim();

            if (!query) { list.style.display = 'none'; return; }    

            debounceTimer = setTimeout(() => fetchSuggestions(query, input.parentElement.getAttribute('id')), 500);
        });
    }

    // Add event listener to search button
    document.getElementById('search-button').addEventListener('click', compareShows);
});

// Get suggestions from AniList
async function fetchSuggestions(animeName, id) {
    const query = `
    query ($name: String!) {
        Page(perPage: 8) {
            media(search: $name, type: ANIME) {
                id
                title {
                    english
                    native
                }
                coverImage {
                    medium
                }
            }
        }
    }`;

    const variables = { name: animeName };
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    const suggestions = data.data.Page.media;
    const list = document.getElementById(id).querySelector('.suggestions');

    if (suggestions.length === 0) {
        list.style.display = 'none';
        return;
    }

    list.style.display = 'block';
    list.innerHTML = '';

    for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        const title = suggestion.title.english || suggestion.title.native;
        const listItem = document.createElement('div');
        listItem.setAttribute('id', `AniListID-${suggestion.id}`);
        listItem.classList.add('listItem');
        listItem.innerHTML = `
            <img src="${suggestion.coverImage.medium}" alt="${title}">
            <p>${title}</p>
        `;

        listItem.addEventListener('click', () => {
            const input = document.getElementById(id).querySelector('.search-field');
            input.value = title;
            list.style.display = 'none';
            const cover = document.getElementById(id).querySelector('.cover');
            cover.src = suggestion.coverImage.medium;
            cover.style.display = 'block';
            cover.alt = title;
            selection[id] = suggestion;
        });

        list.appendChild(listItem);
    }
}

const MAX_PAGES = 5; // safety cap — ~250 entries, avoids runaway loops on huge shows

async function fetchAllStaff(id) {
    const query = `
    query ($id: Int, $page: Int) {
        Media(id: $id, type: ANIME) {
            staff(page: $page, perPage: 25, sort: RELEVANCE) {
                pageInfo { hasNextPage }
                edges {
                    role
                    node {
                        id
                        name { full }
                        image { medium }
                    }
                }
            }
        }
    }`;

    let page = 1;
    let hasNextPage = true;
    let allEdges = [];

    while (hasNextPage && page <= MAX_PAGES) {
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { id, page } })
        };
        const response = await fetch(url, options);
        const data = await response.json();
        const staff = data.data.Media.staff;

        allEdges = allEdges.concat(staff.edges);
        hasNextPage = staff.pageInfo.hasNextPage;
        page++;
    }

    return allEdges;
}

async function fetchAllCharacters(id) {
    const query = `
    query ($id: Int, $page: Int) {
        Media(id: $id, type: ANIME) {
            characters(page: $page, perPage: 25, sort: ROLE) {
                pageInfo { hasNextPage }
                edges {
                    node {
                        id
                        name { full }
                    }
                    voiceActors(sort: LANGUAGE) {
                        id
                        name { full }
                        languageV2
                        image { medium }
                    }
                }
            }
        }
    }`;

    let page = 1;
    let hasNextPage = true;
    let allEdges = [];

    while (hasNextPage && page <= MAX_PAGES) {
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { id, page } })
        };
        const response = await fetch(url, options);
        const data = await response.json();
        const characters = data.data.Media.characters;

        allEdges = allEdges.concat(characters.edges);
        hasNextPage = characters.pageInfo.hasNextPage;
        page++;
    }

    return allEdges;
}

async function fetchMediaDetails(id) {
    const [staffEdges, characterEdges] = await Promise.all([
        fetchAllStaff(id),
        fetchAllCharacters(id)
    ]);

    return {
        staff: { edges: staffEdges },
        characters: { edges: characterEdges }
    };
}

function buildStaffMap(media) {
    const map = new Map();
    media.staff.edges.forEach(edge => {
        map.set(edge.node.id, {
            name: edge.node.name.full,
            role: edge.role,
            image: edge.node.image?.medium
        });
    });
    return map;
}

function buildVAMap(media) {
    const map = new Map();
    media.characters.edges.forEach(edge => {
        const character = edge.node.name.full;
        edge.voiceActors.forEach(va => {
            map.set(va.id, {
                name: va.name.full,
                language: va.languageV2 || 'Unknown',
                character,
                image: va.image?.medium
            });
        });
    });
    return map;
}

function intersect(map1, map2) {
    const result = [];
    for (const [id, val1] of map1) {
        if (map2.has(id)) result.push({ a: val1, b: map2.get(id) });
    }
    return result;
}

async function compareShows() {
    const a1 = selection['ani1'];
    const a2 = selection['ani2'];

    if (!a1 || !a2) {
        alert('Please select both anime first.');
        return;
    }

    document.getElementById('result').innerHTML = '<p>Loading...</p>';

    const [media1, media2] = await Promise.all([
        fetchMediaDetails(a1.id),
        fetchMediaDetails(a2.id)
    ]);

    const staffMatches = intersect(buildStaffMap(media1), buildStaffMap(media2));
    const vaMatches = intersect(buildVAMap(media1), buildVAMap(media2));

    renderResults(staffMatches, vaMatches);
}

function renderResults(staffMatches, vaMatches) {
    const resultDiv = document.getElementById('result');

    if (staffMatches.length === 0 && vaMatches.length === 0) {
        resultDiv.innerHTML = '<p>No shared staff or voice actors found.</p>';
        return;
    }

    const byLanguage = {};
    vaMatches.forEach(match => {
        (byLanguage[match.a.language] ||= []).push(match);
    });

    let html = '';

    if (vaMatches.length > 0) {
        html += '<h3>Shared Voice Actors</h3>';
        for (const lang in byLanguage) {
            html += `<h4>${lang}</h4><div class="match-list">`;
            byLanguage[lang].forEach(m => {
                html += `
                    <div class="match-row">
                        <img src="${m.a.image}" alt="${m.a.name}">
                        <p>${m.a.name} — "${m.a.character}" / "${m.b.character}"</p>
                    </div>`;
            });
            html += '</div>';
        }
    }

    if (staffMatches.length > 0) {
        html += '<h3>Shared Staff</h3><div class="match-list">';
        staffMatches.forEach(m => {
            html += `
                <div class="match-row">
                    <img src="${m.a.image}" alt="${m.a.name}">
                    <p>${m.a.name} — ${m.a.role} / ${m.b.role}</p>
                </div>`;
        });
        html += '</div>';
    }

    resultDiv.innerHTML = html;
}