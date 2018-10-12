(function() {
    // SystemJSLoader$1 -> RegisterLoader$1 -> Loader
    var Loader = System.__proto__.__proto__.__proto__.constructor,
        loaderResolve = Loader.prototype.resolve,
        ignoreLoaderResolveKeys = ['@system-env', '@empty'],
        bundles = System.getConfig().bundles || [],
        hashTable = null,
        loadHashTablePromise = null,
        baseUrl = "",
        jsonFileName = "system.cachebuster.json",
        jsonFileBustValue = new Date().valueOf(),
        enableLogs = false,
        hashPrefix = 'hash=';

    initBaseUrl();
    patchSystemLocate();

    function config(options) {
        enableLogs = (options.enableLogs === undefined ? false : !!options.enableLogs);
        baseUrl = (options.baseUrl === undefined ? baseUrl : options.baseUrl);
        jsonFileName = (options.jsonFileName === undefined ? jsonFileName : options.jsonFileName);
        jsonFileBustValue = (options.jsonFileBustValue === undefined ? jsonFileBustValue : options.jsonFileBustValue);

        normalizeBaseUrl();
    }

    function log() {
        if (!enableLogs) {
            return;
        }

        console.log.apply(null, arguments);
    }

    function dumpTable() {
        log("SystemJS hash table");

        hashTable.forEach(function(key) {
            log("    " + key + ": " + hashTable[key].hash);
        });
    }

    function initBaseUrl() {
        var baseTag = document.getElementsByTagName("base");
        if (baseTag.length) {
            baseUrl = baseTag[0].href;
        } else {
            baseUrl = window.location.origin;
            normalizeBaseUrl();
        }
        log("SystemJS baseUrl:", baseUrl);
    }

    function normalizeBaseUrl() {
        if (baseUrl[baseUrl.length - 1] !== "/") {
            baseUrl += "/";
        }
    }

    function loadHashTable() {
        if (loadHashTablePromise) {
            return loadHashTablePromise;
        }

        loadHashTablePromise = new Promise(function(resolve, reject) {
            var isAbs = jsonFileName.indexOf('://') !== -1,
                baseJsonFileName = isAbs ? jsonFileName : '/' + jsonFileName,
                url = baseJsonFileName + "?v=" + jsonFileBustValue,
                oReq = new XMLHttpRequest();

            log("Loading hash table from: " + url);
            oReq.open("GET", url);
            oReq.send();
            oReq.addEventListener("load", function () {
                if (this.status === 200) {
                    hashTable = JSON.parse(this.responseText);
                } else {
                    hashTable = {};
                }

                resolve();
            });
        });

        return loadHashTablePromise;
    }

    function patchSystemLocate() {
        var metadataSymbol;

        function isBundled(key) {
            var i, b;
            for (i in bundles) {
                if (Object.prototype.hasOwnProperty.call(bundles, i)) {
                    b = bundles[i];
                    if (b.indexOf(key) > -1) {
                        return true;
                    }
                }
            }

            return false;
        }

        function shouldIgnoreCustomResolver(key) {
            return ignoreLoaderResolveKeys.indexOf(key) > -1;
        }

        function getHash(key) {
            var relUrl = (startsWith(key, baseUrl) ? key.substring(baseUrl.length) : key),
                entry = hashTable[relUrl];

            if (entry) {
                return entry.hash;
            }

            return null;
        }

        function augment(key) {
            var hash, hI, qI;
            if (key.indexOf(hashPrefix) > 0 || isBundled(key) || shouldIgnoreCustomResolver(key)) {
                // key already augmented or should be ignored.
                return key;
            }

            hash = getHash(key);
            if (hash) {
                hI = key.indexOf("#");
                qI = key.lastIndexOf("?", hI < 0 ? undefined : hI);

                if (qI > 0) {
                    if (hI > 0) {
                        // ? and # found: put build between ? and #
                        key = key.slice(0, hI) + "&" + hashPrefix + hash + key.slice(hI);
                    } else {
                        // ? found: put build at end
                        key += "&" + hashPrefix + hash;
                    }
                } else {
                    // no ? nor #
                    key += "?" + hashPrefix + hash;
                }
            }

            return key;
        }

        function getMetadataSymbol(loader, mustFindKey) {
            var symbols, i, s, lov;
            if (metadataSymbol) {
                return metadataSymbol;
            }
            if (loader["@@metadata"]) {
                // some browsers dont support Symbol()
                return (metadataSymbol = "@@metadata");
            }
            symbols = Object.getOwnPropertySymbols(loader);
            for (i = 0; i < symbols.length; i++) {
                s = symbols[i];
                lov = loader[s];
                if (lov && typeof lov === 'object' && lov[mustFindKey]) {
                    return (metadataSymbol = s);
                }
            }
            throw new Error("I tried.");
        }

        Loader.prototype.resolve = function hackedLoaderResolve() {
            var loader = this,
                args = Array.prototype.slice.call(arguments);

            return loadHashTable()
                .then(function() {
                    return Promise.resolve(loaderResolve.apply(loader, args));
                })
                .then(function (key) {
                    var newKey = augment(key),
                        metaSymbol, metadata, moveMe;

                    if (newKey !== key) {
                        metaSymbol = getMetadataSymbol(loader, key);
                        metadata = loader[metaSymbol];
                        moveMe = metadata[key];

                        if (moveMe) {
                            delete metadata[key];
                            metadata[newKey] = moveMe;
                        }
                    }

                    log("System: Loader: resolved: " + newKey);
                    return newKey;
                });
        };
    }

    function startsWith(str1, str2) {
        if (str2.length > str1.length) {
            return false;
        }

        return (str1.substring(0, str2.length) === str2);
    }

    window.SystemCacheBuster = {
        config: config,
    };
}());
