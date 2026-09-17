const URL = 'https://graphql.anilist.co';

let lastApiHeader = null;
let currentSelection = {};

// TODO
function checkLimit(){
    if(!lastApiHeader){return;}
    let limit = lastApiHeader.get('x-ratelimit-remaining');
    let retry = lastApiHeader.get('retry-after');
    console.log(limit, retry);
    // if(limit <= 0){
    //     window.alert(`You have exceeded API limit.\nTry again in ~${retry}s`)
    // }
}

/////////////////////////////////////
//////////   Suggestions   //////////
/////////////////////////////////////

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

// Fake searching just to show that something is happening but not to execute queries too quickly
const showSearching = debounce((ev) => {
    let sugg = ev.target.parentElement.getElementsByClassName('suggestions')[0] ;
    let notice = ev.target.parentElement.getElementsByClassName('notice')[0];
    sugg.style.display = "none";
    notice.style.display = "block";
    notice.innerHTML = `<p>Searching...</p>`;
}, 200);

// Send API request to fetch 8 suggestions based on search query
const searchSuggestions = debounce(async (ev) => {
    if(!ev.target.value?.length){return;}
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
                    large
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
    fetch(URL, options).then(results => {
        lastApiHeader = results.headers;
        checkLimit();
        if (results.ok) {
            return results.json().then(data => {
                renderSuggestions(data.data.Page.media, ev.target.id);
            });
        } else {
            console.log("ruh roh");
            return results.json().then(data => {
                window.alert(`Error Code: ${results.status}\n${data.errors[0].message}`)
            });
        }
    });
}, 800);

// Generate html elements based on suggestions json.
function renderSuggestions(suggestions, id){
    let par = document.getElementById(id).parentElement;
    let sugg = par.getElementsByClassName("suggestions")[0];
    let cover = par.getElementsByClassName("cover")[0];
    let notice = par.getElementsByClassName("notice")[0];
    // Reset displayed suggestions
    sugg.innerHTML = '';

    if(suggestions?.length){
        // Unhide suggestions box
        notice.style.display = "none";
        sugg.style.display = "block";

        suggestions.map((s) => {
            let ele = document.createElement('div');
            ele.classList.add('list-item');
            ele.id = `ani-${s.id}`;
            ele.innerHTML = `
                <img src="${s.coverImage.medium}">
                <p class="title">${s.title.english || s.title.romaji || s.title.native}</p>
            `;
            ele.addEventListener('click', (ev) => {
                currentSelection[id] = s.id;
                console.log(currentSelection);
                cover.innerHTML = `<img src="${s.coverImage.large}">`;
            });
            sugg.appendChild(ele);
        });
    } else{ // If there are no suggestions
        sugg.style.display = "none";
        notice.style.display = "block";
        notice.innerHTML = `<p>No Search Results</p>`;
    }
}

[search1,search2].map((e) => e.addEventListener('input', (ev) => {
    showSearching(ev);
    searchSuggestions(ev);
}));

/////////////////////////////////////
/////////   Compare Staff   /////////
/////////////////////////////////////