const express = require('express')
const app = express()
const port = 3000
const paytm_routes = require("./paytm");
const dotenv = require('dotenv');
dotenv.config();

console.log("Paytm MID" + process.env.PAYTM_MID)
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.use('/paytm', paytm_routes);

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})