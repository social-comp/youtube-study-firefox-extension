/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "webextension-polyfill";

let prevURL = undefined; // Check whether the YouTUbe URL actually same, and do not execute content script function again if it's same
// this is used to record loading timeout (2 seconds) before parsing web page
let searchLoadingTimeOut = undefined;
let videoLoadingTimeOut = undefined;
let homeLoadingTimeOut = undefined;

console.log("Running YouTube content script");

// Code to trigger data collection function

// When the YouTube Page is initially opened/loaded (at the first time)
window.addEventListener('load', function () {
    // console.log('load');
    //async wait (function triggered after couple of seconds)
    executeYTCollectFn();
});

// When YouTube Page URL is changed but still within YouTube website
if (window === top) {
    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.is_content_script) {
            executeYTCollectFn();
            sendResponse({is_content_script: true});
        }
    });
}

// This code is obsolete as I can use chrome.tabs.onUpdated event listener on the background script to gather data in a more stable way

// window.addEventListener('yt-page-data-updated', function () {
//     // console.log('url change');
//     getYouTubeSearch();
// });

function executeYTCollectFn() {
    const URL = document.URL;
    // We only execute data collection function on the YouTube website
    if (URL.startsWith("https://www.youtube.com") || URL.startsWith("http://www.youtube.com")) {
        // Only execute content script functions if the current URL differs from previous URL
        if (prevURL !== URL) {
            prevURL = URL;
            // We're at the YouTube video page
            if (URL.includes("/watch?")) {
                console.log("Encountered Video Page at " + URL);
                ytVideoPageExtraction();
            }
            // We're at the YouTube search page
            else if (URL.includes("/results?")) {
                console.log("Encountered Search Page at " + URL);
                getYouTubeSearch();
            }
            // We're at the home page
            else if (URL === "https://www.youtube.com/" || URL === "http://www.youtube.com/") {
                console.log("Encountered Home Page at " + URL);
                getYTHome();
            } else {
                console.log("Encountered Uncategorized YouTube Page Type at " + URL);
            }
        }
    }
}

/*
 *  YouTube Video Page data extraction functions
 */

// This function that will trigger getYouTubeTitleAndSendMessage() function with 2-second delay
function ytVideoPageExtraction() {
    clearTimeout(videoLoadingTimeOut);
    videoLoadingTimeOut = window.setTimeout(getYouTubeTitleAndSendMessage, 2000);
}

// The function that extracts YouTube Video's Title and send message to background script
function getYouTubeTitleAndSendMessage() {
    const unixTimestamp = Date.now();
    const date = new Date(unixTimestamp);

    //const title = document.querySelectorAll("h1.style-scope.ytd-video-primary-info-renderer")[0].querySelector("yt-formatted-string.style-scope.ytd-video-primary-info-renderer").textContent

    // Alternative approach to get YouTube video title from the page's title
    const title = document.title.slice(0, (document.title.indexOf(" - YouTube")));
    //console.log("YouTube Video URL title is: " + title);

    const videoID = extractYouTubeVideoID(document.URL);
    //console.log("YouTube Video ID is: " + videoID);

    const watchNextContainer = document.querySelector("ytd-watch-next-secondary-results-renderer");
    //const watchNextContainer = document.querySelector("#related");
    const relatedVideoCards = watchNextContainer.querySelectorAll("ytd-compact-video-renderer")

    const recommendVideos = {};
    for (let j = 0; j < relatedVideoCards.length; j++) {
        const tmp = {};
        //console.log(videos[j])
        //console.log("bb "+ videos[j].getAttribute("title"))
        tmp['title'] = relatedVideoCards[j].querySelector("#video-title").getAttribute("title");
        tmp['url'] = relatedVideoCards[j].querySelector("#thumbnail").getAttribute("href")
        recommendVideos[j] = tmp
    }

    // Sending a message from a content script to background script
    chrome.runtime.sendMessage({
        InternalUse: true, // to distinguish my message from other message.
        timestamp: unixTimestamp,
        plain_text_time: date.toString(),
        site: "YouTube",
        type: "Video",
        currentURL: document.URL,
        title: title,
        recommendVideo: recommendVideos,
        videoID: videoID
    }, function (response) {
        console.log(response.farewell);
    });
}

