const VERSION = "0.0.6";

const assets = [
  "./",
  "./style.css",
  "./script.js",
  "./favicon.ico",
  "./icon.svg",
  "./hash-nav.js",
  "./hash-router.js",
  "./model.js",
  "./store.js",
  "./sync-status.js",
  "./tasks.js",
  "./timesheet.js",
  "./timesheetStore.js",
  "./archive/archive.js",
  "./archive/timesheet-archive.js",
  "./archive/task-archive.js",
  "./utils/apply.js",
  "./utils/calcDuration.js",
  "./utils/emitEvent.js",
  "./utils/filter.js",
  "./utils/first.js",
  "./utils/format24Hour.js",
  "./utils/formatDate.js",
  "./utils/formatPrice.js",
  "./utils/getNetIncome.js",
  "./utils/inputsEntered.js",
  "./utils/isSameWeek.js",
  "./utils/last.js",
  "./utils/newTemplateItem.js",
  "./utils/percentOf.js",
  "./utils/reduce.js",
  "./utils/reduceDuration.js",
  "./utils/round1dp.js",
  "./utils/shallowClone.js",
  "./utils/sortByMostRecentEntry.js",
  "./utils/subMonth.js",
  "./utils/subWeek.js",
  "./utils/timeLoop.js",
  "./utils/timeToDate.js",
];

async function install() {
  console.log("WORKER: install event in progress.");
  /* The caches built-in is a promise-based API that helps you cache responses,
           as well as finding and deleting them.
        */
  /* You can open a cache by name, and this method returns a promise. We use
             a VERSIONed cache name here so that we can remove old cache entries in
             one fell swoop later, when phasing out an older service worker.
          */
  const cache = await caches.open(VERSION + "fundamentals");
  /* After the cache is opened, we can fill it with the offline fundamentals.
               The method below will add all resources we've indicated to the cache,
               after making HTTP requests for each of them.
            */
  const res = await cache.addAll(assets);
  console.log("WORKER: install completed");
  return res;
}

self.addEventListener("install", (event) => {
  event.waitUntil(install());
});

async function handleFetch(event) {
  console.log("WORKER: fetch event in progress.");

  /* We should only cache GET requests, and deal with the rest of method in the
       client-side, by handling failed POST,PUT,PATCH,etc. requests.
    */
  if (event.request.method !== "GET") {
    /* If we don't block the event as shown below, then the request will go to
         the network as usual.
      */
    console.log(
      "WORKER: fetch event ignored.",
      event.request.method,
      event.request.url
    );
    return;
  }
  /* Similar to event.waitUntil in that it blocks the fetch event on a promise.
       Fulfillment result will be used as the response, and rejection will end in a
       HTTP response indicating failure.
    */

  const cached = caches.match(event.request);
  /* This method returns a promise that resolves to a cache entry matching
           the request. Once the promise is settled, we can then provide a response
           to the fetch request.
        */

  /* Even if the response is in our cache, we go to the network as well.
             This pattern is known for producing "eventually fresh" responses,
             where we return cached responses immediately, and meanwhile pull
             a network response and store that in the cache.
             Read more:
             https://ponyfoo.com/articles/progressive-networking-serviceworker
          */
  const networked = fetch(event.request)
    // We handle the network request with success and failure scenarios.
    .then(fetchedFromNetwork, unableToResolve)
    // We should catch errors on the fetchedFromNetwork handler as well.
    .catch(unableToResolve);

  /* We return the cached response immediately if there is one, and fall
             back to waiting on the network as usual.
          */
  console.log(
    "WORKER: fetch event",
    cached ? "(cached)" : "(network)",
    event.request.url
  );
  return cached || networked;

  async function fetchedFromNetwork(response) {
    /* We copy the response before replying to the network request.
               This is the response that will be stored on the ServiceWorker cache.
            */
    var cacheCopy = response.clone();

    console.log("WORKER: fetch response from network.", event.request.url);

    caches
      // We open a cache to store the response for this request.
      .open(VERSION + "pages")
      .then(function add(cache) {
        /* We store the response for this request. It'll later become
                   available to caches.match(event.request) calls, when looking
                   for cached responses.
                */
        cache.put(event.request, cacheCopy);
      })
      .then(function () {
        console.log(
          "WORKER: fetch response stored in cache.",
          event.request.url
        );
      });

    // Return the response so that the promise is settled in fulfillment.
    return response;
  }

  /* When this method is called, it means we were unable to produce a response
             from either the cache or the network. This is our opportunity to produce
             a meaningful response even when all else fails. It's the last chance, so
             you probably want to display a "Service Unavailable" view or a generic
             error response.
          */
  function unableToResolve() {
    /* There's a couple of things we can do here.
               - Test the Accept header and then return one of the `offlineFundamentals`
                 e.g: `return caches.match('/some/cached/image.png')`
               - You should also consider the origin. It's easier to decide what
                 "unavailable" means for requests against your origins than for requests
                 against a third party, such as an ad provider
               - Generate a Response programmaticaly, as shown below, and return that
            */

    console.log("WORKER: fetch request failed in both cache and network.");

    /* Here we're creating a response programmatically. The first parameter is the
               response body, and the second one defines the options for the response.
            */
    return new Response("<h1>Service Unavailable</h1>", {
      status: 503,
      statusText: "Service Unavailable",
      headers: new Headers({
        "Content-Type": "text/html",
      }),
    });
  }
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleFetch(event));
});

async function cleanup() {
  /* Just like with the install event, event.waitUntil blocks activate on a promise.
       Activation will fail unless the promise is fulfilled.
    */
  console.log("WORKER: activate event in progress.");

  /* This method returns a promise which will resolve to an array of available
           cache keys.
        */
  const keys = await caches.keys();
  // We return a promise that settles when all outdated caches are deleted.
  await Promise.all(
    keys
      .filter(function (key) {
        // Filter by keys that don't start with the latest VERSION prefix.
        return !key.startsWith(VERSION);
      })
      .map(function (key) {
        /* Return a promise that's fulfilled
                when each outdated cache is deleted.
            */
        console.log(`WORKER: deleting ${key}.`);
        return caches.delete(key);
      })
  );
  console.log("WORKER: activate completed.");
}

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanup());
});
