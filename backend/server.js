const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/search', async (req, res) => {
    const { p, s } = req.query;
    const response = await fetch(`https://www.extrem-down.diy/?p=${p}&s=${s}`);
    const data = await response.json();
    res.json(data);
});

app.listen(3001);