// Extract YouTube video ID from a given YouTube Video URL
// For analytical purpose, YouTube will embed extra information in its url link, which will make us challenging to find out whether a user opens a same video.
// https://www.youtube.com/watch?t=230&v=MuOe3NM_2Ig&feature=youtu.be -> MuOe3NM_2Ig
function extractYouTubeVideoID(YouTubeURL) {
    const videoIdentifierStartIndex = YouTubeURL.indexOf("v=") + 2;
    let videoIdentifier = "";
    if (YouTubeURL.includes("&", videoIdentifierStartIndex)) {
        const videoIdentifierEndIndex = YouTubeURL.indexOf("&", videoIdentifierStartIndex);
        videoIdentifier = YouTubeURL.slice(videoIdentifierStartIndex, videoIdentifierEndIndex);
    } else {
        videoIdentifier = YouTubeURL.slice(videoIdentifierStartIndex);
    }
    return videoIdentifier;
}

/*
 *  YouTube Search Page data extraction functions
 */

// The function that extracts YouTube search page content and send message to background script
function getYouTubeSearch() {
    // YouTube Search Page will only return top 4 results if the page is not fully loaded
    // Extract YouTube Search Result after 2 seconds timeout (need a better solution to detect YouTubeSearchResultElem stopped loading)
    clearTimeout(searchLoadingTimeOut);
    searchLoadingTimeOut = window.setTimeout(parseSearchResultsAndSendMessage, 2000);
}

// Extract YouTube's search query from YouTube's search query URL, taking account to URL encoding characters
// https://www.youtube.com/results?search_query=MC-21+300 -> MC-21 300
function extractYouTubeSearchQuery(YouTubeURL) {
    const searchIdentifierStartIndex = YouTubeURL.indexOf("search_query=") + 13;
    let searchQuery = "";
    if (YouTubeURL.includes("&", searchIdentifierStartIndex)) {
        const videoIdentifierEndIndex = YouTubeURL.indexOf("&", searchIdentifierStartIndex);
        searchQuery = YouTubeURL.slice(searchIdentifierStartIndex, videoIdentifierEndIndex);
    } else {
        searchQuery = YouTubeURL.slice(searchIdentifierStartIndex);
    }

    // Documentation regarding decode Google's search URL query to original search content (https://developers.google.com/custom-search/docs/xml_results_appendices?hl=en#url-escaping)
    // First, we need to replace all instances of "+" with " " (a whitespace), and then we can run decodeURIComponent()
    return decodeURIComponent(searchQuery.replaceAll("+", " "));
}

function parseSearchResultsAndSendMessage() {
    clearTimeout(searchLoadingTimeOut);
    const videos = document.querySelectorAll("a#video-title");
    // console.log(videos)
    // console.log("number of videos: " + videos.length)
    const search_results = {};
    for (let j = 0; j < videos.length; j++) {
        const tmp = {};
        //console.log(videos[j])
        //console.log("bb "+ videos[j].getAttribute("title"))
        tmp['title'] = videos[j].getAttribute("title")
        tmp['url'] = videos[j].getAttribute("href")
        search_results[j] = tmp
    }
    // console.log(search_results);

    const youTubeSearchQuery = extractYouTubeSearchQuery(document.URL);
    // console.log("YouTube Search Query is: " + youTubeSearchQuery);

    const unixTimestamp = Date.now();
    const date = new Date(unixTimestamp);
    // Sending a message from a content script to background script
    chrome.runtime.sendMessage({
        InternalUse: true, // to distinguish my message from other message.
        timestamp: unixTimestamp,
        plain_text_time: date.toString(),
        site: "YouTube",
        type: "Search",
        currentURL: document.URL,
        searchQuery: youTubeSearchQuery,
        searchResult: search_results
    }, function (response) {
        console.log(response.farewell);
    });
    console.log("Done running YouTube Search content script");
}


/*
 *  YouTube Home Page data extraction functions
 */

// This function that will trigger extractYTHome() function with 2-second delay
function getYTHome() {
    clearTimeout(homeLoadingTimeOut);
    homeLoadingTimeOut = window.setTimeout(extractYTHome, 2000);
}

function extractYTHome() {
    console.log("YouTube Home Script Goes Here");
}
