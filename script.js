// One Piece (ID: 21) is my extreme tester
// Most likely cannot retrieve all voice actors and staff, but the most relavent 100-200 should be more than adequete in my opinion...
// As of 9/17/26 the API limit is 30 queries a minute with 25 entries per page. Ideally you'd get 750 total characters/staff members per limit.
const URL = 'https://graphql.anilist.co';

let lastApiHeader = null;

class Anime {
    staff = [];
    hasNextPage = true;
    currentPage = 1;
    constructor(id){
        this.id = id;
    }
}

let selection1 = null;
let selection2 = null;

function checkLimit(){
    if(!lastApiHeader){return true;}
    let limit = lastApiHeader.get('x-ratelimit-remaining');
    let retry = lastApiHeader.get('retry-after');
    console.log(limit);
    if(limit <= 0){
        window.alert(`You have exceeded API limit.\nTry again in ~${retry}s`);
        console.log("No more API. Try again in ", retry);
        return false;
    }
    return limit;
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
    if(!ev.target.value?.length){notice.style.display = "none";return;} // Do not run if input is blank
    let sugg = ev.target.parentElement.getElementsByClassName('suggestions')[0] ;
    let notice = ev.target.parentElement.getElementsByClassName('notice')[0];
    sugg.style.display = "none";
    notice.style.display = "block";
    notice.innerHTML = `<p>Searching...</p>`;
}, 200);

// Send API request to fetch 8 suggestions based on search query
const searchSuggestions = debounce(async (ev) => {
    if(!ev.target.value?.length){return;} // Do not run if input is blank
    const query = `
        query ($search: String!, $perPage: Int) {
            Page(perPage: $perPage) {
                media(search: $search, type: ANIME) {
                id
                seasonYear
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
    sugg.scrollTop = 0;

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
                <div class="details">
                    <div class="title">${s.title.english || s.title.romaji || s.title.native}</div>
                    <div class="year">${s.seasonYear}</div>
                </div>
            `;
            ele.addEventListener('click', (ev) => {
                if (id == 'a-search-1') {
                    selection1 = new Anime(s.id);
                } else {
                    selection2 = new Anime(s.id);
                }
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

const searchButton = document.getElementById("compare-button");

// I want to fetch all staff instead of just voice actors, but that seems to be quite difficult since they seperate same entry staff members to different roles.
// In other words, different roles can have the same staff member, so 1 query could be filled with a single person 25 times since they had 25 different roles.
// This query fetches 25 characters at a time along with all of their attached voice actors.
// It will only return VA's for that media ID since the same character can have other VA's in a different season/iteration of the same anime.
// It is technically only 25 characters, but each one can have dozens of voice actors.
async function fetchStaff(mediaId, page){
    const query = `
    query ($mediaId: Int, $page: Int) {
        Media(id: $mediaId) {
            characters(page: $page) {
            pageInfo {
                perPage
                currentPage
                hasNextPage
            }
            edges { # Array of character edges
                node {
                name {
                    full # Character name
                }
                siteUrl # Link to character on AniList
                image {
                    medium # Character image
                }
                }
                role
                voiceActors { # Array of voice actors of this character for the anime
                id
                name {
                    full # VA name
                }
                languageV2 # What language they speak
                image {
                    medium # VA Image
                }
                }
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
            variables: {mediaId: mediaId, page: page}
        })
    };
    return fetch(URL, options).then(async (results) => {
        lastApiHeader = results.headers;
        if (results.ok) {
            return results.json();
        } else {
            console.log("ruh roh");
            return results.json().then(data => {
                window.alert(`Error Code: ${results.status}\n${data.errors[0].message}`)
            });
        }
    });
}

async function fetchAll(){
    let currentAnime = null;
    // Does not determine if alternating, just a helper boolean for the loop.
    let alternateFlag = true;
    // This will use the rest of the limit
    while(checkLimit()){
        currentAnime = alternateFlag ? selection1 : selection2;
        // If there is nothing left to query switch anime again
        if(!currentAnime.hasNextPage){
            currentAnime = !alternateFlag ? selection1 : selection2;
            // If neither anime has nothing left, just break the loop
            if(!currentAnime.hasNextPage){break;}
        }
        alternateFlag = !alternateFlag;

        // console.log("Fetching ", currentAnime.id);
        let results = await fetchStaff(currentAnime.id, currentAnime.currentPage);
        currentAnime.staff = currentAnime.staff.concat(results.data.Media.characters.edges);
        currentAnime.hasNextPage = results.data.Media.characters.pageInfo.hasNextPage;
        currentAnime.currentPage++;
        // break;
    }
    if(selection1.hasNextPage || selection2.hasNextPage){
        console.log("There's more characters, but we ran out of API requests...")
    }
    console.log(selection1);
    console.log(selection2);
}

searchButton.addEventListener("click", () => {
    // Do not compare if both selection aren't ready
    if(!(selection1 && selection2)){console.log("need some selecting");return;}
    fetchAll();
});