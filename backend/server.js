const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const cheerio = require('cheerio');
const app = express();

app.use(cors());


app.get('/search', async (req, res) => {
    const { p, s } = req.query;

    if(!p || !s) return res.status(400).send('Bad request')

    try {
        const response = await fetch(`https://www.extrem-down.diy/?p=${p}&s=${s}`);

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

app.listen(3001);

function parseMoviesSearchResults(htmlString) {
    const $ = cheerio.load(htmlString);
    const results = [];
    $('a.top-last.thumbnails').each((_, node) => {
        const image = $(node).find('img.img-post').attr('src');
        const title = $(node).find('span.top-title').text().trim();
        const quality = $(node).find('span.top-lasttitle').text().trim();
        const type = $(node).find('span.top-genre').text().trim();
        const year = $(node).find('span.top-imdb.top-year').text().trim();
        if (title) {
            results.push({
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