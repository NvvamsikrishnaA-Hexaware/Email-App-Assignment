require('dotenv').config()

const express = require('express')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const schemas = require('./schemas')
const validate = require('./validate')
const passport = require('passport')
const middleware = require('./middleware')(passport)
const fileupload = require('express-fileupload')

const app = express()
app.use(express.json())
app.use(passport.initialize())
app.use(passport.session())
app.use(fileupload())

function sortData(argData) {
    return argData.slice().sort(function (a, b) {
        var nameA = a.sentAt.toUpperCase();
        var nameB = b.sentAt.toUpperCase();
        if (nameA > nameB) {
            return -1;
        }
        if (nameA < nameB) {
            return 1;
        }
        return 0;
    })
}

app.get('/users', (req, res) => {
    try {
        const users = require('./users.json')
        res.status(200).json(users)
    }
    catch {
        res.status(503).send('Service Unavailable')
    }
})

app.post('/user/signup', validate(schemas.createUser), (req, res) => {
    try {
        var data = require('./users.json')
        var dataObj = data
        if (data.some(user => user.email === req.body.email)) {
            res.status(409).send("User already exists")
        }
        else {

            let newUser = {
                email: req.body.email,
                name: req.body.name,
                password: req.body.password
            }

            dataObj.push(newUser)

            var updatedData = JSON.stringify(dataObj)
            fs.writeFile("users.json", updatedData, (err) => {
                if (err) throw err
                console.log("Data updated")
                res.status(201).send("User Registeration Successfull")
            })
        }
    }
    catch {
        res.status(503).send('Service Unavailable')
    }
})

app.post('/user/login', validate(schemas.loginSchema), (req, res) => {
    try {
        const data = require('./users.json')
        if (data.some(user => user.email === req.body.email && user.password === req.body.password)) {
            const user = data.find(user => user.email === req.body.email)
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { algorithm: 'HS512' })
            res.cookie('jwt', accessToken, { 
                expires: new Date(Date.now() + 60000),
                httpOnly: true 
            })
            res.status(200).json({ accessToken: accessToken })
        }
        else {
            res.status(401).send("Invalid Credentials")
        }
    }
    catch (err) {
        res.status(503).send('Service Unavailable ' + err.message)
    }
})

app.get('/user/details', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const data = require('./users.json')
        res.status(200).json(data.find(user => user.email === req.user.email))
    }
    catch {
        res.status(503).send('Service Unavailable')
    }
})

app.post('/email', validate(schemas.emailSchema), passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        var data = require('./mailbox.json')
        var dataObj = data
        let to = JSON.parse(req.body.to)
        let cc, bcc
        // console.log(to)
        if(req.body.cc){
            cc = JSON.parse(req.body.cc)
        }
        // console.log(cc)
        if(req.body.bcc){
            bcc = JSON.parse(req.body.bcc)
        }
        // console.log(bcc)
        let subject = req.body.subject
        let description = req.body.description
        attachments = []
        for (var f in req.files) {
            if (!req.files[f].name) {
                for (var f1 in req.files[f]) {
                    attachments.push('http://localhost:8000/email/files/attachments?name=' + req.files[f][f1].name)
                    req.files[f][f1].mv('./uploads/' + req.files[f][f1].name, (err, result) => {
                        if (err) {
                            throw err
                        }
                    })
                }
            }
            else {
                attachments.push('http://localhost:8000/email/files/attachments?name=' + req.files[f].name)
                req.files[f].mv('./uploads/' + req.files[f].name, (err, result) => {
                    if (err) {
                        throw err
                    }
                })
            }
        }

        if (!cc) {
            cc = []
        }
        if (!bcc) {
            bcc = []
        }
        let newMail = {
            from: req.user.email,
            to: to,
            cc: cc,
            bcc: bcc,
            attachments: attachments,
            subject: subject,
            description: description,
            sentAt: (new Date()).toISOString().slice(0, 19)
        }
        dataObj.push(newMail)

        var updatedData = JSON.stringify(dataObj)
        fs.writeFile("mailbox.json", updatedData, (err) => {
            if (err) throw err
            console.log("Mail sent")
            res.status(201).send("Mail Sent Successfull")
        })
    }
    catch (err) {
        res.status(503).send('Service Unavailable ' + err.message)
    }
})

app.get('/email/inbox', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const data = require('./mailbox.json')
        let { page } = req.query
        const size = 10
        if (!page) {
            page = 1
        }
        const startIndex = (page - 1) * size
        const endIndex = page * size
        res.status(200).json(sortData(data.filter(({to, cc, bcc}) => to.some(id => id === req.user.email) || cc.some(id => id === req.user.email) || bcc.some(id => id === req.user.email))).slice(startIndex, endIndex))
    }
    catch (err) {
        res.status(503).send('Service Unavailable ' + err.message)
    }
})

app.get('/email/sentItems', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const data = require('./mailbox.json')
        let { page } = req.query
        const size = 10
        if (!page) {
            page = 1
        }
        const startIndex = (page - 1) * size
        const endIndex = page * size
        res.status(200).json(sortData(data.filter(mail => mail.from === req.user.email)).slice(startIndex, endIndex))
    }
    catch {
        res.status(503).send('Service Unavailable')
    }
})

app.get('/email/files/attachments', (req, res) => {
    try {
        res.status(200).download(__dirname + '/uploads/' + req.query.name)
    }
    catch (err) {
        res.status(503).send('Service Unavailable ' + err.message)
    }
})

app.listen(8000)