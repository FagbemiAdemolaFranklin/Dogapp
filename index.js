require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const https = require("https");
const fs = require("fs");
const { json } = require("body-parser");
const { error, profile } = require("console");
const req = require('request');
const expressSession = require("express-session");
const passport = require("passport");
const Strategy = require("passport-local").Strategy;
const passportLocalMongoose = require("passport-local-mongoose");
const connectEnsureLogin = require('connect-ensure-login')
var currentUser = ""

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.set('trust proxy', 1);
app.use(expressSession({
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false,
    cookies:{
        secure:true
    }
}))

app.use(passport.initialize());
app.use(passport.session());
main().catch((err) => console.log(err));
async function main() {
    try{
        await mongoose.connect(process.env.MONGO_URI);
    }catch(error){
        console.log(error);
    }
   
    // dob means date of birth


    const createAccountSchema = new mongoose.Schema({
        firstname: {
            type: String,
            required: true
        },
        lastname: {
            type: String,
            required: true 
        },
        username: {
            type: String,
            required:true
        },
        password: {
            type : String
        },
        dob: {
            type: Date,
            required: true},
        sex: {
            type: String,
            required:true
        },
        email:{
            type:String
        },
        likedPictures: [{type: String}],
        postedPictures: [{type: Buffer}] 
    })

    createAccountSchema.plugin(passportLocalMongoose);

    const createAccount = new mongoose.model("createAccount", createAccountSchema)

    const logInSchema = new mongoose.Schema({
        username:{
            type:String
        },
        password: {
            type:String,
        }
    })
    logInSchema.plugin(passportLocalMongoose);
    const logIn = new mongoose.model("logIn", logInSchema)

    passport.use(logIn.createStrategy());
    passport.serializeUser(function(user, done){
        done(null, user);
    })
    passport.deserializeUser(function(user, done){
        done(null, user);
    });



    app.get("/", function(request, response){
        response.render("homepage");
    })
    
    app.get("/check", connectEnsureLogin.ensureLoggedIn("/signIn"),  async function(request, response){
        try{
            var options = {
                headers: {
                    'X-Api-Key':process.env.KEYS
                }
            }
            var protectiveness = Math.floor(Math.random()*5)+1
            if(request.isAuthenticated){
                https.get(`https://api.api-ninjas.com/v1/dogs?protectiveness=${protectiveness}`, options, function(res){
                res.on("data", function(data){
                    const answers = JSON.parse(data);
                    console.log(answers)
                    response.render("check", {resulter:answers})
                });
            })
            }else if(request.session.user === null){
                response.redirect("/signIn");
            }
        }catch(error){
            console.log(error);
        }
        
    })

    app.post("/check", async function(request, response){

        try{
            const buttonSearch = request.body.searcher;
            const dogSearch = request.body.search;
            const likedPicture = request.body.love
    
            var options = {
                headers: {
                    'X-Api-Key':process.env.KEYS
                }
    
            }
            
            if(dogSearch) {
                console.log(dogSearch)
                https.get('https://api.api-ninjas.com/v1/dogs?name=' + dogSearch, options, function(res) {
                res.on("data", function(data){
                    const answers = JSON.parse(data);
                    response.render("check", {resulter:answers})
                })
                })
    
            }else if(likedPicture){
                await createAccount.findOneAndUpdate({username:currentUser}, {$addToSet:{"likedPictures":likedPicture}})
                .then(function(){
                    response.redirect("/liked");
                    console.log("succesfull!!");
                    
                }).catch(function(err){
                    console.log(err);
                })
            }
        }catch(error){
            console.log(error);
        }

    })

    app.get("/log", function(request, response){
        try{
            request.logout(function(err){
                if(err){
                    console.log(err)
                }else{
                    console.log("Logged Out!")
                    response.redirect("/");
                }
            });
        }catch(error){
            console.log(error);
        }
        
        
    })

    app.get("/profile", async function(request, response){
        try{
           await createAccount.find({username:currentUser})
        .then(function(results){
            response.render("profile", {profileResult:results})
        }).catch(function(err){
            console.log(err)
            
        })
        }catch(error){
            console.log(error)
            response.redirect("/signIn")
        }
        
    })

    app.get("/liked", async function(request, response){
        try{
            await createAccount.find({username:currentUser})
            .then(function(results){
                results.forEach(function(post){
                    const foundResult = post.likedPictures;
                    response.render("liked", {resulter:foundResult});
                })
                
            })
        }catch(error){
            console.log(error);
        }
       
    })

    app.post("/liked", async function(request, response){
        
        var Delete = request.body.delete;
        await createAccount.findOneAndUpdate({username:currentUser}, {$pull:{"likedPictures":Delete}}).then(
            response.redirect("/liked")
        )
    })
    
    app.get("/signIn", async function(request, response){
        try{
            response.render("login")
        }catch(error){
            console.log(error);
        }
       
    })

    app.post("/signIn", async function(request, response){
        try{
            const enteredUsername = request.body.username;
            const enteredPassword = request.body.password;
            currentUser = enteredUsername;
            console.log(currentUser)
            const user = new logIn({
                username:enteredUsername,
                password:enteredPassword
            });

            request.login(user, function(err){
                if (err) {
                    console.log("Failed");
                }else{
                    passport.authenticate('local',{failureRedirect:"/signIn", failureFlash:true}) (request, response, function(err){
                        if(err){
                            console.log("Failed");
                            const body = "username or password is incorrect"
                            response
                            .writeHead(401, {
                                'Content-Length': Buffer.byteLength(body),
                                'Content-Type': 'text/plain'
                            })
                            .end(body);
                        }else{
                            response.redirect('/check');
                        }
                    
                    })
                }
            })
        }catch(error){
            console.log(error);
        }
        
       
    })
    
    app.get("/create-account", function(request, response){
        try{
            response.render("create");
        }catch(error){
            console.log(error);
        }
        
    })
    
    app.post("/create-account", async function(request, response){
        try{
            const {firstname,lastname,email, password1,sex,dob,username} = request.body;

            const createUser = await new createAccount ({
                firstname:firstname,
                lastname:lastname,
                email:email,
                sex:sex,
                dob:dob,
                username:username
            });

            createUser.save();

            await logIn.register ({username:username},password1, function(err){
                    if(err){
                        const body = "username is already taken"
                        response
                        .writeHead(401, {
                            'Content-Length': Buffer.byteLength(body),
                            'Content-Type': 'text/plain'
                        })
                        .end(body);
        
                    }else{
                        response.redirect("/signIn");   
                    }
                });
        }catch(error){
            console.log(error);
        }
               
    });

    app.get("/about", function(request, response){
        try{
            response.render("about");
        }catch(error){
            console.log(error);
        }
        
    })
    
    app.listen(process.env.PORT || 800 , function(){
        console.log("Listening on 800");
    })

}

