const URL = 'https://graphql.anilist.co';

let apiLimit = null;
let currentSelection = {};

const search1 = document.getElementById('a-search-1');
const search2 = document.getElementById('a-search-2');

// Sourced https://www.joshwcomeau.com/snippets/javascript/debounce/
const debounce = (callback, wait) => {
  let timeoutId = null;

  return (...args) => {
    window.clearTimeout(timeoutId);

    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}

const searchSuggestions = debounce(async (ev) => {
    const query = `
        query ($search: String!, $perPage: Int) {
            Page(perPage: $perPage) {
                media(search: $search, type: ANIME) {
                id
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    medium
                }
                }
            }
        }`;
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: {search: ev.target.value, perPage: 8}
        })
    };
    let results = await fetch(URL, options);
    apiLimit = await results.headers.get('x-ratelimit-remaining');
    console.log(apiLimit);
    let data = await results.json();
    renderSuggestions(data.data.Page.media, ev.target.id)
}, 400);

function renderSuggestions(suggestions, id){
    let par = document.getElementById(id).parentElement;
    let sugg = par.getElementsByClassName("suggestions")[0];
    let cover = par.getElementsByClassName("cover")[0];

    suggestions.map((s) => {
        let ele = document.createElement('div');
        ele.classList.add('list-item');
        ele.id = `ani-${s.id}`;
        ele.innerHTML = `
            <img src="${s.coverImage.medium}">
            <div class="title">${s.title.english || s.title.romaji || s.title.native}</div>
        `;
        ele.addEventListener('click', (ev) => {
            currentSelection[id] = ev.target.id.split('-')[1];
            console.log(currentSelection);
            cover.innerHTML = `<img src="${s.coverImage.medium}">`;
        });
        sugg.appendChild(ele);
    });
}

[search1,search2].map((e) => e.addEventListener('input', searchSuggestions));