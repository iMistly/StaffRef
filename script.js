// API URL
const URL = 'https://graphql.anilist.co';

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

            debounceTimer = setTimeout(() => fetchSuggestions(query, input), 500);
        });
    }

    // Add event listener to search button
    // document.getElementById('search-button').addEventListener('click', compareShows);
});

// Get suggestions from AniList
async function fetchSuggestions(animeName, inputField) {
    const perPage = 8;
    const query = `
    query ($name: String!) {
        Page(perPage: ${perPage}) {
            pageInfo {
                currentPage
                hasNextPage
            }
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

    var options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: {name: animeName}
        })
    };

    var results = await (async () => {
        try {
            return await (await fetch(URL, options)).json();
        } catch (error) {
            alert(`Could not search API\n${error}`)
        }
    })();

    const suggestions = results.data.Page.media.map(media => `
        <div class="listItem">
            <img src="${media.coverImage.medium}" alt="No Image">
            <p>${media.title.english || media.title.native}</p>
        </div>
    `).join('');
    
}

function fetchAllStaff(id) {
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
}

function fetchAllCharacters(id) {
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