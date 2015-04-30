/**
 * Node Dropbox
 * @since April, 2015
 * @author  Linghua
 */

let path = require('path')
let fs = require('fs')
let express = require('express')
let nodeify = require('bluebird-nodeify') //to convert promise to callbacks
let morgan = require('morgan')
let mime = require('mime-types')
let rimraf = require('rimraf')

//to allow use of promise
require('songbird')

const NODE_ENV = process.env.NODE_ENV
const PORT = process.env.PORT || 8000
const ROOT_DIR = path.resolve(process.cwd())

let app = express()

//morgan runs first, then run other app.get, or actions
//depends on declear sequence
if (NODE_ENV === 'development') {
    app.use(morgan('dev'))
}

app.listen(PORT, () => console.log(`LISTENING http://localhost:${PORT}`))

/**
 *  curl -v 'http://localhost:8000/' --get
 */
app.get('*', setFileMeta, sendHeaders, (req, res) => {
    //if directory, we set it to body 
    //ToDO: improve so less hacky
    if (req.stat && req.stat.isDirectory) {
        res.json(res.body)
        return;
    }

    fs.createReadStream(req.filePath).pipe(res);
})

// curl -v http://localhost:8000/ -X HEAD
app.head('*', setFileMeta, sendHeaders, (req, res) => {
    res.end();
});


app.delete('*', setFileMeta, sendHeaders, (req, res, next) => {
    console.log(">< in delete")
    //only call next if it fails
    async() => {
        if (!req.stat) return res.status(400).send('invalid path')
        if (req.stat && req.stat.isDirectory()) {
            await rimraf.promise(req.filePath)
        } else {
            await fs.promise.unlink(req.filePath)
        }
        res.end()
    }().catch(next) //only want to call next if it fails
});

/**
 * pull the file info
 * set file path and file stat
 * @param {[type]}   req  [description]
 * @param {[type]}   res  [description]
 * @param {Function} next [description]
 */
function setFileMeta(req, res, next) {
    let filePath = path.resolve(path.join(ROOT_DIR, req.url));
    if (filePath.indexOf(ROOT_DIR) !== 0) {
        return res.status(400).send('invalid path')
    }
    req.filePath = filePath; //so you can pass via middle ware to next actions(middleware)
    console.log(">< set meta")

    // next();
    fs.promise.stat(filePath)
    //?catch errors and do nothing
    .then(
        //success
        stat => req.stat = stat,
        //error
        () => {
            req.stat = null;
        }
    )

    //bluebird promises nodeify
    //chain promise to resolve cb. 
    //nodeify will pass the results and error to next
    .nodeify(next)
}
/**
 * send headers serves as middleware
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function sendHeaders(req, res, next) {
    //convert promise back to callback
    //take this promise and connect to next callback
    //no matter error or succss, always go next
    nodeify(async() => {
        if (req.stat) {
            //TODO: handle if there is not url
            if (req.stat.isDirectory()) {
                let files = await fs.promise.readdir(req.filePath)
                res.body = JSON.stringify(files);
                res.setHeader('Content-Length', res.body.length);
                res.setHeader('Content-Type', 'application/json')
                return
            }
            //if stat is file
            else {
                let contentType = mime.contentType(path.extname(req.filePath))
                res.setHeader('Content-Length', req.stat.size)
                res.setHeader('Content-Type', contentType)
            }

        }

    }(), next);
}
// function sendHeaders(req, res, next) {
//   // send headers logic
//   console.log("middleware")
//   // req.setHeader('x-cat', 'niuniu');
//   next();
// }

// app.get('*', sendHeaders, (req, res) => {
// 	console.log(">< in get");
//    //  let file = fs.readFile(filePath, function(err, file){
// 			// res.write(file);
// 			// res.end();

//    //  });
//    //  TODO:  Support streaming video 
//     let stream = fs.createReadStream(filePath);
//     stream.on('open', function(){
//     	  stream.pipe(res);
//     })
//     stream.on('error', function(err){
//     	 res.end(err);
//     })

// });

// //curl --head http://localhost:8000
// //TODO it's always hitting get;
// app.head('*', sendHeaders, (req, res) => {
// 	console.log(">< in head")
//     let stats = fs.statSync(filePath);
//     let fileSizeInBytes = stats["size"]
//     let fileMimeType = mime.lookup(filePath);
//     // console.log("><fileSizeInBytes", fileSizeInBytes);
//     req.setHeader('Content-Length', fileSizeInBytes);
//     req.setHeader('Content-Type', 'text/plain');
//     req.end();


// 	// res.setHeader('x-cat', 'niuniu');
// });

// app.put('*', (req, res) => { 
// 	let newFilePath = process.cwd() + 'newFile';
// 	if (fs.existsSync(path)) {
//     // Do something
//        res.writeHead('405');
//        return res.end();
//     }
// 	return req.pipe(fs.createWriteStream(newFilePath));
// });

// app.post('*', (req, res) => { 
// });

// app.delete('*', (req, res) => {
//    // fs.unlink(path.join(ROOT_DIR, filePath))
// });