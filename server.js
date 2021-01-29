( async () => {

const yargs = require('yargs');
const express = require('express');
const bodyParser = require('body-parser');
const betterSqlite3 = require('better-sqlite3');
const http = require('http');
const https = require('https');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');

process.on('SIGINT', () => {
    console.info('ctrl+c detected, exiting tinypin');
    console.info('goodbye.');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.info('sigterm detected, exiting tinypin');
    console.info('goodbye.');
    process.exit(0);
});

const VERSION = process.env['TINYPIN_VERSION'] ? process.env['TINYPIN_VERSION'].trim() : "none";

const argv = yargs
    .option('slow', {
        alias: 's',
        description: 'delay each request this many milliseconds for testing',
        type: 'number'
    })
    .option('image-path', {
        alias: 'i',
        description: 'base path to store images',
        type: 'string',
        default: './images'
    })
    .option('db-path', {
        alias: 'd',
        description: 'path to sqlite database file',
        type: 'string',
        default: 'tinypin.db'
    })
    .option('port', {
        alias: 'p',
        description: 'http server port',
        type: 'number',
        default: 3000
    })
    .help().alias('help', 'h')
    .argv;


const DB_PATH = path.resolve(argv['db-path']);
const IMAGE_PATH = path.resolve(argv['image-path']);
const PORT = argv.port;

const THUMBNAIL_IMAGE_SIZE = 400;
const ADDITIONAL_IMAGE_SIZES = [800,1280,1920,2560];

console.log('tinypin starting...');
console.log('');
console.log(`version: ${VERSION}`);
console.log('');
console.log('configuration:');
console.log(`  port: ${PORT}`);
console.log(`  database path: ${DB_PATH}`);
console.log(`  image path: ${IMAGE_PATH}`)

const SLOW = argv.slow || parseInt(process.env.TINYPIN_SLOW);
if ( SLOW ){
    console.log(`  slow mode delay: ${SLOW}`);
}
console.log('');


const db = betterSqlite3(DB_PATH);
await initDb();

const COOKIE_KEY = Buffer.from(db.prepare("SELECT value FROM properties WHERE key = ?").get('cookieKey').value, 'hex');

// express config
const app = express();
const expressWs = require('express-ws')(app);

app.use(express.static('public'));
app.use(bodyParser.raw({type: 'image/jpeg', limit: '25mb'}));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
app.set('json spaces', 2);
app.use(cookieParser());

// auth helper functions
function sendAuthCookie(res, c){
    res.cookie('s', encryptCookie(c), {maxAge: 315569520000}); // 10 years
}

async function deriveKeyFromPassword(salt, pw){
    return new Promise( (resolve, reject) => {
        crypto.scrypt(pw, salt, 64, (err, key) => {
            resolve(key.toString('hex'));
        });
    }); 
}

function encryptCookie(obj){
    let str = JSON.stringify(obj);
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv('aes256', COOKIE_KEY, iv);
    let ciphered = cipher.update(str, 'utf8', 'hex');
    ciphered += cipher.final('hex');
    return iv.toString('hex') + ':' + ciphered;
}

function decryptCookie(ciphertext){
    let components = ciphertext.split(':');
    let iv_from_ciphertext = Buffer.from(components.shift(), 'hex');
    let decipher = crypto.createDecipheriv('aes256', COOKIE_KEY, iv_from_ciphertext);
    let deciphered = decipher.update(components.join(':'), 'hex', 'utf8');
    deciphered += decipher.final('utf8');
    return JSON.parse(deciphered);
}

// accept websocket connections.  currently are parsing the userid from the path to 
// map the connections to only notify on changes from the same user.
// this simple mapping of holding all connections in memory here won't really scale beyond 
// one server instance - but that's not really the use case for tinypin.
app.ws('/ws/:uid', (ws, req) => {
    ws.on("message", (msg) => {
        //console.log("received messsage: " + msg);
    });
    ws.on("close", () => {
        console.log("socket closed for user " + req.params.uid);
    });
    console.log("socket opened for user " + req.params.uid);
});

function broadcast(uid, msg){
    for ( let socket of expressWs.getWss('/ws/' + uid).clients ){
        socket.send(JSON.stringify(msg));
    }
}

// handle auth
app.use ( async (req, res, next) => {

    // we will also accept the auth token in the x-api-key header
    if ( req.headers["x-api-key"] ){
        let apiKey = req.headers['x-api-key'];
        try {
            u = decryptCookie(decodeURIComponent(apiKey));
            req.user = {
                id: u.i,
                name: u.u
            };
            console.log("api key accepted for user " + req.user.name);
        } catch (e) {
            console.log("invalid api key");
            res.sendStatus(403);
            return;
        }
    }


    // handle one-time-links for images
    if ( req.originalUrl.startsWith("/otl/" ) ){
        try{
            let token = decryptCookie(req.originalUrl.substr(5));
            
            // expire tokens in 5 minutes
            if ( new Date().getTime() - token.t > 300000 ){ // 5 minutes
                res.status(404).send(NOT_FOUND);
                return;
            }

            let imagePath = getImagePath(token.u, token.p, 'o');
            res.sendFile(imagePath.file);
            return;
        } catch (e){
            res.status(404).send(NOT_FOUND);
            return;
        }
    }

    // skip auth for pub resources
    // handle login and register paths
    if ( req.originalUrl.startsWith("/pub/") ){
        next();
        return;
    } if ( req.method == "GET" && req.originalUrl == "/login" ){
        res.type("html").sendFile(path.resolve('./templates/login.html'));
        return;
    } else if ( req.method == "POST" && req.originalUrl == "/login" ){
        let username = req.body.username;
        let result = db.prepare("SELECT salt FROM users WHERE username = ?").get(username);
        if ( !result ){
            console.log(`login ${username} failed [unknown user]`);
            res.redirect("/login#nope");
            return;
        }

        let key = await deriveKeyFromPassword(result.salt, req.body.password);
        result = db.prepare("SELECT * FROM users WHERE username = @username AND key = @key").get({username: username, key: key});

        if (!result){
            console.log(`login ${username} failed [bad password]`);
            res.redirect("/login#nope");
            return;
        }

        sendAuthCookie(res, {
            i: result.id,
            u: username
        });

        console.log(`login ${username} ok`);
        res.redirect("./");
        return;
    } else if ( req.method == "GET" && req.originalUrl == "/register" ){
        res.type("html").sendFile(path.resolve('./templates/register.html'));
        return;
    } else if ( req.method == "POST" && req.originalUrl == "/register" ){

        let username = req.body.username;
        let salt = crypto.randomBytes(16).toString('hex');
        let key = await deriveKeyFromPassword(salt, req.body.password);

        let result = db.prepare("INSERT INTO users (username, key, salt, createDate) VALUES (@username, @key, @salt, @createDate)").run({username: username, key: key, salt: salt, createDate: new Date().toISOString()});

        if ( result && result.changes == 1 ){
            sendAuthCookie(res, {
                i: result.lastInsertRowid,
                u: username
            });

            console.log(`created user ${username}`);
            res.redirect("./");
        } else {
            console.log(`error creating account ${name}`);
            res.redirect("/register#nope");
        }

        return;
    } 

    // if we made it this far, we're eady to check for the cookie
    let s = req.cookies.s;

    if ( s ){
        try {
            s = decryptCookie(s);
            if ( s.i && s.u ){
                req.user = {
                    id: s.i,
                    name: s.u
                }
            }
        } catch (err) {
            console.error(`error parsing cookie: `, err);
        }
    }

    if ( !req.user ){
        res.redirect("/login");
        return;
    }

    if ( req.method == "GET" && req.originalUrl == "/logout" ){
        console.log(`logout ${req.user.name}`);
        res.cookie('s', '', {maxAge:0});
        res.redirect("/login");
        return;
    }

    next();

});


// handle image serving, injecting the user id in the path to segregate users and control cross-user resource access
app.use( (req, res, next) => {
    if ( req.method == "GET" && req.originalUrl.startsWith("/images/") ){

        let filepath = IMAGE_PATH + '/' + req.user.id + '/' + req.originalUrl;
        res.setHeader('Cache-control', `private, max-age=2592000000`); // 30 days
        res.sendFile(filepath); 

    } else if ( req.method == "GET" && req.originalUrl.startsWith("/dl/") ){
        
        let path = req.originalUrl.replace("/dl/", "/images/");

        let filepath = IMAGE_PATH + "/" + req.user.id + "/" + path;
        res.setHeader("Content-Disposition", 'attachment; filename="image.jpg');
        res.sendFile(filepath);

    } else {
        next();
    }
});



app.use(express.static('static'));

//emulate slow down
if ( SLOW ){
    app.use( (req,res,next) => {
        console.log("slow...");
        setTimeout(() => {
            next();
        }, SLOW);
    });
}

const OK = {status: "ok"};
const NOT_FOUND = {status: "error", error: "not found"};
const ALREADY_EXISTS = {status: "error", error: "already exists"};
const SERVER_ERROR = {status: "error", error: "server error"};


app.get("/api/whoami", (req, res) => {
    res.send({name: req.user.name, version: VERSION, id: req.user.id});
});

// list boards
app.get("/api/boards", async (req, res) => {
    try{
        let boards = db.prepare("SELECT * FROM boards").all();

        for( let i = 0; i < boards.length; ++i ){
            let result = db.prepare("SELECT id FROM pins WHERE userId = @userId and boardId = @boardId order by createDate limit 1").get({userId:req.user.id, boardId:boards[i].id});
            if ( result ) {
                boards[i].titlePinId = result.id;
            } else {
                boards[i].titlePinId = 0;
            }
        }

        res.send(boards);
    } catch (err) {
        console.log(`Error listing boards: ${err.message}`);
        res.status(500).send(SERVER_ERROR);
    }
});

// get board
app.get("/api/boards/:boardId", async (req, res) => {
    try{

        let board = db.prepare("SELECT * FROM boards WHERE userId = @userId and id = @boardId").get({userId:req.user.id, boardId:req.params.boardId});
        if ( board ){

            board.pins = db.prepare("SELECT * FROM pins WHERE userId = @userId and boardId = @boardId").all({userId:req.user.id, boardId:req.params.boardId});

            res.send(board);
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err) {
        console.log(`Error getting board#${req.params.boardId}: ${err.message}`);
        res.status(500).send(SERVER_ERROR);
    }
});

// create board
app.post('/api/boards', (req, res) => {
    try{
        let result = db.prepare("INSERT INTO boards (name, userId, hidden, createDate) VALUES (@name, @userId, @hidden, @createDate)").run({name: req.body.name, userId: req.user.id, hidden: req.body.hidden, createDate: new Date().toISOString()});
        let id = result.lastInsertRowid;
        let board = db.prepare("SELECT * FROM boards WHERE userId = @userId and id = @boardId").get({userId: req.user.id, boardId: id});
        board.titlePinId = 0;
        res.send(board);
        console.log(`Created board#${id} ${req.body.name}`);

        broadcast(req.user.id, {b:id});
    } catch (err){
        console.log("Error creating board: " + err.message);
        if ( err.message.includes('UNIQUE constraint failed:') ){
            res.status(409).send(ALREADY_EXISTS);
        } else {
            res.status(500).send(SERVER_ERROR);
        }
    }
});

// update board
app.post("/api/boards/:boardId", (req, res) =>{
    try{
        let result = db.prepare("UPDATE boards SET name = @name, hidden = @hidden WHERE userId = @userId and id = @boardId").run({name: req.body.name, hidden: req.body.hidden, userId: req.user.id, boardId: req.params.boardId});
        if ( result.changes == 1 ){
            res.send(OK);
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err){
        console.log(`Error updating board#${req.params.boardId}: ${err.message}`);
        res.status(500).send(SERVER_ERROR);
    }
});

// delete board
app.delete("/api/boards/:boardId", async (req, res) => {
    try{     

        let pins = db.prepare("SELECT id FROM pins WHERE userId = @userId and boardId = @boardId").all({userId:req.user.id, boardId:req.params.boardId});
        for ( let i = 0; i < pins.length; ++i ){

            await fs.unlink(getImagePath(req.user.id, pins[i].id, 'o').file);

            await fs.unlink(getImagePath(req.user.id, pins[i].id, THUMBNAIL_IMAGE_SIZE).file);

            for ( let s = 0; s < ADDITIONAL_IMAGE_SIZES.length; ++s ){
                await fs.unlink(getImagePath(req.user.id, pins[i].id, ADDITIONAL_IMAGE_SIZES[s]).file);
            }

        }

        let result = db.prepare("DELETE FROM pins WHERE userId = @userId and boardId = @boardId").run({userId:req.user.id, boardId:req.params.boardId});
        result = db.prepare("DELETE FROM boards WHERE userId = @userId and id = @boardId").run({userId: req.user.id, boardId:req.params.boardId});

        if ( result.changes == 1 ){
            res.send(OK);
            broadcast(req.user.id, {deleteBoard: req.params.boardId});
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err) {
        console.log(`Error deleting board#${req.params.boardId}: ${err.message}`);
        res.status(500).send(SERVER_ERROR);
    }
});

// get pin
app.get("/api/pins/:pinId", (req, res) => {
    try {
        let pin = db.prepare('SELECT * FROM pins WHERE userId = @userId and id = @pinId').get({userId: req.user.id, pinId:req.params.pinId});
        if ( pin ){
            res.send(pin);
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err){
        console.error(`Error getting pin#${req.params.pinId}: ${err.message}`, err);
        res.status(500).send(SERVER_ERROR);
    }
});

// create pin
app.post("/api/pins", async (req, res) => {
    try {

        let boardId = req.body.boardId;

        if ( boardId == "new" ){
            try {
                let result = db.prepare("INSERT INTO boards (name, userId, hidden, createDate) VALUES (@name, @userId, @hidden, @createDate)").run({name: req.body.newBoardName, userId: req.user.id, hidden: 0, createDate: new Date().toISOString()});
                boardId = result.lastInsertRowid;
            } catch (e){
                console.log("error creating new board: ", err);
                res.status(500).send(SERVER_ERROR);
            }
        }

        // download the image first to make sure we can get it
        let image = await downloadImage(req.body.imageUrl);
        
        let result = db.prepare(`INSERT INTO PINS (
            boardId, 
            imageUrl, 
            siteUrl, 
            description, 
            sortOrder, 
            originalHeight, 
            originalWidth, 
            thumbnailHeight, 
            thumbnailWidth, 
            userId,
            createDate
        ) VALUES (
            @boardId, 
            @imageUrl, 
            @siteUrl, 
            @description, 
            @sortOrder, 
            @originalHeight, 
            @originalWidth, 
            @thumbnailHeight, 
            @thumbnailWidth, 
            @userId,
            @createDate)
        `).run({
            boardId: boardId,
            imageUrl: req.body.imageUrl,
            siteUrl: req.body.siteUrl,
            description: req.body.description,
            sortOrder: req.body.sortOrder,
            originalHeight: image.original.height,
            originalWidth: image.original.width,
            thumbnailHeight: image.thumbnail.height,
            thumbnailWidth: image.thumbnail.width,
            userId: req.user.id,
            createDate: new Date().toISOString()
        });
        
        let id = result.lastInsertRowid;

        await saveImage(req.user.id, id, image);

        // return the newly created row
        let pin = db.prepare("SELECT * FROM pins WHERE userId = @userId and id = @pinId").get({userId: req.user.id, pinId: id});
        res.send(pin);

        broadcast(req.user.id, {updateBoard:boardId});

    } catch (err) {
        console.log(`Error creating pin: ${err.message}`, err);
        res.status(500).send(SERVER_ERROR);
    }
});

// create pin
app.post("/api/pins/:pinId", (req,res) => {

    try {
        let result = db.prepare(`UPDATE pins SET
            boardId = @boardId,
            siteUrl = @siteUrl,
            description = @description,
            sortOrder = @sortOrder
            WHERE userId = @userId and id = @pinId
        `).run({
            userId: req.user.id,
            pinId: req.params.pinId,
            boardId: req.body.boardId,
            siteUrl: req.body.siteUrl,
            description: req.body.description,
            sortOrder: req.body.sortOrder
        });

        if ( result.changes == 1 ){
            console.log(`updated pin#${req.params.pinId}`)
            res.send(OK);
            broadcast(req.user.id, {updateBoard:req.body.boardId});
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err) {
        console.log(`Error updating pin#${req.params.pinId}`, err);
        res.status(500).send(SERVER_ERROR);
    }

});

// get a one-time-link for an image
app.post("/api/pins/:pinId/otl", (req,res) => {

    let data = {
        u: req.user.id,
        p: req.params.pinId,
        t: new Date().getTime()
    };

    let token = encryptCookie(data);

    res.status(200).send({t: token});
});

// delete pin
app.delete("/api/pins/:pinId", async (req, res) => {
    try {

        let pin = db.prepare('SELECT * FROM pins WHERE userId = @userId and id = @pinId').get({userId: req.user.id, pinId:req.params.pinId});

        let result = db.prepare('DELETE FROM pins WHERE userId = @userId and id = @pinId').run({userId: req.user.id, pinId:req.params.pinId});

        if ( result.changes == 1 ){
            await fs.unlink(getImagePath(req.user.id, req.params.pinId, 'o').file);
            await fs.unlink(getImagePath(req.user.id, req.params.pinId, THUMBNAIL_IMAGE_SIZE).file);

            for ( let s = 0; s < ADDITIONAL_IMAGE_SIZES.length; ++s ){
                await fs.unlink(getImagePath(req.user.id, req.params.pinId, ADDITIONAL_IMAGE_SIZES[s]).file);
            }

            console.log(`deleted pin#${req.params.pinId}`);
            res.send(OK);

            broadcast(req.user.id, {updateBoard:pin.boardId});
            
        } else {
            res.status(404).send(NOT_FOUND);
        }
    } catch (err){
        console.log(`Error deleting pin#${req.params.pinId}`, err);
        res.status(500).send(SERVER_ERROR);
    }
});

app.post("/up/", async (req, res) => {
    console.log("got up!");
    console.log("content type = " + req.headers['content-type']);
    let boardName = req.headers['board-name'].trim();
    console.log("board name = " + req.headers['board-name']);
    console.log(typeof(req.body));

    let result = db.prepare("SELECT id FROM boards WHERE name = @name and userId = @userId").get({name: boardName, userId: req.user.id});

    let boardId = null;

    if ( result ){
        boardId = result.id;
    } else {
        result = db.prepare("INSERT INTO boards (name, userId, hidden, createDate) VALUES (@name, @userId, @hidden, @createDate)").run({name: boardName, userId: req.user.id, hidden: null, createDate: new Date().toISOString()});
        boardId = result.lastInsertRowid;
    }

    console.log("boardId=" + boardId);

    let image = await processImage(req.body);

    result = db.prepare(`INSERT INTO PINS (
        boardId, 
        imageUrl, 
        siteUrl, 
        description, 
        sortOrder, 
        originalHeight, 
        originalWidth, 
        thumbnailHeight, 
        thumbnailWidth, 
        userId,
        createDate
    ) VALUES (
        @boardId, 
        @imageUrl, 
        @siteUrl, 
        @description, 
        @sortOrder, 
        @originalHeight, 
        @originalWidth, 
        @thumbnailHeight, 
        @thumbnailWidth, 
        @userId,
        @createDate)
    `).run({
        boardId: boardId,
        imageUrl: null,
        siteUrl: null,
        description: null,
        sortOrder: null,
        originalHeight: image.original.height,
        originalWidth: image.original.width,
        thumbnailHeight: image.thumbnail.height,
        thumbnailWidth: image.thumbnail.width,
        userId: req.user.id,
        createDate: new Date().toISOString()
    });

    let id = result.lastInsertRowid;

    await saveImage(req.user.id, id, image);

    // return the newly created row
    let pin = db.prepare("SELECT * FROM pins WHERE userId = @userId and id = @pinId").get({userId: req.user.id, pinId: id});
    res.send(pin);

    broadcast(req.user.id, {updateBoard:boardId});
    
    return;
});



// start listening
app.listen(PORT, () => {
    console.log(`tinypin is running at http://localhost:${PORT}`);
    console.log('');
});

async function initDb(){   

    console.log("initializing database...");

    db.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY,
        createDate TEXT
    )
    `).run();

    let schemaVersion = db.prepare('select max(id) as id from migrations').get().id;
    let isNewDb = false;
    let createdBackup = false;

    if ( !schemaVersion || schemaVersion < 1 ){

        console.log("  running migration v1");
        isNewDb = true;

        db.transaction( () => {

            db.prepare(`
                CREATE TABLE users (
                    id INTEGER NOT NULL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    key TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    createDate TEXT
                )
            `).run();

            db.prepare(`
                    CREATE TABLE properties (
                        key TEXT NOT NULL UNIQUE PRIMARY KEY,
                        value TEXT NOT NULL
                    )
            `).run();

            db.prepare(`
            CREATE TABLE boards (
                id INTEGER NOT NULL PRIMARY KEY, 
                name TEXT NOT NULL UNIQUE, 
                userId INTEGER NOT NULL,
                createDate TEXT,
                
                FOREIGN KEY (userId) REFERENCES users(id)
                )
            `).run();

            // autoincrement on pins so that pin ids are stable and are not reused.
            // this allows for better caching of images
            db.prepare(`
            CREATE TABLE pins (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                boardId INTEGER NOT NULL,
                imageUrl TEXT,
                siteUrl TEXT,
                description TEXT,
                sortOrder INTEGER,
                originalHeight INTEGER,
                originalWidth INTEGER,
                thumbnailHeight INTEGER,
                thumbnailWidth INTEGER,
                userId INTEGER NOT NULL,
                createDate TEXT,

                FOREIGN KEY (boardId) REFERENCES boards(id),
                FOREIGN KEY (userId) REFERENCES users(id)
            )
            `).run();

            db.prepare("INSERT INTO properties (key, value) VALUES (@key, @value)").run({key: "cookieKey", value: crypto.randomBytes(32).toString('hex')});
            db.prepare("INSERT INTO migrations (id, createDate) VALUES ( @id, @createDate )").run({id:1, createDate: new Date().toISOString()});

            schemaVersion = 1;

        })();
    }

    if ( schemaVersion < 2 ){
        console.log("  running migration v2");

        if ( !isNewDb ){
            let backupPath = DB_PATH + ".backup-" + new Date().toISOString();
            console.log("    backing up to: " + backupPath);
            db.prepare(`
            VACUUM INTO ?
            `).run(backupPath);
            createdBackup = true;
        }

        db.transaction( () => {

            db.prepare(`
            ALTER TABLE boards ADD COLUMN hidden INTEGER
            `).run();

            db.prepare(`
            UPDATE boards SET hidden = 0
            `).run();

            db.prepare(`
            INSERT INTO migrations (id, createDate) VALUES ( @id, @createDate )
            `).run({id:2, createDate: new Date().toISOString()});

            schemaVersion = 2;
        })();
    }

    if ( schemaVersion < 3 ){
        // image file re-organization, additional sizes
        console.log("  running migration v3");

        let pins = db.prepare(`SELECT * FROM pins`).all();

        if ( require("fs").existsSync(`${IMAGE_PATH}`) ){
            let userdirs = await fs.readdir(IMAGE_PATH);
            console.log("  migrating images");
            for ( let i = 0; i < userdirs.length; ++i ){       
                if ( require("fs").existsSync(`${IMAGE_PATH}/${userdirs[i]}/images/originals`) ){
                    await fs.rename(`${IMAGE_PATH}/${userdirs[i]}/images/originals`, `${IMAGE_PATH}/${userdirs[i]}/images/o`);
                }
                if ( require("fs").existsSync(`${IMAGE_PATH}/${userdirs[i]}/images/thumbnails`) ){
                    await fs.rename(`${IMAGE_PATH}/${userdirs[i]}/images/thumbnails`, `${IMAGE_PATH}/${userdirs[i]}/images/400`);
                }
            }
        }
        
        if ( pins.length > 0 ){
            console.log("  generating additional image sizes...");
        } 

        for ( let i = 0; i < pins.length; ++i ){
            let pin = pins[i];
            let originalImagePath = getImagePath(pin.userId, pin.id, 'o');
            
            for ( let i = 0; i < ADDITIONAL_IMAGE_SIZES.length; ++i ){
                let size = ADDITIONAL_IMAGE_SIZES[i];
            
                let img = await sharp(originalImagePath.file);
                let resizedImg = await img.resize({width: size, height: size, fit: 'inside'})
                let buf = await resizedImg.toBuffer();
        
                let imgPath = getImagePath(pin.userId, pin.id, size);
                await fs.mkdir(imgPath.dir, {recursive:true});
                await fs.writeFile(imgPath.file, buf);
                console.log(`   saved additional size ${size} for pin#${pin.id} to: ${imgPath.file}`);
            }

        }

        if ( pins.length > 0 ){
            console.log("  finished generating addditional image sizes");
        }

        db.prepare(`
        INSERT INTO migrations (id, createDate) VALUES ( @id, @createDate )
        `).run({id:3, createDate: new Date().toISOString()});

        schemaVersion = 3;
    }

    console.log(`database ready - schema version v${schemaVersion}`);
    console.log('');
}

/**
 * Downloads the image, converts it to JPG, and creates the thumbnail size so that standard dimensions can be taken
 * @param {string} imageUrl 
 */
async function downloadImage(imageUrl){

    let res = await fetch(imageUrl);

    if ( res.status != 200 ){
        throw(new Error(`download error status=${res.status}`));
    }

    let buffer = await res.buffer();

    return await processImage(buffer);
}

async function processImage(buffer){
    let original = sharp(buffer);
    let originalBuffer = await original.toFormat("jpg").toBuffer();  
    let originalMetadata = await original.metadata();

    let thumbnail = await original.resize({ width: THUMBNAIL_IMAGE_SIZE, height: THUMBNAIL_IMAGE_SIZE, fit: 'inside' });
    let thumbnailBuffer = await thumbnail.toBuffer();
    let thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

    return {
        original: {
            buffer: originalBuffer,
            width: originalMetadata.width,
            height: originalMetadata.height
        },
        thumbnail: {
            buffer: thumbnailBuffer,
            width: thumbnailMetadata.width,
            height: thumbnailMetadata.height
        }
    }
}

// takes the response from downloadImage, creates ADDITIONAL_IMAGE_SIZE and writes all files to disk
async function saveImage(userId, pinId, image){


    let originalImagePath = getImagePath(userId, pinId, 'o');
    await fs.mkdir(originalImagePath.dir, {recursive: true});
    await fs.writeFile(originalImagePath.file, image.original.buffer);
    console.log(`saved original to: ${originalImagePath.file}`);

    let thumbnailImagePath = getImagePath(userId, pinId, '400');
    await fs.mkdir(thumbnailImagePath.dir, {recursive: true});
    await fs.writeFile(thumbnailImagePath.file, image.thumbnail.buffer);
    console.log(`saved thumbnail to: ${thumbnailImagePath.file}`);

    // this will enlarge images if necessary, as the lanczos3 resize algorithm will create better looking enlargements than the browser will
    for ( let i = 0; i < ADDITIONAL_IMAGE_SIZES.length; ++i ){
        let size = ADDITIONAL_IMAGE_SIZES[i];
        
        let img = await sharp(image.original.buffer);
        let resizedImg = await img.resize({width: size, height: size, fit: 'inside'})
        let buf = await resizedImg.toBuffer();

        let imgPath = getImagePath(userId, pinId, size);
        await fs.mkdir(imgPath.dir, {recursive:true});
        await fs.writeFile(imgPath.file, buf);
        console.log(`saved additional size ${size} to: ${imgPath.file}`);
    }

}


function getImagePath(userId, pinId, size){
    let paddedId = pinId.toString().padStart(12, '0');
    let dir = `${IMAGE_PATH}/${userId}/images/${size}/${paddedId[11]}/${paddedId[10]}/${paddedId[9]}/${paddedId[8]}`;
    let file = `${dir}/${paddedId}.jpg`;
    return { dir: dir, file: file};
}


})();