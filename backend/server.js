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

    try {
        const resolvedUrl = await resolveLinkUrl(url);
        res.json({ originalUrl: url, resolvedUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3001);

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
                // Check if this is a protected-link.example URL that can be resolved by the resolver
                const isProtectedLink = url.includes('protected-link.example');
                downloadLinks.push({
                    host,
                    url,
                    isProtectedLink,
                    needsResolver: isProtectedLink
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
                // Check if this is a protected-link.example URL that can be resolved by the resolver
                const isProtectedLink = url.includes('protected-link.example');
                streamingLinks.push({
                    host,
                    url,
                    isProtectedLink,
                    needsResolver: isProtectedLink
                });
            }
        });
    }

    return {
        downloadLinks,
        streamingLinks,
    };
}

// Link resolver functions
async function resolveLinkUrl(url) {
    const apiKey = process.env.RESOLVER_API_KEY;

    if (!apiKey) {
        throw new Error('resolver API key not configured');
    }

    try {
        // First, add the link to the resolver
        const addResponse = await fetch('https://api.provider.example/v4/link/unlock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `agent=neox&apikey=${apiKey}&link=${encodeURIComponent(url)}`
        });

        const addData = await addResponse.json();

        if (!addResponse.ok || addData.status !== 'success') {
            throw new Error(addData.error?.message || 'Failed to resolve URL with the resolver');
        }

        return addData.data.link;
    } catch (error) {
        console.error('resolver API error:', error);
        throw new Error(`resolution failed: ${error.message}`);
    }
}