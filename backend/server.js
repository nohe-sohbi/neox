const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const cheerio = require('cheerio');
const app = express();

app.use(cors());
app.use(express.json());


app.get('/search', async (req, res) => {
    const { p, s } = req.query;

    if(!p || !s) return res.status(400).send('Bad request')

    try {
        const response = await fetch(`https://www.extrem-down.diy/?p=${p}&search=${s}`);

        if(p === "films") {
            const searchData = parseMoviesSearchResults(await response.text());
            res.send(searchData);
        }
        else {
            res.send("incorrect type", 400);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/searchMovieLinks', async (req, res) => {
    const { url } = req.query;

    if(!url) return res.status(400).send('Bad request')

    try {
        const response = await fetch(url);
        const searchData = parseMovieLinkPage(await response.text());
        res.send(searchData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Link resolver integration
app.post('/resolve', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (!process.env.RESOLVER_API_KEY) {
        return res.status(500).json({ error: 'resolver API key not configured' });
    }

    console.log('resolve request for URL:', url);

    try {
        const resolvedUrl = await resolveLinkUrl(url);
        console.log('resolution successful:', { originalUrl: url, resolvedUrl });
        res.json({ originalUrl: url, resolvedUrl });
    } catch (error) {
        console.error('resolution failed:', { url, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Get supported hosts
app.get('/hosts', async (req, res) => {
    if (!process.env.RESOLVER_API_KEY) {
        return res.status(500).json({ error: 'resolver API key not configured' });
    }

    try {
        const response = await fetch(`https://api.provider.example/v4/hosts?agent=neox&apikey=${process.env.RESOLVER_API_KEY}`);
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            throw new Error(data.error?.message || 'Failed to get supported hosts');
        }

        res.json({ hosts: data.data.hosts });
    } catch (error) {
        console.error('resolver hosts API error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});

function parseMoviesSearchResults(htmlString) {
    const $ = cheerio.load(htmlString);
    const results = [];

    $('a.top-last.thumbnails').each((_, node) => {
        const url = $(node).attr('href');
        const image = $(node).find('img.img-post').attr('src');
        const title = $(node).find('span.top-title').text().trim();
        const quality = $(node).find('span.top-lasttitle').text().trim();
        const type = $(node).find('span.top-genre').text().trim();
        const year = $(node).find('span.top-imdb.top-year').text().trim();
        if (title) {
            results.push({
                url: url ? `https://www.extrem-down.diy${url}` : null,
                image: image ? `https://www.extrem-down.diy${image}` : null,
                title,
                quality,
                type,
                year,
            });
        }
    });

    return results;
}


function parseMovieLinkPage(htmlString) {
    const $ = cheerio.load(htmlString);
    const downloadLinks = [];
    const streamingLinks = [];

    // --- SECTION TÉLÉCHARGEMENT ---
    const downloadHeading = $('.prez_2.fx:contains("Liens de téléchargement")');
    if (downloadHeading.length) {
        // On trouve le premier conteneur DIV qui le suit
        const linkContainer = downloadHeading.nextAll('div').first();
        linkContainer.find('a').each((_, link) => {
            const url = $(link).attr('href');
            const host = $(link).find('strong.hebergeur').text().trim();
            if (url && host) {
                // Filter out advertisement links
                if (isAdvertisementLink(url)) {
                    console.log('Filtered out advertisement link:', url);
                    return; // Skip this link
                }

                // For protected-link.example, only include legitimate protected links
                if (url.includes('protected-link.example') && !isLegitimateProtectedLink(url)) {
                    console.log('Filtered out invalid protected-link.example:', url);
                    return; // Skip this link
                }

                const linkInfo = analyzeLinkForResolver(url, host);
                downloadLinks.push({
                    host,
                    url,
                    ...linkInfo
                });
            }
        });
    }

    // --- SECTION STREAMING ---
    const streamingHeading = $('.prez_2:contains("Liens de streaming")');
    if (streamingHeading.length) {
        const linkContainer = streamingHeading.nextAll('div').first();
        linkContainer.find('a').each((_, link) => {
            const url = $(link).attr('href');
            const host = $(link).find('strong.hebergeur').text().trim();
            if (url && host) {
                // Filter out advertisement links
                if (isAdvertisementLink(url)) {
                    console.log('Filtered out advertisement link:', url);
                    return; // Skip this link
                }

                // For protected-link.example, only include legitimate protected links
                if (url.includes('protected-link.example') && !isLegitimateProtectedLink(url)) {
                    console.log('Filtered out invalid protected-link.example:', url);
                    return; // Skip this link
                }

                const linkInfo = analyzeLinkForResolver(url, host);
                streamingLinks.push({
                    host,
                    url,
                    ...linkInfo
                });
            }
        });
    }

    console.log('Parsed movie links:', {
        downloadLinks: downloadLinks.length,
        streamingLinks: streamingLinks.length,
        resolverLinks: [...downloadLinks, ...streamingLinks].filter(l => l.needsResolver).length,
        totalValidLinks: downloadLinks.length + streamingLinks.length
    });

    return {
        downloadLinks,
        streamingLinks,
    };
}

// Filter out advertisement links that should be excluded
function isAdvertisementLink(url) {
    // Exclude protected-link.example advertisement patterns
    // BAD: https://protected-link.example/rqts-url?fn=*
    if (url.includes('protected-link.example/rqts-url?fn=')) {
        return true;
    }

    // Add other advertisement patterns here if needed
    return false;
}

// Check if a protected-link.example is a legitimate protected link
function isLegitimateProtectedLink(url) {
    // GOOD: https://protected-link.example/[alphanumeric-id]?fn=*&rl=*
    const legitimatePattern = /^https:\/\/protected-link\.link\/[a-zA-Z0-9]+\?fn=.*&rl=.*$/;
    return legitimatePattern.test(url);
}

// Analyze if a link needs resolution
function analyzeLinkForResolver(url, host) {
    // Common protected link patterns
    const protectedPatterns = [
        'protected-link.example',
        'protect-link.com',
        'short-link.fr',
        'linkprotect.xz',
        'protect-url.com'
    ];

    // Common file hosting services that the resolver supports
    const resolverHosts = [
        'rapidgator',
        'uploaded',
        'nitroflare',
        'turbobit',
        'katfile',
        'ddownload',
        'mega.nz',
        'mediafire',
        '1fichier',
        'uptobox'
    ];

    const isProtectedLink = protectedPatterns.some(pattern => url.includes(pattern));
    const isResolverHost = resolverHosts.some(hostPattern =>
        host.toLowerCase().includes(hostPattern) || url.toLowerCase().includes(hostPattern)
    );

    return {
        isProtectedLink,
        isResolverHost,
        needsResolver: isProtectedLink || isResolverHost,
        linkType: isProtectedLink ? 'protected' : isResolverHost ? 'premium' : 'direct'
    };
}

// Link resolver functions
async function resolveLinkUrl(url) {
    const apiKey = process.env.RESOLVER_API_KEY;

    if (!apiKey) {
        throw new Error('resolver API key not configured');
    }

    console.log('Attempting to resolve URL with the resolver:', url);

    try {
        // First, add the link to the resolver
        const requestBody = `agent=neox&apikey=${apiKey}&link=${encodeURIComponent(url)}`;
        console.log('resolver API request body:', requestBody.replace(apiKey, '[REDACTED]'));

        const addResponse = await fetch('https://api.provider.example/v4/link/unlock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: requestBody
        });

        const addData = await addResponse.json();
        console.log('resolver API response:', {
            status: addResponse.status,
            ok: addResponse.ok,
            data: addData
        });

        if (!addResponse.ok) {
            const errorMsg = addData.error?.message || addData.error || `HTTP ${addResponse.status}`;
            throw new Error(`resolver API HTTP error: ${errorMsg}`);
        }

        if (addData.status !== 'success') {
            const errorMsg = addData.error?.message || addData.error || 'Unknown error';
            throw new Error(`resolver API error: ${errorMsg}`);
        }

        if (!addData.data || !addData.data.link) {
            throw new Error('resolver API returned no download link');
        }

        console.log('resolution successful, resolved URL:', addData.data.link);
        return addData.data.link;
    } catch (error) {
        console.error('resolver API error details:', {
            originalUrl: url,
            errorMessage: error.message,
            errorStack: error.stack
        });

        // Provide more specific error messages based on common issues
        if (error.message.includes('This host or link is not supported')) {
            throw new Error('This host or link is not supported by the resolver');
        } else if (error.message.includes('Invalid link')) {
            throw new Error('The provided link is invalid or malformed');
        } else if (error.message.includes('Unauthorized')) {
            throw new Error('resolver API key is invalid or expired');
        } else if (error.message.includes('Quota exceeded')) {
            throw new Error('link resolver quota exceeded for this account');
        }

        throw new Error(`resolution failed: ${error.message}`);
    }
}