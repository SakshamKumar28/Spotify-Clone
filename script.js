console.log("Lets Start!");
let songs;
let currentSong = new Audio();
let currfolder;
// DOM element references (defined after DOM is available; script is loaded at end of body)
const play = document.getElementById("play");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
function secondsToMinutesSeconds(seconds) {
    if(isNaN(seconds) || seconds<0){
        return "00:00";
    }
    // Calculate whole minutes and seconds
    var minutes = Math.floor(seconds / 60);
    var remainingSeconds = seconds % 60;

    // Ensure both minutes and seconds are two digits
    var minutesFormatted = String(minutes).padStart(2, '0');
    var secondsFormatted = String(parseInt(remainingSeconds)).padStart(2, '0');

    // Return formatted time string
    return minutesFormatted + ':' + secondsFormatted;
}
const playMusic = (track, pause = false)=>{
    currentSong.src = `/${currfolder}/` + decodeURIComponent(track);
    if(!pause){
        currentSong.play();
        play.src = "/svg/pause.svg";
    }
    
    // Show a friendly song name (decoded and without extension)
    try{
        const displayName = decodeURIComponent(track).replace(/\.mp3$/i, "");
        document.querySelector(".songinfo").innerHTML = displayName;
    }catch(err){
        document.querySelector(".songinfo").innerHTML = track;
    }
    document.querySelector(".songtime").innerHTML = "00:00 / 00:00";
}
async function getsongs(folder){
    // Use relative path so the page works regardless of host/port the user serves files from
    let a;
    try{
        a = await fetch(`/${folder}/`);
    }catch(err){
        console.error(`Failed to fetch /${folder}/ :`, err);
        songs = [];
        return;
    }
    currfolder = folder;
    if(!a.ok){
        console.error(`Fetch /${folder}/ returned status ${a.status}`);
        songs = [];
        return;
    }
    let response = await a.text();
    console.debug(`getsongs: fetched /${folder}/, response length=${response.length}`);
    let div = document.createElement("div");
    div.innerHTML = response;
    let as = div.getElementsByTagName("a");
    console.debug(`getsongs: found ${as.length} anchor(s) in directory listing for /${folder}/`);
    songs= [];
    const albumName = folder.split('/').slice(-1)[0];
    for (let index = 0; index < as.length; index++) {
        const element = as[index];
        try{
            // Use attribute href if available to preserve original formatting
            let rawHref = element.getAttribute && element.getAttribute('href') ? element.getAttribute('href') : element.href;
            if (!rawHref) continue;
            // Some servers (or Windows) produce backslashes in paths which may be percent-encoded (%5C).
            // Normalize to forward-slashes so splitting works reliably.
            try{
                rawHref = decodeURIComponent(rawHref);
            }catch(_){
                // If decode fails, keep rawHref as-is
            }
            const normalized = rawHref.replace(/\\/g, '/');
            // Only consider mp3 entries
            if (!normalized.toLowerCase().endsWith('.mp3')) continue;

            // Try to find the album segment "/<albumName>/" in the normalized URL
            const segment = `/${albumName}/`;
            let result = null;
            const idx = normalized.lastIndexOf(segment);
            if (idx !== -1) {
                result = normalized.slice(idx + segment.length);
            } else {
                // Fallback: take the last path segment after last '/'
                const lastSlash = normalized.lastIndexOf('/');
                result = lastSlash !== -1 ? normalized.slice(lastSlash + 1) : normalized;
            }
            result = result.replace(/^\//, '');
            if (!result) {
                console.warn(`Split returned empty result for href=${rawHref} normalized=${normalized} album=${albumName}`);
                continue;
            }
            songs.push(encodeURI(result));
        }catch(e){
            console.error('Error processing anchor element', element, e);
        }
    }
    console.debug('getsongs: parsed songs:', songs);
    // Fallback: if directory listing didn't expose .mp3 anchors, try a manifest file (index.json / tracks.json)
    if (songs.length === 0) {
        try{
            const tryFiles = [`/songs/${folder.split('/').slice(-1)[0]}/tracks.json`, `/songs/${folder.split('/').slice(-1)[0]}/index.json`];
            for (const file of tryFiles) {
                try{
                    const r = await fetch(file);
                    if (!r.ok) continue;
                    const json = await r.json();
                    if (Array.isArray(json) && json.length>0) {
                        console.debug('getsongs: loaded manifest', file, json);
                        // expect array of filenames (e.g. ["song1.mp3", ...])
                        songs = json.map(s=> encodeURI(s));
                        break;
                    }
                }catch(e){
                    // ignore and try next
                }
            }
        }catch(e){
            console.debug('getsongs: manifest fallback failed', e);
        }
    }
    let songUL = document.querySelector(".songlist").getElementsByTagName("ul")[0];
    songUL.innerHTML = "";
    let songstore = []
    for (const song of songs) {
        const display = decodeURIComponent(song).replace(/\.mp3$/i, "");
        songUL.innerHTML = songUL.innerHTML + `<li>
                        <img src="/svg/music.svg" alt="">
                        <div class="info">
                            <div>${display}</div>
                            <div>Saksham Kumar</div>
                        </div>
                        <span>Play Now <i class="fa-solid fa-play"></i></span>
                    </li>`;
        songstore.push(song);
    }
    Array.from(document.querySelector(".songlist").getElementsByTagName("li")).forEach(e=>{
        e.addEventListener("click",ele=>{
            for (const i of songstore) {
                const displayI = decodeURIComponent(i).replace(/\.mp3$/i, "");
                if (e.querySelector(".info").firstElementChild.innerHTML == displayI){
                    playMusic(i.trim())
                }
            }
        })
    })
}


async function displayAlbums(){
    // Use relative path so listing works with any local server / port
    let a = await fetch("/songs/");
    if (!a.ok) {
        console.error(`/songs/ listing returned ${a.status}`);
        return;
    }
    let response = await a.text();
    let div = document.createElement("div");
    div.innerHTML = response;
    let anchors = div.getElementsByTagName("a");
    let cardContainer = document.querySelector(".cardContainer")

    // Collect unique folder names under /songs/
    const folders = new Set();
    for (let i = 0; i < anchors.length; i++) {
        const el = anchors[i];
        let rawHref = el.getAttribute && el.getAttribute('href') ? el.getAttribute('href') : el.href;
        if (!rawHref) continue;
        try{
            rawHref = decodeURIComponent(rawHref);
        }catch(_){ }
        const normalized = rawHref.replace(/\\/g, '/');
        // find segment /songs/<folderName>/ or /songs/<folderName>
        const match = normalized.match(/\/songs\/([^\/]+)/i);
        if (match && match[1]) {
            const folder = match[1].replace(/\/+$/,'');
            // skip parent/ current dir markers
            if (folder && folder !== '.' && folder !== '..') folders.add(folder);
        }
    }

    // If no folders found via anchors, try a simple fallback: look for directories by parsing links that end with '/'
    if (folders.size === 0) {
        for (let i = 0; i < anchors.length; i++) {
            const el = anchors[i];
            const txt = (el.textContent || el.innerText || '').trim();
            if (txt && txt.endsWith('/')) {
                const folder = txt.replace(/\/+$/,'');
                if (folder && folder !== '.' && folder !== '..') folders.add(folder);
            }
        }
    }

    // Render cards for each folder
    for (const folder of folders) {
        try{
            const infoResp = await fetch(`/songs/${folder}/info.json`);
            if(!infoResp.ok){
                console.warn(`/songs/${folder}/info.json returned ${infoResp.status}`);
                continue;
            }
            const info = await infoResp.json();
            const title = info.title || folder;
            const desc = info.description || '';
            cardContainer.innerHTML += `<div data-folder="${folder}" class="card">
                    <div class="play-button">
                        <i class="fa-solid fa-play" style="color: #000000;"></i>
                    </div>
                    <div class = "image">
                    <img src="/songs/${folder}/cover.jpg" alt="image"></div>
                    <h3>${title}</h3>
                    <p>${desc}.</p>
                </div>`;
        }catch(e){
            console.error('Error rendering card for', folder, e);
        }
    }

    // Wire up click handlers
    Array.from(document.getElementsByClassName("card")).forEach(e=>{
        e.addEventListener("click", async item=>{
            await getsongs(`songs/${item.currentTarget.dataset.folder}`)
            if (!songs || songs.length === 0) {
                console.warn('No songs found for', item.currentTarget.dataset.folder);
                return;
            }
            playMusic(songs[0], true)
        })
    })
}
async function main(){

    await getsongs("songs/bollywood");
    if (!songs || songs.length === 0) {
        console.warn('No songs found in songs/bollywood on initial load');
    } else {
        playMusic(songs[0], true);
    }

    //display all the albums
    displayAlbums();

    play.addEventListener("click",()=>{
        if(currentSong.paused){
            currentSong.play();
            play.src = "/svg/pause.svg";
        }
        else{
            currentSong.pause();
            play.src = "/svg/play.svg";
            
        }
    })

    currentSong.addEventListener("timeupdate",()=>{
        // Avoid NaN/divide-by-zero when duration isn't available yet
        const current = currentSong.currentTime || 0;
        const dur = currentSong.duration || 0;
        document.querySelector(".songtime").innerHTML = `${secondsToMinutesSeconds(current)}/${secondsToMinutesSeconds(dur)}`;
        if (dur > 0) {
            document.querySelector(".circle").style.left = (current/dur)*100 + "%";
        } else {
            document.querySelector(".circle").style.left = "0%";
        }
    })

    document.querySelector(".seekbar").addEventListener("click", e=>{
        let percent = (e.offsetX/e.target.getBoundingClientRect().width)*100
        document.querySelector(".circle").style.left = percent + "%";
        currentSong.currentTime = (currentSong.duration*percent)/100
    })

    document.querySelector(".hamburger").addEventListener("click",()=>{
        document.querySelector(".left").style.left = "0%";
    })

    document.querySelector(".close").addEventListener("click",()=>{
        document.querySelector(".left").style.left = "-100%";
    })

    previous.addEventListener("click",()=>{
        let index = songs.indexOf(currentSong.src.split("/").slice(-1)[0])
        if ((index-1) >= 0) {
            
            playMusic(songs[index-1])
        }
    })

    next.addEventListener("click",()=>{
        currentSong.pause();
        let index = songs.indexOf(currentSong.src.split("/").slice(-1)[0])
        if ((index+1) < (songs.length)) {
            
            playMusic(songs[index+1])
        }
    })

    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change",(e)=>{
        currentSong.volume = parseInt(e.target.value)/100;
    })

    

}
main()